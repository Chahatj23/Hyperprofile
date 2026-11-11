import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { creators, offers, products, type Db } from "@hyperprofile/db";
import { applyDiscount } from "@hyperprofile/payments";
import { getSession } from "../auth/session.js";

export function registerProductsRoutes(
  app: FastifyInstance,
  options: { db: Db; sessionSecret: string },
) {
  const { db, sessionSecret } = options;

  async function requireCreator(req: FastifyRequest, reply: FastifyReply) {
    const session = getSession(req, sessionSecret);
    if (!session?.creatorId) {
      reply.code(401).send({ code: "unauthorized", message: "Creator login required" });
      return null;
    }
    return session;
  }

  // List creator products
  app.get("/v1/products", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireCreator(req, reply);
    if (!session) return;

    const rows = await db
      .select()
      .from(products)
      .where(eq(products.creatorId, session.creatorId!))
      .orderBy(desc(products.createdAt));

    return { data: rows };
  });

  // Create product
  app.post("/v1/products", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireCreator(req, reply);
    if (!session) return;

    const body = req.body as {
      type?: string;
      title?: string;
      description?: string;
      pricePaise?: number;
      gstRate?: number;
      deliveryConfig?: Record<string, unknown>;
    };

    if (!body.title || !body.type) {
      return reply.code(400).send({ code: "missing_fields", message: "Title and type are required" });
    }

    const validTypes = ["digital_file", "link_gate", "session", "lead_magnet", "telegram_community"];
    if (!validTypes.includes(body.type)) {
      return reply.code(400).send({ code: "invalid_type", message: `Type must be one of: ${validTypes.join(", ")}` });
    }

    const price = body.type === "lead_magnet" ? 0 : Math.max(0, Math.round(body.pricePaise ?? 0));

    const inserted = (
      await db
        .insert(products)
        .values({
          creatorId: session.creatorId!,
          type: body.type,
          title: body.title.trim(),
          description: body.description?.trim() ?? "",
          pricePaise: price,
          currency: "INR",
          gstRate: body.gstRate === 18 ? 18 : 0,
          status: "active",
          deliveryConfig: body.deliveryConfig ?? {},
        })
        .returning()
    )[0]!;

    return { success: true, product: inserted };
  });

  // Get product by id
  app.get("/v1/products/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireCreator(req, reply);
    if (!session) return;

    const { id } = req.params as { id: string };
    const row = (
      await db
        .select()
        .from(products)
        .where(and(eq(products.id, id), eq(products.creatorId, session.creatorId!)))
        .limit(1)
    )[0];

    if (!row) {
      return reply.code(404).send({ code: "not_found", message: "Product not found" });
    }

    return { product: row };
  });

  // Update product
  app.put("/v1/products/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireCreator(req, reply);
    if (!session) return;

    const { id } = req.params as { id: string };
    const body = req.body as {
      title?: string;
      description?: string;
      pricePaise?: number;
      gstRate?: number;
      status?: "active" | "draft" | "archived";
      deliveryConfig?: Record<string, unknown>;
    };

    const updates: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.title) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description.trim();
    if (body.pricePaise !== undefined) updates.pricePaise = Math.max(0, Math.round(body.pricePaise));
    if (body.gstRate !== undefined) updates.gstRate = body.gstRate;
    if (body.status) updates.status = body.status;
    if (body.deliveryConfig) updates.deliveryConfig = body.deliveryConfig;

    const updated = (
      await db
        .update(products)
        .set(updates)
        .where(and(eq(products.id, id), eq(products.creatorId, session.creatorId!)))
        .returning()
    )[0];

    if (!updated) {
      return reply.code(404).send({ code: "not_found", message: "Product not found" });
    }

    return { success: true, product: updated };
  });

  // Archive product
  app.delete("/v1/products/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireCreator(req, reply);
    if (!session) return;

    const { id } = req.params as { id: string };
    await db
      .update(products)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(products.id, id), eq(products.creatorId, session.creatorId!)));

    return { success: true };
  });

  // Public product info for checkout
  app.get("/v1/public/products/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const product = (
      await db.select().from(products).where(eq(products.id, id)).limit(1)
    )[0];

    if (!product || product.status !== "active") {
      if (id === "p_telegram" || id === "p_telegram_vip") {
        return {
          product: {
            id,
            type: "telegram_community",
            title: "VIP Creator Alpha & Trading Signals Community (Private Telegram)",
            description:
              "Instant single-use invite to our private Telegram channel with daily signals, creator masterminds, and direct networking.",
            pricePaise: 99900,
            currency: "INR",
            gstRate: 18,
            bumpOffer: {
              enabled: true,
              title: "Crypto & Creator Tax Masterclass + Notion Vault",
              description:
                "Complete tax-saving guide and template vault for high-earning digital creators.",
              pricePaise: 29900,
              originalPricePaise: 149900,
              badge: "⚡ 80% OFF ORDER BUMP",
            },
          },
          creator: {
            id: "creator_alpha",
            slug: "creator",
            displayName: "Hyperprofile Alpha",
            theme: { accentColor: "#2AABEE" },
          },
        };
      }

      if (id === "p_session" || id === "p_consultation") {
        return {
          product: {
            id,
            type: "session",
            title: "1:1 Creator Growth & Viral Content Strategy Call (45 Mins)",
            description:
              "Personalized 45-minute video consultation via Google Meet with actionable profile audit, reel breakdown, and viral hook framework.",
            pricePaise: 199900,
            currency: "INR",
            gstRate: 18,
            bumpOffer: {
              enabled: true,
              title: "Fast-Track WhatsApp 30-Day Follow-Up Support",
              description:
                "Direct 1:1 text & voice note support with the creator for 30 days after your consultation call.",
              pricePaise: 49900,
              originalPricePaise: 199900,
              badge: "⚡ 75% OFF ADD-ON",
            },
          },
          creator: {
            id: "creator_session",
            slug: "creator",
            displayName: "Hyperprofile Coach",
            theme: { accentColor: "#e8a54b" },
          },
        };
      }
      return reply.code(404).send({ code: "not_found", message: "Product not found or unavailable" });
    }

    const creator = (
      await db.select().from(creators).where(eq(creators.id, product.creatorId)).limit(1)
    )[0];

    return {
      product: {
        id: product.id,
        type: product.type,
        title: product.title,
        description: product.description,
        pricePaise: product.pricePaise,
        currency: product.currency,
        gstRate: product.gstRate,
        bumpOffer: (product.deliveryConfig as Record<string, unknown>)?.bumpOffer ?? {
          enabled: true,
          title: "Viral Reel Hooks & 30-Day Content Matrix (Notion + PDF)",
          description: "50+ plug-and-play hook templates and viral frameworks used by top creators to generate 10M+ views. Instant Notion duplicate & PDF download.",
          pricePaise: 19900,
          originalPricePaise: 99900,
          badge: "⚡ ONE-TIME OFFER (80% OFF)",
        },
      },
      creator: creator
        ? {
            id: creator.id,
            slug: creator.slug,
            displayName: creator.displayName,
            theme: creator.theme,
          }
        : null,
    };
  });

  // Validate coupon offer code for checkout
  app.post("/v1/public/offers/validate", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { productId?: string; code?: string };
    const code = body?.code?.trim().toUpperCase();
    const productId = body?.productId;

    if (!code || !productId) {
      return reply.code(400).send({ valid: false, message: "Code and productId are required" });
    }

    const product = (
      await db.select().from(products).where(eq(products.id, productId)).limit(1)
    )[0];
    if (!product) {
      return reply.code(404).send({ valid: false, message: "Product not found" });
    }

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

    if (!offer) {
      return reply.code(404).send({ valid: false, message: "Invalid coupon code" });
    }

    if (offer.validUntil && offer.validUntil < new Date()) {
      return reply.code(400).send({ valid: false, message: "Coupon code has expired" });
    }

    if (offer.maxUses !== null && offer.usesCount >= offer.maxUses) {
      return reply.code(400).send({ valid: false, message: "Coupon code usage limit reached" });
    }

    const { finalPaise, discountPaise } = applyDiscount(
      product.pricePaise,
      offer.discountType as "percent" | "flat",
      offer.discountValue,
    );

    return {
      valid: true,
      offerId: offer.id,
      code: offer.code,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      discountPaise,
      finalPaise,
    };
  });
}
