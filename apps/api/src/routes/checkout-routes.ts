import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  buyers,
  consents,
  creators,
  entitlements,
  invoices,
  ledgerEntries,
  offers,
  orders,
  pageEvents,
  payments,
  products,
  type Db,
} from "@hyperprofile/db";
import {
  applyDiscount,
  buildOrderLedgerEntries,
  calculateGatewayFee,
  calculateGst,
  calculatePlatformFee,
  type PaymentProvider,
} from "@hyperprofile/payments";
import { logger } from "@hyperprofile/shared";

import { finalizeOrderPayment } from "../payments/order-processor.js";
import { recordPendingBookingIntent } from "../bookings/booking-service.js";

export function registerCheckoutRoutes(
  app: FastifyInstance,
  options: { db: Db; paymentProvider: PaymentProvider },
) {
  const { db, paymentProvider } = options;

  // Create checkout order
  app.post("/v1/checkout/create-order", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      productId?: string;
      buyerEmail?: string;
      buyerPhone?: string;
      buyerName?: string;
      offerCode?: string;
      includeBump?: boolean;
      paymentMethod?: "upi" | "card" | "netbanking";
      consentAccepted?: boolean;
      bookingDate?: string;
      timeSlot?: string;
      buyerNotes?: string;
    };

    const productId = body?.productId;
    const email = body?.buyerEmail?.trim().toLowerCase();
    const phone = body?.buyerPhone?.trim();
    const name = body?.buyerName?.trim() || email?.split("@")[0] || "Buyer";
    const paymentMethod = body?.paymentMethod ?? "upi";

    if (!productId || !email || !email.includes("@")) {
      return reply.code(400).send({
        code: "missing_fields",
        message: "Valid product ID and buyer email are required",
      });
    }

    const product = (
      await db.select().from(products).where(eq(products.id, productId)).limit(1)
    )[0];

    if (!product || product.status !== "active") {
      return reply.code(404).send({ code: "not_found", message: "Product is not available" });
    }

    const creator = (
      await db.select().from(creators).where(eq(creators.id, product.creatorId)).limit(1)
    )[0];

    // Handle coupon if provided
    let discountPaise = 0;
    let offerId: string | null = null;
    if (body.offerCode) {
      const code = body.offerCode.trim().toUpperCase();
      const offer = (
        await db
          .select()
          .from(offers)
          .where(
            and(
              eq(offers.code, code),
              eq(offers.active, true),
              eq(offers.creatorId, product.creatorId),
            ),
          )
          .limit(1)
      )[0];

      if (offer && (!offer.validUntil || offer.validUntil >= new Date())) {
        const disc = applyDiscount(
          product.pricePaise,
          offer.discountType as "percent" | "flat",
          offer.discountValue,
        );
        discountPaise = disc.discountPaise;
        offerId = offer.id;
      }
    }

    const bumpConfig = (product.deliveryConfig as Record<string, any>)?.bumpOffer ?? {
      enabled: true,
      title: "Viral Reel Hooks & 30-Day Content Matrix (Notion + PDF)",
      pricePaise: 19900,
    };
    const bumpPricePaise = body.includeBump ? (bumpConfig.pricePaise ?? 19900) : 0;
    const baseAmount = Math.max(0, product.pricePaise + bumpPricePaise - discountPaise);
    const gstBreakdown = calculateGst(baseAmount, product.gstRate, false);
    const netAmountPaise = gstBreakdown.totalPaise;

    // Find or create buyer
    let buyer = (await db.select().from(buyers).where(eq(buyers.email, email)).limit(1))[0];
    if (!buyer) {
      const inserted = await db
        .insert(buyers)
        .values({ email, phone, name })
        .returning();
      buyer = inserted[0]!;
    }

    // Record DPDP consent if accepted
    if (body.consentAccepted) {
      await db.insert(consents).values({
        entityType: "buyer",
        entityId: buyer.id,
        purpose: "checkout_purchase",
        version: "1.0",
        ipAddress: req.ip,
      });
    }

    // Generate unique receipt id
    const receipt = `rcpt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // Create gateway order
    const gatewayOrder = await paymentProvider.createOrder({
      amountPaise: netAmountPaise,
      currency: "INR",
      receipt,
      notes: {
        productId: product.id,
        creatorId: product.creatorId,
        buyerEmail: email,
        bumpIncluded: body.includeBump ? "true" : "false",
        bumpTitle: body.includeBump ? bumpConfig.title : "",
      },
    });

    // Insert order record
    const [order] = await db
      .insert(orders)
      .values({
        creatorId: product.creatorId,
        productId: product.id,
        buyerId: buyer.id,
        amountPaise: baseAmount,
        discountPaise,
        gstPaise: gstBreakdown.gstPaise,
        netAmountPaise,
        status: "created",
        gatewayOrderId: gatewayOrder.gatewayOrderId,
        receipt,
        currency: "INR",
        offerId,
      })
      .returning();

    if (body.bookingDate || body.timeSlot || body.buyerNotes || product.type === "session") {
      recordPendingBookingIntent(order!.id, {
        bookingDate: body.bookingDate,
        timeSlot: body.timeSlot,
        buyerNotes: body.buyerNotes,
      });
    }

    // Track checkout_init event
    await db.insert(pageEvents).values({
      creatorId: product.creatorId,
      eventType: "checkout_init",
      visitorId: buyer.id,
      metadata: { orderId: order!.id, productId: product.id, amountPaise: netAmountPaise },
    });

    return {
      orderId: order!.id,
      receipt,
      amountPaise: baseAmount,
      bumpPricePaise,
      discountPaise,
      gstPaise: gstBreakdown.gstPaise,
      netAmountPaise,
      gatewayOrderId: gatewayOrder.gatewayOrderId,
      upiIntentUrl: gatewayOrder.upiIntentUrl,
      qrPayload: gatewayOrder.qrPayload,
      creatorName: creator?.displayName ?? "Creator",
      productTitle: product.title,
      bumpIncluded: !!body.includeBump,
      bumpTitle: body.includeBump ? bumpConfig.title : undefined,
    };
  });

  // Verify payment & finalize order
  app.post("/v1/checkout/verify", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      orderId?: string;
      gatewayOrderId?: string;
      gatewayPaymentId?: string;
      signature?: string;
      paymentMethod?: "upi" | "card" | "netbanking";
    };

    if (!body.orderId || !body.gatewayPaymentId || !body.signature) {
      return reply.code(400).send({
        code: "missing_fields",
        message: "orderId, gatewayPaymentId, and signature are required",
      });
    }

    const order = (
      await db.select().from(orders).where(eq(orders.id, body.orderId)).limit(1)
    )[0];

    if (!order) {
      return reply.code(404).send({ code: "order_not_found", message: "Order not found" });
    }

    // Idempotency: if order is already paid, return existing entitlement
    if (order.status === "paid") {
      const existingEntitlement = (
        await db.select().from(entitlements).where(eq(entitlements.orderId, order.id)).limit(1)
      )[0];
      return {
        success: true,
        alreadyProcessed: true,
        orderId: order.id,
        entitlementToken: existingEntitlement?.accessToken,
      };
    }

    const isValid = paymentProvider.verifyPaymentSignature({
      orderId: body.gatewayOrderId ?? order.gatewayOrderId ?? "",
      paymentId: body.gatewayPaymentId,
      signature: body.signature,
    });

    if (!isValid) {
      logger.warn("payment signature verification failed", { orderId: order.id, paymentId: body.gatewayPaymentId });
      return reply.code(400).send({
        code: "invalid_signature",
        message: "Cryptographic payment verification failed",
      });
    }

    const creator = (
      await db.select().from(creators).where(eq(creators.id, order.creatorId)).limit(1)
    )[0];

    const result = await finalizeOrderPayment(db, {
      order,
      gatewayPaymentId: body.gatewayPaymentId,
      method: body.paymentMethod ?? "upi",
      signature: body.signature,
    });

    return {
      success: true,
      orderId: order.id,
      invoiceNumber: result.invoiceNumber,
      entitlementToken: result.entitlementToken,
      alreadyProcessed: result.alreadyProcessed,
    };
  });

  // Free lead magnet capture (0 paise)
  app.post("/v1/checkout/lead-capture", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      productId?: string;
      email?: string;
      phone?: string;
      name?: string;
      consentAccepted?: boolean;
    };

    const productId = body?.productId;
    const email = body?.email?.trim().toLowerCase();
    if (!productId || !email || !email.includes("@")) {
      return reply.code(400).send({ code: "missing_fields", message: "Valid productId and email are required" });
    }

    const product = (
      await db.select().from(products).where(eq(products.id, productId)).limit(1)
    )[0];

    if (!product || product.type !== "lead_magnet") {
      return reply.code(400).send({ code: "invalid_product", message: "Product is not a lead magnet" });
    }

    let buyer = (await db.select().from(buyers).where(eq(buyers.email, email)).limit(1))[0];
    if (!buyer) {
      const inserted = await db
        .insert(buyers)
        .values({ email, phone: body.phone?.trim(), name: body.name?.trim() })
        .returning();
      buyer = inserted[0]!;
    }

    if (body.consentAccepted) {
      await db.insert(consents).values({
        entityType: "buyer",
        entityId: buyer.id,
        purpose: "lead_magnet_capture",
        version: "1.0",
        ipAddress: req.ip,
      });
    }

    const receipt = `lead_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const [order] = await db
      .insert(orders)
      .values({
        creatorId: product.creatorId,
        productId: product.id,
        buyerId: buyer.id,
        amountPaise: 0,
        netAmountPaise: 0,
        status: "paid",
        receipt,
        currency: "INR",
      })
      .returning();

    const accessToken = crypto.randomBytes(32).toString("hex");
    const [entitlement] = await db
      .insert(entitlements)
      .values({
        buyerId: buyer.id,
        productId: product.id,
        orderId: order!.id,
        accessToken,
      })
      .returning();

    await db.insert(pageEvents).values({
      creatorId: product.creatorId,
      eventType: "lead_submit",
      visitorId: buyer.id,
      metadata: { productId: product.id, orderId: order!.id },
    });

    return {
      success: true,
      entitlementToken: entitlement?.accessToken,
      message: "Lead magnet granted successfully",
    };
  });
}
