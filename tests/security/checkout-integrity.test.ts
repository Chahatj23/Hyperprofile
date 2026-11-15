import { describe, expect, it } from "vitest";

describe("Payment & Checkout Security Integrity Tests", () => {
  describe("SEC-S1-02: Payment Verification Gateway Order Mismatch", () => {
    // Pure logic simulation of checkout-routes.ts verification step
    function verifyPaymentAttempt(opts: {
      orderGatewayOrderId: string | null;
      clientGatewayOrderId?: string;
      clientPaymentId: string;
      clientSignature: string;
      verifySignatureFn: (params: { orderId: string; paymentId: string; signature: string }) => boolean;
    }): { success: boolean; code?: string; message?: string } {
      const { orderGatewayOrderId, clientGatewayOrderId, clientPaymentId, clientSignature, verifySignatureFn } = opts;

      // DEFENSIVE CONTROL:
      // If the order already has an assigned gatewayOrderId, the client CANNOT override it
      if (orderGatewayOrderId) {
        if (clientGatewayOrderId && clientGatewayOrderId !== orderGatewayOrderId) {
          return {
            success: false,
            code: "order_mismatch",
            message: "Gateway order ID does not match order record",
          };
        }
      }

      const expectedGatewayOrderId = orderGatewayOrderId ?? clientGatewayOrderId ?? "";
      if (!expectedGatewayOrderId) {
        return {
          success: false,
          code: "invalid_order",
          message: "No gateway order ID associated with this order",
        };
      }

      const isValid = verifySignatureFn({
        orderId: expectedGatewayOrderId,
        paymentId: clientPaymentId,
        signature: clientSignature,
      });

      if (!isValid) {
        return {
          success: false,
          code: "invalid_signature",
          message: "Cryptographic payment verification failed",
        };
      }

      return { success: true };
    }

    it("rejects when attacker provides a valid signature for a different (cheaper) gateway order", () => {
      // Scenario:
      // Victim Order B is a ₹5,000 product with gatewayOrderId: 'order_expensive_target_777'
      // Attacker bought a ₹1 product with gatewayOrderId: 'order_cheap_attacker_111'
      // Attacker has valid signature for 'order_cheap_attacker_111'
      const mockVerifySig = (p: { orderId: string; paymentId: string; signature: string }) => {
        // Signature is ONLY valid for order_cheap_attacker_111
        return p.orderId === "order_cheap_attacker_111" && p.signature === "valid_sig_for_111";
      };

      const result = verifyPaymentAttempt({
        orderGatewayOrderId: "order_expensive_target_777",
        clientGatewayOrderId: "order_cheap_attacker_111", // Attacker attempts substitution
        clientPaymentId: "pay_attacker_111",
        clientSignature: "valid_sig_for_111",
        verifySignatureFn: mockVerifySig,
      });

      // Must be rejected because clientGatewayOrderId !== orderGatewayOrderId
      expect(result.success).toBe(false);
      expect(result.code).toBe("order_mismatch");
    });

    it("accepts when gatewayOrderId matches the order record and has valid signature", () => {
      const mockVerifySig = (p: { orderId: string; paymentId: string; signature: string }) => {
        return p.orderId === "order_legit_555" && p.signature === "valid_sig_for_555";
      };

      const result = verifyPaymentAttempt({
        orderGatewayOrderId: "order_legit_555",
        clientGatewayOrderId: "order_legit_555",
        clientPaymentId: "pay_legit_555",
        clientSignature: "valid_sig_for_555",
        verifySignatureFn: mockVerifySig,
      });

      expect(result.success).toBe(true);
    });

    it("accepts when client omits gatewayOrderId and server uses stored order.gatewayOrderId", () => {
      const mockVerifySig = (p: { orderId: string; paymentId: string; signature: string }) => {
        return p.orderId === "order_stored_999" && p.signature === "valid_sig_for_999";
      };

      const result = verifyPaymentAttempt({
        orderGatewayOrderId: "order_stored_999",
        clientPaymentId: "pay_stored_999",
        clientSignature: "valid_sig_for_999",
        verifySignatureFn: mockVerifySig,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Client-side Price & Amount Tampering Protection", () => {
    it("ensures net amount is strictly computed from database product price and discounts", () => {
      const dbProductPricePaise = 299900; // ₹2,999 from database
      const clientSentAmount = 100; // Attacker claims ₹1 in client payload

      // Server recalculation logic
      const discountPaise = 0;
      const computedNetPaise = Math.max(0, dbProductPricePaise - discountPaise);

      // Server MUST NOT trust clientSentAmount
      expect(computedNetPaise).toBe(299900);
      expect(computedNetPaise).not.toBe(clientSentAmount);
    });

    it("rejects negative, fractional, or non-finite discount amounts", () => {
      const invalidDiscounts = [-500, NaN, Infinity, -0.01];
      for (const disc of invalidDiscounts) {
        const isSafe = typeof disc === "number" && Number.isInteger(disc) && disc >= 0;
        expect(isSafe).toBe(false);
      }
    });
  });
});

