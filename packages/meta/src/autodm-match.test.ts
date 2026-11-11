import { describe, expect, it } from "vitest";
import { ruleMatchesComment, shouldIgnoreComment } from "./autodm-match.js";

describe("ruleMatchesComment", () => {
  it("matches keyword case-insensitively and strips punctuation", () => {
    expect(
      ruleMatchesComment({ keyword: "GUIDE" }, { id: "1", text: "Please send GUIDE!" }),
    ).toBe(true);
    expect(ruleMatchesComment({ keyword: "guide" }, { id: "1", text: "hello" })).toBe(false);
  });

  it("empty keyword matches any comment", () => {
    expect(ruleMatchesComment({ keyword: "" }, { id: "1", text: "anything" })).toBe(true);
  });

  it("filters by mediaId when set", () => {
    expect(
      ruleMatchesComment(
        { keyword: "", mediaId: "m1" },
        { id: "1", text: "x", media: { id: "m2" } },
      ),
    ).toBe(false);
    expect(
      ruleMatchesComment(
        { keyword: "", mediaId: "m1" },
        { id: "1", text: "x", media: { id: "m1" } },
      ),
    ).toBe(true);
  });
});

describe("shouldIgnoreComment", () => {
  it("ignores own comments and thread replies", () => {
    expect(
      shouldIgnoreComment("ig1", { id: "c1", from: { id: "ig1" }, text: "hi" }),
    ).toBe(true);
    expect(
      shouldIgnoreComment("ig1", {
        id: "c1",
        from: { id: "other" },
        parent_id: "c0",
        text: "reply",
      }),
    ).toBe(true);
    expect(
      shouldIgnoreComment("ig1", { id: "c1", from: { id: "other" }, text: "GUIDE" }),
    ).toBe(false);
  });
});
