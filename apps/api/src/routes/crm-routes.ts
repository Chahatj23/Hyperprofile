import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "@hyperprofile/db";
import { exportLeadsCsv, getUnifiedLeads } from "../crm/leads-service.js";
import { getSession } from "../auth/session.js";

export function registerCrmRoutes(app: FastifyInstance, options: { db: Db; sessionSecret: string }) {
  const { db, sessionSecret } = options;

  function requireSession(req: FastifyRequest, reply: FastifyReply) {
    const session = getSession(req, sessionSecret);
    if (!session?.creatorId) {
      reply.code(401).send({ code: "unauthorized", message: "Creator authentication required" });
      return null;
    }
    return session;
  }

  // List all aggregated leads with filters and analytics
  app.get("/v1/leads", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(req, reply);
    if (!session) return;

    const query = req.query as {
      search?: string;
      source?: string;
    };

    const result = await getUnifiedLeads(db, {
      search: query.search,
      source: query.source,
      creatorId: session.creatorId,
    });

    return reply.send(result);
  });

  // Export leads as standard CSV download
  app.get("/v1/leads/export.csv", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(req, reply);
    if (!session) return;

    const query = req.query as {
      search?: string;
      source?: string;
    };

    const { leads } = await getUnifiedLeads(db, {
      search: query.search,
      source: query.source,
      creatorId: session.creatorId,
    });

    const csvContent = exportLeadsCsv(leads);
    const dateStr = new Date().toISOString().slice(0, 10);

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        `attachment; filename="hyperprofile-leads-${dateStr}.csv"`,
      )
      .send(csvContent);
  });
}

