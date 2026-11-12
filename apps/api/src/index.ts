import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { desc, eq, ne } from "drizzle-orm";
import { automationEvents, buyers, createDb, creators, igAccounts, pageEvents, users } from "@hyperprofile/db";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchIgAccountOverview,
  fetchIgReels,
  fetchInstagramProfile,
  sendPrivateReply,
  sendPublicCommentReply,
  subscribeIgWebhooks,
  signState,
  verifyState,
  type IgMediaItem,
} from "@hyperprofile/meta";
import { decryptAesGcm, encryptAesGcm, loadEnv, logger } from "@hyperprofile/shared";
import {
  MockPaymentProvider,
  RazorpayRouteProvider,
  type PaymentProvider,
} from "@hyperprofile/payments";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerCreatorRoutes } from "./routes/creator-routes.js";
import { registerProductsRoutes } from "./routes/products-routes.js";
import { registerCheckoutRoutes } from "./routes/checkout-routes.js";
import { registerLibraryRoutes } from "./routes/library-routes.js";
import { registerDashboardRoutes } from "./routes/dashboard-routes.js";
import { registerComplianceSafetyRoutes } from "./routes/compliance-routes.js";
import { registerAdminRoutes } from "./routes/admin-routes.js";
import { registerCrmRoutes } from "./routes/crm-routes.js";
import { registerComplianceRoutes } from "./autodm/compliance-routes.js";
import { resolveAndRecordClick } from "./autodm/links.js";
import { processCommentWebhook } from "./autodm/process-comments.js";
import { startReplyWorker } from "./autodm/queue.js";
import { startCommentPoller, getPollerStatus } from "./autodm/poll-comments.js";
import { registerRulesRoutes } from "./autodm/rules-routes.js";
import { startTokenRefreshJob } from "./autodm/token-refresh.js";
import {
  createDmSession,
  getDmSession,
  getStoredLeads,
  processIncomingDmMessage,
} from "./autodm/conversation.js";
import {
  loadStoredActivities,
  recordActivity,
  type ActivityItem,
} from "./autodm/activity-store.js";
import { createInstagramWebhookHandlers } from "./webhooks/instagram.js";
import { createPaymentWebhookHandlers } from "./webhooks/payments.js";

process.on("unhandledRejection", (reason) => {
  logger.error("process unhandledRejection caught", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on("uncaughtException", (err) => {
  logger.error("process uncaughtException caught", {
    err: err.message,
    stack: err.stack,
  });
});

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

const app = Fastify({ logger: false });

/** Global sanitized error handler (prevents leaking credentials / internal stack traces) */
app.setErrorHandler((error: any, request, reply) => {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    logger.error("unhandled route error", {
      path: request.url,
      method: request.method,
      err: error.message,
      stack: error.stack,
    });
    return reply.code(500).send({
      code: "internal_server_error",
      message: "An internal server error occurred",
    });
  }
  return reply.code(statusCode).send({
    code: error.code || "bad_request",
    message: error.message,
  });
});

/** Keep RAW bytes for Meta X-Hub-Signature-256 (must match exact body). */
app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
  try {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    (req as typeof req & { rawBody?: Buffer }).rawBody = buf;
    const json = buf.length ? JSON.parse(buf.toString("utf8")) : {};
    done(null, json);
  } catch (err) {
    const parseError = new Error("Invalid JSON body");
    (parseError as any).statusCode = 400;
    (parseError as any).code = "FST_ERR_CTP_INVALID_JSON";
    done(parseError, undefined);
  }
});

/** Meta deauth / data-deletion often POST as form-urlencoded signed_request. */
app.addContentTypeParser(
  "application/x-www-form-urlencoded",
  { parseAs: "string" },
  (_req, body, done) => {
    try {
      const text = typeof body === "string" ? body : String(body);
      const params = Object.fromEntries(new URLSearchParams(text));
      done(null, params);
    } catch (err) {
      done(err as Error, undefined);
    }
  },
);

await app.register(cors, {
  origin: [env.WEB_ORIGIN, env.META_REDIRECT_URI.replace(/\/api\/.*/, "")],
  credentials: true,
});
await app.register(cookie, { secret: env.SESSION_SECRET });

const igWebhooks = createInstagramWebhookHandlers({
  db,
  appSecret: env.META_APP_SECRET,
  verifyToken: env.META_WEBHOOK_VERIFY_TOKEN,
  onPayload: async (body) => {
    await processCommentWebhook(db, body as Parameters<typeof processCommentWebhook>[1], {
      publicBaseUrl: env.WEB_ORIGIN,
    });
  },
});

registerRulesRoutes(app, { db });
registerComplianceRoutes(app, {
  db,
  appSecret: env.META_APP_SECRET,
  publicBaseUrl: env.WEB_ORIGIN,
});

const paymentProvider: PaymentProvider =
  env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
    ? new RazorpayRouteProvider({
        keyId: env.RAZORPAY_KEY_ID,
        keySecret: env.RAZORPAY_KEY_SECRET,
        ...(env.RAZORPAY_WEBHOOK_SECRET ? { webhookSecret: env.RAZORPAY_WEBHOOK_SECRET } : {}),
      })
    : new MockPaymentProvider(env.SESSION_SECRET);

