import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { buyers, creators, igAccounts, pageEvents, type Db } from "@hyperprofile/db";
import { sendDirectMessage, type GraphClientOptions } from "@hyperprofile/meta";
import { decryptAesGcm, logger } from "@hyperprofile/shared";

export interface DmSession {
  id: string; // `${igUserId}:${buyerIgId}`
  igUserId: string;
  buyerIgId: string;
  username?: string;
  state: "awaiting_follow" | "awaiting_email" | "completed";
  ruleId: string;
  commentId?: string;
  resourceLink: string;
  resourceTitle?: string;
  askToFollow: boolean;
  requireEmail: boolean;
  capturedEmail?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LeadRecord {
  email: string;
  username?: string | undefined;
  igUserId: string;
  buyerIgId: string;
  ruleId: string;
  source: string;
  capturedAt: string;
}

// In-memory session store
const sessions = new Map<string, DmSession>();

const SESSIONS_FILE = path.resolve(process.cwd(), "real-ig-dm-sessions.json");
const LEADS_FILE = path.resolve(process.cwd(), "real-ig-leads.json");

// Hydrate from disk if exists
try {
  if (fs.existsSync(SESSIONS_FILE)) {
    const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    if (Array.isArray(raw)) {
      for (const s of raw) {
        sessions.set(s.id, s);
      }
    }
  }
} catch {
  // ignore
}

function persistSessions() {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Array.from(sessions.values()), null, 2), "utf8");
  } catch {
    // ignore
  }
}

export function saveLeadToDisk(lead: LeadRecord) {
  try {
    let existing: LeadRecord[] = [];
    if (fs.existsSync(LEADS_FILE)) {
      existing = JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
    }
    // De-duplicate by email and igUserId
    const idx = existing.findIndex((l) => l.email === lead.email && l.igUserId === lead.igUserId);
    if (idx >= 0) {
      existing[idx] = lead;
    } else {
      existing.unshift(lead);
    }
    fs.writeFileSync(LEADS_FILE, JSON.stringify(existing, null, 2), "utf8");
  } catch (err) {
    logger.warn("failed to persist lead to disk", { err });
  }
}

export function getStoredLeads(): LeadRecord[] {
  try {
    if (fs.existsSync(LEADS_FILE)) {
      return JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
    }
  } catch {
    // ignore
  }
  return [];
}

export function createDmSession(session: Omit<DmSession, "id" | "createdAt" | "updatedAt">): DmSession {
  const id = `${session.igUserId}:${session.buyerIgId}`;
  const now = Date.now();
  const fullSession: DmSession = {
    ...session,
    id,
    createdAt: now,
    updatedAt: now,
  };
  sessions.set(id, fullSession);
  persistSessions();
  return fullSession;
}

export function getDmSession(igUserId: string, buyerIgId: string): DmSession | undefined {
  return sessions.get(`${igUserId}:${buyerIgId}`);
}

async function resolveToken(db: Db, igUserId: string): Promise<string | null> {
  const encKey = process.env.TOKEN_ENCRYPTION_KEY;
  try {
    const row = (
      await db
        .select({
          accessTokenEncrypted: igAccounts.accessTokenEncrypted,
        })
        .from(igAccounts)
        .where(eq(igAccounts.igUserId, igUserId))
        .limit(1)
    )[0];

    if (row?.accessTokenEncrypted && encKey) {
      return decryptAesGcm(row.accessTokenEncrypted, encKey);
    }
  } catch {
    // fallback to disk
  }

  const diskPath = path.resolve(process.cwd(), "real-ig-account.json");
  if (fs.existsSync(diskPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(diskPath, "utf8"));
      if (data.accessTokenEncrypted && encKey) {
        return decryptAesGcm(data.accessTokenEncrypted, encKey);
      }
      if (data.accessToken) {
        return data.accessToken;
      }
    } catch {
      // ignore
    }
  }

  return process.env.META_USER_ACCESS_TOKEN ?? null;
}

/**
 * Handle incoming user DM messages (conversational Ask-to-Follow & Email Capture)
 */
