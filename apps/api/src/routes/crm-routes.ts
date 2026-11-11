import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "@hyperprofile/db";
import { exportLeadsCsv, getUnifiedLeads } from "../crm/leads-service.js";

export function registerCrmRoutes(app: FastifyInstance, options: { db: Db }) {
  const { db } = options;

  // List all aggregated leads with filters and analytics
  app.get("/v1/leads", async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      search?: string;
      source?: string;
      creatorId?: string;
    };

    const result = await getUnifiedLeads(db, {
      search: query.search,
      source: query.source,
      creatorId: query.creatorId,
    });

    return reply.send(result);
  });

  // Export leads as standard CSV download
  app.get("/v1/leads/export.csv", async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      search?: string;
      source?: string;
      creatorId?: string;
    };

    const { leads } = await getUnifiedLeads(db, {
      search: query.search,
      source: query.source,
      creatorId: query.creatorId,
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

