import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { automationRules, creators, igAccounts, type Db } from "@hyperprofile/db";
import {
  ruleMatchesComment,
  shouldIgnoreComment,
  type CommentMatchValue,
} from "@hyperprofile/meta";
import { logger } from "@hyperprofile/shared";
import { claimComment } from "./claim.js";
import { createDmSession } from "./conversation.js";
import { maybeTrackedLink } from "./links.js";
import { enqueueReply } from "./queue.js";
import { recordActivity } from "./activity-store.js";

function resolveRulesFile(): string {
  const local = path.resolve(process.cwd(), "real-ig-rules.json");
  if (fs.existsSync(local)) return local;
  const workspaceRoot = path.resolve(process.cwd(), "..", "..", "real-ig-rules.json");
  if (fs.existsSync(workspaceRoot)) return workspaceRoot;
  const apiSubdir = path.resolve(process.cwd(), "apps", "api", "real-ig-rules.json");
  if (fs.existsSync(apiSubdir)) return apiSubdir;
  const directE = path.resolve("e:/Full Stack/real-ig-rules.json");
  if (fs.existsSync(directE)) return directE;
  return local;
}

function loadDiskRules(): Array<any> {
  try {
    const file = resolveRulesFile();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveDiskRules(rules: Array<any>): void {
  try {
    const file = resolveRulesFile();
    fs.writeFileSync(file, JSON.stringify(rules, null, 2), "utf8");
    const directE = path.resolve("e:/Full Stack/real-ig-rules.json");
    if (directE !== file) {
      try {
        fs.writeFileSync(directE, JSON.stringify(rules, null, 2), "utf8");
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

type WebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: Partial<CommentMatchValue> & { id?: string };
    }>;
  }>;
};

function buildMessage(
  template: string,
  username: string,
  link: string | null,
  plan: string = "free",
): string {
  const name = username || "there";
  const base = template.replaceAll("{name}", name);
  let withLink = link ? `${base} ${link}` : base;

  // Free plan sends a short attribution footer; paid plans remove it
  if (plan === "free") {
    withLink += "\n\nSent via Hyperprofile";
  }

  // Meta invariant: message text must be at most 1000 UTF-8 bytes
  if (Buffer.byteLength(withLink, "utf8") > 1000) {
    const buf = Buffer.from(withLink, "utf8");
    withLink = buf.subarray(0, 1000).toString("utf8");
  }

  return withLink.trim();
}

/**
 * Route each entry[].changes[] independently (never index entry[0] only).
 * Claim before enqueue. Send happens in the reply worker.
 */
export async function processCommentWebhook(
  db: Db,
  body: WebhookBody,
  opts: { publicBaseUrl: string },
): Promise<{
  claimed: number;
  skipped: number;
}> {
  let claimed = 0;
  let skipped = 0;

  for (const entry of body.entry ?? []) {
    const igUserId = entry.id;
    if (!igUserId) continue;

    let plan = "free";
    try {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("db_timeout")), 80));
      const igAccount = (
        await Promise.race([
          db
            .select({ creatorId: igAccounts.creatorId })
            .from(igAccounts)
            .where(eq(igAccounts.igUserId, igUserId))
            .limit(1),
          timeout,
        ])
      )[0];

      if (igAccount?.creatorId) {
        const creator = (
          await Promise.race([
            db
              .select({ plan: creators.plan })
              .from(creators)
              .where(eq(creators.id, igAccount.creatorId))
              .limit(1),
            timeout,
          ])
        )[0];
        if (creator?.plan) plan = creator.plan;
      }
    } catch {
      // safe fallback to free plan
    }

    // 1. Instant disk rules resolution (< 0.1ms)
    let rules: Array<any> = loadDiskRules().filter(
      (r: any) => (!r.igUserId || r.igUserId === igUserId) && r.active,
    );

    // 2. Race DB if disk rules empty
    if (rules.length === 0) {
      try {
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("db_timeout")), 80));
        rules = await Promise.race([
          db
            .select()
            .from(automationRules)
            .where(and(eq(automationRules.igUserId, igUserId), eq(automationRules.active, true))),
          timeout,
        ]);
      } catch {
        // fallback
      }
    }

    // If no active rules are configured for this account, skip processing
    if (rules.length === 0) {
      continue;
    }

    for (const ch of entry.changes ?? []) {
      if (ch.field !== "comments" && ch.field !== "live_comments") continue;
      const raw = ch.value;
      if (!raw?.id) {
        skipped++;
        continue;
      }
      const v: CommentMatchValue = {
        id: raw.id,
        ...(raw.text != null ? { text: raw.text } : {}),
        ...(raw.parent_id != null ? { parent_id: raw.parent_id } : {}),
        ...(raw.from != null ? { from: raw.from } : {}),
        ...(raw.media != null ? { media: raw.media } : {}),
      };

      // Record every incoming comment in the live Activity Stream
      try {
        recordActivity({
          type: "comment",
          title: `Comment from @${v.from?.username || "user"}`,
          description: `"${v.text || ""}"`,
          status: "verified",
          badge: "Live Comment",
          actor: `@${v.from?.username || "user"}`,
          meta: { commentId: v.id, text: v.text, mediaId: v.media?.id },
        });
      } catch {
        // ignore
      }

      if (shouldIgnoreComment(igUserId, v)) {
        skipped++;
        continue;
      }

      const rule = rules.find((r) =>
        ruleMatchesComment(
          { keyword: r.keyword, mediaId: r.mediaId },
          v,
        ),
      );
      if (!rule) {
        skipped++;
        continue;
      }

      const ok = await claimComment(db, {
        commentId: v.id,
        igUserId,
        ruleId: rule.id,
      });
      if (!ok) {
        skipped++;
        continue;
      }

      // Increment runs count on the triggered rule
      try {
        const disk = loadDiskRules();
        const found = disk.find((r: any) => r.id === rule.id);
        if (found) {
          found.runsCount = (found.runsCount || 0) + 1;
          saveDiskRules(disk);
        }
      } catch {
        // ignore
      }

      const username = v.from?.username ?? "there";
      let link = rule.link;
      try {
        if (rule.link) {
          link = await maybeTrackedLink(db, {
            url: rule.link,
            publicBaseUrl: opts.publicBaseUrl,
            igUserId,
          });
        }
      } catch {
        // use raw link
      }

      // Conversational state machine (SuperProfile Follower Gate & Email Capture)
      const buyerIgId = v.from?.id ?? v.id;
      const isConversational = !!(rule.askToFollow || rule.requireEmail);

      let dmText = "";
      if (isConversational) {
        createDmSession({
          igUserId,
          buyerIgId,
          username,
          state: rule.askToFollow ? "awaiting_follow" : "awaiting_email",
          ruleId: rule.id,
          commentId: v.id,
          resourceLink: link ?? opts.publicBaseUrl,
          resourceTitle: "Exclusive Monetization Guide",
          askToFollow: !!rule.askToFollow,
          requireEmail: !!rule.requireEmail,
        });

        if (rule.askToFollow) {
          dmText = `Hey @${username}! 👋 Thanks for checking out our post! To unlock your exclusive resource, make sure you're following @jinbandhan first.\n\nOnce followed, reply "YES" or send your email address right here!`;
        } else {
          dmText = `Hey @${username}! 🚀 What's your best email address to send your instant download and bonus templates?`;
        }
      } else {
        dmText = buildMessage(rule.message, username, link, plan);
      }

      // Rotate public comment reply variations (Superbadge algorithm boost)
      const publicReplyTemplates = [
        rule.publicCommentReply,
        "Check your DMs! Sent you the link 📩",
        "Sent to your inbox! ✨",
        "Just sent you a DM with details! 🚀",
        "Check your direct messages! 📬",
      ].filter(Boolean) as string[];

      const chosenPublicReply =
        publicReplyTemplates.length > 0
          ? publicReplyTemplates[Math.floor(Math.random() * publicReplyTemplates.length)]
          : null;

      enqueueReply({
        igUserId,
        commentId: v.id,
        username,
        text: dmText,
        publicReply: chosenPublicReply ?? null,
        receivedAt: Date.now(),
      });
      claimed++;
    }
  }

  logger.info("autodm comments processed", { claimed, skipped });
  return { claimed, skipped };
}
