import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  auditLog,
  automationEvents,
  buyers,
  creators,
  entitlements,
  igAccounts,
  ledgerEntries,
  orders,
  pageEvents,
  payments,
  payouts,
  products,
  subscriptions,
  type Db,
} from "@hyperprofile/db";
import {
  buildRefundLedgerEntries,
  calculatePlatformFee,
  formatInr,
  type PaymentProvider,
} from "@hyperprofile/payments";
import { getSession } from "../auth/session.js";

export function registerDashboardRoutes(
  app: FastifyInstance,
  options: { db: Db; sessionSecret: string; paymentProvider: PaymentProvider },
) {
  const { db, sessionSecret, paymentProvider } = options;

  async function requireCreator(req: FastifyRequest, reply: FastifyReply) {
    const session = getSession(req, sessionSecret);
    if (!session?.creatorId) {
      reply.code(401).send({ code: "unauthorized", message: "Creator authentication required" });
      return null;
    }
    return session;
  }

  // List creator orders
  app.get("/v1/creator/orders", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireCreator(req, reply);
    if (!session) return;

    const orderRows = await db
      .select({
        id: orders.id,
        receipt: orders.receipt,
        amountPaise: orders.amountPaise,
        discountPaise: orders.discountPaise,
        gstPaise: orders.gstPaise,
        netAmountPaise: orders.netAmountPaise,
        status: orders.status,
        createdAt: orders.createdAt,
        productTitle: products.title,
        productType: products.type,
        buyerEmail: buyers.email,
        buyerName: buyers.name,
      })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .leftJoin(buyers, eq(orders.buyerId, buyers.id))
      .where(eq(orders.creatorId, session.creatorId!))
      .orderBy(desc(orders.createdAt))
      .limit(100);

    return {
      data: orderRows.map((o) => ({
        ...o,
        netAmountFormatted: formatInr(o.netAmountPaise),
      })),
    };
  });

  // Creator refunds an order
  app.post("/v1/orders/:id/refund", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireCreator(req, reply);
    if (!session) return;

    const { id } = req.params as { id: string };
    const order = (
      await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, id), eq(orders.creatorId, session.creatorId!)))
        .limit(1)
    )[0];

    if (!order) {
      return reply.code(404).send({ code: "not_found", message: "Order not found" });
    }

    if (order.status !== "paid") {
      return reply.code(400).send({
        code: "invalid_order_state",
        message: `Order cannot be refunded because status is ${order.status}`,
      });
    }

    const creator = (
      await db.select().from(creators).where(eq(creators.id, session.creatorId!)).limit(1)
    )[0];

    // Calculate refund amounts
    const platformFeePaise = calculatePlatformFee(
      order.netAmountPaise,
      (creator?.plan as "free" | "creator" | "studio") ?? "free",
    );
    const creatorReversalPaise = order.netAmountPaise - platformFeePaise;

    // Look up the actual gateway payment ID for the gateway refund API
    const payment = (
      await db.select().from(payments).where(eq(payments.orderId, order.id)).limit(1)
    )[0];
    const paymentId = payment?.gatewayPaymentId ?? order.gatewayOrderId ?? `mock_${order.id}`;

    // Trigger refund with gateway
    const refundRes = await paymentProvider.createRefund({
      paymentId,
      amountPaise: order.netAmountPaise,
    });

    // Mark order refunded
    await db
      .update(orders)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    // Append reversing ledger entries
    const refundId = refundRes.gatewayRefundId || crypto.randomUUID();
    const reversingRows = buildRefundLedgerEntries({
      orderId: order.id,
      refundId,
      refundAmountPaise: order.netAmountPaise,
      creatorPayableReversalPaise: creatorReversalPaise,
      platformFeeReversalPaise: platformFeePaise,
    });

    for (const r of reversingRows) {
      await db
        .insert(ledgerEntries)
        .values({
          orderId: r.orderId,
          account: r.account,
          amountPaise: r.amountPaise,
          direction: r.direction,
          idempotencyKey: r.idempotencyKey,
        })
        .onConflictDoNothing();
    }

    // Revoke buyer entitlement
    await db.delete(entitlements).where(eq(entitlements.orderId, order.id));

    // Audit log
    await db.insert(auditLog).values({
      actor: `creator:${session.creatorId}`,
      action: "order.refund",
      entity: `order:${order.id}`,
      before: { status: "paid" },
      after: { status: "refunded", refundId },
    });

    return {
      success: true,
      message: "Order refunded and reversing ledger entries posted",
      refundId,
    };
  });

  // Creator financial ledger statement
  app.get("/v1/creator/statement", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireCreator(req, reply);
    if (!session) return;

    // Fetch ledger entries tied to this creator's orders
    const entries = await db
      .select({
        id: ledgerEntries.id,
        orderId: ledgerEntries.orderId,
        account: ledgerEntries.account,
        amountPaise: ledgerEntries.amountPaise,
        direction: ledgerEntries.direction,
        idempotencyKey: ledgerEntries.idempotencyKey,
        createdAt: ledgerEntries.createdAt,
      })
      .from(ledgerEntries)
      .innerJoin(orders, eq(ledgerEntries.orderId, orders.id))
      .where(eq(orders.creatorId, session.creatorId!))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(200);

    let netCreatorPayable = 0;
    for (const e of entries) {
      if (e.account === "creator_payable") {
        if (e.direction === "credit") netCreatorPayable += e.amountPaise;
        else if (e.direction === "debit") netCreatorPayable -= e.amountPaise;
      }
    }

    return {
      balancePaise: netCreatorPayable,
      balanceFormatted: formatInr(netCreatorPayable),
      entries: entries.map((e) => ({
        ...e,
        amountFormatted: formatInr(e.amountPaise),
      })),
    };
  });

  // Creator payouts list
  app.get("/v1/creator/payouts", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireCreator(req, reply);
    if (!session) return;

    const rows = await db
      .select()
      .from(payouts)
      .where(eq(payouts.creatorId, session.creatorId!))
      .orderBy(desc(payouts.createdAt));

    return {
      data: rows.map((p) => ({
        ...p,
        amountFormatted: formatInr(p.amountPaise),
      })),
    };
  });

  // Creator analytics summary
  app.get("/v1/creator/analytics", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireCreator(req, reply);
    if (!session) return;

    // Count page views
    const viewsRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(pageEvents)
      .where(and(eq(pageEvents.creatorId, session.creatorId!), eq(pageEvents.eventType, "page_view")));

    // Count paid orders & total revenue
    const revenueRes = await db
      .select({
        count: sql<number>`count(*)`,
        totalRevenue: sql<number>`coalesce(sum(${orders.netAmountPaise}), 0)`,
      })
      .from(orders)
      .where(and(eq(orders.creatorId, session.creatorId!), eq(orders.status, "paid")));

    // Count AutoDM events strictly scoped to this creator's Instagram accounts
    const creatorIgAccounts = await db
      .select({ igUserId: igAccounts.igUserId })
      .from(igAccounts)
      .where(eq(igAccounts.creatorId, session.creatorId!));

    let dmsSent = 0;
    if (creatorIgAccounts.length > 0) {
      const igUserIds = creatorIgAccounts.map((a) => a.igUserId);
      const dmsRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(automationEvents)
        .where(
          and(
            eq(automationEvents.status, "sent"),
            inArray(automationEvents.igUserId, igUserIds),
          ),
        );
      dmsSent = Number(dmsRes[0]?.count) || 0;
    }

    const pageViews = Number(viewsRes[0]?.count) || 0;
    const paidOrders = Number(revenueRes[0]?.count) || 0;
    const revenuePaise = Number(revenueRes[0]?.totalRevenue) || 0;
    const conversionRate = pageViews > 0 ? ((paidOrders / pageViews) * 100).toFixed(1) + "%" : "0%";

    return {
      pageViews,
      paidOrders,
      revenuePaise,
      revenueFormatted: formatInr(revenuePaise),
      dmsSent,
      conversionRate,
    };
  });

  // Plans & Subscriptions
  app.post("/v1/creator/subscription", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireCreator(req, reply);
    if (!session) return;

    const body = req.body as { plan?: "free" | "creator" | "studio" };
    const plan = body?.plan ?? "free";

    await db
      .update(creators)
      .set({ plan, updatedAt: new Date() })
      .where(eq(creators.id, session.creatorId!));

    await db
      .insert(subscriptions)
      .values({
        creatorId: session.creatorId!,
        plan,
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      })
      .returning();

    // Audit log
    await db.insert(auditLog).values({
      actor: `creator:${session.creatorId}`,
      action: "plan.change",
      entity: `creator:${session.creatorId}`,
      after: { plan },
    });

    return { success: true, plan };
  });
}
