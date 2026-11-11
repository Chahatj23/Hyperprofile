import { cfg } from "./config.js";
import { decrypt } from "./crypto.js";
import { MetaError, sendPrivateReply } from "./meta.js";
import { store } from "./store.js";

export interface ReplyJob {
  igUserId: string; commentId: string; username: string; text: string;
  receivedAt: number; attempts: number; notBefore: number;
}

const jobs: ReplyJob[] = [];
const sentLog = new Map<string, number[]>(); // per-account send timestamps (sliding 1h window)

export const enqueue = (j: Omit<ReplyJob, "attempts" | "notBefore">) =>
  jobs.push({ ...j, attempts: 0, notBefore: 0 });

function hasCapacity(igUserId: string): boolean {
  const cutoff = Date.now() - 3600_000;
  const arr = (sentLog.get(igUserId) ?? []).filter((t) => t > cutoff);
  sentLog.set(igUserId, arr);
  return arr.length < cfg.hourlyCap;
}

async function process(job: ReplyJob): Promise<"done" | "retry"> {
  const acct = store.accounts.get(job.igUserId);
  if (!acct || acct.reauthAt) { store.mark(job.commentId, "failed", "account disconnected or needs reauth"); return "done"; }
  if (Date.now() - job.receivedAt > cfg.replyWindowMs) { store.mark(job.commentId, "expired", "7-day window passed"); return "done"; }
  try {
    await sendPrivateReply(job.igUserId, decrypt(acct.tokenEnc), job.commentId, job.text);
    sentLog.get(job.igUserId)!.push(Date.now());
    store.mark(job.commentId, "sent");
    return "done";
  } catch (e) {
    if (!(e instanceof MetaError)) throw e;
    console.warn(`[send] ${job.commentId} kind=${e.kind} code=${e.code} sub=${e.subcode} trace=${e.fbtrace}`);
    switch (e.kind) {
      case "rate":      job.notBefore = Date.now() + 5 * 60_000; return "retry"; // honour wait; header parsing = TODO
      case "transient": if (++job.attempts < 5) { job.notBefore = Date.now() + 2 ** job.attempts * 5_000; return "retry"; }
                        store.mark(job.commentId, "failed", "transient errors exhausted"); return "done";
      case "token":     acct.reauthAt = Date.now(); store.mark(job.commentId, "failed", "token invalid: reconnect"); return "done";
      default:          store.mark(job.commentId, "failed", `${e.kind}: ${e.message}`); return "done";
    }
  }
}

/** Single-process worker loop. Production: BullMQ/SQS with per-account rate limiter and a dead-letter queue. */
export function startWorker() {
  let busy = false;
  setInterval(async () => {
    if (busy) return; busy = true;
    try {
      const now = Date.now();
      for (let i = 0; i < jobs.length; i++) {
        const j = jobs[i];
        if (j.notBefore > now || !hasCapacity(j.igUserId)) continue; // queue, never drop
        jobs.splice(i--, 1);
        if ((await process(j)) === "retry") jobs.push(j);
      }
    } finally { busy = false; }
  }, 1000);
}
export const queueDepth = () => jobs.length;
