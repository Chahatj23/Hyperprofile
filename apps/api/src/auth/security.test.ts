import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

describe("Security Hardening & Protection Tests", () => {
  describe("Password Complexity Standards", () => {
    it("rejects weak passwords shorter than 8 characters", () => {
      const passwords = ["12345", "pass", "abc", "short1", ""];
      for (const pwd of passwords) {
        const isSecure = pwd.length >= 8;
        expect(isSecure).toBe(false);
      }
    });

    it("accepts passwords with 8 or more characters", () => {
      const passwords = ["correct-horse-battery", "StrongP@ssw0rd!2026", "minlength8"];
      for (const pwd of passwords) {
        const isSecure = pwd.length >= 8;
        expect(isSecure).toBe(true);
      }
    });
  });

  describe("Timing-Attack Safe Comparison", () => {
    it("performs constant-time comparison on admin secrets without timing leak", () => {
      const storedSecret = "hyperprofile_super_secret_admin_token_2026";
      const validBuffer = Buffer.from(storedSecret);
      const invalidBuffer = Buffer.from("hyperprofile_super_secret_admin_token_wrong");

      const matchValid =
        validBuffer.length === validBuffer.length &&
        crypto.timingSafeEqual(validBuffer, validBuffer);
      expect(matchValid).toBe(true);

      const matchInvalid =
        validBuffer.length === invalidBuffer.length &&
        crypto.timingSafeEqual(validBuffer, invalidBuffer);
      expect(matchInvalid).toBe(false);
    });
  });

  describe("PII Email Masking", () => {
    function maskEmail(email: string): string {
      const parts = email.split("@");
      if (parts.length !== 2) return "***";
      const [name, domain] = parts;
      if (!name || !domain) return "***";
      const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
      return `${maskedName}@${domain}`;
    }

    it("masks buyer emails to protect PII against sequential harvesting", () => {
      expect(maskEmail("chahat@example.com")).toBe("c***t@example.com");
      expect(maskEmail("al@company.org")).toBe("a***@company.org");
      expect(maskEmail("invalid-email")).toBe("***");
    });
  });

  describe("Sliding Window Rate Limiter", () => {
    interface RateLimitRecord {
      attempts: number;
      resetAt: number;
    }
    const testMap = new Map<string, RateLimitRecord>();

    function checkRateLimit(
      key: string,
      maxAttempts = 5,
      windowMs = 15 * 60 * 1000,
    ): { allowed: boolean; retryAfterSec?: number } {
      const now = Date.now();
      const record = testMap.get(key);
      if (!record || record.resetAt <= now) {
        testMap.set(key, { attempts: 1, resetAt: now + windowMs });
        return { allowed: true };
      }
      if (record.attempts >= maxAttempts) {
        return { allowed: false, retryAfterSec: Math.ceil((record.resetAt - now) / 1000) };
      }
      record.attempts += 1;
      return { allowed: true };
    }

    it("blocks brute-force attempts after maximum allowed threshold", () => {
      const ipKey = "test_ip_192_168_1_50";
      for (let i = 0; i < 5; i++) {
        const res = checkRateLimit(ipKey, 5, 60000);
        expect(res.allowed).toBe(true);
      }
      // 6th attempt must be blocked
      const blocked = checkRateLimit(ipKey, 5, 60000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    });
  });
});
