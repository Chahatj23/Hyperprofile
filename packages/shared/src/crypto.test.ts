import { describe, expect, it } from "vitest";
import { decryptAesGcm, encryptAesGcm } from "./crypto.js";

describe("AES-256-GCM", () => {
  it("round-trips a token", () => {
    const key = "a".repeat(64);
    const encrypted = encryptAesGcm("ig-token-secret", key);
    expect(encrypted.split(":")).toHaveLength(3);
    expect(decryptAesGcm(encrypted, key)).toBe("ig-token-secret");
  });
});