export async function processIncomingDmMessage(
  db: Db,
  input: {
    igUserId: string;
    senderId: string;
    senderUsername?: string | undefined;
    text: string;
    messageId?: string | undefined;
  },
  opts: {
    graphOptions?: GraphClientOptions;
    sendReply?: boolean;
  } = {},
): Promise<{
  handled: boolean;
  replySent?: string | undefined;
  leadCaptured?: string | undefined;
  sessionState?: string | undefined;
}> {
  const { igUserId, senderId, senderUsername, text } = input;
  const session = getDmSession(igUserId, senderId);

  if (!session) {
    logger.debug("no active conversation session for sender", { igUserId, senderId });
    return { handled: false };
  }

  if (session.state === "completed") {
    return { handled: true, sessionState: "completed" };
  }

  const cleanText = text.trim();
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  const emailMatch = cleanText.match(emailRegex);

  let replyText = "";
  let leadCaptured: string | undefined;

  // Case 1: Currently awaiting follow confirmation
  if (session.state === "awaiting_follow") {
    // If the user directly entered their email
    if (emailMatch) {
      const email = emailMatch[0].toLowerCase();
      session.capturedEmail = email;
      session.state = "completed";
      session.updatedAt = Date.now();
      persistSessions();

      leadCaptured = email;
      saveLeadToDisk({
        email,
        username: senderUsername || session.username,
        igUserId,
        buyerIgId: senderId,
        ruleId: session.ruleId,
        source: "ig_dm_ask_to_follow_and_email",
        capturedAt: new Date().toISOString(),
      });

      // Save to database if available
      try {
        await db
          .insert(buyers)
          .values({
            email,
            name: senderUsername || session.username || "Instagram Lead",
          })
          .onConflictDoNothing();
      } catch {
        // ignore offline db
      }

      replyText = `Thank you for following! 🎉 Your access link is unlocked below:\n\n👉 ${session.resourceLink}\n\nWe've also saved your email for exclusive creator drops! 🚀`;
    } else {
      const followAffirmations = ["yes", "done", "followed", "following", "yup", "ok", "ready", "yep", "joined"];
      const isAffirmative = followAffirmations.some((w) => cleanText.toLowerCase().includes(w));

      if (isAffirmative) {
        if (session.requireEmail) {
          session.state = "awaiting_email";
          session.updatedAt = Date.now();
          persistSessions();
          replyText = `Awesome, thank you for following! 🙌 What's your best email address to send your instant download and bonus templates?`;
        } else {
          session.state = "completed";
          session.updatedAt = Date.now();
          persistSessions();
          replyText = `You're awesome! 🎉 Here is your direct access link:\n\n👉 ${session.resourceLink}`;
        }
      } else {
        replyText = `To get your instant access, please make sure you follow @jinbandhan, then reply "YES" or send your email address right here! ✨`;
      }
    }
  }
  // Case 2: Awaiting email address
  else if (session.state === "awaiting_email") {
    if (emailMatch) {
      const email = emailMatch[0].toLowerCase();
      session.capturedEmail = email;
      session.state = "completed";
      session.updatedAt = Date.now();
      persistSessions();

      leadCaptured = email;
      saveLeadToDisk({
        email,
        username: senderUsername || session.username,
        igUserId,
        buyerIgId: senderId,
        ruleId: session.ruleId,
        source: "ig_dm_email_capture",
        capturedAt: new Date().toISOString(),
      });

      try {
        await db
          .insert(buyers)
          .values({
            email,
            name: senderUsername || session.username || "Instagram Lead",
          })
          .onConflictDoNothing();
      } catch {
        // ignore offline db
      }

      replyText = `Verified! 🎁 Here is your instant access link:\n\n👉 ${session.resourceLink}\n\nWe're so excited to have you with us!`;
    } else {
      replyText = `That doesn't look like a valid email address. Please reply with your email (e.g. name@gmail.com) so we can send you the resource link! 📩`;
    }
  }

  // Send real Meta DM if reply text is set and sending enabled
  if (replyText && (opts.sendReply ?? true)) {
    const token = await resolveToken(db, igUserId);
    if (token) {
      try {
        await sendDirectMessage(igUserId, token, senderId, replyText, opts.graphOptions);
        logger.info("conversational dm reply dispatched via meta", {
          igUserId,
          senderId,
          state: session.state,
        });
      } catch (err) {
        logger.warn("meta direct message dispatch error (logged for recovery)", {
          err: err instanceof Error ? err.message : String(err),
          igUserId,
          senderId,
        });
      }
    }
  }

  return {
    handled: true,
    replySent: replyText,
    leadCaptured,
    sessionState: session.state,
  };
}
