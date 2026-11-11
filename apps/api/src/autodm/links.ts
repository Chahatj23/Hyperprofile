import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { linkClicks, trackedLinks, type Db } from "@hyperprofile/db";

/** Affiliate deep links must stay raw (SuperProfile / TEARDOWN carve-out). */
const NEVER_REWRITE_HOSTS = new Set([
  "amazon.in",
  "www.amazon.in",
  "amazon.com",
  "www.amazon.com",
  "amzn.to",
  "flipkart.com",
  "www.flipkart.com",
  "dl.flipkart.com",
]);

export function shouldSkipTracking(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return NEVER_REWRITE_HOSTS.has(host) || host.endsWith(".amazon.in") || host.endsWith(".amazon.com");
  } catch {
    return true;
  }
}

/**
 * Wrap a destination in a first-party /r/:id redirect, unless allow-listed.
 * Returns the URL to embed in the DM text.
 */
export async function maybeTrackedLink(
  db: Db,
  opts: { url: string; publicBaseUrl: string; igUserId: string },
): Promise<string> {
  if (shouldSkipTracking(opts.url)) return opts.url;

  const shortId = randomBytes(5).toString("hex");
  await db.insert(trackedLinks).values({
    shortId,
    targetUrl: opts.url,
    igUserId: opts.igUserId,
  });
  const base = opts.publicBaseUrl.replace(/\/$/, "");
  return `${base}/r/${shortId}`;
}

export async function resolveAndRecordClick(
  db: Db,
  shortId: string,
): Promise<string | null> {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("db_timeout")), 100));
    const row = (
      await Promise.race([
        db.select().from(trackedLinks).where(eq(trackedLinks.shortId, shortId)).limit(1),
        timeout,
      ])
    )[0];
    if (!row) return null;
    void Promise.race([
      db.insert(linkClicks).values({ shortId }),
      timeout,
    ]).catch(() => {});
    return row.targetUrl;
  } catch {
    return null;
  }
}
