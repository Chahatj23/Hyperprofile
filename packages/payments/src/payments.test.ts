import { describe, expect, it } from "vitest";
import {
  applyDiscount,
  buildOrderLedgerEntries,
  buildRefundLedgerEntries,
  calculateGatewayFee,
  calculateGst,
  calculatePlatformFee,
  calculateSignedLedgerSum,
  formatInr,
  MockPaymentProvider,
  RazorpayRouteProvider,
  verifyLedgerBalance,
} from "./index.js";

describe("Money & GST Calculations", () => {
  it("calculates GST exclusive correctly", () => {
    // ₹1,000 (100,000 paise) + 18% GST = ₹180 GST, total ₹1,180
    const gst = calculateGst(100000, 18, false);
    expect(gst.basePaise).toBe(100000);
    expect(gst.gstPaise).toBe(18000);
    expect(gst.cgstPaise).toBe(9000);
    expect(gst.sgstPaise).toBe(9000);
    expect(gst.totalPaise).toBe(118000);
  });

  it("calculates GST inclusive correctly", () => {
    // Total ₹1,180 (118,000 paise) inclusive of 18% GST -> base = ₹1,000
    const gst = calculateGst(118000, 18, true);
    expect(gst.basePaise).toBe(100000);
    expect(gst.gstPaise).toBe(18000);
    expect(gst.totalPaise).toBe(118000);
  });

  it("handles 0% GST rate", () => {
    const gst = calculateGst(50000, 0, false);
    expect(gst.gstPaise).toBe(0);
    expect(gst.totalPaise).toBe(50000);
  });

  it("applies percentage discount", () => {
    // 20% off ₹500 (50,000 paise) = ₹100 off -> ₹400
    const res = applyDiscount(50000, "percent", 20);
    expect(res.discountPaise).toBe(10000);
    expect(res.finalPaise).toBe(40000);
  });

  it("applies flat discount and clamps at 0", () => {
    const res = applyDiscount(5000, "flat", 10000); // flat ₹100 off ₹50
    expect(res.discountPaise).toBe(5000);
    expect(res.finalPaise).toBe(0);
  });

  it("calculates gateway fees with UPI bands", () => {
    // Under ₹2,000 with upi discount
    const under2k = calculateGatewayFee(150000, "upi", { upiDiscountAbove2000: true });
    expect(under2k.feePaise).toBe(0);

    // Over ₹2,000 (0.4% fee)
    const over2k = calculateGatewayFee(300000, "upi", { upiDiscountAbove2000: true });
    // 300,000 * 0.004 = 1,200 paise (₹12)
    expect(over2k.feePaise).toBe(1200);
    expect(over2k.feeGstPaise).toBe(Math.round(1200 * 0.18)); // 216 paise

    // ₹1,00,000 (10,000,000 paise): 0.4% = 40,000 paise, but capped at ₹300 (30,000 paise)
    const capped = calculateGatewayFee(10000000, "upi", { upiDiscountAbove2000: true });
    expect(capped.feePaise).toBe(30000);
    expect(capped.feeGstPaise).toBe(5400); // 18% of 30,000
    expect(capped.totalFeePaise).toBe(35400);

    // Standard card: 2% fee
    const cardFee = calculateGatewayFee(100000, "card");
    expect(cardFee.feePaise).toBe(2000);
    expect(cardFee.feeGstPaise).toBe(360);
  });

  it("calculates platform fees per plan", () => {
    expect(calculatePlatformFee(100000, "free")).toBe(4000); // 4% = ₹40
    expect(calculatePlatformFee(100000, "creator")).toBe(0); // 0%
    expect(calculatePlatformFee(100000, "studio")).toBe(0); // 0%
  });

  it("formats INR correctly with Indian numbering", () => {
    const formatted = formatInr(12345678); // ₹1,23,456.78
    expect(formatted).toContain("1,23,456.78");
  });
});

