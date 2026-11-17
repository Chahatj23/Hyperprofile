import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { webhookInbox, type Db } from "@hyperprofile/db";
import { safeEqual, verifyWebhookSignature } from "@hyperprofile/meta";
import { logger } from "@hyperprofile/shared";
import { processIncomingDmMessage } from "../autodm/conversation.js";

export type InstagramWebhookDeps = {
  db: Db;
  appSecret: string;
  verifyToken: string;
  /** After inbox insert: claim + enqueue (step 4). */
  onPayload?: (body: WebhookBody) => Promise<void>;
};

type WebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{ field?: string; value?: { id?: string } }>;
    messaging?: Array<{ sender?: { id?: string }; timestamp?: number }>;
  }>;
};

/** Stable event id for idempotent inbox insert (never index entry[0] only). */
export function deriveWebhookEventIds(body: WebhookBody, raw: Buffer): string[] {
  const ids = new Set<string>();
  for (const entry of body.entry ?? []) {
    for (const ch of entry.changes ?? []) {
      const commentId = ch.value?.id;
      if (ch.field && commentId) {
        ids.add(`${ch.field}:${commentId}`);
      } else if (ch.field && entry.id && entry.time != null) {
        ids.add(`${ch.field}:${entry.id}:${entry.time}`);
      }
    }
    for (const msg of entry.messaging ?? []) {
      const sid = msg.sender?.id ?? "unknown";
      const ts = msg.timestamp ?? entry.time ?? 0;
      ids.add(`messaging:${entry.id ?? "x"}:${sid}:${ts}`);
    }
  }
  if (ids.size === 0) {
    ids.add(`raw:${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`);
  }
  return [...ids];
}

const dailyWebhookCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Section 7: Per-account daily webhook cap (5,000 webhooks / day)
 * Protects Google Cloud Run free tier (2M requests/month allowance) from runaway viral Reel storms.
 */
export function checkDailyWebhookAllowance(igUserId: string, dailyCap = 5000): boolean {
  const now = Date.now();
  const entry = dailyWebhookCounts.get(igUserId);
  if (!entry || entry.resetAt <= now) {
    dailyWebhookCounts.set(igUserId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= dailyCap) {
    return false;
  }
  entry.count++;
  return true;
}

export function createInstagramWebhookHandlers(deps: InstagramWebhookDeps) {
  async function verifyGet(req: FastifyRequest, reply: FastifyReply) {
    const q = req.query as {
      "hub.mode"?: string;
      "hub.verify_token"?: string;
      "hub.challenge"?: string;
    };
    if (
      q["hub.mode"] === "subscribe" &&
      safeEqual(String(q["hub.verify_token"] ?? ""), deps.verifyToken)
    ) {
      return reply.code(200).type("text/plain").send(String(q["hub.challenge"] ?? ""));
    }
    return reply.code(403).send("Forbidden");
  }

  async function receivePost(req: FastifyRequest, reply: FastifyReply) {
    const raw = (req as FastifyRequest & { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
    const signature = req.headers["x-hub-signature-256"] as string | undefined;

    if (!verifyWebhookSignature(raw, signature, deps.appSecret)) {
      logger.error("instagram webhook signature mismatch");
      // 200 on purpose: retrying the same bytes cannot help
      return reply.code(200).send("ok");
    }

    try {
      const body = (req.body ?? {}) as WebhookBody;
      if (body.object !== "instagram" && body.object !== "page") {
        logger.warn("instagram webhook ignored object", { object: body.object });
        return reply.code(200).send("ok");
      }

      const eventIds = deriveWebhookEventIds(body, raw);
      const rawText = raw.toString("utf8");

      for (const eventId of eventIds) {
        deps.db
          .insert(webhookInbox)
          .values({
            provider: "instagram",
            eventId,
            rawBody: rawText,
          })
          .onConflictDoNothing()
          .catch((err) => {
            logger.warn("webhook inbox insert warning", {
              eventId,
              err: err instanceof Error ? err.message : String(err),
            });
          });
      }

      // Check daily webhook cap per account to protect Cloud Run limits
      let isThrottled = false;
      for (const entry of body.entry ?? []) {
        if (entry.id && !checkDailyWebhookAllowance(entry.id)) {
          logger.warn("[WEBHOOK_THROTTLE] Daily webhook limit (5,000) reached for account, skipping payload processing", {
            igUserId: entry.id,
          });
          isThrottled = true;
          break;
        }
      }

      if (!isThrottled && deps.onPayload) {
        // Zero-Cost Invariant: Await processing inside incoming request budget before replying
        // so Google Cloud Run does not throttle CPU post-response.
        await deps.onPayload(body);
      }

      // Conversational Instagram DM Processing (SuperProfile Follower Gate & DM Lead Capture)
      if (!isThrottled) {
        for (const entry of body.entry ?? []) {
          const igUserId = entry.id;
          if (!igUserId) continue;

          for (const msg of entry.messaging ?? []) {
            const senderId = msg.sender?.id;
            const text = (msg as any).message?.text;
            if (senderId && text) {
              await processIncomingDmMessage(deps.db, {
                igUserId,
                senderId,
                text,
                messageId: (msg as any).message?.mid,
              });
            }
          }

          for (const ch of entry.changes ?? []) {
            if (ch.field === "messages") {
              const val = ch.value as any;
              const senderId = val?.from?.id;
              const senderUsername = val?.from?.username;
              const text = val?.text || val?.message;
              if (senderId && text) {
                await processIncomingDmMessage(deps.db, {
                  igUserId,
                  senderId,
                  senderUsername,
                  text,
                  messageId: val?.id,
                });
              }
            }
          }
        }
      }

      logger.info("instagram webhook stored", {
        events: eventIds.length,
        entries: body.entry?.length ?? 0,
      });
    } catch (err) {
      logger.error("instagram webhook handler error", {
        err: err instanceof Error ? err.message : String(err),
      });
    } finally {
      // Always reply 200 to acknowledge Meta delivery
      reply.code(200).send("ok");
    }
  }

  return { verifyGet, receivePost };
}
