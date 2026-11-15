import { createHmac, timingSafeEqual } from "node:crypto";

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * X-Hub-Signature-256 = sha256 HMAC of the RAW body, keyed by the app secret
 * (not the hub.verify_token). Supports single or multiple secrets for zero-downtime rotation.
 */
export function verifyWebhookSignature(
  raw: Buffer,
  header: string | undefined,
  appSecret: string | string[],
): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const secrets = Array.isArray(appSecret)
    ? appSecret
    : appSecret.split(",").map((s) => s.trim()).filter(Boolean);

  const sig = header.slice(7);
  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    if (safeEqual(expected, sig)) {
      return true;
    }
  }
  return false;
}

/**
 * Deauthorize / data-deletion callbacks send signed_request = sig.payload.
 * HMAC covers the ENCODED payload (reference/ig-autodm). Supports dual secrets during rotation.
 */
export function parseSignedRequest(
  signedRequest: string,
  appSecret: string | string[],
): { user_id?: string } | null {
  const [sig, payload] = signedRequest.split(".", 2);
  if (!sig || !payload) return null;

  const secrets = Array.isArray(appSecret)
    ? appSecret
    : appSecret.split(",").map((s) => s.trim()).filter(Boolean);

  let verified = false;
  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(payload).digest("base64url");
    if (safeEqual(expected, sig)) {
      verified = true;
      break;
    }
  }
  if (!verified) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      user_id?: string;
    };
  } catch {
    return null;
  }
}
