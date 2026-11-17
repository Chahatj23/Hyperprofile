import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import {
  automationEvents,
  dailyRollups,
  igAccounts,
  jobQueueTable,
  orders,
  pageEvents,
  webhookInbox,
  PostgresJobQueue,
  type Db,
} from "@hyperprofile/db";
import { MetaError, sendPrivateReply, sendPublicCommentReply } from "@hyperprofile/meta";
import { decryptAesGcm, logger } from "@hyperprofile/shared";
import { refreshDueTokens } from "../autodm/token-refresh.js";
import { recordActivity } from "../autodm/activity-store.js";

export interface JobRoutesOptions {
  db: Db;
  cronSecret: string;
  appId: string;
  appSecret: string;
  tokenEncryptionKey: string;
  metaGraphVersion: string;
}

export interface ReplyJobPayload extends Record<string, unknown> {
  igUserId: string;
  commentId: string;
  username: string;
  text: string;
  publicReply?: string | null;
  receivedAt: number;
}

/**
 * Constant-time authentication verification for Cloudflare Cron Triggers.
 * Supports:
 * 1. Bearer Token in Authorization header: `Bearer <CRON_SECRET>`
 * 2. HMAC-SHA256 signature in `X-Cron-Signature` or `X-Signature` header: `sha256=<hex>`
 */
export function verifyCronAuth(req: FastifyRequest, secret: string): boolean {
  if (!secret) return false;

  // 1. Bearer Token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (
      token.length === secret.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))
    ) {
      return true;
    }
  }

  // 2. HMAC-SHA256 Signature
  const sigHeader =
    (req.headers["x-cron-signature"] as string | undefined) ??
    (req.headers["x-signature"] as string | undefined);

  if (sigHeader) {
    const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody ?? Buffer.from("");
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const received = sigHeader.startsWith("sha256=") ? sigHeader.slice(7) : sigHeader;

    if (
      received.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))
    ) {
      return true;
    }
  }

  return false;
}

