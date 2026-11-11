export type CommentMatchValue = {
  id: string;
  text?: string;
  parent_id?: string;
  from?: { id: string; username?: string };
  media?: { id: string };
};

export type RuleMatchInput = {
  keyword: string;
  mediaId?: string | null;
};

/**
 * Keyword match: empty keyword = any comment.
 * Splits on non-letter/number (Unicode) so "GUIDE!" still matches GUIDE.
 */
export function ruleMatchesComment(rule: RuleMatchInput, v: CommentMatchValue): boolean {
  if (rule.mediaId && rule.mediaId !== v.media?.id) return false;
  if (!rule.keyword || !rule.keyword.trim()) return true;

  const text = (v.text ?? "").toLowerCase();
  const words = text.split(/[^\p{L}\p{N}]+/u);
  const keywords = rule.keyword
    .toLowerCase()
    .split(/[,;|]+/)
    .map((k) => k.trim())
    .filter(Boolean);

  if (keywords.length === 0) return true;

  // Match if any configured keyword is in words or substring of text
  return keywords.some((k) => words.includes(k) || text.includes(k));
}

/** Skip creator's own comments and in-thread replies (policy from reference). */
export function shouldIgnoreComment(
  entryIgUserId: string,
  v: CommentMatchValue,
): boolean {
  if (!v.id || !v.from?.id) return true;
  if (v.from.id === entryIgUserId) return true;
  if (v.parent_id) return true;
  return false;
}
