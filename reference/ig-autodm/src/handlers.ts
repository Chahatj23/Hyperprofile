import { randomBytes } from "node:crypto";
import { cfg } from "./config.js";
import { enqueue } from "./queue.js";
import { store, Rule } from "./store.js";

/**
 * Webhook shape for comments: entry[].changes[] = { field: "comments", value: {...} }.
 * (DMs use entry[].messaging[] instead.) Verify against the dashboard "Test" payload before relying on it.
 */
interface CommentValue { id: string; text?: string; parent_id?: string; from?: { id: string; username?: string }; media?: { id: string } }

export function matches(rule: Rule, v: CommentValue): boolean {
  if (rule.mediaId && rule.mediaId !== v.media?.id) return false;
  if (!rule.keyword) return true;
  const words = (v.text ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return words.includes(rule.keyword.toLowerCase());
}

/** Wrap links in a first-party redirect so clicks are countable (SuperProfile does this by default). */
function trackedLink(url: string): string {
  const id = randomBytes(5).toString("hex");
  store.clicks.set(id, 0);
  trackedTargets.set(id, url);
  return `${cfg.publicUrl}/r/${id}`;
}
export const trackedTargets = new Map<string, string>();

export function handleWebhookPayload(payload: any) {
  if (payload?.object !== "instagram") return;
  for (const entry of payload.entry ?? []) {            // never index entry[0]
    for (const ch of entry.changes ?? []) {
      if (ch.field !== "comments") continue;
      const v: CommentValue = ch.value;
      if (!v?.id || !v.from) continue;
      if (v.from.id === entry.id) continue;              // the creator's own comment/reply
      if (v.parent_id) continue;                         // reply inside a thread; top-level only (policy choice)
      const rule = store.rulesFor(entry.id).find((r) => matches(r, v));
      if (!rule) continue;
      if (!store.claim(v.id)) continue;                  // idempotency: claim BEFORE sending
      const name = v.from.username ?? "there";
      const link = rule.link ? trackedLink(rule.link) : "";
      enqueue({
        igUserId: entry.id, commentId: v.id, username: name, receivedAt: Date.now(),
        text: `${rule.message.replaceAll("{name}", name)} ${link}`.trim(),
      });
    }
  }
}
