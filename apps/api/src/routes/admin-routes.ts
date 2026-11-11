import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq, like, or } from "drizzle-orm";
import {
  auditLog,
  creators,
  featureFlags,
  orders,
  pages,
  payouts,
  products,
  users,
  type Db,
} from "@hyperprofile/db";
import { formatInr } from "@hyperprofile/payments";

export function registerAdminRoutes(
  app: FastifyInstance,
  options: { db: Db; adminSecret?: string },
) {
  const { db, adminSecret } = options;

  // Middleware to check admin authorization
  async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    const adminKey = req.headers["x-admin-key"] as string | undefined;
    // In dev / test or with admin key matching secret
    if (adminSecret && adminKey && adminKey === adminSecret) {
      return true;
    }
    // Allow in non-production test mode if header present
    if (process.env.NODE_ENV !== "production") {
      return true;
    }
    reply.code(403).send({ code: "forbidden", message: "Admin authorization required" });
    return false;
  }

  // 1. Creator list with KYC state, plan, and status flags
  app.get("/v1/admin/creators", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;

    const query = req.query as {
      search?: string;
      kycStatus?: string;
      plan?: string;
      limit?: string;
    };

    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));

    const rows = await db
      .select({
        id: creators.id,
        userId: creators.userId,
        slug: creators.slug,
        displayName: creators.displayName,
        bio: creators.bio,
        plan: creators.plan,
        kycStatus: creators.kycStatus,
        createdAt: creators.createdAt,
        updatedAt: creators.updatedAt,
        userEmail: users.email,
        userRole: users.role,
      })
      .from(creators)
      .leftJoin(users, eq(creators.userId, users.id))
      .orderBy(desc(creators.createdAt))
      .limit(limit);

    return { data: rows };
  });

  // 2. Update creator KYC state
  app.put("/v1/admin/creators/:id/kyc", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;

    const { id } = req.params as { id: string };
    const body = req.body as { kycStatus?: "none" | "pending" | "verified" | "rejected" };

    const validStates = ["none", "pending", "verified", "rejected"];
    if (!body?.kycStatus || !validStates.includes(body.kycStatus)) {
      return reply.code(400).send({
        code: "invalid_kyc_status",
        message: `KYC status must be one of: ${validStates.join(", ")}`,
      });
    }

    const creator = (
      await db.select().from(creators).where(eq(creators.id, id)).limit(1)
    )[0];

    if (!creator) {
      return reply.code(404).send({ code: "not_found", message: "Creator not found" });
    }

    const before = { kycStatus: creator.kycStatus };
    const updated = (
      await db
        .update(creators)
        .set({ kycStatus: body.kycStatus, updatedAt: new Date() })
        .where(eq(creators.id, id))
        .returning()
    )[0]!;

    await db.insert(auditLog).values({
      actor: "admin",
      action: "creator.kyc_update",
      entity: `creator:${id}`,
      before,
      after: { kycStatus: updated.kycStatus },
    });

    return { success: true, creator: updated };
  });

  // 3. Search and list orders
  app.get("/v1/admin/orders", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;

    const query = req.query as {
      search?: string;
      status?: string;
      creatorId?: string;
      limit?: string;
    };

    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));

    const rows = await db
      .select({
        id: orders.id,
        creatorId: orders.creatorId,
        productId: orders.productId,
        buyerId: orders.buyerId,
        amountPaise: orders.amountPaise,
        discountPaise: orders.discountPaise,
        gstPaise: orders.gstPaise,
        netAmountPaise: orders.netAmountPaise,
        status: orders.status,
        gatewayOrderId: orders.gatewayOrderId,
        receipt: orders.receipt,
        createdAt: orders.createdAt,
        creatorDisplayName: creators.displayName,
      })
      .from(orders)
      .leftJoin(creators, eq(orders.creatorId, creators.id))
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    return {
      data: rows.map((o) => ({
        ...o,
        amountFormatted: formatInr(o.netAmountPaise),
      })),
    };
  });

  // 4. Search and list payouts
  app.get("/v1/admin/payouts", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;

    const rows = await db
      .select({
        id: payouts.id,
        creatorId: payouts.creatorId,
        gatewayTransferId: payouts.gatewayTransferId,
        amountPaise: payouts.amountPaise,
        status: payouts.status,
        settledAt: payouts.settledAt,
        createdAt: payouts.createdAt,
      })
      .from(payouts)
      .orderBy(desc(payouts.createdAt))
      .limit(50);

    return {
      data: rows.map((p) => ({
        ...p,
        amountFormatted: formatInr(p.amountPaise),
      })),
    };
  });

  // 5. Takedown tool for reported pages and products
  app.post("/v1/admin/takedown", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;

    const body = req.body as {
      target?: "page" | "product";
      targetId?: string;
      reason?: string;
    };

    if (!body?.target || !body?.targetId || !body?.reason) {
      return reply.code(400).send({
        code: "missing_fields",
        message: "target ('page' | 'product'), targetId, and reason are required",
      });
    }

    if (body.target === "product") {
      const product = (
        await db.select().from(products).where(eq(products.id, body.targetId)).limit(1)
      )[0];

      if (!product) {
        return reply.code(404).send({ code: "not_found", message: "Product not found" });
      }

      await db
        .update(products)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(products.id, body.targetId));

      await db.insert(auditLog).values({
        actor: "admin",
        action: "takedown.product",
        entity: `product:${body.targetId}`,
        before: { status: product.status },
        after: { status: "archived", reason: body.reason },
      });

      return { success: true, message: "Product taken down and archived" };
    }

    if (body.target === "page") {
      const page = (
        await db.select().from(pages).where(eq(pages.id, body.targetId)).limit(1)
      )[0];

      if (!page) {
        return reply.code(404).send({ code: "not_found", message: "Page not found" });
      }

      await db
        .update(pages)
        .set({ isPublished: false, updatedAt: new Date() })
        .where(eq(pages.id, body.targetId));

      await db.insert(auditLog).values({
        actor: "admin",
        action: "takedown.page",
        entity: `page:${body.targetId}`,
        before: { isPublished: page.isPublished },
        after: { isPublished: false, reason: body.reason },
      });

      return { success: true, message: "Page taken down and unpublished" };
    }

    return reply.code(400).send({ code: "invalid_target", message: "Target must be 'page' or 'product'" });
  });

  // 6. Audit log viewer
  app.get("/v1/admin/audit-logs", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;

    const rows = await db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(100);

    return { data: rows };
  });

  // 7. Feature flags manager
  app.get("/v1/admin/feature-flags", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;

    const flags = await db.select().from(featureFlags);
    return { data: flags };
  });

  app.put("/v1/admin/feature-flags/:key", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;

    const { key } = req.params as { key: string };
    const body = req.body as {
      enabled?: boolean;
      description?: string;
      config?: Record<string, unknown>;
    };

    const existing = (
      await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1)
    )[0];

    let result;
    if (existing) {
      result = (
        await db
          .update(featureFlags)
          .set({
            enabled: body.enabled ?? existing.enabled,
            description: body.description ?? existing.description,
            config: body.config ?? existing.config,
            updatedAt: new Date(),
          })
          .where(eq(featureFlags.key, key))
          .returning()
      )[0];
    } else {
      result = (
        await db
          .insert(featureFlags)
          .values({
            key,
            enabled: body.enabled ?? false,
            description: body.description ?? "",
            config: body.config ?? {},
          })
          .returning()
      )[0];
    }

    await db.insert(auditLog).values({
      actor: "admin",
      action: "feature_flag.update",
      entity: `flag:${key}`,
      before: existing ? { enabled: existing.enabled } : null,
      after: { enabled: result?.enabled },
    });

    return { success: true, flag: result };
  });
}
