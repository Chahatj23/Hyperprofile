import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import {
  auditLog,
  buyers,
  consents,
  creators,
  deletionRequests,
  orders,
  pageEvents,
  type Db,
} from "@hyperprofile/db";

export function registerComplianceSafetyRoutes(app: FastifyInstance, options: { db: Db }) {
  const { db } = options;

  // Track public client event (page_view, link_click, etc.)
  app.post("/v1/events/track", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      creatorSlug?: string;
      creatorId?: string;
      eventType?: string;
      visitorId?: string;
      referrer?: string;
      metadata?: Record<string, unknown>;
    };

    let creatorId = body.creatorId;
    if (!creatorId && body.creatorSlug) {
      const c = (
        await db.select().from(creators).where(eq(creators.slug, body.creatorSlug.toLowerCase())).limit(1)
      )[0];
      creatorId = c?.id;
    }

    if (!creatorId || !body.eventType) {
      return reply.code(400).send({ ok: false, error: "creatorId and eventType required" });
    }

    await db.insert(pageEvents).values({
      creatorId,
      eventType: body.eventType,
      visitorId: body.visitorId || req.ip || "anon",
      referrer: body.referrer || (req.headers.referer as string) || null,
      metadata: body.metadata ?? {},
    });

    return { ok: true };
  });

  // Record DPDP consent
  app.post("/v1/compliance/consent", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      entityType?: string;
      entityId?: string;
      purpose?: string;
      version?: string;
    };

    if (!body.entityId || !body.purpose) {
      return reply.code(400).send({ ok: false, error: "entityId and purpose required" });
    }

    await db.insert(consents).values({
      entityType: body.entityType ?? "buyer",
      entityId: body.entityId,
      purpose: body.purpose,
      version: body.version ?? "1.0",
      ipAddress: req.ip,
    });

    return { ok: true, message: "Consent recorded" };
  });

  // DPDP Buyer data export
  app.post("/v1/compliance/data-export", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { email?: string };
    const email = body?.email?.trim().toLowerCase();
    if (!email) return reply.code(400).send({ error: "Email is required" });

    const buyer = (await db.select().from(buyers).where(eq(buyers.email, email)).limit(1))[0];
    if (!buyer) {
      return { email, found: false, records: [] };
    }

    const orderRows = await db.select().from(orders).where(eq(orders.buyerId, buyer.id));
    const consentRows = await db
      .select()
      .from(consents)
      .where(and(eq(consents.entityType, "buyer"), eq(consents.entityId, buyer.id)));

    return {
      email,
      found: true,
      buyer: { id: buyer.id, email: buyer.email, name: buyer.name, createdAt: buyer.createdAt },
      orders: orderRows,
      consents: consentRows,
    };
  });

  // DPDP Deletion request: keeps ledger integrity, anonymises personal identifiers
  app.post("/v1/compliance/deletion-request", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { email?: string };
    const email = body?.email?.trim().toLowerCase();
    if (!email) return reply.code(400).send({ error: "Email is required" });

    await db.insert(deletionRequests).values({
      email,
      status: "pending",
    });

    const buyer = (await db.select().from(buyers).where(eq(buyers.email, email)).limit(1))[0];
    if (buyer) {
      // Anonymise buyer personal data while preserving ledger order IDs
      await db
        .update(buyers)
        .set({
          name: "Anonymized Buyer",
          phone: null,
          email: `anonymized_${buyer.id}@deleted.local`,
          updatedAt: new Date(),
        })
        .where(eq(buyers.id, buyer.id));
    }

    return { success: true, message: "Deletion request registered and identity anonymized" };
  });

  // Content abuse report
  app.post("/v1/compliance/report-abuse", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      targetUrl?: string;
      reason?: string;
      reporterEmail?: string;
    };

    await db.insert(auditLog).values({
      actor: body.reporterEmail ?? "anonymous",
      action: "abuse.report",
      entity: body.targetUrl ?? "unknown",
      after: { reason: body.reason, reportedAt: new Date().toISOString() },
    });

    return { success: true, message: "Report received and queued for admin review" };
  });
}
