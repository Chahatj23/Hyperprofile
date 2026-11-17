import { logger } from "@hyperprofile/shared";

export interface CloudflarePurgeOptions {
  zoneId?: string | undefined;
  apiToken?: string | undefined;
}

export interface PurgeResult {
  success: boolean;
  purgedCount: number;
  error?: string;
}

/**
 * Zero-Cost Architecture Helper: Purge edge cache at Cloudflare
 * when creators publish page changes or update products.
 *
 * Cloudflare caches public creator pages at the edge with long s-maxage.
 * When the creator updates their page, this function purges the edge cache
 * so fresh content is instantly visible without waiting for cache expiration.
 */
export async function purgeCloudflareCache(
  urls: string[],
  options?: CloudflarePurgeOptions,
): Promise<PurgeResult> {
  const zoneId = options?.zoneId ?? process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = options?.apiToken ?? process.env.CLOUDFLARE_API_TOKEN;

  if (!zoneId || !apiToken) {
    logger.debug("cloudflare purge skipped: CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN not configured", {
      urlsCount: urls.length,
    });
    return { success: true, purgedCount: 0 };
  }

  if (urls.length === 0) {
    return { success: true, purgedCount: 0 };
  }

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: urls }),
    });

    const data = (await res.json()) as { success?: boolean; errors?: Array<{ message?: string }> };

    if (!res.ok || !data.success) {
      const errMsg = data.errors?.[0]?.message || `Cloudflare purge failed with status ${res.status}`;
      logger.warn("cloudflare edge cache purge warning", { error: errMsg, urls });
      return { success: false, purgedCount: 0, error: errMsg };
    }

    logger.info("cloudflare edge cache purged successfully", { purgedCount: urls.length, urls });
    return { success: true, purgedCount: urls.length };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("cloudflare edge cache purge request failed", { error: errMsg, urls });
    return { success: false, purgedCount: 0, error: errMsg };
  }
}
