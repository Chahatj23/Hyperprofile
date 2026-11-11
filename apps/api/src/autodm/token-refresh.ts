import { and, eq, isNull, lte, or } from "drizzle-orm";
import { igAccounts, type Db } from "@hyperprofile/db";
import { MetaError, refreshAccessToken, subscribeIgWebhooks } from "@hyperprofile/meta";
import { decryptAesGcm, encryptAesGcm, logger } from "@hyperprofile/shared";

export type TokenRefreshConfig = {
  db: Db;
  appId: string;
  appSecret: string;
  tokenEncryptionKey: string;
  graphVersion: string;
  /** Refresh when expiry is within this window (default 3 days). */
  refreshWithinMs?: number;
};

/**
 * Hourly job: skip reauth tokens; refresh those expiring within the buffer;
 * re-subscribe webhook fields after a successful refresh.
 */
export async function refreshDueTokens(cfg: TokenRefreshConfig): Promise<{
  refreshed: number;
  skipped: number;
  failed: number;
}> {
  const withinMs = cfg.refreshWithinMs ?? 3 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() + withinMs);

  const rows = await cfg.db
    .select()
    .from(igAccounts)
    .where(
      and(
        isNull(igAccounts.reauthRequiredAt),
        or(
          isNull(igAccounts.tokenExpiresAt),
          lte(igAccounts.tokenExpiresAt, cutoff),
        ),
      ),
    )
    .limit(100);

  let refreshed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    // Non-expiring tokens (null expires) only refresh if never subscribed
    if (row.tokenExpiresAt == null && row.subscribedAt != null) {
      skipped++;
      continue;
    }
    if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() <= Date.now()) {
      await cfg.db
        .update(igAccounts)
        .set({ reauthRequiredAt: new Date(), updatedAt: new Date() })
        .where(eq(igAccounts.id, row.id));
      failed++;
      logger.warn("ig token already expired — mark reauth", { username: row.username });
      continue;
    }

    try {
      const token = decryptAesGcm(row.accessTokenEncrypted, cfg.tokenEncryptionKey);
      const next = await refreshAccessToken(token, {
        appId: cfg.appId,
        appSecret: cfg.appSecret,
        graphVersion: cfg.graphVersion,
      });
      const encrypted = encryptAesGcm(next.accessToken, cfg.tokenEncryptionKey);

      await subscribeIgWebhooks(row.igUserId, next.accessToken, {
        graphVersion: cfg.graphVersion,
      });

      await cfg.db
        .update(igAccounts)
        .set({
          accessTokenEncrypted: encrypted,
          tokenExpiresAt: next.expiresAt,
          subscribedAt: new Date(),
          updatedAt: new Date(),
          reauthRequiredAt: null,
        })
        .where(eq(igAccounts.id, row.id));

      refreshed++;
      logger.info("ig token refreshed", {
        username: row.username,
        method: next.method,
        expiresAt: next.expiresAt?.toISOString() ?? null,
      });
    } catch (e) {
      failed++;
      if (e instanceof MetaError && e.kind === "token") {
        await cfg.db
          .update(igAccounts)
          .set({ reauthRequiredAt: new Date(), updatedAt: new Date() })
          .where(eq(igAccounts.id, row.id));
      }
      logger.error("ig token refresh failed", {
        username: row.username,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { refreshed, skipped, failed };
}

export function startTokenRefreshJob(cfg: TokenRefreshConfig): () => void {
  const run = () => {
    void refreshDueTokens(cfg)
      .then((r) => {
        logger.info("token refresh tick", r);
      })
      .catch((err) => {
        logger.warn("token refresh job tick failed (db unreachable)", { err: String(err) });
      });
  };
  // Delay first run slightly so boot isn't blocked
  const initial = setTimeout(run, 15_000);
  const timer = setInterval(run, 3_600_000);
  return () => {
    clearTimeout(initial);
    clearInterval(timer);
  };
}
