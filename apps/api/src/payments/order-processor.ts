import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  buyers,
  creators,
  entitlements,
  invoices,
  ledgerEntries,
  orders,
  pageEvents,
  payments,
  products,
  type Db,
} from "@hyperprofile/db";
import {
  buildOrderLedgerEntries,
  calculateGatewayFee,
  calculatePlatformFee,
} from "@hyperprofile/payments";
import { logger } from "@hyperprofile/shared";
import { provisionTelegramMembership } from "../telegram/community-service.js";
import { provisionSessionBooking } from "../bookings/booking-service.js";

/**
 * Generates gap-free Indian FY invoice number: INV-YYYYYY-NNNNN
 * e.g., April 2026 to March 2027 is FY 2026-27 -> INV-202627-00001
 */
export function generateFyInvoiceNumber(sequence: number, date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1) % 100;
  const fyString = `${fyStart}${fyEnd.toString().padStart(2, "0")}`;
  const seqPadded = sequence.toString().padStart(5, "0");
  return `INV-${fyString}-${seqPadded}`;
}

export function getCurrentFyPrefix(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1) % 100;
  return `INV-${fyStart}${fyEnd.toString().padStart(2, "0")}-`;
}

export interface FinalizeOrderResult {
  success: boolean;
  orderId: string;
  invoiceNumber?: string | undefined;
  entitlementToken?: string | undefined;
  alreadyProcessed?: boolean | undefined;
}

/**
 * Idempotently finalizes a paid order, posts append-only ledger entries,
 * creates buyer entitlement, and generates gap-free FY tax invoice.
 */
