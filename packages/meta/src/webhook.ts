import { createHmac, timingSafeEqual } from "node:crypto";

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * X-Hub-Signature-256 = sha256 HMAC of the RAW body, keyed by the app secret
 * (not the hub.verify_token).
 */
export function verifyWebhookSignature(
  raw: Buffer,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(raw).digest("hex");
  return safeEqual(expected, header.slice(7));
}

/**
 * Deauthorize / data-deletion callbacks send signed_request = sig.payload.
 * HMAC covers the ENCODED payload (reference/ig-autodm).
 */
export function parseSignedRequest(
  signedRequest: string,
  appSecret: string,
): { user_id?: string } | null {
  const [sig, payload] = signedRequest.split(".", 2);
  if (!sig || !payload) return null;
  const expected = createHmac("sha256", appSecret).update(payload).digest("base64url");
  if (!safeEqual(expected, sig)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      user_id?: string;
    };
  } catch {
    return null;
  }
}