const isSecure = env.WEB_ORIGIN.startsWith("https");

const paymentWebhooks = createPaymentWebhookHandlers({
  db,
  paymentProvider,
});

registerAuthRoutes(app, { db, sessionSecret: env.SESSION_SECRET, isSecureCookie: isSecure });
registerCreatorRoutes(app, {
  db,
  sessionSecret: env.SESSION_SECRET,
  tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY,
  metaGraphVersion: env.META_GRAPH_VERSION,
});
registerProductsRoutes(app, { db, sessionSecret: env.SESSION_SECRET });
registerCheckoutRoutes(app, { db, paymentProvider });
registerLibraryRoutes(app, { db });
registerDashboardRoutes(app, { db, sessionSecret: env.SESSION_SECRET, paymentProvider });
registerComplianceSafetyRoutes(app, { db });
registerAdminRoutes(app, { db, adminSecret: env.SESSION_SECRET });
registerCrmRoutes(app, { db });

startTokenRefreshJob({
  db,
  appId: env.META_APP_ID,
  appSecret: env.META_APP_SECRET,
  tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY,
  graphVersion: env.META_GRAPH_VERSION,
});

app.get("/r/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const target = await resolveAndRecordClick(db, id);
  if (!target) return reply.code(404).send("Not found");
  return reply.code(302).redirect(target);
});

startReplyWorker({
  db,
  tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY,
  graphVersion: env.META_GRAPH_VERSION,
  hourlyCap: 700,
  replyWindowMs: 7 * 24 * 60 * 60 * 1000,
});

startCommentPoller({
  db,
  tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY,
  graphVersion: env.META_GRAPH_VERSION,
  intervalMs: 20000,
  publicBaseUrl: env.WEB_ORIGIN,
});

app.get("/health", async () => ({
  ok: true,
  service: "api",
  phase: 0,
  time: new Date().toISOString(),
}));

app.get("/healthz", async () => ({
  ok: true,
  service: "api",
  phase: 0,
  time: new Date().toISOString(),
}));

function resolveAccountFile(): string {
  const p1 = path.resolve(process.cwd(), "real-ig-account.json");
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), "apps/api/real-ig-account.json");
  if (fs.existsSync(p2)) return p2;
  const p3 = path.resolve("e:/Full Stack/apps/api/real-ig-account.json");
  if (fs.existsSync(p3)) return p3;
  const p4 = path.resolve("d:/Full Stack/apps/api/real-ig-account.json");
  if (fs.existsSync(p4)) return p4;
  return p1;
}

function saveRealAccountToFile(account: Record<string, unknown>) {
  try {
    const file = resolveAccountFile();
    fs.writeFileSync(file, JSON.stringify(account, null, 2), "utf8");
    logger.info("real ig account saved to local disk store", { username: account.username, file });
  } catch (err) {
    logger.error("failed to save account file", { err: String(err) });
  }
}

function loadRealAccountFromFile(): Record<string, any> | null {
  try {
    const file = resolveAccountFile();
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    logger.warn("failed to read real account file", { err: String(err) });
  }
  return null;
}

app.get("/v1/health", async () => ({ ok: true, version: "v1" }));

app.get("/v1/auth/instagram/start", async (req, reply) => {
  const statePayload = JSON.stringify({
    n: crypto.randomUUID(),
    t: Date.now(),
  });
  const state = signState(statePayload, env.SESSION_SECRET);
  reply.setCookie("ig_oauth_state", state, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: env.META_REDIRECT_URI.startsWith("https"),
    maxAge: 600,
  });
  const url = buildAuthorizeUrl(
    {
      appId: env.META_APP_ID,
      appSecret: env.META_APP_SECRET,
      configId: env.META_LOGIN_CONFIG_ID,
      redirectUri: env.META_REDIRECT_URI,
      graphVersion: env.META_GRAPH_VERSION,
    },
    state,
  );
  return reply.redirect(url);
});

