/** Money maths and currency utilities. All amounts are strictly integers in paise. */

export type MoneyPaise = number;

export interface GstBreakdown {
  basePaise: number;
  gstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  totalPaise: number;
  ratePercent: number;
}

/** Calculate GST breakdown. If price is tax-inclusive or exclusive. */
export function calculateGst(
  amountPaise: MoneyPaise,
  gstRatePercent: number = 18,
  inclusive: boolean = false,
): GstBreakdown {
  if (gstRatePercent <= 0) {
    return {
      basePaise: amountPaise,
      gstPaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      totalPaise: amountPaise,
      ratePercent: 0,
    };
  }

  if (inclusive) {
    // base = amount / (1 + rate/100)
    const basePaise = Math.round((amountPaise * 100) / (100 + gstRatePercent));
    const gstPaise = amountPaise - basePaise;
    const halfGst = Math.round(gstPaise / 2);
    return {
      basePaise,
      gstPaise,
      cgstPaise: halfGst,
      sgstPaise: gstPaise - halfGst,
      totalPaise: amountPaise,
      ratePercent: gstRatePercent,
    };
  }

  // Exclusive: tax added on top
  const gstPaise = Math.round((amountPaise * gstRatePercent) / 100);
  const halfGst = Math.round(gstPaise / 2);
  return {
    basePaise: amountPaise,
    gstPaise,
    cgstPaise: halfGst,
    sgstPaise: gstPaise - halfGst,
    totalPaise: amountPaise + gstPaise,
    ratePercent: gstRatePercent,
  };
}

/** Apply percentage or flat discount code */
export function applyDiscount(
  pricePaise: MoneyPaise,
  discountType: "percent" | "flat",
  discountValue: number,
): { finalPaise: MoneyPaise; discountPaise: MoneyPaise } {
  let discountPaise = 0;
  if (discountType === "percent") {
    const pct = Math.max(0, Math.min(100, discountValue));
    discountPaise = Math.round((pricePaise * pct) / 100);
  } else {
    // flat discount in paise
    discountPaise = Math.max(0, Math.min(pricePaise, Math.round(discountValue)));
  }

  const finalPaise = Math.max(0, pricePaise - discountPaise);
  return { finalPaise, discountPaise };
}

/**
 * Gateway fee modeling:
 * Standard gateway cost is ~2% + 18% GST on the fee.
 * UPI band: 0.4% above ₹2,000 (200000 paise), capped at ₹300 (30000 paise).
 */
export function calculateGatewayFee(
  amountPaise: MoneyPaise,
  method: "upi" | "card" | "netbanking" = "upi",
  options?: { upiDiscountAbove2000?: boolean },
): { feePaise: MoneyPaise; feeGstPaise: MoneyPaise; totalFeePaise: MoneyPaise } {
  if (amountPaise <= 0) {
    return { feePaise: 0, feeGstPaise: 0, totalFeePaise: 0 };
  }

  let rate = 0.02; // default 2%
  let capPaise: number | undefined;

  if (method === "upi") {
    if (options?.upiDiscountAbove2000 && amountPaise > 200000) {
      rate = 0.004; // 0.4%
      capPaise = 30000; // ₹300 cap
    } else if (options?.upiDiscountAbove2000 && amountPaise <= 200000) {
      rate = 0.0; // ₹0 under 2k for merchant UPI
    } else {
      rate = 0.015; // 1.5% default UPI
    }
  }

  let feePaise = Math.round(amountPaise * rate);
  if (capPaise !== undefined && feePaise > capPaise) {
    feePaise = capPaise;
  }

  const feeGstPaise = Math.round(feePaise * 0.18);
  return {
    feePaise,
    feeGstPaise,
    totalFeePaise: feePaise + feeGstPaise,
  };
}

/** Platform fee according to creator plan: Free 4%, Creator 0%, Studio 0% */
export function calculatePlatformFee(
  netAmountPaise: MoneyPaise,
  plan: "free" | "creator" | "studio" = "free",
): MoneyPaise {
  if (plan === "creator" || plan === "studio") {
    return 0;
  }
  // Free plan has 4% platform fee
  return Math.round(netAmountPaise * 0.04);
}

/**
 * Format INR paise into Indian currency format with proper digit grouping (lakhs, crores).
 * e.g., 12345678 paise = ₹1,23,456.78
 */
export function formatInr(paise: MoneyPaise): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}
