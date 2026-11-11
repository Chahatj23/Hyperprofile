import { describe, expect, it } from "vitest";
import { classifyMetaError, MetaError } from "./errors.js";
import { sendPrivateReply } from "./client.js";
import { safeEqual, verifyWebhookSignature } from "./webhook.js";
import { createHmac } from "node:crypto";

describe("MetaError classification", () => {
  it("classifies rate limits by code not HTTP status", () => {
    expect(new MetaError(400, 4).kind).toBe("rate");
    expect(new MetaError(400, 17).kind).toBe("rate");
    expect(new MetaError(400, 32).kind).toBe("rate");
    expect(new MetaError(400, 613).kind).toBe("rate");
  });

  it("classifies token and window errors", () => {
    expect(new MetaError(400, 190).kind).toBe("token");
    expect(new MetaError(401, 102).kind).toBe("token");
    expect(new MetaError(400, 10, 2534022).kind).toBe("window");
  });

  it("classifies transient and permission", () => {
    expect(new MetaError(500, 1).kind).toBe("transient");
    expect(new MetaError(599).kind).toBe("transient");
    expect(new MetaError(400, 10).kind).toBe("permission");
    expect(classifyMetaError(400, 100)).toBe("fatal");
  });
});

describe("sendPrivateReply guards", () => {
  it("rejects messages over 1000 UTF-8 bytes before calling Meta", async () => {
    const text = "x".repeat(1001);
    await expect(sendPrivateReply("ig", "tok", "c1", text)).rejects.toMatchObject({
      name: "MetaError",
      code: 100,
    });
  });
});

describe("webhook signature", () => {
  it("verifies X-Hub-Signature-256 over raw bytes", () => {
    const secret = "app-secret";
    const raw = Buffer.from('{"object":"instagram"}');
    const sig = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    expect(verifyWebhookSignature(raw, sig, secret)).toBe(true);
    expect(verifyWebhookSignature(raw, "sha256=deadbeef", secret)).toBe(false);
    expect(verifyWebhookSignature(raw, undefined, secret)).toBe(false);
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});
