import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import {
  automationEvents,
  automationRules,
  igAccounts,
  trackedLinks,
  type Db,
} from "@hyperprofile/db";
import { parseSignedRequest } from "@hyperprofile/meta";
import { logger } from "@hyperprofile/shared";

function extractSignedRequest(body: unknown): string | null {
  if (typeof body === "string") {
    return new URLSearchParams(body).get("signed_request");
  }
  if (body && typeof body === "object" && "signed_request" in body) {
    return String((body as { signed_request?: string }).signed_request ?? "") || null;
  }
  return null;
}

export function registerComplianceRoutes(
  app: FastifyInstance,
  deps: { db: Db; appSecret: string; publicBaseUrl: string },
): void {
  async function deauthorize(req: FastifyRequest, reply: FastifyReply) {
    const sr = extractSignedRequest(req.body);
    const parsed = parseSignedRequest(String(sr ?? ""), deps.appSecret);
    if (!parsed?.user_id) return reply.code(400).send("bad signed_request");

    const userId = parsed.user_id;
    const rows = await deps.db.select().from(igAccounts).limit(200);
    for (const row of rows) {
      const raw = row.rawProfile as { debug?: { user_id?: string | number } } | null;
      const debugUser = raw?.debug?.user_id != null ? String(raw.debug.user_id) : null;
      if (row.igUserId === userId || debugUser === userId) {
        await deps.db
          .update(igAccounts)
          .set({
            accessTokenEncrypted: "",
            reauthRequiredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(igAccounts.id, row.id));
        logger.info("instagram deauthorized", {
          igUserId: row.igUserId,
          username: row.username,
        });
      }
    }
    return reply.code(200).send("ok");
  }

  async function dataDeletion(req: FastifyRequest, reply: FastifyReply) {
    const sr = extractSignedRequest(req.body);
    const parsed = parseSignedRequest(String(sr ?? ""), deps.appSecret);
    if (!parsed?.user_id) return reply.code(400).send("bad signed_request");

    const userId = parsed.user_id;
    const rows = await deps.db.select().from(igAccounts).limit(200);
    for (const row of rows) {
      const raw = row.rawProfile as { debug?: { user_id?: string | number } } | null;
      const debugUser = raw?.debug?.user_id != null ? String(raw.debug.user_id) : null;
      if (row.igUserId !== userId && debugUser !== userId) continue;

      await deps.db
        .delete(automationEvents)
        .where(eq(automationEvents.igUserId, row.igUserId));
      await deps.db
        .delete(automationRules)
        .where(eq(automationRules.igUserId, row.igUserId));
      await deps.db.delete(trackedLinks).where(eq(trackedLinks.igUserId, row.igUserId));
      await deps.db.delete(igAccounts).where(eq(igAccounts.id, row.id));
      logger.info("instagram data deletion", { igUserId: row.igUserId });
    }

    const base = deps.publicBaseUrl.replace(/\/$/, "");
    return reply.send({
      url: `${base}/instagram/data-deletion/status?code=${encodeURIComponent(userId)}`,
      confirmation_code: userId,
    });
  }

  async function deletionStatus(req: FastifyRequest) {
    const code = String((req.query as { code?: string }).code ?? "");
    const still = (
      await deps.db.select().from(igAccounts).where(eq(igAccounts.igUserId, code)).limit(1)
    )[0];
    return { deleted: !still, code };
  }

  app.post("/instagram/deauthorize", deauthorize);
  app.post("/api/instagram/deauthorize", deauthorize);
  app.post("/instagram/data-deletion", dataDeletion);
  app.post("/api/instagram/data-deletion", dataDeletion);
  app.get("/instagram/data-deletion/status", deletionStatus);
  app.get("/api/instagram/data-deletion/status", deletionStatus);
}
