import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSender, sendEmail, sendOtpEmail } from "./mailer.js";

describe("Mailer with Brevo Integration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
    delete process.env.BREVO_SENDER_NAME;
    delete process.env.BREVO_SMTP_KEY;
    delete process.env.BREVO_SMTP_USER;
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("parseSender", () => {
    it("parses combined name and email correctly", () => {
      const result = parseSender("Hyperprofile Bio <support@hyperprofile.bio>");
      expect(result).toEqual({
        name: "Hyperprofile Bio",
        email: "support@hyperprofile.bio",
      });
    });

    it("parses quoted names correctly", () => {
      const result = parseSender('"Hyperprofile Team" <team@hyperprofile.bio>');
      expect(result).toEqual({
        name: "Hyperprofile Team",
        email: "team@hyperprofile.bio",
      });
    });

    it("handles plain email address", () => {
      const result = parseSender("test@hyperprofile.bio");
      expect(result).toEqual({
        name: "Hyperprofile",
        email: "test@hyperprofile.bio",
      });
    });

    it("falls back to defaults when empty", () => {
      const result = parseSender(undefined, "fallback@hyperprofile.bio", "Fallback App");
      expect(result).toEqual({
        name: "Fallback App",
        email: "fallback@hyperprofile.bio",
      });
    });
  });

  describe("Brevo REST API", () => {
    it("sends transactional email via Brevo REST API when BREVO_API_KEY is configured", async () => {
      process.env.BREVO_API_KEY = "xkeysib-mock-brevo-api-key-12345";
      process.env.BREVO_SENDER_EMAIL = "auth@hyperprofile.bio";
      process.env.BREVO_SENDER_NAME = "Hyperprofile Auth";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ messageId: "<brevo-msg-id-9988@smtp-relay.mailin.fr>" }),
      });
      global.fetch = mockFetch;

      const result = await sendEmail({
        to: "creator@example.com",
        subject: "Your OTP Code",
        html: "<p>123456</p>",
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(call).toBeDefined();
      const [url, init] = call;
      expect(url).toBe("https://api.brevo.com/v3/smtp/email");
      expect(init.method).toBe("POST");
      const headers = init.headers as Record<string, string>;
      expect(headers["api-key"]).toBe("xkeysib-mock-brevo-api-key-12345");
      expect(headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(init.body as string);
      expect(body.sender).toEqual({ name: "Hyperprofile Auth", email: "auth@hyperprofile.bio" });
      expect(body.to).toEqual([{ email: "creator@example.com" }]);
      expect(body.subject).toBe("Your OTP Code");

      expect(result).toEqual({
        sent: true,
        provider: "brevo",
        id: "<brevo-msg-id-9988@smtp-relay.mailin.fr>",
      });
    });

    it("formats 6-digit OTP code correctly in sendOtpEmail", async () => {
      process.env.BREVO_API_KEY = "xkeysib-mock-brevo-api-key-12345";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ messageId: "<brevo-otp-id-123>" }),
      });
      global.fetch = mockFetch;

      const result = await sendOtpEmail("creator@example.com", "849201");

      expect(result.sent).toBe(true);
      expect(result.provider).toBe("brevo");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(call).toBeDefined();
      const [, init] = call;
      const body = JSON.parse(init.body as string);
      expect(body.subject).toContain("849201");
      expect(body.htmlContent).toContain("849201");
      expect(body.textContent).toContain("849201");
    });

    it("gracefully falls back if Brevo API fails with non-2xx status", async () => {
      process.env.BREVO_API_KEY = "xkeysib-invalid-key";
      process.env.RESEND_API_KEY = "re_mock_resend_fallback";

      const mockFetch = vi.fn()
        // First call: Brevo fails
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => "Key not found",
        })
        // Second call: Resend fallback succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "resend-fallback-id-456" }),
        });
      global.fetch = mockFetch;

      const result = await sendEmail({
        to: "creator@example.com",
        subject: "Verification",
        html: "<p>Code</p>",
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const call0 = mockFetch.mock.calls[0] as [string, RequestInit];
      const call1 = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(call0?.[0]).toBe("https://api.brevo.com/v3/smtp/email");
      expect(call1?.[0]).toBe("https://api.resend.com/emails");
      expect(result.sent).toBe(true);
      expect(result.provider).toBe("resend");
      expect(result.id).toBe("resend-fallback-id-456");
    });
  });
});