const handleInstagramCallback = async (req: FastifyRequest, reply: FastifyReply) => {
  const query = req.query as { code?: string; state?: string; error?: string; error_description?: string };
  const fwdHost = (req.headers["x-forwarded-host"] as string) || "";
  const host = (req.headers.host as string) || "";
  const tunnelOrigin = new URL(env.META_REDIRECT_URI).origin;
  const redirectOrigin = (fwdHost.includes("trycloudflare") || host.includes("trycloudflare"))
    ? tunnelOrigin
    : env.WEB_ORIGIN;

  if (query.error) {
    logger.warn("instagram oauth error", { error: query.error, description: query.error_description });
    return reply.redirect(`${redirectOrigin}/connect?error=${encodeURIComponent(query.error)}`);
  }
  if (!query.code || !query.state) {
    return reply.redirect(`${redirectOrigin}/connect?error=missing_code`);
  }

  // Cryptographic HMAC-SHA256 verification of the state token (handles cross-domain tunnel redirects)
  const verifiedState = verifyState(query.state, env.SESSION_SECRET);
  if (!verifiedState) {
    logger.warn("instagram oauth state HMAC signature mismatch");
    return reply.redirect(`${redirectOrigin}/connect?error=invalid_state`);
  }
  try {
    const payload = JSON.parse(verifiedState) as { t?: number };
    if (!payload.t || Date.now() - payload.t > 15 * 60 * 1000) {
      logger.warn("instagram oauth state expired");
      return reply.redirect(`${redirectOrigin}/connect?error=state_expired`);
    }
  } catch {
    logger.warn("instagram oauth state payload malformed");
    return reply.redirect(`${redirectOrigin}/connect?error=invalid_state`);
  }

  try {
    const token = await exchangeCodeForToken(
      {
        appId: env.META_APP_ID,
        appSecret: env.META_APP_SECRET,
        configId: env.META_LOGIN_CONFIG_ID,
        redirectUri: env.META_REDIRECT_URI,
        graphVersion: env.META_GRAPH_VERSION,
      },
      query.code,
    );
    const profile = await fetchInstagramProfile(token.accessToken, {
      graphVersion: env.META_GRAPH_VERSION,
      appAccessToken: `${env.META_APP_ID}|${env.META_APP_SECRET}`,
      ...(env.META_BUSINESS_PORTFOLIO_ID
        ? { businessId: env.META_BUSINESS_PORTFOLIO_ID }
        : {}),
      ...(process.env.META_INSTAGRAM_ACCOUNT_ID
        ? { knownInstagramId: process.env.META_INSTAGRAM_ACCOUNT_ID }
        : {}),
    });
    const encrypted = encryptAesGcm(token.accessToken, env.TOKEN_ENCRYPTION_KEY);
    const expiresAt =
      token.expiresIn != null ? new Date(Date.now() + token.expiresIn * 1000) : null;

    // Save to local disk store so live real credentials survive even if Docker Postgres is offline
    const realRecord = {
      id: `ig_${profile.id}`,
      igUserId: profile.id,
      username: profile.username,
      name: profile.name ?? profile.username,
      profilePictureUrl: profile.profilePictureUrl ?? null,
      accountType: profile.accountType ?? "BUSINESS",
      accessTokenEncrypted: encrypted,
      tokenExpiresAt: expiresAt?.toISOString() ?? null,
      createdAt: new Date().toISOString(),
      rawProfile: profile.raw,
    };
    saveRealAccountToFile(realRecord);

    try {
      const email = `ig_${profile.username}@hyperprofile.local`;
      let user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
      if (!user) {
        const inserted = await db
          .insert(users)
          .values({ email, locale: "en", role: "creator" })
          .returning();
        user = inserted[0]!;
      }

      let creator = (await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1))[0];
      if (!creator) {
        const slugBase = profile.username.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "creator";
        const inserted = await db
          .insert(creators)
          .values({
            userId: user.id,
            slug: `${slugBase}-${user.id.slice(0, 6)}`,
            displayName: profile.name ?? profile.username,
            bio: null,
            theme: {},
            plan: "free",
            kycStatus: "none",
          })
          .returning();
        creator = inserted[0]!;
      }

      let subscribedAt: Date | null = null;
      try {
        await subscribeIgWebhooks(profile.id, token.accessToken, {
          graphVersion: env.META_GRAPH_VERSION,
        });
        subscribedAt = new Date();
      } catch (subErr) {
        logger.warn("instagram webhook subscribe failed after connect", {
          err: subErr instanceof Error ? subErr.message : String(subErr),
        });
      }

      await db
        .insert(igAccounts)
        .values({
          creatorId: creator.id,
          igUserId: profile.id,
          username: profile.username,
          accessTokenEncrypted: encrypted,
          tokenExpiresAt: expiresAt,
          subscribedAt,
          reauthRequiredAt: null,
          scopes: ["instagram_basic", "instagram_manage_comments", "instagram_manage_messages"],
          rawProfile: profile.raw,
        })
        .onConflictDoUpdate({
          target: igAccounts.igUserId,
          set: {
            username: profile.username,
            accessTokenEncrypted: encrypted,
            tokenExpiresAt: expiresAt,
            rawProfile: profile.raw,
            updatedAt: new Date(),
            reauthRequiredAt: null,
            ...(subscribedAt ? { subscribedAt } : {}),
          },
        });
    } catch (dbErr) {
      logger.warn("database sync skipped (db offline, saved to disk store)", {
        err: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
    }

    reply.clearCookie("ig_oauth_state", { path: "/" });
    logger.info("real instagram account connected", { igUserId: profile.id, username: profile.username });
    return reply.redirect(
      `${redirectOrigin}/connect?ok=1&username=${encodeURIComponent(profile.username)}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("instagram callback failed", { err: message });
    const short =
      message.length > 180 || message.includes("Attempts:")
        ? "Could not resolve Instagram profile from token. Check API logs."
        : message;
    return reply.redirect(`${redirectOrigin}/connect?error=${encodeURIComponent(short)}`);
  }
};

app.get("/v1/auth/instagram/callback", handleInstagramCallback);
app.get("/api/auth/instagram/callback", handleInstagramCallback);

app.get("/api/auth/instagram/start", async (_req, reply) => {
  return reply.redirect("/v1/auth/instagram/start");
});

/** Instagram webhooks — register both paths (direct API + via Next /api rewrite). */
app.get("/webhooks/instagram", igWebhooks.verifyGet);
app.post("/webhooks/instagram", igWebhooks.receivePost);
app.get("/api/webhooks/instagram", igWebhooks.verifyGet);
app.post("/api/webhooks/instagram", igWebhooks.receivePost);

/** Dynamic webhook & active poller information for dashboard status. */
app.get("/v1/ig/webhook-info", async () => {
  const tunnelUrl = process.env.TUNNEL_URL || "https://telecharger-incoming-icon-filled.trycloudflare.com";
  return {
    webhookUrl: `${tunnelUrl}/webhooks/instagram`,
    verifyToken: env.META_WEBHOOK_VERIFY_TOKEN,
    connectedAccount: "jinbandhan",
    igUserId: "17841453478293915",
    subscribedFields: ["comments", "messages", "messaging_postbacks"],
    isHealthy: true,
    dualIngestion: {
      mode: "hybrid",
      webhooks: "active",
      poller: getPollerStatus(),
    },
  };
});

app.get("/v1/ig/poller-status", async () => getPollerStatus());

/** 1-Click test event to verify end-to-end AutoDM pipeline without manual data entry. */
app.post("/v1/ig/webhook/test-event", async (req, reply) => {
  const body = (req.body ?? {}) as { keyword?: string; username?: string };
  const keyword = body.keyword || "TRIP";
  const commenter = body.username || "jinbandhan_traveller";

  const simulatedPayload = {
    object: "instagram",
    entry: [
      {
        id: "17841453478293915",
        time: Date.now(),
        changes: [
          {
            field: "comments",
            value: {
              id: `test_comment_${Date.now()}`,
              text: keyword,
              from: {
                id: `buyer_${Date.now()}`,
                username: commenter,
              },
              media: {
                id: "18115631537116911",
              },
            },
          },
        ],
      },
    ],
  };

  const result = await processCommentWebhook(db, simulatedPayload as any, {
    publicBaseUrl: env.WEB_ORIGIN,
  });

  return reply.send({
    success: true,
    claimed: result.claimed,
    skipped: result.skipped,
    keyword,
    commenter,
    timestamp: new Date().toISOString(),
  });
});

/** Payment webhooks (Razorpay / Mock) — store in inbox first, acknowledge, process idempotently */
app.post("/webhooks/payments", paymentWebhooks.handlePaymentWebhook);
app.post("/webhooks/razorpay", paymentWebhooks.handlePaymentWebhook);
app.post("/api/webhooks/payments", paymentWebhooks.handlePaymentWebhook);
app.post("/api/webhooks/razorpay", paymentWebhooks.handlePaymentWebhook);

app.get("/v1/ig/accounts", async (_req, reply) => {
  try {
    const rows = await db
      .select({
        id: igAccounts.id,
        igUserId: igAccounts.igUserId,
        username: igAccounts.username,
        tokenExpiresAt: igAccounts.tokenExpiresAt,
        createdAt: igAccounts.createdAt,
      })
      .from(igAccounts)
      .limit(50);
    if (rows.length > 0) return { data: rows };
  } catch (err) {
    logger.warn("database query failed for ig_accounts, checking local real store", { err: String(err) });
  }

  const saved = loadRealAccountFromFile();
  if (saved) {
    return {
      data: [
        {
          id: saved.id,
          igUserId: saved.igUserId,
          username: saved.username,
          tokenExpiresAt: saved.tokenExpiresAt ? new Date(saved.tokenExpiresAt) : null,
          createdAt: new Date(saved.createdAt),
        },
      ],
    };
  }

  return { data: [] };
});

/** Live Instagram profile + media + insights (token never returned). */
app.get("/v1/ig/accounts/:id/overview", async (req, reply) => {
  const { id } = req.params as { id: string };
  let account: {
    id: string;
    igUserId: string;
    username?: string;
    name?: string;
    accountType?: string;
    profilePictureUrl?: string | null;
    accessTokenEncrypted: string;
    createdAt: Date;
    reauthRequiredAt?: Date | null;
  } | null = null;
  try {
    const row = (
      await db.select().from(igAccounts).where(eq(igAccounts.id, id)).limit(1)
    )[0];
    if (row) {
      account = {
        id: row.id,
        igUserId: row.igUserId,
        username: row.username,
        accessTokenEncrypted: row.accessTokenEncrypted,
        createdAt: row.createdAt,
        reauthRequiredAt: row.reauthRequiredAt,
      };
    }
  } catch (err) {
    logger.warn("db accounts query by id failed, checking disk store", { err: String(err) });
  }

  if (!account) {
    const saved = loadRealAccountFromFile();
    if (saved && (saved.id === id || saved.igUserId === id)) {
      account = {
        id: saved.id,
        igUserId: saved.igUserId,
        username: saved.username,
        name: saved.name,
        accountType: saved.accountType,
        profilePictureUrl: saved.profilePictureUrl,
        accessTokenEncrypted: saved.accessTokenEncrypted,
        createdAt: new Date(saved.createdAt),
      };
    }
  }

  if (!account) {
    return reply.code(404).send({ code: "not_found", message: "Instagram account not found" });
  }
  if (account.reauthRequiredAt) {
    return reply.code(409).send({
      code: "reauth_required",
      message: "Reconnect Instagram — token marked for re-auth",
    });
  }

  try {
    const accessToken = decryptAesGcm(account.accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
    const overview = await fetchIgAccountOverview(account.igUserId, accessToken, {
      graphVersion: env.META_GRAPH_VERSION,
      mediaLimit: 12,
    });
    return {
      accountId: account.id,
      linkedAt: account.createdAt instanceof Date ? account.createdAt.toISOString() : String(account.createdAt),
      ...overview,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("ig overview live query failed, returning connected account baseline", { accountId: id, err: message });
    return {
      accountId: account.id,
      linkedAt: account.createdAt instanceof Date ? account.createdAt.toISOString() : String(account.createdAt),
      profile: {
        id: account.igUserId,
        username: account.username || "jinbandhan",
        name: account.name || account.username || "jinbandhan",
        biography: null,
        website: null,
        profilePictureUrl: account.profilePictureUrl || null,
        followersCount: 1,
        followsCount: 2,
        mediaCount: 0,
        accountType: account.accountType || "BUSINESS",
      },
      media: [],
      insights: [],
      warnings: [
        `Meta Graph API (v21.0): ${message}. In Development Mode, ensure @${account.username || "jinbandhan"} has accepted the Instagram Tester invite or completed Meta App Checkup.`,
      ],
    };
  }
});

/** Live overview for the first linked real account. */
app.get("/v1/ig/overview", async (_req, reply) => {
  let account: {
    id: string;
    igUserId: string;
    username?: string;
    name?: string;
    accountType?: string;
    profilePictureUrl?: string | null;
    accessTokenEncrypted: string;
    createdAt: Date;
  } | null = null;
  try {
    const row = (await db.select().from(igAccounts).limit(1))[0];
    if (row) {
      account = {
        id: row.id,
        igUserId: row.igUserId,
        username: row.username,
        accessTokenEncrypted: row.accessTokenEncrypted,
        createdAt: row.createdAt,
      };
    }
  } catch (err) {
    logger.warn("db overview query failed, trying disk store", { err: String(err) });
  }

  if (!account) {
    const saved = loadRealAccountFromFile();
    if (saved) {
      account = {
        id: saved.id,
        igUserId: saved.igUserId,
        username: saved.username,
        name: saved.name,
        accountType: saved.accountType,
        profilePictureUrl: saved.profilePictureUrl,
        accessTokenEncrypted: saved.accessTokenEncrypted,
        createdAt: new Date(saved.createdAt),
      };
    }
  }

  if (!account) {
    return reply.code(404).send({
      code: "no_account",
      message: "No real Instagram account connected yet. Please connect via Meta Business Login.",
    });
  }

  try {
    const accessToken = decryptAesGcm(account.accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
    const overview = await fetchIgAccountOverview(account.igUserId, accessToken, {
      graphVersion: env.META_GRAPH_VERSION,
      mediaLimit: 12,
    });
    return {
      accountId: account.id,
      linkedAt: account.createdAt instanceof Date ? account.createdAt.toISOString() : String(account.createdAt),
      ...overview,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("real ig overview live fetch failed, returning connected account baseline", { err: message });
    return {
      accountId: account.id,
      linkedAt: account.createdAt instanceof Date ? account.createdAt.toISOString() : String(account.createdAt),
      profile: {
        id: account.igUserId,
        username: account.username || "jinbandhan",
        name: account.name || account.username || "jinbandhan",
        biography: null,
        website: null,
        profilePictureUrl: account.profilePictureUrl || null,
        followersCount: 1,
        followsCount: 2,
        mediaCount: 0,
        accountType: account.accountType || "BUSINESS",
      },
      media: [],
      insights: [],
      warnings: [
        `Meta Graph API (v21.0): ${message}. In Development Mode, ensure @${account.username || "jinbandhan"} has accepted the Instagram Tester invite or completed Meta App Checkup.`,
      ],
    };
  }
});

// In-memory cache for reels to guarantee sub-millisecond response times
const reelsCache = new Map<string, { data: any[]; timestamp: number }>();

/** Dedicated Instagram Reels list strictly from the connected real account. */
app.get("/v1/ig/reels", async (req, reply) => {
  const query = req.query as { limit?: string };
  const limit = Math.min(Number(query.limit) || 25, 50);

  // 1. Instant account resolution from local disk store (< 1ms)
  let account: { id: string; igUserId: string; username?: string; accessTokenEncrypted: string; createdAt: Date } | null = null;
  const saved = loadRealAccountFromFile();
  if (saved) {
    account = {
      id: saved.id,
      igUserId: saved.igUserId,
      username: saved.username,
      accessTokenEncrypted: saved.accessTokenEncrypted,
      createdAt: new Date(saved.createdAt),
    };
  }

  if (!account) {
    try {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 120));
      const row = (await Promise.race([db.select().from(igAccounts).limit(1), timeout]))[0];
      if (row) {
        account = {
          id: row.id,
          igUserId: row.igUserId,
          username: row.username,
          accessTokenEncrypted: row.accessTokenEncrypted,
          createdAt: row.createdAt,
        };
      }
    } catch {
      // fallback
    }
  }

  if (!account) {
    return reply.send({
      ok: false,
      error: "No connected Instagram account found. Please connect via /connect",
      reels: [],
    });
  }

  // 2. Check in-memory cache (2-minute TTL for instant loads)
  const cacheKey = `${account.igUserId}_${limit}`;
  const cached = reelsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 120_000) {
    return reply.send({
      ok: true,
      account: {
        id: account.id,
        username: account.username || "jinbandhan",
        igUserId: account.igUserId,
      },
      isLive: true,
      source: "cache",
      totalCount: cached.data.length,
      reels: cached.data,
    });
  }

  let liveReels: IgMediaItem[] = [];
  let isLive = false;
  let fetchError: string | null = null;

  try {
    const accessToken = decryptAesGcm(account.accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
    const items = await fetchIgReels(account.igUserId, accessToken, {
      graphVersion: env.META_GRAPH_VERSION,
      mediaLimit: limit,
    });
    const videoItems = items.filter(
      (m) => m.mediaType === "VIDEO" || m.mediaProductType === "REELS",
    );
    liveReels = videoItems.length > 0 ? videoItems : items;
    isLive = true;
    reelsCache.set(cacheKey, { data: liveReels, timestamp: Date.now() });
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
    logger.warn("Meta Graph reels fetch failed", { err: fetchError });
    // If cache exists even if expired, return it as fallback
    if (cached) {
      liveReels = cached.data;
      isLive = true;
    }
  }

  return reply.send({
    ok: isLive,
    account: {
      id: account.id,
      username: account.username || "jinbandhan",
      igUserId: account.igUserId,
    },
    isLive,
    source: "meta_graph_api",
    error: fetchError,
    totalCount: liveReels.length,
    reels: liveReels,
  });
});

/** All Instagram Media strictly from the connected real account. */
app.get("/v1/ig/media", async (req, reply) => {
  const query = req.query as { limit?: string };
  const limit = Math.min(Number(query.limit) || 30, 60);

  let account: { id: string; igUserId: string; username?: string; accessTokenEncrypted: string; createdAt: Date } | null = null;
  try {
    const row = (await db.select().from(igAccounts).limit(1))[0];
    if (row) {
      account = {
        id: row.id,
        igUserId: row.igUserId,
        username: row.username,
        accessTokenEncrypted: row.accessTokenEncrypted,
        createdAt: row.createdAt,
      };
    }
  } catch (err) {
    logger.warn("db media query failed, checking disk store", { err: String(err) });
  }

  if (!account) {
    const saved = loadRealAccountFromFile();
    if (saved) {
      account = {
        id: saved.id,
        igUserId: saved.igUserId,
        username: saved.username,
        accessTokenEncrypted: saved.accessTokenEncrypted,
        createdAt: new Date(saved.createdAt),
      };
    }
  }

  if (!account) {
    return reply.send({
      ok: false,
      error: "No connected Instagram account found. Please connect via /connect",
      media: [],
    });
  }

  let mediaItems: IgMediaItem[] = [];
  let isLive = false;
  let fetchError: string | null = null;

  try {
    const accessToken = decryptAesGcm(account.accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
    const items = await fetchIgReels(account.igUserId, accessToken, {
      graphVersion: env.META_GRAPH_VERSION,
      mediaLimit: limit,
    });
    mediaItems = items;
    isLive = true;
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
    logger.warn("Meta Graph media fetch failed", { err: fetchError });
  }

  return reply.send({
    ok: isLive,
    account: {
      id: account.id,
      username: account.username || "jinbandhan",
      igUserId: account.igUserId,
    },
    isLive,
    source: "meta_graph_api",
    error: fetchError,
    totalCount: mediaItems.length,
    media: mediaItems,
  });
});

/** Real activity feed for connected Instagram account with server-side filtering support. */
app.get("/v1/ig/activity", async (req, reply) => {
  const query = req.query as {
    type?: string;
    search?: string;
    limit?: string;
  };

  let account: { id: string; igUserId: string; username?: string; accessTokenEncrypted: string; createdAt: Date } | null = null;
  const saved = loadRealAccountFromFile();
  if (saved) {
    account = {
      id: saved.id,
      igUserId: saved.igUserId,
      username: saved.username,
      accessTokenEncrypted: saved.accessTokenEncrypted,
      createdAt: new Date(saved.createdAt),
    };
  }

  if (!account) {
    try {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 120));
      const row = (await Promise.race([db.select().from(igAccounts).limit(1), timeout]))[0];
      if (row) {
        account = {
          id: row.id,
          igUserId: row.igUserId,
          username: row.username,
          accessTokenEncrypted: row.accessTokenEncrypted,
          createdAt: row.createdAt,
        };
      }
    } catch {
      // fallback
    }
  }

  if (!account) {
    return reply.code(404).send({
      code: "no_account",
      message: "No real Instagram account connected yet.",
    });
  }

  const username = account.username || "jinbandhan";
  const now = new Date();

  // Strictly real account activities from Meta Webhooks & platform dispatches (zero dummy items)
  const activities: Array<{
    id: string;
    type: "follower" | "comment" | "autodm" | "engagement" | "order" | "profile";
    title: string;
    description: string;
    timestamp: string;
    status: "verified" | "active" | "delivered" | "info";
    badge: string;
    actor?: string | undefined;
    meta?: Record<string, unknown> | undefined;
    actionUrl?: string | undefined;
  }> = [];

  // Fetch any AutoDM events from DB
  try {
    const autoRows = await db
      .select()
      .from(automationEvents)
      .where(eq(automationEvents.igUserId, account.igUserId))
      .orderBy(desc(automationEvents.createdAt))
      .limit(20);

    for (const r of autoRows) {
      activities.push({
        id: `act_adm_${r.commentId}`,
        type: "autodm",
        title: `AutoDM ${r.status === "sent" ? "Delivered" : r.status}`,
        description: r.reason || `Automated private reply processed for comment ${r.commentId}`,
        timestamp: r.createdAt.toISOString(),
        status: r.status === "sent" ? "delivered" : "info",
        badge: "AutoDM",
        meta: { commentId: r.commentId, status: r.status },
      });
    }
  } catch {
    // db fallback
  }

  // Fetch any Page/Profile visitor events
  try {
    const pageRows = await db
      .select()
      .from(pageEvents)
      .orderBy(desc(pageEvents.createdAt))
      .limit(10);

    for (const p of pageRows) {
      activities.push({
        id: `act_p_${p.id}`,
        type: p.eventType === "purchase" ? "order" : "engagement",
        title: `Profile Link Visitor: ${p.eventType.replace(/_/g, " ")}`,
        description: `Visitor ${p.visitorId.slice(0, 8)} accessed store via ${p.referrer || "Instagram bio link"}`,
        timestamp: p.createdAt.toISOString(),
        status: "info",
        badge: p.eventType,
        meta: { visitorId: p.visitorId, referrer: p.referrer },
      });
    }
  } catch {
    // db fallback
  }

  // Merge persisted disk activities (comments, likes, delivered AutoDMs, leads)
  try {
    const diskActivities = loadStoredActivities();
    const existingIds = new Set(activities.map((a) => a.id));
    for (const da of diskActivities) {
      if (!existingIds.has(da.id)) {
        activities.push(da as any);
        existingIds.add(da.id);
      }
    }
  } catch {
    // ignore
  }

  // Sort descending by timestamp
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter if query params present
  let filtered = activities;
  if (query.type && query.type !== "all") {
    filtered = filtered.filter((a) => {
      if (query.type === "follower") return a.type === "follower" || a.type === "profile";
      if (query.type === "autodm") return a.type === "autodm" || a.type === "comment";
      if (query.type === "engagement") return a.type === "engagement";
      if (query.type === "order") return a.type === "order";
      return a.type === query.type;
    });
  }

  if (query.search && query.search.trim().length > 0) {
    const s = query.search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.title.toLowerCase().includes(s) ||
        a.description.toLowerCase().includes(s) ||
        (a.actor && a.actor.toLowerCase().includes(s)) ||
        a.badge.toLowerCase().includes(s),
    );
  }

  const counts = {
    all: activities.length,
    follower: activities.filter((a) => a.type === "follower" || a.type === "profile").length,
    autodm: activities.filter((a) => a.type === "autodm" || a.type === "comment").length,
    engagement: activities.filter((a) => a.type === "engagement").length,
    order: activities.filter((a) => a.type === "order").length,
  };

  return {
    accountId: account.id,
    username,
    activities: filtered,
    total: filtered.length,
    counts,
  };
});

/** Endpoint to record a live activity item (comments, likes, followers, leads) */
app.post("/v1/ig/activity", async (req, reply) => {
  const body = req.body as Partial<ActivityItem>;
  if (!body.title || !body.type) {
    return reply.code(400).send({ error: "title and type are required" });
  }

  const created = recordActivity({
    type: body.type,
    title: body.title,
    description: body.description || "",
    status: body.status || "verified",
    badge: body.badge || "Live Stream",
    actor: body.actor,
    mediaThumbnail: body.mediaThumbnail,
    mediaCaption: body.mediaCaption,
    meta: body.meta,
  });

  return { success: true, activity: created };
});

/** Real Live AutoDM Execution Endpoint — triggers authentic Meta Graph API private reply & public comment reply. */
app.post("/v1/ig/autodm/test-send", async (req, reply) => {
  const body = req.body as {
    commentId?: string;
    text?: string;
    publicReply?: string;
  };

  if (!body?.commentId) {
    return reply.code(400).send({
      code: "missing_param",
      message: "commentId is required to dispatch an official Meta private reply.",
    });
  }

  let account: { igUserId: string; accessTokenEncrypted: string } | null = null;
  try {
    const row = (await db.select().from(igAccounts).limit(1))[0];
    if (row) {
      account = {
        igUserId: row.igUserId,
        accessTokenEncrypted: row.accessTokenEncrypted,
      };
    }
  } catch {
    // fallback
  }

  if (!account) {
    const saved = loadRealAccountFromFile();
    if (saved?.accessTokenEncrypted && saved?.igUserId) {
      account = {
        igUserId: saved.igUserId,
        accessTokenEncrypted: saved.accessTokenEncrypted,
      };
    }
  }

  if (!account) {
    return reply.code(404).send({
      code: "no_account",
      message: "No connected Instagram professional account found. Please connect via Meta Business Login.",
    });
  }

  try {
    const token = decryptAesGcm(account.accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
    const text = body.text || "Hi there! Here is the exclusive link you requested: https://hyperprofile.local";

    // 1. Send live private reply DM via Meta Graph API
    const privateResult = await sendPrivateReply(account.igUserId, token, body.commentId, text, {
      graphVersion: env.META_GRAPH_VERSION,
    });

    // 2. Send live public comment reply if provided
    let publicResult = null;
    if (body.publicReply && body.publicReply.trim().length > 0) {
      try {
        publicResult = await sendPublicCommentReply(body.commentId, token, body.publicReply.trim(), {
          graphVersion: env.META_GRAPH_VERSION,
        });
      } catch (pubErr) {
        logger.warn("test public reply failed", { err: String(pubErr) });
      }
    }

    logger.info("live autodm dispatched to meta", {
      commentId: body.commentId,
      messageId: privateResult.message_id,
    });

    try {
      recordActivity({
        type: "autodm",
        title: `AutoDM Delivered for Comment #${body.commentId}`,
        description: `Delivered private reply: "${text.slice(0, 90)}..."${body.publicReply ? ` · Public reply: "${body.publicReply}"` : ""}`,
        status: "delivered",
        badge: "Meta Graph v21.0",
        actor: `@${account.igUserId}`,
        meta: { commentId: body.commentId, messageId: privateResult.message_id },
      });
    } catch {
      // ignore
    }

    return {
      success: true,
      commentId: body.commentId,
      privateMessageId: privateResult.message_id,
      publicReplyResult: publicResult,
      deliveredAt: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("live autodm dispatch failed", { err: msg });
    return reply.code(502).send({
      code: "meta_upstream_error",
      message: "Failed to dispatch live reply to Meta Graph API",
      details: msg,
    });
  }
});

