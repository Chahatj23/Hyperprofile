import type { MoneyPaise } from "./money.js";

export type LedgerAccount =
  | "buyer"
  | "gateway_fee"
  | "gateway_fee_gst"
  | "platform_fee"
  | "creator_payable"
  | "refund";

export type LedgerDirection = "debit" | "credit";

export interface LedgerPosting {
  orderId: string;
  account: LedgerAccount;
  amountPaise: MoneyPaise;
  direction: LedgerDirection;
  idempotencyKey: string;
}

export interface OrderFinancials {
  orderId: string;
  buyerPaidPaise: MoneyPaise;
  gatewayFeePaise: MoneyPaise;
  gatewayFeeGstPaise: MoneyPaise;
  platformFeePaise: MoneyPaise;
  creatorPayablePaise: MoneyPaise;
}

/**
 * Creates double-entry append-only ledger rows for an order.
 * In double entry: Sum(Debits) === Sum(Credits).
 */
export function buildOrderLedgerEntries(fin: OrderFinancials): LedgerPosting[] {
  const creditsSum =
    fin.gatewayFeePaise +
    fin.gatewayFeeGstPaise +
    fin.platformFeePaise +
    fin.creatorPayablePaise;

  if (fin.buyerPaidPaise !== creditsSum) {
    throw new Error(
      `Ledger imbalance: buyer paid ${fin.buyerPaidPaise} paise but credits sum to ${creditsSum} paise`,
    );
  }

  const entries: LedgerPosting[] = [
    {
      orderId: fin.orderId,
      account: "buyer",
      amountPaise: fin.buyerPaidPaise,
      direction: "debit",
      idempotencyKey: `ord_${fin.orderId}_buyer_debit`,
    },
    {
      orderId: fin.orderId,
      account: "gateway_fee",
      amountPaise: fin.gatewayFeePaise,
      direction: "credit",
      idempotencyKey: `ord_${fin.orderId}_gwfee_credit`,
    },
    {
      orderId: fin.orderId,
      account: "gateway_fee_gst",
      amountPaise: fin.gatewayFeeGstPaise,
      direction: "credit",
      idempotencyKey: `ord_${fin.orderId}_gwfeegst_credit`,
    },
    {
      orderId: fin.orderId,
      account: "platform_fee",
      amountPaise: fin.platformFeePaise,
      direction: "credit",
      idempotencyKey: `ord_${fin.orderId}_platfee_credit`,
    },
    {
      orderId: fin.orderId,
      account: "creator_payable",
      amountPaise: fin.creatorPayablePaise,
      direction: "credit",
      idempotencyKey: `ord_${fin.orderId}_creator_credit`,
    },
  ];

  return entries.filter((e) => e.amountPaise > 0);
}

export interface RefundFinancials {
  orderId: string;
  refundId: string;
  refundAmountPaise: MoneyPaise;
  creatorPayableReversalPaise: MoneyPaise;
  platformFeeReversalPaise: MoneyPaise;
}

/**
 * Creates reversing ledger entries for a refund.
 * Never deletes or updates original rows; appends reversing rows.
 */
export function buildRefundLedgerEntries(fin: RefundFinancials): LedgerPosting[] {
  const debitsSum = fin.creatorPayableReversalPaise + fin.platformFeeReversalPaise;
  if (fin.refundAmountPaise !== debitsSum) {
    throw new Error(
      `Refund ledger imbalance: refund ${fin.refundAmountPaise} paise does not match reversals sum ${debitsSum} paise`,
    );
  }

  const entries: LedgerPosting[] = [
    {
      orderId: fin.orderId,
      account: "creator_payable",
      amountPaise: fin.creatorPayableReversalPaise,
      direction: "debit",
      idempotencyKey: `ref_${fin.refundId}_creator_debit`,
    },
    {
      orderId: fin.orderId,
      account: "platform_fee",
      amountPaise: fin.platformFeeReversalPaise,
      direction: "debit",
      idempotencyKey: `ref_${fin.refundId}_platfee_debit`,
    },
    {
      orderId: fin.orderId,
      account: "refund",
      amountPaise: fin.refundAmountPaise,
      direction: "credit",
      idempotencyKey: `ref_${fin.refundId}_refund_credit`,
    },
  ];

  return entries.filter((e) => e.amountPaise > 0);
}

/**
 * Verifies that a set of ledger postings balances:
 * Total debits == Total credits, or signed sum == 0.
 */
export function verifyLedgerBalance(
  postings: Array<{ amountPaise: MoneyPaise; direction: LedgerDirection }>,
): boolean {
  let debits = 0;
  let credits = 0;

  for (const p of postings) {
    if (p.direction === "debit") {
      debits += p.amountPaise;
    } else {
      credits += p.amountPaise;
    }
  }

  return debits === credits;
}

/**
 * Calculates the signed ledger sum.
 * Debits are positive (+), credits are negative (-).
 * A balanced set always returns 0.
 */
export function calculateSignedLedgerSum(
  postings: Array<{ amountPaise: MoneyPaise; direction: LedgerDirection }>,
): number {
  return postings.reduce(
    (acc, p) => acc + (p.direction === "debit" ? p.amountPaise : -p.amountPaise),
    0,
  );
}
