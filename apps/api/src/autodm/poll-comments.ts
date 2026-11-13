import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { automationRules, igAccounts, type Db } from "@hyperprofile/db";
import { decryptAesGcm, logger } from "@hyperprofile/shared";
import { isCommentClaimed } from "./claim.js";
import { processCommentWebhook } from "./process-comments.js";

function resolveAccountFile(): string {
  const p1 = path.resolve(process.cwd(), "real-ig-account.json");
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), "apps", "api", "real-ig-account.json");
  if (fs.existsSync(p2)) return p2;
  const p3 = path.resolve(process.cwd(), "..", "..", "real-ig-account.json");
  if (fs.existsSync(p3)) return p3;
  return p1;
}

function resolveRulesFile(): string {
  const local = path.resolve(process.cwd(), "real-ig-rules.json");
  if (fs.existsSync(local)) return local;
  const workspaceRoot = path.resolve(process.cwd(), "..", "..", "real-ig-rules.json");
  if (fs.existsSync(workspaceRoot)) return workspaceRoot;
  const apiSubdir = path.resolve(process.cwd(), "apps", "api", "real-ig-rules.json");
  if (fs.existsSync(apiSubdir)) return apiSubdir;
  return local;
}

export type CommentPollerConfig = {
  db: Db;
  tokenEncryptionKey: string;
  graphVersion?: string;
  intervalMs?: number;
  publicBaseUrl: string;
};

type PollerStats = {
  enabled: boolean;
  intervalMs: number;
  lastPollAt: string | null;
  lastCommentsChecked: number;
  totalMissedCommentsRecovered: number;
  monitoredMediaIds: string[];
  lastError: string | null;
};

const stats: PollerStats = {
  enabled: true,
  intervalMs: 15000,
  lastPollAt: null,
  lastCommentsChecked: 0,
  totalMissedCommentsRecovered: 0,
  monitoredMediaIds: [],
  lastError: null,
};

export function getPollerStatus(): PollerStats {
  return { ...stats };
}

/**
 * Single tick of comment polling across all active rule media.
 */
