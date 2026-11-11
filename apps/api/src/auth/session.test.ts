import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session.js";

describe("Session signing and verification", () => {
  const secret = "a_super_secret_test_key_32_chars_long_1234";

  it("signs and verifies valid session tokens", () => {
    const payload = {
      userId: "usr_123",
      email: "test@creator.com",
      creatorId: "crt_456",
      slug: "test-creator",
    };

    const token = signSession(payload, secret);
    expect(typeof token).toBe("string");
    expect(token).toContain(".");

    const verified = verifySession(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(payload.userId);
    expect(verified?.email).toBe(payload.email);
    expect(verified?.creatorId).toBe(payload.creatorId);
    expect(verified?.slug).toBe(payload.slug);
  });

  it("rejects tampered session tokens", () => {
    const token = signSession({ userId: "usr_123", email: "legit@test.com" }, secret);
    const tampered = token.slice(0, -4) + "abcd";
    expect(verifySession(tampered, secret)).toBeNull();
  });

  it("rejects tokens signed with a different secret", () => {
    const token = signSession({ userId: "usr_123", email: "legit@test.com" }, secret);
    const wrongSecret = "another_different_secret_key_12345678";
    expect(verifySession(token, wrongSecret)).toBeNull();
  });
});
