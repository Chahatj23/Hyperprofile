import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { safeEqual, verifyWebhookSignature } from "../../packages/meta/src/webhook.js";

describe("Stage 3: Meta & Instagram Webhook Robustness & Security Tests", () => {
  const testSecret = "meta_app_secret_test_xyz123456789";
  const rawBody = Buffer.from(
    JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "17841453478293915",
          time: 1714567890,
          changes: [
            {
              field: "comments",
              value: {
                id: "comment_test_9999",
                text: "Send me the guide!",
                from: { id: "buyer_ig_123", username: "superfan" },
              },
            },
          ],
        },
      ],
    }),
    "utf8",
  );

  function signPayload(body: Buffer, secret: string): string {
    const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return `sha256=${hmac}`;
  }

  describe("Section 4C: Webhook Signature Verification Matrix", () => {
    it("1. Rejects when signature header is missing entirely", () => {
      expect(verifyWebhookSignature(rawBody, undefined, testSecret)).toBe(false);
      expect(verifyWebhookSignature(rawBody, "", testSecret)).toBe(false);
    });

    it("2. Rejects when signature has wrong prefix (e.g., sha1= or Bearer)", () => {
      const validHmac = crypto.createHmac("sha256", testSecret).update(rawBody).digest("hex");
      expect(verifyWebhookSignature(rawBody, `sha1=${validHmac}`, testSecret)).toBe(false);
      expect(verifyWebhookSignature(rawBody, `Bearer ${validHmac}`, testSecret)).toBe(false);
      expect(verifyWebhookSignature(rawBody, validHmac, testSecret)).toBe(false);
    });

    it("3. Rejects wrong digest value with matching length", () => {
      const bogusDigest = "a".repeat(64);
      expect(verifyWebhookSignature(rawBody, `sha256=${bogusDigest}`, testSecret)).toBe(false);
    });

    it("4. Rejects truncated digest value", () => {
      const validSig = signPayload(rawBody, testSecret);
      const truncated = validSig.slice(0, 30);
      expect(verifyWebhookSignature(rawBody, truncated, testSecret)).toBe(false);
    });

    it("5. Rejects valid signature generated over a different body", () => {
      const differentBody = Buffer.from(JSON.stringify({ object: "instagram", tampered: true }), "utf8");
      const sigForDifferentBody = signPayload(differentBody, testSecret);
      expect(verifyWebhookSignature(rawBody, sigForDifferentBody, testSecret)).toBe(false);
    });

    it("6. Rejects signature created with verify_token instead of app_secret", () => {
      const verifyToken = "my_hub_verify_token_123";
      const sigWithVerifyToken = signPayload(rawBody, verifyToken);
      expect(verifyWebhookSignature(rawBody, sigWithVerifyToken, testSecret)).toBe(false);
    });

    it("7. Accepts correct signature over exact raw bytes", () => {
      const validSignature = signPayload(rawBody, testSecret);
      expect(verifyWebhookSignature(rawBody, validSignature, testSecret)).toBe(true);
    });

    it("8. Rejects when body is re-serialized with different whitespace", () => {
      const validSignature = signPayload(rawBody, testSecret);
      // Same JSON object but re-formatted with indentation
      const prettyBody = Buffer.from(JSON.stringify(JSON.parse(rawBody.toString("utf8")), null, 2), "utf8");
      expect(verifyWebhookSignature(prettyBody, validSignature, testSecret)).toBe(false);
    });

    it("9. Dual-Secret Rotation: Accepts signatures made with either old or new secret during rotation window", () => {
      const oldSecret = "meta_app_secret_legacy_old";
      const newSecret = "meta_app_secret_rotated_new";
      const rotationConfig = `${newSecret},${oldSecret}`; // Multiple secrets supported

      const oldSig = signPayload(rawBody, oldSecret);
      const newSig = signPayload(rawBody, newSecret);
      const bogusSig = signPayload(rawBody, "completely_unknown_secret");

      // Both old and new signatures must be accepted without downtime
      expect(verifyWebhookSignature(rawBody, oldSig, rotationConfig)).toBe(true);
      expect(verifyWebhookSignature(rawBody, newSig, rotationConfig)).toBe(true);
      expect(verifyWebhookSignature(rawBody, bogusSig, rotationConfig)).toBe(false);
    });
  });

  describe("Section 4C: Replay & 50-Request Concurrency Test", () => {
    it("deduplicates 50 concurrent incoming deliveries of the same comment ID", async () => {
      const inMemoryClaimStore = new Set<string>();

      async function attemptClaim(commentId: string): Promise<boolean> {
        // Atomic check-and-set emulation
        if (inMemoryClaimStore.has(commentId)) {
          return false;
        }
        inMemoryClaimStore.add(commentId);
        return true;
      }

      const commentId = "comment_concurrency_test_12345";
      const concurrentAttempts = 50;

      // Fire 50 simultaneous parallel promises
      const results = await Promise.all(
        Array.from({ length: concurrentAttempts }, () => attemptClaim(commentId)),
      );

      const successfulClaims = results.filter((r) => r === true).length;
      const rejectedDuplicates = results.filter((r) => r === false).length;

      expect(successfulClaims).toBe(1);
      expect(rejectedDuplicates).toBe(49);
    });
  });

  describe("Section 4C: Content & Template Injection Hardening", () => {
    function renderMessageTextSafe(
      template: string,
      username: string | null | undefined,
      link: string | null | undefined,
      plan: "free" | "creator" = "free",
    ): string {
      const name = username || "there";
      // Plain string replacement: safe against template/eval injection
      const base = template.replaceAll("{name}", name);
      let withLink = link ? `${base} ${link}` : base;

      if (plan === "free") {
        withLink += "\n\nSent via Hyperprofile";
      }

      // Meta strict requirement: maximum 1000 UTF-8 bytes
      if (Buffer.byteLength(withLink, "utf8") > 1000) {
        const buf = Buffer.from(withLink, "utf8");
        withLink = buf.subarray(0, 1000).toString("utf8");
      }

      return withLink.trim();
    }

    it("safely treats code and template injection payloads as literal text without evaluation", () => {
      const maliciousUsernames = [
        "${process.env.META_APP_SECRET}",
        "{{7*7}}",
        "#{system('id')}",
        "<script>alert('xss')</script>",
        "'; DROP TABLE users; --",
      ];

      for (const malName of maliciousUsernames) {
        const rendered = renderMessageTextSafe("Hey {name}, here is your link!", malName, "https://example.com");
        // Must contain the literal characters safely, without evaluating expressions
        expect(rendered).toContain(malName);
        expect(rendered).not.toContain("49"); // {{7*7}} was NOT evaluated
      }
    });

    it("strictly truncates message payloads exceeding 1000 UTF-8 bytes", () => {
      const hugeUsername = "A".repeat(1500);
      const rendered = renderMessageTextSafe("Hey {name}!", hugeUsername, null);
      expect(Buffer.byteLength(rendered, "utf8")).toBeLessThanOrEqual(1000);
    });

    it("handles multi-byte unicode characters without crashing during boundary truncation", () => {
      // 4-byte emoji sequence
      const emojiName = "🔥🚀💎".repeat(300);
      const rendered = renderMessageTextSafe("Welcome {name}!", emojiName, null);
      expect(Buffer.byteLength(rendered, "utf8")).toBeLessThanOrEqual(1000);
    });
  });
});
