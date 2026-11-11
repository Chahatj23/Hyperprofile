import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cfg } from "./config.js";

const key = Buffer.from(cfg.tokenKeyHex, "hex");
if (key.length !== 32) throw new Error("TOKEN_ENC_KEY must be 32 bytes (64 hex chars)");

/** AES-256-GCM. Output = base64(iv|tag|ciphertext). Tokens are bearer credentials: never store plaintext. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}
export function decrypt(b64: string): string {
  const b = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** X-Hub-Signature-256 = sha256 HMAC of the RAW body, keyed by the app secret (not the verify token). */
export function verifyWebhookSignature(raw: Buffer, header: string | undefined): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", cfg.appSecret).update(raw).digest("hex");
  return safeEqual(expected, header.slice(7));
}

/** Signed, expiring OAuth `state` (CSRF guard + carries who started the flow). Uses its own secret. */
export function signState(payload: Record<string, unknown>, ttlSec = 600): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString("base64url");
  const sig = createHmac("sha256", cfg.stateSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifyState<T = Record<string, unknown>>(state: string): T | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", cfg.stateSecret).update(body).digest("base64url");
  if (!safeEqual(expected, sig)) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  return p.exp > Date.now() / 1000 ? (p as T) : null;
}

/** Deauthorize / data-deletion callbacks send `signed_request` = sig.payload. HMAC covers the ENCODED payload. */
export function parseSignedRequest(sr: string): { user_id?: string } | null {
  const [sig, payload] = sr.split(".", 2);
  if (!sig || !payload) return null;
  const expected = createHmac("sha256", cfg.appSecret).update(payload).digest();
  const provided = Buffer.from(sig, "base64url");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}