export async function finalizeOrderPayment(
  db: Db,
  options: {
    order: typeof orders.$inferSelect;
    gatewayPaymentId: string;
    method?: "upi" | "card" | "netbanking";
    signature?: string;
    rawPayload?: Record<string, unknown>;
  },
): Promise<FinalizeOrderResult> {
  const { order, gatewayPaymentId, method = "upi", signature, rawPayload } = options;

  // Idempotency: if already paid, return existing entitlement and invoice
  if (order.status === "paid") {
    const existingEntitlement = (
      await db.select().from(entitlements).where(eq(entitlements.orderId, order.id)).limit(1)
    )[0];
    const existingInvoice = (
      await db.select().from(invoices).where(eq(invoices.orderId, order.id)).limit(1)
    )[0];
    return {
      success: true,
      alreadyProcessed: true,
      orderId: order.id,
      entitlementToken: existingEntitlement?.accessToken,
      invoiceNumber: existingInvoice?.invoiceNumber,
    };
  }

  const creator = (
    await db.select().from(creators).where(eq(creators.id, order.creatorId)).limit(1)
  )[0];

  // Fee and split arithmetic
  const gwFees = calculateGatewayFee(order.netAmountPaise, method);
  const platformFeePaise = calculatePlatformFee(
    order.netAmountPaise,
    (creator?.plan as "free" | "creator" | "studio") ?? "free",
  );
  const creatorPayablePaise = Math.max(
    0,
    order.netAmountPaise - (gwFees.feePaise + gwFees.feeGstPaise + platformFeePaise),
  );

  // Update order status
  await db
    .update(orders)
    .set({ status: "paid", updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  // Record payment (idempotent on gatewayPaymentId)
  await db
    .insert(payments)
    .values({
      orderId: order.id,
      gatewayPaymentId,
      method,
      status: "captured",
      feePaise: gwFees.feePaise,
      gstOnFeePaise: gwFees.feeGstPaise,
      rawResponse: rawPayload ?? (signature ? { signature } : {}),
    })
    .onConflictDoNothing();

  // Post double-entry append-only ledger rows
  const ledgerRows = buildOrderLedgerEntries({
    orderId: order.id,
    buyerPaidPaise: order.netAmountPaise,
    gatewayFeePaise: gwFees.feePaise,
    gatewayFeeGstPaise: gwFees.feeGstPaise,
    platformFeePaise,
    creatorPayablePaise,
  });

  for (const row of ledgerRows) {
    await db
      .insert(ledgerEntries)
      .values({
        orderId: row.orderId,
        account: row.account,
        amountPaise: row.amountPaise,
        direction: row.direction,
        idempotencyKey: row.idempotencyKey,
      })
      .onConflictDoNothing();
  }

  // Create entitlement with magic access token (idempotent on orderId)
  const accessToken = crypto.randomBytes(32).toString("hex");
  await db
    .insert(entitlements)
    .values({
      buyerId: order.buyerId,
      productId: order.productId,
      orderId: order.id,
      accessToken,
      downloadCount: 0,
      maxDownloads: 10,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    })
    .onConflictDoNothing();

  const entitlement = (
    await db.select().from(entitlements).where(eq(entitlements.orderId, order.id)).limit(1)
  )[0];

  // SuperProfile Phase 4: Automatically provision 1-tap single-use Telegram community invite
  try {
    const product = (
      await db.select().from(products).where(eq(products.id, order.productId)).limit(1)
    )[0];
    if (product?.type === "telegram_community") {
      const buyer = (
        await db.select().from(buyers).where(eq(buyers.id, order.buyerId)).limit(1)
      )[0];
      await provisionTelegramMembership(db, {
        creatorId: order.creatorId,
        productId: order.productId,
        buyerId: order.buyerId,
        orderId: order.id,
        buyerEmail: buyer?.email,
      });
    }

    // SuperProfile Phase 5: Automatically provision 1:1 Calendar consultation booking
    if (product?.type === "session") {
      const buyer = (
        await db.select().from(buyers).where(eq(buyers.id, order.buyerId)).limit(1)
      )[0];
      await provisionSessionBooking(db, {
        creatorId: order.creatorId,
        productId: order.productId,
        buyerId: order.buyerId,
        orderId: order.id,
        buyerName: buyer?.name ?? undefined,
        buyerEmail: buyer?.email ?? undefined,
      });
    }
  } catch (err) {
    logger.warn("telegram membership provisioning caught error", { err: String(err) });
  }

  // Gap-free FY invoice generation
  let invoice = (
    await db.select().from(invoices).where(eq(invoices.orderId, order.id)).limit(1)
  )[0];

  if (!invoice) {
    const fyPrefix = getCurrentFyPrefix();
    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(sql`${invoices.invoiceNumber} LIKE ${fyPrefix + "%"}`);
    const nextSeq = (Number(countRes[0]?.count) || 0) + 1;
    const invoiceNumber = generateFyInvoiceNumber(nextSeq);

    const inserted = await db
      .insert(invoices)
      .values({
        orderId: order.id,
        invoiceNumber,
        amountPaise: order.netAmountPaise,
        gstBreakdown: {
          amountPaise: order.amountPaise,
          gstPaise: order.gstPaise,
          discountPaise: order.discountPaise,
          netAmountPaise: order.netAmountPaise,
        },
      })
      .onConflictDoNothing()
      .returning();

    invoice =
      inserted[0] ??
      (await db.select().from(invoices).where(eq(invoices.orderId, order.id)).limit(1))[0];
  }

  // Record purchase event in analytics
  await db.insert(pageEvents).values({
    creatorId: order.creatorId,
    eventType: "purchase",
    visitorId: order.buyerId,
    metadata: { orderId: order.id, amountPaise: order.netAmountPaise },
  });

  logger.info("order paid and ledger balanced", {
    orderId: order.id,
    buyerPaid: order.netAmountPaise,
    creatorPayable: creatorPayablePaise,
    invoiceNumber: invoice?.invoiceNumber,
  });

  return {
    success: true,
    orderId: order.id,
    invoiceNumber: invoice?.invoiceNumber,
    entitlementToken: entitlement?.accessToken,
  };
}
