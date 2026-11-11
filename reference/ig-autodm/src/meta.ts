import { cfg } from "./config.js";

const GRAPH = () => `https://graph.instagram.com/${cfg.apiVersion}`;
export const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
];
export const WEBHOOK_FIELDS = ["comments", "live_comments", "messages"];

export type ErrorKind = "rate" | "token" | "window" | "transient" | "permission" | "fatal";

export class MetaError extends Error {
  constructor(public status: number, public code?: number, public subcode?: number, public fbtrace?: string, message?: string) {
    super(message ?? `Meta API error ${status}/${code}/${subcode}`);
  }
  /** Classify on the error CODE, not the HTTP status: Meta throttles with HTTP 400, never 429. */
  get kind(): ErrorKind {
    if ([4, 17, 32, 613].includes(this.code ?? -1)) return "rate";
    if (this.code === 190 || this.code === 102) return "token";
    if (this.code === 10 && this.subcode === 2534022) return "window";
    if ([1, 2].includes(this.code ?? -1) || this.status >= 500) return "transient";
    if (this.code === 10 || (this.code !== undefined && this.code >= 200 && this.code < 300)) return "permission";
    return "fatal";
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await fetch(url, init); }
  catch (e) { throw new MetaError(599, undefined, undefined, undefined, `network error: ${(e as Error).message}`); } // transient
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  // Three independent checks: error envelope, HTTP status, and (callers) success flag.
  if (json?.error || !res.ok) {
    const e = json?.error ?? {};
    throw new MetaError(res.status, e.code, e.error_subcode, e.fbtrace_id, e.message ?? json?.error_message ?? text.slice(0, 200));
  }
  return json as T;
}

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.appId, redirect_uri: cfg.redirectUri, response_type: "code",
    scope: SCOPES.join(","), state,
  });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

export async function exchangeCode(code: string): Promise<{ token: string; userId: string }> {
  const body = new URLSearchParams({
    client_id: cfg.appId, client_secret: cfg.appSecret, grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri, code,
  });
  const j: any = await call("https://api.instagram.com/oauth/access_token", { method: "POST", body });
  const t = j.data?.[0] ?? j; // response shape has varied; accept both
  return { token: t.access_token, userId: String(t.user_id) };
}

export async function toLongLived(shortToken: string): Promise<{ token: string; expiresAt: number }> {
  const q = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: cfg.appSecret, access_token: shortToken });
  const j = await call<{ access_token: string; expires_in: number }>(`https://graph.instagram.com/access_token?${q}`);
  return { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
}

/** Only works on tokens >= 24h old and not yet expired. A 190 here means: stop, user must reconnect. */
export async function refreshToken(token: string): Promise<{ token: string; expiresAt: number }> {
  const q = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token });
  const j = await call<{ access_token: string; expires_in: number }>(`https://graph.instagram.com/refresh_access_token?${q}`);
  return { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
}

export async function getMe(token: string): Promise<{ user_id: string; username: string; name?: string }> {
  const q = new URLSearchParams({ fields: "user_id,username,name", access_token: token });
  return call(`${GRAPH()}/me?${q}`);
}

/** Subscribing REPLACES the field set, so always send the full list. Check body.success, not just HTTP 200. */
export async function subscribe(token: string): Promise<void> {
  const q = new URLSearchParams({ subscribed_fields: WEBHOOK_FIELDS.join(","), access_token: token });
  const j = await call<{ success?: boolean }>(`${GRAPH()}/me/subscribed_apps?${q}`, { method: "POST" });
  if (j.success !== true) throw new MetaError(200, undefined, undefined, undefined, "subscribed_apps returned success:false");
}

export async function unsubscribe(token: string): Promise<void> {
  await call(`${GRAPH()}/me/subscribed_apps?access_token=${encodeURIComponent(token)}`, { method: "DELETE" });
}

/** One private reply per comment, within 7 days. recipient = comment_id (not an IGSID). */
export async function sendPrivateReply(igUserId: string, token: string, commentId: string, text: string) {
  if (Buffer.byteLength(text, "utf8") > 1000) throw new MetaError(400, 100, undefined, undefined, "message exceeds 1000 bytes");
  return call<{ recipient_id: string; message_id: string }>(`${GRAPH()}/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
  });
}