export function registerJobRoutes(app: FastifyInstance, options: JobRoutesOptions) {
  const { db, cronSecret, appId, appSecret, tokenEncryptionKey, metaGraphVersion } = options;
  const queue = new PostgresJobQueue(db);

  // Middleware auth guard for /v1/jobs/*
  async function guardCron(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    if (!verifyCronAuth(req, cronSecret)) {
      reply.code(401).send({
        code: "unauthorized",
        message: "Invalid or missing cron authentication signature/token",
      });
      return false;
    }
    return true;
  }

  /**
   * 1. Drain AutoDM Queue
   * Cloudflare Cron Trigger endpoint (every 30 mins) to process deferred / retrying DMs
   * without keeping background polling workers running continuously in Node.
   */
  app.post("/v1/jobs/drain-autodm", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await guardCron(req, reply))) return;

    if (process.env.PAUSE_AUTODM === "true") {
      logger.info("drain-autodm job skipped: PAUSE_AUTODM kill switch is active");
      return { ok: true, status: "paused", message: "AutoDM paused via PAUSE_AUTODM kill switch", processed: 0 };
    }

    const query = req.query as { limit?: string };
    const batchSize = Math.min(100, Math.max(1, parseInt(query.limit ?? "20", 10) || 20));

    const claimed = await queue.claimNext<ReplyJobPayload>("autodm", batchSize);
    let completed = 0;
    let deferred = 0;
    let failed = 0;

    for (const job of claimed) {
      const payload = job.payload;
      if (!payload?.igUserId || !payload?.commentId) {
        await queue.complete(job.id);
        continue;
      }

      // Check 700 / hour send cap in Postgres
      const sentLastHour = await queue.countSentInLastHour(payload.igUserId);
      if (sentLastHour >= 700) {
        await queue.fail(job.id, "Hourly send limit (700) reached", 15 * 60 * 1000);
        deferred++;
        continue;
      }

      // Simulated comments
      if (payload.commentId.startsWith("test_comment_")) {
        recordActivity({
          type: "autodm",
          title: `AutoDM Delivered to @${payload.username || "user"}`,
          description: `Delivered private reply: "${payload.text.slice(0, 100)}..."`,
          status: "delivered",
          badge: "Meta AutoDM Delivered",
          actor: `@${payload.username || "user"}`,
          meta: { commentId: payload.commentId, test: true },
        });
        await queue.complete(job.id);
        completed++;
        continue;
      }

      // Resolve encrypted token from DB
      let tokenEncrypted: string | null = null;
      try {
        const acct = (
          await db
            .select()
            .from(igAccounts)
            .where(eq(igAccounts.igUserId, payload.igUserId))
            .limit(1)
        )[0];
        if (acct?.accessTokenEncrypted && !acct.reauthRequiredAt) {
          tokenEncrypted = acct.accessTokenEncrypted;
        }
      } catch (err) {
        logger.warn("drain-autodm db token query warning", {
          err: err instanceof Error ? err.message : String(err),
        });
      }

      if (!tokenEncrypted) {
        await queue.complete(job.id);
        failed++;
        continue;
      }

      try {
        const token = decryptAesGcm(tokenEncrypted, tokenEncryptionKey);

        // 1. Send Private Reply
        const result = await sendPrivateReply(payload.igUserId, token, payload.commentId, payload.text, {
          graphVersion: metaGraphVersion,
        });

        // 2. Send Public Comment Reply if configured
        if (payload.publicReply && payload.publicReply.trim().length > 0) {
          try {
            await sendPublicCommentReply(payload.commentId, token, payload.publicReply.trim(), {
              graphVersion: metaGraphVersion,
            });
          } catch (pubErr) {
            logger.warn("drain-autodm public reply non-fatal warning", {
              commentId: payload.commentId,
              err: pubErr instanceof Error ? pubErr.message : String(pubErr),
            });
          }
        }

        // Update automationEvents
        try {
          await db
            .update(automationEvents)
            .set({
              status: "sent",
              messageId: result.message_id,
              updatedAt: new Date(),
            })
            .where(eq(automationEvents.commentId, payload.commentId));
        } catch {
          // ignore
        }

        recordActivity({
          type: "autodm",
          title: `AutoDM Delivered to @${payload.username || "user"}`,
          description: `Delivered private reply: "${payload.text.slice(0, 100)}..."`,
          status: "delivered",
          badge: "Meta AutoDM Delivered",
          actor: `@${payload.username || "user"}`,
          meta: { commentId: payload.commentId, messageId: result.message_id },
        });

        await queue.complete(job.id);
        completed++;
      } catch (e) {
        if (e instanceof MetaError) {
          if (e.kind === "rate") {
            await queue.fail(job.id, "rate_limited", 5 * 60 * 1000);
            deferred++;
          } else if (e.kind === "token") {
            await db
              .update(igAccounts)
              .set({ reauthRequiredAt: new Date(), updatedAt: new Date() })
              .where(eq(igAccounts.igUserId, payload.igUserId));
            await queue.complete(job.id);
            failed++;
          } else {
            await queue.fail(job.id, `${e.kind}: ${e.message}`, 30_000);
            failed++;
          }
        } else {
          const errMsg = e instanceof Error ? e.message : String(e);
          await queue.fail(job.id, errMsg, 30_000);
          failed++;
        }
      }
    }

    return {
      ok: true,
      processed: claimed.length,
      completed,
      deferred,
      failed,
    };
  });

  /**
   * 2. Refresh Expiring Tokens
   * Cloudflare Cron Trigger endpoint (daily cron) to refresh tokens expiring within 3 days.
   */
  app.post("/v1/jobs/refresh-tokens", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await guardCron(req, reply))) return;

    const result = await refreshDueTokens({
      db,
      appId,
      appSecret,
      tokenEncryptionKey,
      graphVersion: metaGraphVersion,
      refreshWithinMs: 3 * 24 * 60 * 60 * 1000,
    });

    return {
      ok: true,
      ...result,
    };
  });

  /**
   * 3. Cleanup & Storage Retention
   * Cloudflare Cron Trigger endpoint (daily cron) to:
   * - Roll up raw page_events older than 24h into daily_rollups table
   * - Drop raw page_events older than 30 days
   * - Drop webhook_inbox older than 14 days
   * - Drop completed/failed job_queue older than 7 days
   * Ensures database stays strictly within the 400 MB Neon free-tier budget.
   */
  app.post("/v1/jobs/cleanup-retention", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await guardCron(req, reply))) return;

    let rollupsProcessed = 0;
    let rawEventsPurged = 0;
    let webhooksPurged = 0;
    let jobsPurged = 0;

    // 1. Roll up page_events older than 24 hours into daily_rollups
    try {
      const rollupResult = await db.execute(sql`
        INSERT INTO ${dailyRollups} (id, creator_id, date, page_views, link_clicks, lead_submits, checkouts, created_at, updated_at)
        SELECT
          gen_random_uuid(),
          creator_id,
          to_char(created_at, 'YYYY-MM-DD') AS date,
          count(*) FILTER (WHERE event_type = 'page_view')::int AS page_views,
          count(*) FILTER (WHERE event_type = 'link_click')::int AS link_clicks,
          count(*) FILTER (WHERE event_type = 'lead_submit')::int AS lead_submits,
          count(*) FILTER (WHERE event_type = 'checkout')::int AS checkouts,
          NOW(),
          NOW()
        FROM ${pageEvents}
        WHERE created_at < NOW() - INTERVAL '1 day'
        GROUP BY creator_id, to_char(created_at, 'YYYY-MM-DD')
        ON CONFLICT (creator_id, date) DO UPDATE SET
          page_views = daily_rollups.page_views + EXCLUDED.page_views,
          link_clicks = daily_rollups.link_clicks + EXCLUDED.link_clicks,
          lead_submits = daily_rollups.lead_submits + EXCLUDED.lead_submits,
          checkouts = daily_rollups.checkouts + EXCLUDED.checkouts,
          updated_at = NOW();
      `);
      rollupsProcessed = Array.isArray(rollupResult) ? rollupResult.length : 1;
    } catch (err) {
      logger.warn("cleanup-retention rollup query warning", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 2. Drop raw page_events older than 30 days
    try {
      const deletedEvents = await db.execute(sql`
        DELETE FROM ${pageEvents}
        WHERE created_at < NOW() - INTERVAL '30 days';
      `);
      rawEventsPurged = Array.isArray(deletedEvents) ? deletedEvents.length : 0;
    } catch (err) {
      logger.warn("cleanup-retention pageEvents purge warning", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 3. Drop webhook_inbox older than 14 days
    try {
      const deletedWebhooks = await db.execute(sql`
        DELETE FROM ${webhookInbox}
        WHERE received_at < NOW() - INTERVAL '14 days';
      `);
      webhooksPurged = Array.isArray(deletedWebhooks) ? deletedWebhooks.length : 0;
    } catch (err) {
      logger.warn("cleanup-retention webhookInbox purge warning", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // 4. Drop completed/failed job_queue older than 7 days
    try {
      const deletedJobs = await db.execute(sql`
        DELETE FROM ${jobQueueTable}
        WHERE (status = 'completed' OR status = 'failed')
          AND updated_at < NOW() - INTERVAL '7 days';
      `);
      jobsPurged = Array.isArray(deletedJobs) ? deletedJobs.length : 0;
    } catch (err) {
      logger.warn("cleanup-retention jobQueue purge warning", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("cleanup-retention job completed", {
      rollupsProcessed,
      rawEventsPurged,
      webhooksPurged,
      jobsPurged,
    });

    return {
      ok: true,
      rollupsProcessed,
      rawEventsPurged,
      webhooksPurged,
      jobsPurged,
    };
  });

  /**
   * 4. Usage & Budget Report
   * Cloudflare Cron Trigger / Monitoring endpoint to inspect DB storage usage,
   * verify safety against the 400 MB Neon cap, and emit alerts at 70% threshold (280 MB).
   */
  const handleUsageReport = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await guardCron(req, reply))) return;

    const quotaBytes = 400 * 1024 * 1024; // 400 MB
    const alertThresholdBytes = 0.7 * quotaBytes; // 280 MB

    let dbSizeBytes: number | null = null;
    try {
      const sizeResult = (await db.execute<{ size: string }>(sql`
        SELECT pg_database_size(current_database())::text AS size;
      `)) as unknown as Array<{ size: string }>;
      if (sizeResult && sizeResult[0]?.size) {
        dbSizeBytes = parseInt(sizeResult[0].size, 10);
      }
    } catch {
      // Not a real Postgres instance or mock DB
    }

    // Count rows across primary data tables
    let pageEventsCount = 0;
    let automationEventsCount = 0;
    let webhookInboxCount = 0;
    let ordersCount = 0;
    let jobQueueCount = 0;

    try {
      const pe = (await db.select({ count: sql<number>`count(*)::int` }).from(pageEvents))[0];
      pageEventsCount = pe?.count ?? 0;
    } catch {
      // ignore
    }

    try {
      const ae = (await db.select({ count: sql<number>`count(*)::int` }).from(automationEvents))[0];
      automationEventsCount = ae?.count ?? 0;
    } catch {
      // ignore
    }

    try {
      const wi = (await db.select({ count: sql<number>`count(*)::int` }).from(webhookInbox))[0];
      webhookInboxCount = wi?.count ?? 0;
    } catch {
      // ignore
    }

    try {
      const ord = (await db.select({ count: sql<number>`count(*)::int` }).from(orders))[0];
      ordersCount = ord?.count ?? 0;
    } catch {
      // ignore
    }

    try {
      const jq = (await db.select({ count: sql<number>`count(*)::int` }).from(jobQueueTable))[0];
      jobQueueCount = jq?.count ?? 0;
    } catch {
      // ignore
    }

    // Heuristic estimation if pg_database_size is not supported
    const estimatedBytes =
      dbSizeBytes ??
      (pageEventsCount * 600 +
        automationEventsCount * 800 +
        webhookInboxCount * 1200 +
        ordersCount * 1000 +
        jobQueueCount * 500 +
        50 * 1024 * 1024); // 50 MB base catalog overhead

    const percentUsed = Number(((estimatedBytes / quotaBytes) * 100).toFixed(2));
    const alertTriggered = estimatedBytes >= alertThresholdBytes;

    if (alertTriggered) {
      logger.warn("[STORAGE_ALERT] Neon Postgres database storage exceeds 70% of free-tier quota (400 MB)!", {
        estimatedBytes,
        quotaBytes,
        percentUsed,
      });
    }

    return {
      ok: true,
      storage: {
        estimatedBytes,
        quotaBytes,
        percentUsed,
        alertTriggered,
        exactPgSize: dbSizeBytes != null,
      },
      counts: {
        pageEvents: pageEventsCount,
        automationEvents: automationEventsCount,
        webhookInbox: webhookInboxCount,
        orders: ordersCount,
        jobQueue: jobQueueCount,
      },
      killSwitches: {
        pauseAutoDm: process.env.PAUSE_AUTODM === "true",
        pauseSignups: process.env.PAUSE_SIGNUPS === "true",
        pauseCheckout: process.env.PAUSE_CHECKOUT === "true",
      },
    };
  };

  app.get("/v1/jobs/usage-report", handleUsageReport);
  app.post("/v1/jobs/usage-report", handleUsageReport);
}
