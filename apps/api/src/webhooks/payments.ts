import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import {
  auditLog,
  creators,
  entitlements,
  ledgerEntries,
  orders,
  payments,
  payouts,
  webhookInbox,
  type Db,
} from "@hyperprofile/db";
import {
  buildRefundLedgerEntries,
  calculatePlatformFee,
  type PaymentProvider,
} from "@hyperprofile/payments";
import { logger } from "@hyperprofile/shared";
import { finalizeOrderPayment } from "../payments/order-processor.js";

export function createPaymentWebhookHandlers(deps: {
  db: Db;
  paymentProvider: PaymentProvider;
}) {
  const { db, paymentProvider } = deps;

  async function handlePaymentWebhook(req: FastifyRequest, reply: FastifyReply) {
    const signature =
      (req.headers["x-razorpay-signature"] as string) ??
      (req.headers["x-webhook-signature"] as string) ??
      "";

    const raw = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from("");
    const rawBodyStr = raw.length > 0 ? raw.toString("utf8") : JSON.stringify(req.body ?? {});

    const isValid = paymentProvider.verifyWebhookSignature(raw.length > 0 ? raw : rawBodyStr, signature);
    if (!isValid) {
      logger.error("payment webhook signature mismatch", { signature: signature.slice(0, 16) });
      return reply.code(400).send({ error: "Invalid webhook signature" });
    }

    const payload = (req.body ?? {}) as {
      id?: string;
      event?: string;
      account_id?: string;
      payload?: {
        payment?: {
          entity?: {
            id: string;
            order_id?: string;
            amount?: number;
            method?: "upi" | "card" | "netbanking";
            notes?: Record<string, string>;
          };
        };
        refund?: {
          entity?: {
            id: string;
            payment_id: string;
            amount?: number;
            notes?: Record<string, string>;
          };
        };
        transfer?: {
          entity?: {
            id: string;
            recipient?: string;
            amount?: number;
            status?: string;
          };
        };
      };
    };

    const eventType = payload.event ?? "unknown";
    const eventId =
      payload.id ??
      (req.headers["x-razorpay-event-id"] as string) ??
      `evt_${crypto.createHash("sha256").update(rawBodyStr).digest("hex").slice(0, 24)}`;

    // Store in webhook_inbox first: unique on provider + event_id
    const inboxRow = await db
      .insert(webhookInbox)
      .values({
        provider: "razorpay",
        eventId,
        rawBody: rawBodyStr,
        receivedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    // Replay detection: if already recorded and processed, return immediately
    if (inboxRow.length === 0) {
      logger.info("payment webhook duplicate ignored", { eventId, eventType });
      return reply.code(200).send({ status: "ok", duplicate: true });
    }

    try {
      if (eventType === "payment.captured") {
        const paymentEntity = payload.payload?.payment?.entity;
        const gatewayOrderId = paymentEntity?.order_id;
        const gatewayPaymentId = paymentEntity?.id ?? `pay_${Date.now()}`;
        const method = paymentEntity?.method ?? "upi";

        if (gatewayOrderId) {
          const order = (
            await db.select().from(orders).where(eq(orders.gatewayOrderId, gatewayOrderId)).limit(1)
          )[0];

          if (order) {
            await finalizeOrderPayment(db, {
              order,
              gatewayPaymentId,
              method,
              rawPayload: paymentEntity as Record<string, unknown>,
            });
          }
        }
      } else if (eventType === "payment.failed") {
        const paymentEntity = payload.payload?.payment?.entity;
        const gatewayOrderId = paymentEntity?.order_id;
        if (gatewayOrderId) {
          await db
            .update(orders)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(orders.gatewayOrderId, gatewayOrderId));
        }
      } else if (eventType === "refund.processed" || eventType === "refund.created") {
        const refundEntity = payload.payload?.refund?.entity;
        const paymentId = refundEntity?.payment_id;

        if (paymentId) {
          const paymentRow = (
            await db.select().from(payments).where(eq(payments.gatewayPaymentId, paymentId)).limit(1)
          )[0];

          if (paymentRow) {
            const order = (
              await db.select().from(orders).where(eq(orders.id, paymentRow.orderId)).limit(1)
            )[0];

            if (order && order.status === "paid") {
              const creator = (
                await db.select().from(creators).where(eq(creators.id, order.creatorId)).limit(1)
              )[0];

              const refundAmountPaise = refundEntity?.amount ?? order.netAmountPaise;
              const platformFeePaise = calculatePlatformFee(
                refundAmountPaise,
                (creator?.plan as "free" | "creator" | "studio") ?? "free",
              );
              const creatorReversalPaise = refundAmountPaise - platformFeePaise;
              const refundId = refundEntity?.id ?? `rfnd_${Date.now()}`;

              await db
                .update(orders)
                .set({ status: "refunded", updatedAt: new Date() })
                .where(eq(orders.id, order.id));

              const reversingRows = buildRefundLedgerEntries({
                orderId: order.id,
                refundId,
                refundAmountPaise,
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

              await db.insert(auditLog).values({
                actor: "webhook:razorpay",
                action: "order.refund",
                entity: `order:${order.id}`,
                before: { status: "paid" },
                after: { status: "refunded", refundId },
              });
            }
          }
        }
      } else if (eventType === "transfer.processed") {
        const transfer = payload.payload?.transfer?.entity;
        if (transfer?.id) {
          await db
            .insert(payouts)
            .values({
              creatorId: crypto.randomUUID(), // Linked creator or fallback
              gatewayTransferId: transfer.id,
              amountPaise: transfer.amount ?? 0,
              status: "settled",
              settledAt: new Date(),
            })
            .onConflictDoNothing();
        }
      }

      // Mark webhook processed in inbox
      await db
        .update(webhookInbox)
        .set({ processedAt: new Date() })
        .where(eq(webhookInbox.eventId, eventId));

      return reply.code(200).send({ status: "ok" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("payment webhook processing failed", { eventId, error: msg });
      await db
        .update(webhookInbox)
        .set({ error: msg })
        .where(eq(webhookInbox.eventId, eventId));

      return reply.code(500).send({ error: "Internal processing error" });
    }
  }

  return { handlePaymentWebhook };
}
