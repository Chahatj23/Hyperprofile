import { MetaError } from "./errors.js";
import { graphCall } from "./client.js";

export type RefreshedToken = {
  accessToken: string;
  expiresAt: Date | null;
  method: "fb_exchange_token" | "ig_refresh_token";
};

export type RefreshTokenOptions = {
  graphVersion?: string;
  appId: string;
  appSecret: string;
};

/**
 * Refresh a Unified Login / FLfB system-user or long-lived user token.
 * Tries Facebook `fb_exchange_token` first, then Instagram `ig_refresh_token`.
 * Tokens that are not yet 24h old may fail IG refresh — caller should buffer.
 */
export async function refreshAccessToken(
  accessToken: string,
  opts: RefreshTokenOptions,
): Promise<RefreshedToken> {
  const version = opts.graphVersion ?? "v21.0";
  const attempts: string[] = [];

  try {
    const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", opts.appId);
    url.searchParams.set("client_secret", opts.appSecret);
    url.searchParams.set("fb_exchange_token", accessToken);
    url.searchParams.set("set_token_expires_in_60_days", "true");
    const j = await graphCall<{ access_token?: string; expires_in?: number }>(url.toString());
    if (j.access_token) {
      return {
        accessToken: j.access_token,
        expiresAt:
          typeof j.expires_in === "number"
            ? new Date(Date.now() + j.expires_in * 1000)
            : null,
        method: "fb_exchange_token",
      };
    }
    attempts.push("fb_exchange_token: missing access_token");
  } catch (e) {
    attempts.push(
      `fb_exchange_token: ${e instanceof MetaError ? e.message : String(e)}`,
    );
  }

  try {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", accessToken);
    const j = await graphCall<{ access_token?: string; expires_in?: number }>(url.toString());
    if (j.access_token) {
      return {
        accessToken: j.access_token,
        expiresAt:
          typeof j.expires_in === "number"
            ? new Date(Date.now() + j.expires_in * 1000)
            : null,
        method: "ig_refresh_token",
      };
    }
    attempts.push("ig_refresh_token: missing access_token");
  } catch (e) {
    attempts.push(
      `ig_refresh_token: ${e instanceof MetaError ? e.message : String(e)}`,
    );
  }

  throw new MetaError(
    400,
    190,
    undefined,
    undefined,
    `token refresh failed: ${attempts.join(" | ")}`,
  );
}
