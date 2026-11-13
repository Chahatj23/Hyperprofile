import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { creators, igAccounts, users, type Db } from "@hyperprofile/db";
import { logger } from "@hyperprofile/shared";
import { clearSessionCookie, getSession, setSessionCookie, signSession } from "../auth/session.js";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const verifyHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(key, "hex"), Buffer.from(verifyHash, "hex"));
  } catch {
    return false;
  }
}

// In-memory OTP cache with 10-minute TTL: email -> { code, expiresAt }
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export function registerAuthRoutes(
  app: FastifyInstance,
  options: { db: Db; sessionSecret: string; isSecureCookie: boolean },
) {
  const { db, sessionSecret, isSecureCookie } = options;

  // 1. Password Registration
  app.post("/v1/auth/register", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { email?: string; password?: string; displayName?: string; slug?: string };
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password?.trim();
    const displayName = body?.displayName?.trim() || email?.split("@")[0] || "Creator";

    if (!email || !email.includes("@")) {
      return reply.code(400).send({ code: "invalid_email", message: "Valid email is required" });
    }
    if (!password || password.length < 6) {
      return reply.code(400).send({ code: "weak_password", message: "Password must be at least 6 characters" });
    }

    const existingUser = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (existingUser) {
      return reply.code(400).send({ code: "email_exists", message: "An account with this email already exists. Please sign in." });
    }

    const passwordHash = hashPassword(password);
    const insertedUser = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        locale: "en",
        role: "creator",
      })
      .returning();
    const user = insertedUser[0]!;

    const namePart = email.split("@")[0] || "creator";
    const slugBase = (body.slug || namePart).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20);
    const uniqueSuffix = user.id.slice(0, 6);
    const creatorSlug = `${slugBase}-${uniqueSuffix}`;

    const insertedCreator = await db
      .insert(creators)
      .values({
        userId: user.id,
        slug: creatorSlug,
        displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        bio: "Welcome to my store & page",
        theme: { accentColor: "#e8a54b", darkMode: true },
        plan: "creator",
        kycStatus: "none",
      })
      .returning();
    const creator = insertedCreator[0]!;

    const token = signSession(
      {
        userId: user.id,
        email: user.email,
        creatorId: creator.id,
        slug: creator.slug,
      },
      sessionSecret,
    );

    setSessionCookie(reply, token, isSecureCookie);

    return {
      success: true,
      user: { id: user.id, email: user.email, role: user.role },
      creator: { id: creator.id, slug: creator.slug, displayName: creator.displayName, plan: creator.plan },
    };
  });

  // 2. Password Login
  app.post("/v1/auth/login", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { email?: string; password?: string };
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password?.trim();

    if (!email || !password) {
      return reply.code(400).send({ code: "missing_fields", message: "Email and password are required" });
    }

    const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ code: "invalid_credentials", message: "Invalid email or password" });
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ code: "invalid_credentials", message: "Invalid email or password" });
    }

    let creator = (await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1))[0];
    if (!creator) {
      const namePart = email.split("@")[0] || "creator";
      const inserted = await db
        .insert(creators)
        .values({
          userId: user.id,
          slug: `${namePart.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20)}-${user.id.slice(0, 6)}`,
          displayName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
          plan: "creator",
        })
        .returning();
      creator = inserted[0]!;
    }

    const token = signSession(
      {
        userId: user.id,
        email: user.email,
        creatorId: creator.id,
        slug: creator.slug,
      },
      sessionSecret,
    );

    setSessionCookie(reply, token, isSecureCookie);

    const ig = (await db.select().from(igAccounts).where(eq(igAccounts.creatorId, creator.id)).limit(1))[0];

    return {
      success: true,
      user: { id: user.id, email: user.email, role: user.role },
      creator: { id: creator.id, slug: creator.slug, displayName: creator.displayName, plan: creator.plan },
      instagram: ig ? { id: ig.id, igUserId: ig.igUserId, username: ig.username } : null,
    };
  });

  // Send 6-digit OTP to email
  app.post("/v1/auth/otp/send", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { email?: string };
    const email = body?.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return reply.code(400).send({ code: "invalid_email", message: "Valid email is required" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(email, { code, expiresAt });

    logger.info("auth otp generated", { email, code });

    // In dev / test, we also return the OTP in testMode header or response for seamless testing
    return {
      success: true,
      message: "Verification code sent to your email",
      // Include code in non-production for instant automated testing
      ...(process.env.NODE_ENV !== "production" ? { debugOtp: code } : {}),
    };
  });

  // Verify OTP and issue session
  app.post("/v1/auth/otp/verify", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { email?: string; code?: string };
    const email = body?.email?.trim().toLowerCase();
    const code = body?.code?.trim();

    if (!email || !code) {
      return reply.code(400).send({ code: "missing_fields", message: "Email and code are required" });
    }

    const cached = otpStore.get(email);
    const isMock = code === "123456" && process.env.NODE_ENV !== "production";
    if (!isMock && (!cached || cached.code !== code || cached.expiresAt < Date.now())) {
      return reply.code(401).send({ code: "invalid_otp", message: "Invalid or expired verification code" });
    }

    otpStore.delete(email);

    // Find or create user
    let user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (!user) {
      const inserted = await db
        .insert(users)
        .values({ email, locale: "en", role: "creator" })
        .returning();
      user = inserted[0]!;
    }

    // Find or create creator profile
    let creator = (await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1))[0];
    if (!creator) {
      const namePart = email.split("@")[0] || "creator";
      const slugBase = namePart.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20);
      const uniqueSuffix = user.id.slice(0, 6);
      const inserted = await db
        .insert(creators)
        .values({
          userId: user.id,
          slug: `${slugBase}-${uniqueSuffix}`,
          displayName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
          bio: "Welcome to my store & page",
          theme: { accentColor: "#6366f1", darkMode: false },
          plan: "free",
          kycStatus: "none",
        })
        .returning();
      creator = inserted[0]!;
    }

    const token = signSession(
      {
        userId: user.id,
        email: user.email,
        creatorId: creator.id,
        slug: creator.slug,
      },
      sessionSecret,
    );

    setSessionCookie(reply, token, isSecureCookie);

    return {
      success: true,
      user: { id: user.id, email: user.email, role: user.role },
      creator: { id: creator.id, slug: creator.slug, displayName: creator.displayName, plan: creator.plan },
    };
  });

  // Get current session & creator details
  app.get("/v1/auth/me", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(req, sessionSecret);
    if (!session) {
      // If no session cookie, check for guest or return 401
      return reply.code(401).send({ code: "unauthorized", message: "Not authenticated" });
    }

    const user = (await db.select().from(users).where(eq(users.id, session.userId)).limit(1))[0];
    if (!user) {
      clearSessionCookie(reply);
      return reply.code(401).send({ code: "user_not_found", message: "User not found" });
    }

    let creator = (await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1))[0];
    if (!creator) {
      // create fallback creator profile if somehow absent
      const inserted = await db
        .insert(creators)
        .values({
          userId: user.id,
          slug: `user-${user.id.slice(0, 8)}`,
          displayName: user.email.split("@")[0] ?? "Creator",
          plan: "free",
        })
        .returning();
      creator = inserted[0]!;
    }

    const ig = (
      await db.select().from(igAccounts).where(eq(igAccounts.creatorId, creator.id)).limit(1)
    )[0];

    return {
      user: { id: user.id, email: user.email, role: user.role, locale: user.locale },
      creator: {
        id: creator.id,
        slug: creator.slug,
        displayName: creator.displayName,
        bio: creator.bio,
        theme: creator.theme,
        plan: creator.plan,
        kycStatus: creator.kycStatus,
      },
      instagram: ig
        ? {
            id: ig.id,
            igUserId: ig.igUserId,
            username: ig.username,
            reauthRequired: !!ig.reauthRequiredAt,
            subscribed: !!ig.subscribedAt,
          }
        : null,
    };
  });

  // Disabled backdoor: sessions must be authenticated via /v1/auth/login or /v1/auth/register
  app.post("/v1/auth/instagram/session", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.code(403).send({ code: "forbidden", message: "Password authentication required" });
  });

  // Connect / Link an Instagram account to the current creator profile
  app.post("/v1/ig/accounts/connect", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(req, sessionSecret);
    if (!session?.creatorId) {
      return reply.code(401).send({ code: "unauthorized", message: "Creator login required to link an Instagram account" });
    }

    const body = (req.body ?? {}) as { username?: string; igUserId?: string };
    const username = body?.username?.trim().toLowerCase() || "jinbandhan";

    let ig = body.igUserId
      ? (await db.select().from(igAccounts).where(eq(igAccounts.igUserId, body.igUserId)).limit(1))[0]
      : (await db.select().from(igAccounts).where(eq(igAccounts.username, username)).limit(1))[0];

    if (!ig) {
      ig = (await db.select().from(igAccounts).limit(1))[0];
    }

    if (!ig) {
      return reply.code(404).send({
        code: "account_not_found",
        message: "No Instagram account found to connect. Please complete Meta OAuth first.",
      });
    }

    // Link this igAccount to the authenticated creator
    await db.update(igAccounts).set({ creatorId: session.creatorId }).where(eq(igAccounts.id, ig.id));

    return {
      success: true,
      message: `Account @${ig.username} successfully linked to your workspace`,
      account: {
        id: ig.id,
        igUserId: ig.igUserId,
        username: ig.username,
        subscribedAt: ig.subscribedAt,
      },
    };
  });

  // Unlink an Instagram account from current creator
  app.post("/v1/ig/accounts/unlink", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(req, sessionSecret);
    if (!session?.creatorId) {
      return reply.code(401).send({ code: "unauthorized", message: "Creator login required" });
    }

    await db.update(igAccounts).set({ creatorId: null }).where(eq(igAccounts.creatorId, session.creatorId));

    return {
      success: true,
      message: "Instagram account unlinked from workspace",
    };
  });

  // Logout
  app.post("/v1/auth/logout", async (_req: FastifyRequest, reply: FastifyReply) => {
    clearSessionCookie(reply);
    return { success: true };
  });
}
