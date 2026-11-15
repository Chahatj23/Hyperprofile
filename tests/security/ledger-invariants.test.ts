import { describe, expect, it } from "vitest";
import {
  buildOrderLedgerEntries,
  buildRefundLedgerEntries,
  verifyLedgerBalance,
  type OrderFinancials,
  type RefundFinancials,
} from "../../packages/payments/src/index.js";

describe("Stage 3: Ledger Double-Entry Invariants & Property Tests", () => {
  describe("Order Postings Double-Entry Property Tests", () => {
    it("property test: Debits === Credits across 100 randomized order amounts and fee distributions", () => {
      // Deterministic PRNG seed for reproducible property testing
      let seed = 42;
      function randomPaise(min: number, max: number): number {
        seed = (seed * 9301 + 49297) % 233280;
        const rnd = seed / 233280;
        return Math.floor(min + rnd * (max - min));
      }

      for (let i = 0; i < 100; i++) {
        const buyerPaidPaise = randomPaise(100, 1000000); // ₹1 to ₹10,000
        const gatewayFeePaise = Math.floor(buyerPaidPaise * 0.02);
        const gatewayFeeGstPaise = Math.floor(gatewayFeePaise * 0.18);
        const platformFeePaise = Math.floor(buyerPaidPaise * 0.05);
        const creatorPayablePaise = Math.max(
          0,
          buyerPaidPaise - (gatewayFeePaise + gatewayFeeGstPaise + platformFeePaise),
        );

        // Adjust rounding remainder to ensure exact zero-sum match
        const allocated = gatewayFeePaise + gatewayFeeGstPaise + platformFeePaise + creatorPayablePaise;
        const remainder = buyerPaidPaise - allocated;
        const adjustedCreatorPayable = creatorPayablePaise + remainder;

        const fin: OrderFinancials = {
          orderId: `ord_prop_${i}`,
          buyerPaidPaise,
          gatewayFeePaise,
          gatewayFeeGstPaise,
          platformFeePaise,
          creatorPayablePaise: adjustedCreatorPayable,
        };

        const entries = buildOrderLedgerEntries(fin);

        // Verify debits equal credits
        const isBalanced = verifyLedgerBalance(entries);
        expect(isBalanced).toBe(true);

        const debits = entries.filter((e) => e.direction === "debit").reduce((s, e) => s + e.amountPaise, 0);
        const credits = entries.filter((e) => e.direction === "credit").reduce((s, e) => s + e.amountPaise, 0);
        expect(debits).toBe(buyerPaidPaise);
        expect(credits).toBe(buyerPaidPaise);
      }
    });

    it("throws a ledger imbalance error if credits do not sum to buyer debits", () => {
      const imbalancedFin: OrderFinancials = {
        orderId: "ord_corrupted",
        buyerPaidPaise: 50000,
        gatewayFeePaise: 1000,
        gatewayFeeGstPaise: 180,
        platformFeePaise: 2500,
        creatorPayablePaise: 40000, // Sum = 43,680 !== 50,000 (imbalance of 6,320)
      };

      expect(() => buildOrderLedgerEntries(imbalancedFin)).toThrow(/Ledger imbalance/);
    });
  });

  describe("Refund Postings Invariants", () => {
    it("property test: refund debits equal refund credits without mutating historical rows", () => {
      const refundFin: RefundFinancials = {
        orderId: "ord_ref_test",
        refundId: "rfnd_12345",
        refundAmountPaise: 50000,
        creatorPayableReversalPaise: 47500,
        platformFeeReversalPaise: 2500,
      };

      const refundEntries = buildRefundLedgerEntries(refundFin);

      expect(verifyLedgerBalance(refundEntries)).toBe(true);

      const debits = refundEntries.filter((e) => e.direction === "debit").reduce((s, e) => s + e.amountPaise, 0);
      const credits = refundEntries.filter((e) => e.direction === "credit").reduce((s, e) => s + e.amountPaise, 0);
      expect(debits).toBe(50000);
      expect(credits).toBe(50000);
    });

    it("throws if refund reversals do not match refund amount", () => {
      const badRefund: RefundFinancials = {
        orderId: "ord_bad_ref",
        refundId: "rfnd_bad",
        refundAmountPaise: 50000,
        creatorPayableReversalPaise: 40000,
        platformFeeReversalPaise: 2000, // Sum = 42,000 !== 50,000
      };

      expect(() => buildRefundLedgerEntries(badRefund)).toThrow(/Refund ledger imbalance/);
    });
  });
});
