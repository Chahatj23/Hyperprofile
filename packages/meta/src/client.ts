import { MetaError } from "./errors.js";

export const WEBHOOK_FIELDS = ["comments", "live_comments", "messages"] as const;

export type GraphClientOptions = {
  graphVersion?: string;
  /** Default graph.facebook.com for Unified Login / FLfB tokens */
  host?: "facebook" | "instagram";
};

function graphBase(opts: GraphClientOptions = {}): string {
  const version = opts.graphVersion ?? "v21.0";
  const host =
    opts.host === "instagram" ? "https://graph.instagram.com" : "https://graph.facebook.com";
  return `${host}/${version}`;
}

type GraphErrorBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_message?: string;
  };
  error_message?: string;
  success?: boolean;
};

/**
 * Low-level Graph call. Throws MetaError with code/subcode/fbtrace_id.
 */
export async function graphCall<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new MetaError(
      599,
      undefined,
      undefined,
      undefined,
      `network error: ${(e as Error).message}`,
    );
  }

  const text = await res.text();
  let json: GraphErrorBody | null = null;
  try {
    json = JSON.parse(text) as GraphErrorBody;
  } catch {
    /* non-JSON */
  }

  if (json?.error || !res.ok) {
    const e = json?.error ?? {};
    throw new MetaError(
      res.status,
      e.code,
      e.error_subcode,
      e.fbtrace_id,
      e.message ?? json?.error_message ?? text.slice(0, 200),
    );
  }

  return json as T;
}

/**
 * Subscribe IG account to webhook fields. REPLACES the field set — always send the full list.
 * Check body.success, not just HTTP 200.
 * Unified Login: POST graph.facebook.com/{ig-user-id}/subscribed_apps
 */
export async function subscribeIgWebhooks(
  igUserId: string,
  accessToken: string,
  opts: GraphClientOptions & { fields?: readonly string[] } = {},
): Promise<void> {
  const fields = (opts.fields ?? WEBHOOK_FIELDS).join(",");
  const url = new URL(`${graphBase(opts)}/${igUserId}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", fields);
  url.searchParams.set("access_token", accessToken);
  const j = await graphCall<{ success?: boolean }>(url.toString(), { method: "POST" });
  if (j.success !== true) {
    throw new MetaError(200, undefined, undefined, undefined, "subscribed_apps returned success:false");
  }
}

export async function unsubscribeIgWebhooks(
  igUserId: string,
  accessToken: string,
  opts: GraphClientOptions = {},
): Promise<void> {
  const url = new URL(`${graphBase(opts)}/${igUserId}/subscribed_apps`);
  url.searchParams.set("access_token", accessToken);
  await graphCall(url.toString(), { method: "DELETE" });
}

export type PrivateReplyResult = {
  recipient_id?: string;
  message_id?: string;
};

/**
 * One private reply per comment, within 7 days. recipient = comment_id (not an IGSID).
 * Message ≤ 1000 UTF-8 bytes.
 */
export async function sendPrivateReply(
  igUserId: string,
  accessToken: string,
  commentId: string,
  text: string,
  opts: GraphClientOptions = {},
): Promise<PrivateReplyResult> {
  if (Buffer.byteLength(text, "utf8") > 1000) {
    throw new MetaError(400, 100, undefined, undefined, "message exceeds 1000 bytes");
  }
  const url = `${graphBase(opts)}/${igUserId}/messages`;
  return graphCall<PrivateReplyResult>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text },
    }),
  });
}

export type PublicCommentReplyResult = {
  id?: string;
  success?: boolean;
};

/**
 * Send a direct message in an ongoing Instagram DM conversation:
 * POST graph.facebook.com/v21.0/{ig_user_id}/messages
 * Body: { recipient: { id: recipientId }, message: { text } }
 */
export async function sendDirectMessage(
  igUserId: string,
  accessToken: string,
  recipientId: string,
  text: string,
  opts: GraphClientOptions = {},
): Promise<PrivateReplyResult> {
  if (Buffer.byteLength(text, "utf8") > 1000) {
    throw new MetaError(400, 100, undefined, undefined, "message exceeds 1000 bytes");
  }
  const url = `${graphBase(opts)}/${igUserId}/messages`;
  return graphCall<PrivateReplyResult>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });
}

/**
 * Send a public reply to an Instagram comment (Superbadge feature):
 * POST graph.facebook.com/v21.0/{comment_id}/replies
 * Body: { message: text }
 */
export async function sendPublicCommentReply(
  commentId: string,
  accessToken: string,
  text: string,
  opts: GraphClientOptions = {},
): Promise<PublicCommentReplyResult> {
  const url = `${graphBase(opts)}/${commentId}/replies`;
  return graphCall<PublicCommentReplyResult>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message: text }),
  });
}
