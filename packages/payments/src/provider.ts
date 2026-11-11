import crypto from "node:crypto";
import type { MoneyPaise } from "./money.js";

export interface TransferSplit {
  account: string;
  amountPaise: MoneyPaise;
  currency?: "INR";
}

export interface CreateOrderInput {
  amountPaise: MoneyPaise;
  currency: "INR";
  receipt: string;
  transfers?: TransferSplit[];
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  gatewayOrderId: string;
  amountPaise: MoneyPaise;
  currency: string;
  upiIntentUrl?: string;
  qrPayload?: string;
  raw?: unknown;
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface CreateRefundInput {
  paymentId: string;
  amountPaise: MoneyPaise;
  notes?: Record<string, string>;
}

export interface RefundResult {
  gatewayRefundId: string;
  amountPaise: MoneyPaise;
  status: "processed" | "pending" | "failed";
  raw?: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyPaymentSignature(input: VerifyPaymentInput): boolean;
  createRefund(input: CreateRefundInput): Promise<RefundResult>;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;
}

/**
 * Mock payment provider for offline development, integration tests, and UI flows.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  private secret = "mock_secret_key_1234567890";

  constructor(secret?: string) {
    if (secret) this.secret = secret;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const gatewayOrderId = `order_mock_${input.receipt.slice(0, 16)}_${Date.now()}`;
    const amountRupees = (input.amountPaise / 100).toFixed(2);
    const upiIntentUrl = `upi://pay?pa=merchant@hyperprofile&pn=Hyperprofile&am=${amountRupees}&cu=INR&tr=${gatewayOrderId}`;
    return {
      gatewayOrderId,
      amountPaise: input.amountPaise,
      currency: "INR",
      upiIntentUrl,
      qrPayload: upiIntentUrl,
      raw: { mock: true, transfers: input.transfers },
    };
  }

  generateMockSignature(orderId: string, paymentId: string): string {
    return crypto
      .createHmac("sha256", this.secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
  }

  verifyPaymentSignature(input: VerifyPaymentInput): boolean {
    if (!input.signature || !input.orderId || !input.paymentId) return false;
    const expected = this.generateMockSignature(input.orderId, input.paymentId);
    if (
      input.signature === expected ||
      input.signature === `mock_sig_${input.orderId}_${input.paymentId}`
    ) {
      return true;
    }
    try {
      const sigBuf = Buffer.from(input.signature, "utf8");
      const expBuf = Buffer.from(expected, "utf8");
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  async createRefund(input: CreateRefundInput): Promise<RefundResult> {
    return {
      gatewayRefundId: `rfnd_mock_${Date.now()}`,
      amountPaise: input.amountPaise,
      status: "processed",
      raw: { mock: true },
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature) return false;
    if (signature === "mock_webhook_signature") return true;
    const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const expected = crypto
      .createHmac("sha256", this.secret)
      .update(bodyStr)
      .digest("hex");
    try {
      const sigBuf = Buffer.from(signature, "hex");
      const expBuf = Buffer.from(expected, "hex");
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }
}

/**
 * Razorpay Route implementation for marketplace splits and UPI-first checkout.
 */
export class RazorpayRouteProvider implements PaymentProvider {
  readonly name = "razorpay_route";
  private keyId: string;
  private keySecret: string;
  private webhookSecret?: string | undefined;
  private baseUrl: string;

  constructor(options: {
    keyId: string;
    keySecret: string;
    webhookSecret?: string | undefined;
    baseUrl?: string | undefined;
  }) {
    this.keyId = options.keyId;
    this.keySecret = options.keySecret;
    this.webhookSecret = options.webhookSecret;
    this.baseUrl = options.baseUrl ?? "https://api.razorpay.com/v1";
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const payload: Record<string, unknown> = {
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes ?? {},
    };

    if (input.transfers && input.transfers.length > 0) {
      payload.transfers = input.transfers.map((t) => ({
        account: t.account,
        amount: t.amountPaise,
        currency: "INR",
        on_hold: 0,
      }));
    }

    const res = await fetch(`${this.baseUrl}/orders`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Razorpay createOrder failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { id: string; amount: number; currency: string };
    const amountRupees = (input.amountPaise / 100).toFixed(2);
    const upiIntentUrl = `upi://pay?pa=hyperprofile@razorpay&pn=Hyperprofile&am=${amountRupees}&cu=INR&tr=${data.id}`;

    return {
      gatewayOrderId: data.id,
      amountPaise: data.amount,
      currency: data.currency,
      upiIntentUrl,
      qrPayload: upiIntentUrl,
      raw: data,
    };
  }

  verifyPaymentSignature(input: VerifyPaymentInput): boolean {
    if (!input.orderId || !input.paymentId || !input.signature) return false;
    const body = `${input.orderId}|${input.paymentId}`;
    const expected = crypto.createHmac("sha256", this.keySecret).update(body).digest("hex");
    try {
      const sigBuf = Buffer.from(input.signature, "utf8");
      const expBuf = Buffer.from(expected, "utf8");
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  async createRefund(input: CreateRefundInput): Promise<RefundResult> {
    const payload: Record<string, unknown> = {
      amount: input.amountPaise,
      notes: input.notes ?? {},
    };

    const res = await fetch(`${this.baseUrl}/payments/${input.paymentId}/refund`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Razorpay createRefund failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { id: string; amount: number; status: string };
    return {
      gatewayRefundId: data.id,
      amountPaise: data.amount,
      status: data.status === "processed" ? "processed" : "pending",
      raw: data,
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!this.webhookSecret || !signature) return false;
    const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(bodyStr)
      .digest("hex");
    try {
      const sigBuf = Buffer.from(signature, "hex");
      const expBuf = Buffer.from(expected, "hex");
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }
}
