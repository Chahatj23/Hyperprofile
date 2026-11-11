/** In-memory store for the demo. Production: Postgres (see schema.sql). The unique claim on comment_id is the key invariant. */
export interface Account {
  igUserId: string; username: string; ownerId: string;
  tokenEnc: string; expiresAt: number; reauthAt?: number; subscribedAt?: number;
}
export interface Rule {
  id: string; igUserId: string; keyword: string; // empty keyword = any comment
  mediaId?: string; message: string; link?: string; active: boolean;
}
export type ClaimStatus = "queued" | "sent" | "failed" | "expired";

class Store {
  accounts = new Map<string, Account>();
  rules = new Map<string, Rule>();
  claims = new Map<string, { status: ClaimStatus; reason?: string; at: number }>();
  clicks = new Map<string, number>();

  /** Atomic claim: returns false if this comment was already claimed (webhook redelivery, duplicate). */
  claim(commentId: string): boolean {
    if (this.claims.has(commentId)) return false;
    this.claims.set(commentId, { status: "queued", at: Date.now() });
    return true;
  }
  mark(commentId: string, status: ClaimStatus, reason?: string) {
    this.claims.set(commentId, { status, reason, at: Date.now() });
  }
  rulesFor(igUserId: string) {
    return [...this.rules.values()].filter((r) => r.igUserId === igUserId && r.active);
  }
}
export const store = new Store();