describe("Append-Only Ledger & Balancing", () => {
  it("builds balanced ledger entries for an order", () => {
    const buyerPaid = 118000;
    const gatewayFee = 2000;
    const gatewayFeeGst = 360;
    const platformFee = 4000;
    const creatorPayable = buyerPaid - (gatewayFee + gatewayFeeGst + platformFee); // 111640

    const entries = buildOrderLedgerEntries({
      orderId: "order_123",
      buyerPaidPaise: buyerPaid,
      gatewayFeePaise: gatewayFee,
      gatewayFeeGstPaise: gatewayFeeGst,
      platformFeePaise: platformFee,
      creatorPayablePaise: creatorPayable,
    });

    expect(entries.length).toBe(5);
    expect(verifyLedgerBalance(entries)).toBe(true);
    expect(calculateSignedLedgerSum(entries)).toBe(0);
  });

  it("throws on unbalanced order financials", () => {
    expect(() =>
      buildOrderLedgerEntries({
        orderId: "order_err",
        buyerPaidPaise: 100000,
        gatewayFeePaise: 2000,
        gatewayFeeGstPaise: 360,
        platformFeePaise: 4000,
        creatorPayablePaise: 90000, // Sum = 96360 != 100000
      }),
    ).toThrow(/Ledger imbalance/);
  });

  it("builds balanced reversing ledger entries for refund", () => {
    const refundAmount = 50000;
    const creatorReversal = 48000;
    const platformReversal = 2000;

    const refundEntries = buildRefundLedgerEntries({
      orderId: "order_123",
      refundId: "ref_456",
      refundAmountPaise: refundAmount,
      creatorPayableReversalPaise: creatorReversal,
      platformFeeReversalPaise: platformReversal,
    });

    expect(verifyLedgerBalance(refundEntries)).toBe(true);
    expect(calculateSignedLedgerSum(refundEntries)).toBe(0);
  });

  it("Property Test: the ledger signed sum is strictly zero across payments and refunds", () => {
    // Simulate 20 random orders with payments and partial/full refunds
    for (let i = 0; i < 20; i++) {
      const buyerPaid = Math.floor(Math.random() * 500000) + 10000;
      const gwFee = Math.floor(buyerPaid * 0.02);
      const gwGst = Math.floor(gwFee * 0.18);
      const platFee = Math.floor(buyerPaid * 0.04);
      const creatorPayable = buyerPaid - gwFee - gwGst - platFee;

      const orderEntries = buildOrderLedgerEntries({
        orderId: `prop_ord_${i}`,
        buyerPaidPaise: buyerPaid,
        gatewayFeePaise: gwFee,
        gatewayFeeGstPaise: gwGst,
        platformFeePaise: platFee,
        creatorPayablePaise: creatorPayable,
      });

      // Partial refund simulation
      const refundRatio = Math.random() * 0.8;
      const refundAmt = Math.floor(buyerPaid * refundRatio);
      const platRef = Math.floor(platFee * refundRatio);
      const creatorRef = refundAmt - platRef;

      const refundEntries = buildRefundLedgerEntries({
        orderId: `prop_ord_${i}`,
        refundId: `prop_ref_${i}`,
        refundAmountPaise: refundAmt,
        creatorPayableReversalPaise: creatorRef,
        platformFeeReversalPaise: platRef,
      });

      const combined = [...orderEntries, ...refundEntries];
      expect(verifyLedgerBalance(combined)).toBe(true);
      expect(calculateSignedLedgerSum(combined)).toBe(0);
    }
  });
});

describe("Payment Providers", () => {
  it("MockPaymentProvider creates orders and verifies signatures", async () => {
    const mock = new MockPaymentProvider();
    const order = await mock.createOrder({
      amountPaise: 49900,
      currency: "INR",
      receipt: "rcpt_test_01",
    });

    expect(order.gatewayOrderId).toContain("order_mock_");
    expect(order.upiIntentUrl).toContain("upi://pay");

    const validSig = mock.generateMockSignature(order.gatewayOrderId, "pay_mock_123");
    expect(
      mock.verifyPaymentSignature({
        orderId: order.gatewayOrderId,
        paymentId: "pay_mock_123",
        signature: validSig,
      }),
    ).toBe(true);

    expect(
      mock.verifyPaymentSignature({
        orderId: order.gatewayOrderId,
        paymentId: "pay_mock_123",
        signature: "invalid_sig",
      }),
    ).toBe(false);

    const refund = await mock.createRefund({
      paymentId: "pay_mock_123",
      amountPaise: 49900,
    });
    expect(refund.status).toBe("processed");
    expect(refund.gatewayRefundId).toContain("rfnd_mock_");

    // Verify webhook signature tests
    expect(mock.verifyWebhookSignature("{}", "mock_webhook_signature")).toBe(true);
    expect(mock.verifyWebhookSignature("{}", "invalid_sig")).toBe(false);
    expect(mock.verifyWebhookSignature("{}", "deadbeef")).toBe(false);
  });

  it("RazorpayRouteProvider verifies cryptographic signatures", () => {
    const rzp = new RazorpayRouteProvider({
      keyId: "rzp_test_key",
      keySecret: "top_secret_key_route",
      webhookSecret: "whsec_route_secret",
    });

    const orderId = "order_DBJOWzybf0sJbb";
    const paymentId = "pay_29MoAMHバイ";
    // crypto HMAC-SHA256 of "order_DBJOWzybf0sJbb|pay_29MoAMHバイ" with "top_secret_key_route"
    const crypto = require("node:crypto");
    const validSignature = crypto
      .createHmac("sha256", "top_secret_key_route")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(
      rzp.verifyPaymentSignature({
        orderId,
        paymentId,
        signature: validSignature,
      }),
    ).toBe(true);

    expect(
      rzp.verifyPaymentSignature({
        orderId,
        paymentId,
        signature: "deadbeefcafebabe",
      }),
    ).toBe(false);

    // Razorpay Webhook signature contract test with recorded payload
    const webhookPayload = JSON.stringify({
      entity: "event",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test_capture_123",
            order_id: "order_test_456",
            amount: 49900,
          },
        },
      },
    });

    const validWebhookSig = crypto
      .createHmac("sha256", "whsec_route_secret")
      .update(webhookPayload)
      .digest("hex");

    expect(rzp.verifyWebhookSignature(webhookPayload, validWebhookSig)).toBe(true);
    expect(rzp.verifyWebhookSignature(webhookPayload, "invalid_webhook_sig")).toBe(false);
    expect(rzp.verifyWebhookSignature(webhookPayload, "")).toBe(false);
  });
});
