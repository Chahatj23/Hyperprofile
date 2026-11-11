import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl, signState, verifyState } from "./oauth.js";

describe("oauth helpers", () => {
  it("signs and verifies state", () => {
    const token = signState("creator:demo", "session-secret-at-least-32-chars!!");
    expect(verifyState(token, "session-secret-at-least-32-chars!!")).toBe("creator:demo");
    expect(verifyState(token, "wrong-secret-at-least-32-characters")).toBeNull();
  });

  it("builds authorize url with config_id", () => {
    const url = buildAuthorizeUrl(
      {
        appId: "123",
        appSecret: "secret",
        configId: "456",
        redirectUri: "https://example.com/callback",
      },
      "state1",
    );
    expect(url).toContain("client_id=123");
    expect(url).toContain("config_id=456");
    expect(url).toContain("redirect_uri=");
  });
});
