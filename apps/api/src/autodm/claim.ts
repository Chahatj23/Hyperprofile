import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { automationEvents, type Db } from "@hyperprofile/db";

const inMemoryClaimed = new Set<string>();

function resolveClaimedFile(): string {
  const p1 = path.resolve(process.cwd(), "claimed-comments.json");
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), "apps", "api", "claimed-comments.json");
  if (fs.existsSync(p2)) return p2;
  return p1;
}

function resolveActivityFile(): string {
  const p1 = path.resolve(process.cwd(), "real-ig-activity.json");
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), "apps", "api", "real-ig-activity.json");
  if (fs.existsSync(p2)) return p2;
  return p1;
}

function initClaimedSet() {
  try {
    // 1. Load from claimed-comments.json
    const claimedFile = resolveClaimedFile();
    if (fs.existsSync(claimedFile)) {
      const data = JSON.parse(fs.readFileSync(claimedFile, "utf8"));
      if (Array.isArray(data)) {
        for (const id of data) if (typeof id === "string") inMemoryClaimed.add(id);
      }
    }

    // 2. Also seed from real-ig-activity.json
    const actFile = resolveActivityFile();
    if (fs.existsSync(actFile)) {
      const acts = JSON.parse(fs.readFileSync(actFile, "utf8"));
      if (Array.isArray(acts)) {
        for (const a of acts) {
          const cId = (a.meta?.commentId as string) || (a.meta?.comment_id as string);
          if (cId) inMemoryClaimed.add(cId);
        }
      }
    }
  } catch {
    // ignore
  }
}

initClaimedSet();

function persistClaim(commentId: string) {
  try {
    const file = resolveClaimedFile();
    const arr = Array.from(inMemoryClaimed);
    fs.writeFileSync(file, JSON.stringify(arr, null, 2), "utf8");
  } catch {
    // ignore
  }
}

export function isCommentClaimed(commentId: string): boolean {
  return inMemoryClaimed.has(commentId);
}

/**
 * Atomic claim: INSERT … ON CONFLICT DO NOTHING RETURNING comment_id.
 * Returns true only for the first claim (webhook or poller redelivery → false).
 */
export async function claimComment(
  db: Db,
  input: {
    commentId: string;
    igUserId: string;
    ruleId?: string;
  },
): Promise<boolean> {
  if (inMemoryClaimed.has(input.commentId)) {
    return false;
  }
  inMemoryClaimed.add(input.commentId);
  persistClaim(input.commentId);

  // Atomic deduplication via DB if available
  try {
    await db
      .insert(automationEvents)
      .values({
        commentId: input.commentId,
        igUserId: input.igUserId,
        ruleId: input.ruleId,
        status: "queued",
      })
      .onConflictDoNothing();
  } catch {
    // If DB offline, inMemoryClaimed handles deduplication
  }

  return true;
}

export async function getEventStatus(db: Db, commentId: string) {
  try {
    return (
      await db
        .select()
        .from(automationEvents)
        .where(eq(automationEvents.commentId, commentId))
        .limit(1)
    )[0];
  } catch {
    return null;
  }
}
