import { describe, expect, it } from "vitest";

const RESERVED = new Set(["admin", "api", "www", "app", "login", "signup", "hyperprofile"]);

function isValidSlug(slug: string): boolean {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(slug)) return false;
  if (RESERVED.has(slug)) return false;
  return true;
}

describe("slug rules", () => {
  it("accepts creator slugs", () => {
    expect(isValidSlug("chahat-jain")).toBe(true);
  });
  it("rejects reserved words", () => {
    expect(isValidSlug("admin")).toBe(false);
  });
});
