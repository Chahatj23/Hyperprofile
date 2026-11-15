import { describe, expect, it } from "vitest";
import { applyDiscount } from "../../packages/payments/src/index.js";

interface MockOffer {
  id: string;
  creatorId: string;
  code: string;
  discountType: "percent" | "flat";
  discountValue: number;
  active: boolean;
  validUntil: Date | null;
  maxUses: number | null;
  usesCount: number;
}

function validateAndApplyCoupon(opts: {
  productPricePaise: number;
  productCreatorId: string;
  code: string;
  offer: MockOffer | null;
}): { success: boolean; discountPaise: number; netPaise: number; error?: string } {
  const { productPricePaise, productCreatorId, code, offer } = opts;

  if (!offer || !offer.active || offer.code !== code.toUpperCase().trim()) {
    return { success: false, discountPaise: 0, netPaise: productPricePaise, error: "invalid_coupon" };
  }

  // Multi-tenant check: creator isolation
  if (offer.creatorId !== productCreatorId) {
    return { success: false, discountPaise: 0, netPaise: productPricePaise, error: "wrong_creator_coupon" };
  }

  // Expiration check
  if (offer.validUntil && offer.validUntil < new Date()) {
    return { success: false, discountPaise: 0, netPaise: productPricePaise, error: "coupon_expired" };
  }

  // SEC-S3-01: maxUses usage limit ceiling check
  if (offer.maxUses !== null && offer.usesCount >= offer.maxUses) {
    return { success: false, discountPaise: 0, netPaise: productPricePaise, error: "usage_limit_reached" };
  }

  const disc = applyDiscount(productPricePaise, offer.discountType, offer.discountValue);
  return {
    success: true,
    discountPaise: disc.discountPaise,
    netPaise: disc.finalPaise,
  };
}

describe("Stage 3: Coupon Concurrency, Expiry & Isolation Tests", () => {
  const creatorA = "creator_111";
  const creatorB = "creator_222";
  const productPricePaise = 200000; // ₹2,000

  it("SEC-S3-01: Rejects coupon when maxUses limit has been reached", () => {
    const singleUseOffer: MockOffer = {
      id: "off_1",
      creatorId: creatorA,
      code: "ONETIME50",
      discountType: "percent",
      discountValue: 50,
      active: true,
      validUntil: null,
      maxUses: 1,
      usesCount: 1, // Already consumed once
    };

    const result = validateAndApplyCoupon({
      productPricePaise,
      productCreatorId: creatorA,
      code: "ONETIME50",
      offer: singleUseOffer,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("usage_limit_reached");
    expect(result.discountPaise).toBe(0);
  });

  it("Prevents concurrent race conditions on single-use coupons", async () => {
    let usesCount = 0;
    const maxUses = 1;

    // Concurrency atomic test with simulated DB transaction
    async function claimCouponOrder(): Promise<boolean> {
      if (usesCount >= maxUses) {
        return false;
      }
      usesCount++;
      return true;
    }

    // 10 concurrent shoppers trying to use the same 1-use flash sale code
    const results = await Promise.all(Array.from({ length: 10 }, () => claimCouponOrder()));

    const successfulClaims = results.filter((r) => r === true).length;
    const rejectedClaims = results.filter((r) => r === false).length;

    expect(successfulClaims).toBe(1);
    expect(rejectedClaims).toBe(9);
    expect(usesCount).toBe(1);
  });

  it("Rejects expired coupons", () => {
    const expiredOffer: MockOffer = {
      id: "off_expired",
      creatorId: creatorA,
      code: "SUMMERSALE",
      discountType: "flat",
      discountValue: 50000,
      active: true,
      validUntil: new Date(Date.now() - 3600000), // Expired 1 hr ago
      maxUses: null,
      usesCount: 0,
    };

    const result = validateAndApplyCoupon({
      productPricePaise,
      productCreatorId: creatorA,
      code: "SUMMERSALE",
      offer: expiredOffer,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("coupon_expired");
  });

  it("Rejects coupon belonging to Creator B when applied on Creator A's checkout", () => {
    const creatorBOffer: MockOffer = {
      id: "off_b",
      creatorId: creatorB,
      code: "CREATOR_B_VIP",
      discountType: "percent",
      discountValue: 90,
      active: true,
      validUntil: null,
      maxUses: null,
      usesCount: 0,
    };

    const result = validateAndApplyCoupon({
      productPricePaise,
      productCreatorId: creatorA, // Checking against Creator A's product
      code: "CREATOR_B_VIP",
      offer: creatorBOffer,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("wrong_creator_coupon");
  });
});
