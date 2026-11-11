import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import {
  buyers,
  creators,
  entitlements,
  invoices,
  orders,
  products,
  type Db,
} from "@hyperprofile/db";
import { formatInr } from "@hyperprofile/payments";
import {
  getTelegramMembershipByOrder,
  provisionTelegramMembership,
} from "../telegram/community-service.js";
import {
  getSessionBookingByOrder,
  provisionSessionBooking,
} from "../bookings/booking-service.js";

export function registerLibraryRoutes(app: FastifyInstance, options: { db: Db }) {
  const { db } = options;

  // Buyer library / digital download access by magic token
  app.get("/v1/library/:token", async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as { token: string };

    const entitlement = (
      await db.select().from(entitlements).where(eq(entitlements.accessToken, token)).limit(1)
    )[0];

    if (!entitlement) {
      return reply.code(404).send({
        code: "invalid_token",
        message: "Digital product entitlement not found or token expired",
      });
    }

    if (entitlement.expiresAt && entitlement.expiresAt < new Date()) {
      return reply.code(410).send({
        code: "expired",
        message: "This download link has expired",
      });
    }

    const product = (
      await db.select().from(products).where(eq(products.id, entitlement.productId)).limit(1)
    )[0];

    const creator = product
      ? (await db.select().from(creators).where(eq(creators.id, product.creatorId)).limit(1))[0]
      : null;

    const order = (
      await db.select().from(orders).where(eq(orders.id, entitlement.orderId)).limit(1)
    )[0];

    const deliveryConfig = product?.deliveryConfig as Record<string, unknown> | undefined;

    const bumpIncluded =
      order && product
        ? order.amountPaise > product.pricePaise - (order.discountPaise ?? 0)
        : false;

    const bumpOfferConfig = deliveryConfig?.bumpOffer as Record<string, unknown> | undefined;

    let tgMembership: any = null;
    if (product?.type === "telegram_community" && order) {
      tgMembership = await getTelegramMembershipByOrder(db, order.id);
      if (!tgMembership) {
        tgMembership = await provisionTelegramMembership(db, {
          creatorId: order.creatorId,
          productId: product.id,
          buyerId: order.buyerId,
          orderId: order.id,
        });
      }
    }

    let sessionBooking: any = null;
    if (product?.type === "session" && order) {
      sessionBooking = await getSessionBookingByOrder(db, order.id);
      if (!sessionBooking) {
        sessionBooking = await provisionSessionBooking(db, {
          creatorId: order.creatorId,
          productId: product.id,
          buyerId: order.buyerId,
          orderId: order.id,
        });
      }
    }

    return {
      entitlement: {
        id: entitlement.id,
        downloadCount: entitlement.downloadCount,
        maxDownloads: entitlement.maxDownloads ?? 10,
        expiresAt: entitlement.expiresAt,
      },
      product: product
        ? {
            id: product.id,
            title: product.title,
            type: product.type,
            description: product.description,
          }
        : null,
      creator: creator
        ? {
            displayName: creator.displayName,
            slug: creator.slug,
          }
        : null,
      delivery: {
        type: product?.type,
        // Depending on type, return delivery payload
        fileUrl:
          product?.type === "digital_file"
            ? (deliveryConfig?.fileUrl as string) ??
              `/v1/library/${token}/download?file=${encodeURIComponent(product.title)}`
            : null,
        gatedLink:
          product?.type === "link_gate"
            ? (deliveryConfig?.externalUrl as string) ?? "https://hyperprofile.local"
            : null,
        sessionDetails:
          product?.type === "session"
            ? {
                meetingUrl:
                  sessionBooking?.meetingUrl ??
                  (deliveryConfig?.meetingUrl as string) ??
                  "https://meet.google.com/hpr-consultation",
                durationMinutes:
                  sessionBooking?.durationMinutes ??
                  deliveryConfig?.durationMinutes ??
                  45,
                bookingDate:
                  sessionBooking?.bookingDate ??
                  new Date(Date.now() + 86400 * 1000).toISOString().slice(0, 10),
                timeSlot: sessionBooking?.timeSlot ?? "02:00 PM - 02:45 PM",
                calendarEventUrl: sessionBooking?.calendarEventUrl ?? null,
                status: sessionBooking?.status ?? "confirmed",
                slots: (deliveryConfig?.slots as string[]) ?? [
                  "10:00 AM - 10:45 AM",
                  "02:00 PM - 02:45 PM",
                  "04:30 PM - 05:15 PM",
                  "06:00 PM - 06:45 PM",
                ],
              }
            : null,
        leadMagnetContent:
          product?.type === "lead_magnet"
            ? (deliveryConfig?.content as string) ?? "Thank you for subscribing! Your resource is ready."
            : null,
        telegramAccess:
          product?.type === "telegram_community"
            ? {
                channelName:
                  tgMembership?.channelName ??
                  (deliveryConfig?.telegramChannelName as string) ??
                  product.title,
                inviteLink:
                  tgMembership?.inviteLink ??
                  (deliveryConfig?.inviteLink as string) ??
                  "https://t.me/+join_hyperprofile_alpha",
                singleUse: true,
                status: tgMembership?.status ?? "active",
                expiresAt: tgMembership?.expiresAt ?? null,
              }
            : null,
      },
      bumpOffer: bumpIncluded
        ? {
            title:
              (bumpOfferConfig?.title as string) ??
              "Viral Reel Hooks & 30-Day Content Matrix (Notion + PDF)",
            description:
              (bumpOfferConfig?.description as string) ??
              "50+ plug-and-play hook templates and viral frameworks used by top creators to generate 10M+ views. Instant Notion duplicate & PDF download.",
            fileUrl:
              (bumpOfferConfig?.fileUrl as string) ??
              `/v1/library/${token}/download?file=Viral-Reel-Hooks-Content-Matrix.pdf`,
            notionUrl:
              (bumpOfferConfig?.notionUrl as string) ??
              "https://notion.so/templates/viral-reel-hooks-30-day-matrix",
          }
        : null,
      order: order
        ? {
            receipt: order.receipt,
            amountFormatted: formatInr(order.netAmountPaise),
            createdAt: order.createdAt,
          }
        : null,
    };
  });

  // Buyer file download (GET) for browser clicks
  app.get("/v1/library/:token/download", async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as { token: string };

    const entitlement = (
      await db.select().from(entitlements).where(eq(entitlements.accessToken, token)).limit(1)
    )[0];

    if (!entitlement) {
      return reply.code(404).send({ code: "not_found", message: "Entitlement not found" });
    }

    if (entitlement.expiresAt && entitlement.expiresAt < new Date()) {
      return reply.code(410).send({ code: "expired", message: "Download link has expired" });
    }

    if (entitlement.maxDownloads && entitlement.downloadCount >= entitlement.maxDownloads) {
      return reply.code(429).send({
        code: "download_limit_exceeded",
        message: "Maximum download attempts reached",
      });
    }

    await db
      .update(entitlements)
      .set({ downloadCount: entitlement.downloadCount + 1, updatedAt: new Date() })
      .where(eq(entitlements.id, entitlement.id));

    const product = (
      await db.select().from(products).where(eq(products.id, entitlement.productId)).limit(1)
    )[0];

    const deliveryConfig = product?.deliveryConfig as Record<string, unknown> | undefined;
    const directFileUrl = deliveryConfig?.fileUrl as string | undefined;

    if (directFileUrl && (directFileUrl.startsWith("http://") || directFileUrl.startsWith("https://"))) {
      return reply.redirect(directFileUrl);
    }

    // Serve downloadable file attachment
    const titleSafe = (product?.title || "digital_file").replace(/[^a-zA-Z0-9_-]/g, "_");
    reply.header("Content-Disposition", `attachment; filename="${titleSafe}.txt"`);
    reply.header("Content-Type", "application/octet-stream");
    return reply.send(
      `--- ${product?.title ?? "Digital Product"} ---\n\n` +
      `Delivery Type: ${product?.type ?? "digital_file"}\n` +
      `Product ID: ${product?.id ?? ""}\n` +
      `Entitlement ID: ${entitlement.id}\n` +
      `Licensed To: ${entitlement.buyerId}\n\n` +
      `${(deliveryConfig?.content as string) ?? "Thank you for your purchase! Your resource is verified."}\n`
    );
  });

  // Track / increment download (POST)
  app.post("/v1/library/:token/download", async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as { token: string };

    const entitlement = (
      await db.select().from(entitlements).where(eq(entitlements.accessToken, token)).limit(1)
    )[0];

    if (!entitlement) {
      return reply.code(404).send({ code: "not_found", message: "Entitlement not found" });
    }

    if (entitlement.maxDownloads && entitlement.downloadCount >= entitlement.maxDownloads) {
      return reply.code(429).send({
        code: "download_limit_exceeded",
        message: "Maximum download attempts reached",
      });
    }

    const updated = (
      await db
        .update(entitlements)
        .set({ downloadCount: entitlement.downloadCount + 1, updatedAt: new Date() })
        .where(eq(entitlements.id, entitlement.id))
        .returning()
    )[0]!;

    return {
      success: true,
      downloadCount: updated.downloadCount,
      remaining: (updated.maxDownloads ?? 10) - updated.downloadCount,
    };
  });

  // Public invoice viewer
  app.get("/v1/invoices/:invoiceNumber", async (req: FastifyRequest, reply: FastifyReply) => {
    const { invoiceNumber } = req.params as { invoiceNumber: string };

    const inv = (
      await db.select().from(invoices).where(eq(invoices.invoiceNumber, invoiceNumber)).limit(1)
    )[0];

    if (!inv) {
      return reply.code(404).send({ code: "not_found", message: "Invoice not found" });
    }

    let order = null;
    let creator = null;
    let buyer = null;
    let product = null;

    if (inv.orderId) {
      order = (await db.select().from(orders).where(eq(orders.id, inv.orderId)).limit(1))[0];
      if (order) {
        creator = (
          await db.select().from(creators).where(eq(creators.id, order.creatorId)).limit(1)
        )[0];
        buyer = (await db.select().from(buyers).where(eq(buyers.id, order.buyerId)).limit(1))[0];
        product = (
          await db.select().from(products).where(eq(products.id, order.productId)).limit(1)
        )[0];
      }
    }

    const gstBreakdown = inv.gstBreakdown as Record<string, number>;

    return {
      invoiceNumber: inv.invoiceNumber,
      date: inv.createdAt,
      amountPaise: inv.amountPaise,
      amountFormatted: formatInr(inv.amountPaise),
      gstBreakdown,
      creator: creator
        ? {
            displayName: creator.displayName,
            slug: creator.slug,
          }
        : null,
      buyer: buyer
        ? {
            name: buyer.name,
            email: buyer.email,
          }
        : null,
      item: product ? { title: product.title, type: product.type } : null,
    };
  });
}