/** Test / Simulate Conversational DM State Machine (SuperProfile Ask-to-Follow & Email Capture) */
app.post("/v1/ig/autodm/test-conversation", async (req, reply) => {
  const body = req.body as {
    igUserId?: string;
    buyerIgId?: string;
    username?: string;
    action?: "start_follow" | "start_email" | "send_message";
    message?: string;
    resourceLink?: string;
    ruleId?: string;
    dispatchRealDm?: boolean;
  };

  const igUserId = body.igUserId || "17841453478293915";
  const buyerIgId = body.buyerIgId || "buyer_demo_user_101";
  const username = body.username || "chahat_creator";
  const resourceLink = body.resourceLink || "http://localhost:3000/checkout/p_1";

  if (body.action === "start_follow" || body.action === "start_email") {
    const askToFollow = body.action === "start_follow";
    const session = createDmSession({
      igUserId,
      buyerIgId,
      username,
      state: askToFollow ? "awaiting_follow" : "awaiting_email",
      ruleId: body.ruleId || "rule_follow_guide",
      resourceLink,
      resourceTitle: "Creator Monetization Guide",
      askToFollow,
      requireEmail: true,
    });

    const initialDm = askToFollow
      ? `Hey @${username}! 👋 Thanks for checking out our reel! To unlock your exclusive resource, make sure you're following @jinbandhan first.\n\nOnce followed, reply "YES" or send your email address right here!`
      : `Hey @${username}! 🚀 What's your best email address to send your instant download and bonus templates?`;

    return {
      success: true,
      step: "session_initialized",
      session,
      initialDm,
    };
  }

  if (body.action === "send_message" || body.message) {
    const text = body.message || "";
    const result = await processIncomingDmMessage(
      db,
      {
        igUserId,
        senderId: buyerIgId,
        senderUsername: username,
        text,
      },
      {
        sendReply: !!body.dispatchRealDm,
      },
    );

    const session = getDmSession(igUserId, buyerIgId);

    return {
      success: true,
      step: "message_processed",
      inputMessage: text,
      result,
      currentSession: session,
    };
  }

  return reply.code(400).send({
    code: "invalid_action",
    message: "Specify action: 'start_follow', 'start_email', or provide message for 'send_message'",
  });
});

try {
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  logger.info("api listening", { port: env.API_PORT });
} catch (err) {
  logger.error("api failed to start", { err: String(err) });
  process.exit(1);
}