export async function pollActiveCommentsOnce(cfg: CommentPollerConfig): Promise<{
  checked: number;
  recovered: number;
}> {
  let checked = 0;
  let recovered = 0;

  // 1. Resolve Access Token directly from DB first (production cloud source of truth)
  let accessToken: string | null = null;
  let defaultIgUserId = "17841453478293915";

  try {
    const acctRows = await cfg.db
      .select()
      .from(igAccounts)
      .limit(5);

    for (const acct of acctRows) {
      if (acct?.accessTokenEncrypted && !acct.reauthRequiredAt) {
        try {
          accessToken = decryptAesGcm(acct.accessTokenEncrypted, cfg.tokenEncryptionKey);
          defaultIgUserId = acct.igUserId;
          break;
        } catch {
          // continue
        }
      }
    }
  } catch (err) {
    logger.warn("comment poller db account query warning", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Fallback to disk / env if DB did not provide token
  if (!accessToken) {
    try {
      const acctPath = resolveAccountFile();
      if (fs.existsSync(acctPath)) {
        const acct = JSON.parse(fs.readFileSync(acctPath, "utf8"));
        if (acct?.accessTokenEncrypted) {
          accessToken = decryptAesGcm(acct.accessTokenEncrypted, cfg.tokenEncryptionKey);
        }
        if (acct?.igUserId) defaultIgUserId = acct.igUserId;
      } else if (process.env.IG_ACCOUNT_DATA) {
        const acct = JSON.parse(process.env.IG_ACCOUNT_DATA);
        if (acct?.accessTokenEncrypted) {
          accessToken = decryptAesGcm(acct.accessTokenEncrypted, cfg.tokenEncryptionKey);
        }
        if (acct?.igUserId) defaultIgUserId = acct.igUserId;
      }
    } catch (err) {
      stats.lastError = `Token decrypt failed: ${err instanceof Error ? err.message : String(err)}`;
      return { checked: 0, recovered: 0 };
    }
  }

  if (!accessToken) {
    stats.lastError = "No access token found for comment polling";
    return { checked: 0, recovered: 0 };
  }

  // 2. Resolve Active Rules directly from DB first
  let rules: Array<any> = [];
  try {
    const dbRules = await cfg.db
      .select()
      .from(automationRules)
      .where(eq(automationRules.active, true));

    if (dbRules && dbRules.length > 0) {
      rules = dbRules;
    }
  } catch (err) {
    logger.warn("comment poller db rules query warning", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  if (rules.length === 0) {
    try {
      const rulesPath = resolveRulesFile();
      if (fs.existsSync(rulesPath)) {
        rules = JSON.parse(fs.readFileSync(rulesPath, "utf8")).filter((r: any) => r.active);
      }
    } catch {
      // fallback
    }
  }

  if (rules.length === 0) {
    stats.monitoredMediaIds = [];
    stats.lastError = null;
    return { checked: 0, recovered: 0 };
  }

  const graphVersion = cfg.graphVersion || "v21.0";

  // 3. Resolve Media IDs to monitor
  const mediaIds = Array.from(
    new Set(
      rules
        .map((r: any) => r.mediaId || r.media_id)
        .filter((id): id is string => typeof id === "string" && id.length > 5),
    ),
  );

  // If ANY rule applies to all media (mediaId empty) or if mediaIds list is empty,
  // query creator's recent media so all active posts/reels are monitored:
  const hasWildcardMediaRule = rules.some((r: any) => !(r.mediaId || r.media_id));
  if (hasWildcardMediaRule || mediaIds.length === 0) {
    try {
      const recentMediaUrl = `https://graph.facebook.com/${graphVersion}/${defaultIgUserId}/media?fields=id,caption&limit=8&access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(recentMediaUrl);
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ id: string }> };
        for (const item of json.data ?? []) {
          if (item.id && !mediaIds.includes(item.id)) {
            mediaIds.push(item.id);
          }
        }
      }
    } catch (err) {
      logger.warn("failed to fetch recent media for comment poller", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  stats.monitoredMediaIds = mediaIds;
  stats.lastPollAt = new Date().toISOString();
  stats.lastError = null;

  // 4. Poll comments for each monitored media
  for (const mediaId of mediaIds) {
    try {
      const url = `https://graph.facebook.com/${graphVersion}/${mediaId}/comments?fields=id,text,timestamp,from&limit=25&access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        logger.warn("comment poller graph error", { mediaId, status: res.status, body: text.slice(0, 200) });
        continue;
      }

      const json = (await res.json()) as { data?: Array<any> };
      const comments = json.data ?? [];
      checked += comments.length;

      for (const comment of comments) {
        if (!comment.id || !comment.text) continue;

        // Skip if already processed by Webhook or previous poller run
        if (isCommentClaimed(comment.id)) {
          continue;
        }

        // Never reply to the account's own comments
        if (comment.from?.id === defaultIgUserId || comment.from?.username === "jinbandhan") {
          continue;
        }

        // Synthesize standard Meta Webhook payload for processCommentWebhook
        logger.info("comment poller detected unhandled comment, ingesting", {
          commentId: comment.id,
          text: comment.text,
          author: comment.from?.username,
          mediaId,
        });

        const simulatedBody = {
          object: "instagram",
          entry: [
            {
              id: defaultIgUserId,
              time: Math.floor(new Date(comment.timestamp || Date.now()).getTime() / 1000),
              changes: [
                {
                  field: "comments",
                  value: {
                    id: comment.id,
                    text: comment.text,
                    from: comment.from,
                    media: { id: mediaId },
                  },
                },
              ],
            },
          ],
        };

        const result = await processCommentWebhook(cfg.db, simulatedBody, {
          publicBaseUrl: cfg.publicBaseUrl,
        });

        if (result.claimed > 0) {
          recovered += result.claimed;
          stats.totalMissedCommentsRecovered += result.claimed;
        }
      }
    } catch (err) {
      stats.lastError = err instanceof Error ? err.message : String(err);
      logger.warn("comment poller iteration error", {
        mediaId,
        err: stats.lastError,
      });
    }
  }

  stats.lastCommentsChecked = checked;
  return { checked, recovered };
}

/**
 * Starts continuous background active comment poller (default every 20 seconds).
 * Provides dual-ingestion resilience:
 * - Primary: Real-time Webhooks (< 1 sec)
 * - Fallback: Active Poller (within 20 sec) for missed/delayed webhooks
 */
export function startCommentPoller(cfg: CommentPollerConfig): () => void {
  const interval = cfg.intervalMs ?? 20000;
  stats.intervalMs = interval;
  let busy = false;

  logger.info("starting active comment poller fallback worker", { intervalMs: interval });

  const timer = setInterval(() => {
    void (async () => {
      if (busy) return;
      busy = true;
      try {
        await pollActiveCommentsOnce(cfg);
      } catch (err) {
        logger.error("comment poller tick failed", {
          err: err instanceof Error ? err.message : String(err),
        });
      } finally {
        busy = false;
      }
    })();
  }, interval);

  // Initial immediate background probe after 2 seconds
  setTimeout(() => {
    void pollActiveCommentsOnce(cfg).catch(() => {});
  }, 2000);

  return () => clearInterval(timer);
}

