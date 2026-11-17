import crypto from "node:crypto";
import Fastify from "fastify";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerJobRoutes, verifyCronAuth } from "./job-routes.js";

describe("Job Routes & Cron Endpoints", () => {
  const cronSecret = "super-secret-cron-token-1234567890";
  let app: ReturnType<typeof Fastify>;
  let mockDb: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    app = Fastify();

    // Register rawBody parser for JSON
    app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req: any, body: any, done: any) => {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
      (req as any).rawBody = buf;
      const json = buf.length ? JSON.parse(buf.toString("utf8")) : {};
      done(null, json);
    });

    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockDb)),
    };

    registerJobRoutes(app, {
      db: mockDb,
      cronSecret,
      appId: "test-app-id",
      appSecret: "test-app-secret",
      tokenEncryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      metaGraphVersion: "v21.0",
    });
  });

  describe("verifyCronAuth", () => {
    it("authenticates valid Bearer token", () => {
      const req = {
        headers: { authorization: `Bearer ${cronSecret}` },
      } as any;
      expect(verifyCronAuth(req, cronSecret)).toBe(true);
    });

    it("rejects invalid Bearer token", () => {
      const req = {
        headers: { authorization: "Bearer wrong-token-1234567890123456" },
      } as any;
      expect(verifyCronAuth(req, cronSecret)).toBe(false);
    });

    it("authenticates valid HMAC SHA-256 signature", () => {
      const body = Buffer.from(JSON.stringify({ test: "data" }));
      const sig = crypto.createHmac("sha256", cronSecret).update(body).digest("hex");
      const req = {
        headers: { "x-cron-signature": `sha256=${sig}` },
        rawBody: body,
      } as any;
      expect(verifyCronAuth(req, cronSecret)).toBe(true);
    });

    it("rejects invalid HMAC SHA-256 signature", () => {
      const body = Buffer.from(JSON.stringify({ test: "data" }));
      const req = {
        headers: { "x-cron-signature": "sha256=invalidhex0123456789abcdef0123456789abcdef0123456789abcdef01234567" },
        rawBody: body,
      } as any;
      expect(verifyCronAuth(req, cronSecret)).toBe(false);
    });
  });

  describe("Endpoint Authorization Guard", () => {
    it("returns 401 when calling /v1/jobs/drain-autodm without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/jobs/drain-autodm",
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe("unauthorized");
    });

    it("returns 401 when calling /v1/jobs/refresh-tokens without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/jobs/refresh-tokens",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when calling /v1/jobs/cleanup-retention without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/jobs/cleanup-retention",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when calling /v1/jobs/usage-report without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/v1/jobs/usage-report",
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("Authorized Cron Endpoints", () => {
    it("drains AutoDM queue when authorized with Bearer token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/jobs/drain-autodm",
        headers: { authorization: `Bearer ${cronSecret}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.ok).toBe(true);
      expect(json.processed).toBeDefined();
    });

    it("skips AutoDM queue when PAUSE_AUTODM is true", async () => {
      const original = process.env.PAUSE_AUTODM;
      process.env.PAUSE_AUTODM = "true";

      try {
        const res = await app.inject({
          method: "POST",
          url: "/v1/jobs/drain-autodm",
          headers: { authorization: `Bearer ${cronSecret}` },
        });

        expect(res.statusCode).toBe(200);
        const json = res.json();
        expect(json.ok).toBe(true);
        expect(json.status).toBe("paused");
      } finally {
        process.env.PAUSE_AUTODM = original;
      }
    });

    it("executes cleanup-retention when authorized", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/jobs/cleanup-retention",
        headers: { authorization: `Bearer ${cronSecret}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.ok).toBe(true);
      expect(json.rollupsProcessed).toBeDefined();
      expect(json.rawEventsPurged).toBeDefined();
      expect(json.webhooksPurged).toBeDefined();
      expect(json.jobsPurged).toBeDefined();
    });

    it("returns storage and usage report with safety thresholds", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/v1/jobs/usage-report",
        headers: { authorization: `Bearer ${cronSecret}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.ok).toBe(true);
      expect(json.storage.quotaBytes).toBe(400 * 1024 * 1024);
      expect(json.storage.percentUsed).toBeDefined();
      expect(json.storage.alertTriggered).toBe(false);
      expect(json.killSwitches).toBeDefined();
    });
  });
});
