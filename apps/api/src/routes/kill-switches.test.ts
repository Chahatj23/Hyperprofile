import Fastify from "fastify";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerAuthRoutes } from "./auth-routes.js";
import { registerCheckoutRoutes } from "./checkout-routes.js";
import { processCommentWebhook } from "../autodm/process-comments.js";

describe("Zero-Cost Launch Stack Kill Switches", () => {
  let app: ReturnType<typeof Fastify>;
  let mockDb: any;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    app = Fastify();

    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    registerAuthRoutes(app, {
      db: mockDb,
      sessionSecret: "test-secret-key-at-least-32-chars-long",
      isSecureCookie: false,
    });

    registerCheckoutRoutes(app, {
      db: mockDb,
      paymentProvider: {
        createOrder: vi.fn(),
        verifyPayment: vi.fn(),
      } as any,
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("PAUSE_SIGNUPS Kill Switch", () => {
    it("rejects /v1/auth/signup with 503 when PAUSE_SIGNUPS is true", async () => {
      process.env.PAUSE_SIGNUPS = "true";

      const res = await app.inject({
        method: "POST",
        url: "/v1/auth/signup",
        payload: {
          email: "newcreator@example.com",
          password: "SecurePassword123!",
          displayName: "Creator",
        },
      });

      expect(res.statusCode).toBe(503);
      const json = res.json();
      expect(json.code).toBe("signups_paused");
      expect(json.message).toContain("paused");
    });

    it("rejects /v1/auth/otp/send for non-existing user with 503 when PAUSE_SIGNUPS is true", async () => {
      process.env.PAUSE_SIGNUPS = "true";

      const res = await app.inject({
        method: "POST",
        url: "/v1/auth/otp/send",
        payload: {
          email: "brandnew@example.com",
        },
      });

      expect(res.statusCode).toBe(503);
      const json = res.json();
      expect(json.code).toBe("signups_paused");
    });
  });

  describe("PAUSE_CHECKOUT Kill Switch", () => {
    it("rejects /v1/checkout/create-order with 503 when PAUSE_CHECKOUT is true", async () => {
      process.env.PAUSE_CHECKOUT = "true";

      const res = await app.inject({
        method: "POST",
        url: "/v1/checkout/create-order",
        payload: {
          productId: "prod_123",
          buyerEmail: "buyer@example.com",
        },
      });

      expect(res.statusCode).toBe(503);
      const json = res.json();
      expect(json.code).toBe("checkout_paused");
      expect(json.message).toContain("Checkout is temporarily paused");
    });
  });

  describe("PAUSE_AUTODM Kill Switch", () => {
    it("immediately skips comment processing when PAUSE_AUTODM is true", async () => {
      process.env.PAUSE_AUTODM = "true";

      const result = await processCommentWebhook(
        mockDb,
        {
          object: "instagram",
          entry: [
            {
              id: "ig_user_1",
              changes: [
                {
                  field: "comments",
                  value: { id: "c_123", text: "SEND" } as any,
                },
              ],
            },
          ],
        },
        { publicBaseUrl: "https://hyperprofile.com" },
      );

      expect(result).toEqual({ claimed: 0, skipped: 0 });
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });
});
