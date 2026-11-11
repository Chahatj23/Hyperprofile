import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSignedRequest } from "./webhook.js";

describe("parseSignedRequest (compliance)", () => {
  it("verifies Meta signed_request payload", () => {
    const secret = "test-app-secret";
    const payload = Buffer.from(JSON.stringify({ user_id: "12345", algorithm: "HMAC-SHA256" })).toString(
      "base64url",
    );
    const sig = createHmac("sha256", secret).update(payload).digest("base64url");
    const parsed = parseSignedRequest(`${sig}.${payload}`, secret);
    expect(parsed?.user_id).toBe("12345");
    expect(parseSignedRequest(`${sig}.${payload}`, "wrong")).toBeNull();
  });
});
