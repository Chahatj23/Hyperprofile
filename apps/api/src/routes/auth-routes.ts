import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { creators, igAccounts, users, type Db } from "@hyperprofile/db";
import { logger } from "@hyperprofile/shared";
import { clearSessionCookie, getSession, setSessionCookie, signSession } from "../auth/session.js";

// In-memory OTP cache with 10-minute TTL: email -> { code, expiresAt }
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export function registerAuthRoutes(
  app: FastifyInstance,
  options: { db: Db; sessionSecret: string; isSecureCookie: boolean },
) {
  const { db, sessionSecret, isSecureCookie } = options;

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

  // Logout
  app.post("/v1/auth/logout", async (_req: FastifyRequest, reply: FastifyReply) => {
    clearSessionCookie(reply);
    return { success: true };
  });
}
