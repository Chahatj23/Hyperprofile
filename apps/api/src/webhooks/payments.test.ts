import { describe, expect, it } from "vitest";
import {
  generateFyInvoiceNumber,
  getCurrentFyPrefix,
} from "../payments/order-processor.js";
import { createPaymentWebhookHandlers } from "./payments.js";
import { MockPaymentProvider } from "@hyperprofile/payments";

describe("FY Invoice Number Formatting", () => {
  it("formats Indian financial year gap-free sequence properly", () => {
    // April 2026: FY 2026-27 (month index 3 = April)
    const aprDate = new Date(2026, 3, 15, 12, 0, 0);
    expect(getCurrentFyPrefix(aprDate)).toBe("INV-202627-");
    expect(generateFyInvoiceNumber(1, aprDate)).toBe("INV-202627-00001");
    expect(generateFyInvoiceNumber(42, aprDate)).toBe("INV-202627-00042");

    // March 2027: Still FY 2026-27 (Indian FY ends March 31, month index 2 = March)
    const marDate = new Date(2027, 2, 31, 12, 0, 0);
    expect(getCurrentFyPrefix(marDate)).toBe("INV-202627-");
    expect(generateFyInvoiceNumber(100, marDate)).toBe("INV-202627-00100");

    // April 2027: Rollover to FY 2027-28 (starts fresh from 00001, month index 3 = April)
    const nextFyDate = new Date(2027, 3, 1, 12, 0, 0);
    expect(getCurrentFyPrefix(nextFyDate)).toBe("INV-202728-");
    expect(generateFyInvoiceNumber(1, nextFyDate)).toBe("INV-202728-00001");
  });
});

describe("Payment Webhook Handler", () => {
  it("rejects webhook request with invalid cryptographic signature", async () => {
    const mockProvider = new MockPaymentProvider("test_secret_123");
    let insertCalled = false;

    const mockDb: any = {
      insert: () => {
        insertCalled = true;
        return {
          values: () => ({
            onConflictDoNothing: () => ({
              returning: async () => [{ id: "mock_inbox_id" }],
            }),
          }),
        };
      },
    };

    const { handlePaymentWebhook } = createPaymentWebhookHandlers({
      db: mockDb,
      paymentProvider: mockProvider,
    });

    let statusCode = 200;
    let responseBody: any = null;

    const mockReq: any = {
      headers: { "x-webhook-signature": "invalid_sig_abc" },
      rawBody: Buffer.from(JSON.stringify({ event: "payment.captured" })),
      body: { event: "payment.captured" },
    };

    const mockReply: any = {
      code: (c: number) => {
        statusCode = c;
        return {
          send: (b: any) => {
            responseBody = b;
          },
        };
      },
    };

    await handlePaymentWebhook(mockReq, mockReply);
    expect(statusCode).toBe(400);
    expect(responseBody).toEqual({ error: "Invalid webhook signature" });
    expect(insertCalled).toBe(false);
  });

  it("stores webhook in inbox and detects duplicate replayed events harmlessly", async () => {
    const mockProvider = new MockPaymentProvider("test_secret_123");
    let conflictSimulated = false;

    const mockDb: any = {
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: async () => {
              if (conflictSimulated) {
                // Duplicate replay: returns empty array
                return [];
              }
              // First delivery: returns inserted row
              return [{ id: "inbox_row_1", eventId: "evt_dup_test" }];
            },
          }),
        }),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: async () => {},
        }),
      }),
    };

    const { handlePaymentWebhook } = createPaymentWebhookHandlers({
      db: mockDb,
      paymentProvider: mockProvider,
    });

    const bodyObj = { id: "evt_dup_test", event: "payment.failed" };
    const rawBuf = Buffer.from(JSON.stringify(bodyObj));

    let statusCode = 200;
    let responseBody: any = null;

    const mockReq: any = {
      headers: { "x-webhook-signature": "mock_webhook_signature" },
      rawBody: rawBuf,
      body: bodyObj,
    };

    const mockReply: any = {
      code: (c: number) => {
        statusCode = c;
        return {
          send: (b: any) => {
            responseBody = b;
          },
        };
      },
    };

    // First delivery
    await handlePaymentWebhook(mockReq, mockReply);
    expect(statusCode).toBe(200);
    expect(responseBody).toEqual({ status: "ok" });

    // Replay delivery: simulate unique constraint conflict in DB
    conflictSimulated = true;
    let replayCode = 200;
    let replayBody: any = null;
    const replayReply: any = {
      code: (c: number) => {
        replayCode = c;
        return {
          send: (b: any) => {
            replayBody = b;
          },
        };
      },
    };

    await handlePaymentWebhook(mockReq, replayReply);
    expect(replayCode).toBe(200);
    expect(replayBody).toEqual({ status: "ok", duplicate: true });
  });
});
