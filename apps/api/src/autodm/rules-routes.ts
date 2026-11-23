import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { automationRules, igAccounts, type Db } from "@hyperprofile/db";
import { queueDepth } from "./queue.js";
import { getSession } from "../auth/session.js";

const createRuleSchema = z.object({
  igUserId: z.string().optional(),
  name: z.string().optional(),
  keyword: z.string().default(""),
  mediaId: z.string().optional().nullable(),
  message: z
    .string()
    .min(1)
    .refine((m) => Buffer.byteLength(m, "utf8") <= 1000, "message exceeds 1000 bytes"),
  link: z.string().url().optional().nullable(),
  publicCommentReply: z.string().optional().nullable(),
  publicCommentReplies: z.array(z.string()).optional(),
  ctaButtonText: z.string().optional().nullable(),
  ctaButtonUrl: z.string().url().optional().nullable(),
  askToFollow: z.boolean().optional().default(false),
  requireEmail: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  runsCount: z.number().optional().default(0),
  buttonClicks: z.number().optional().default(0),
  followersGained: z.number().optional().default(0),
});

export function registerRulesRoutes(
  app: FastifyInstance,
  deps: { db: Db; sessionSecret: string },
): void {
  function requireSession(req: FastifyRequest, reply: FastifyReply) {
    const session = getSession(req, deps.sessionSecret);
    if (!session?.creatorId) {
      reply.code(401).send({ code: "unauthorized", message: "Creator authentication required" });
      return null;
    }
    return session;
  }

  app.post("/v1/ig/rules", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(req, reply);
    if (!session) return;

    let callerIgUserId: string | null = null;
    if (session.creatorId) {
      try {
        const acc = (
          await deps.db.select().from(igAccounts).where(eq(igAccounts.creatorId, session.creatorId)).limit(1)
        )[0];
        if (acc?.igUserId) callerIgUserId = acc.igUserId;
      } catch {}
    }

    const parsed = createRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        code: "validation_error",
        message: "Invalid rule",
        details: parsed.error.flatten(),
      });
    }
    const body = parsed.data;

    // SEC-S1-04: Strict tenant isolation - user can only create rules for their own verified connected account
    if (!callerIgUserId) {
      return reply.code(400).send({
        code: "no_instagram_account",
        message: "Please connect your Instagram account first via /connect before creating AutoDM rules.",
      });
    }
    const igUserId = callerIgUserId;

    const ruleId = `rule_${crypto.randomUUID().slice(0, 8)}`;
    const ruleRecord = {
      id: ruleId,
      igUserId,
      name: body.name || (body.keyword ? `${body.keyword} Automation` : "Default AutoDM"),
      keyword: body.keyword ?? "",
      mediaId: body.mediaId ?? null,
      message: body.message,
      link: body.link ?? null,
      publicCommentReply: body.publicCommentReply ?? null,
      publicCommentReplies: body.publicCommentReplies ?? [],
      ctaButtonText: body.ctaButtonText ?? null,
      ctaButtonUrl: body.ctaButtonUrl ?? null,
      askToFollow: body.askToFollow ?? false,
      requireEmail: body.requireEmail ?? false,
      active: body.active ?? true,
      runsCount: body.runsCount ?? 0,
      buttonClicks: body.buttonClicks ?? 0,
      followersGained: body.followersGained ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await deps.db.insert(automationRules).values({
        id: ruleRecord.id,
        igUserId,
        keyword: body.keyword ?? "",
        mediaId: body.mediaId ?? null,
        message: body.message,
        link: body.link ?? null,
        active: body.active ?? true,
      });
    } catch (err) {
      // ignore
    }

    return { data: ruleRecord };
  });

  app.get("/v1/ig/rules", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(req, reply);
    if (!session) return;

    let callerIgUserId: string | null = null;
    if (session.creatorId) {
      try {
        const acc = (
          await deps.db.select().from(igAccounts).where(eq(igAccounts.creatorId, session.creatorId)).limit(1)
        )[0];
        if (acc?.igUserId) callerIgUserId = acc.igUserId;
      } catch {}
    }

    if (!callerIgUserId) {
      return { data: [], connected: false };
    }

    const igUserId = callerIgUserId;

    try {
      const dbRules = await deps.db
        .select()
        .from(automationRules)
        .where(eq(automationRules.igUserId, igUserId));
      return { data: dbRules ?? [], connected: true };
    } catch {
      return { data: [], connected: true };
    }
  });

  async function resolveCallerIgUserId(creatorId?: string): Promise<string | null> {
    if (creatorId) {
      try {
        const acc = (
          await deps.db.select().from(igAccounts).where(eq(igAccounts.creatorId, creatorId)).limit(1)
        )[0];
        if (acc?.igUserId) return acc.igUserId;
      } catch {
        // fallback
      }
    }
    return null;
  }

  app.patch("/v1/ig/rules/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(req, reply);
    if (!session) return;

    const { id } = req.params as { id: string };
    const body = z
      .object({
        name: z.string().optional(),
        active: z.boolean().optional(),
        keyword: z.string().optional(),
        message: z
          .string()
          .refine((m) => Buffer.byteLength(m, "utf8") <= 1000)
          .optional(),
        link: z.string().url().nullable().optional(),
        mediaId: z.string().nullable().optional(),
        publicCommentReply: z.string().nullable().optional(),
        publicCommentReplies: z.array(z.string()).optional(),
        ctaButtonText: z.string().nullable().optional(),
        ctaButtonUrl: z.string().nullable().optional(),
        askToFollow: z.boolean().optional(),
        requireEmail: z.boolean().optional(),
        runsCount: z.number().optional(),
        buttonClicks: z.number().optional(),
        followersGained: z.number().optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ code: "validation_error", message: "Invalid patch" });
    }
    const patch = body.data;

    // SEC-S1-04: Enforce object-level ownership check (IDOR protection)
    const callerIgUserId = await resolveCallerIgUserId(session.creatorId);
    if (!callerIgUserId) {
      return reply.code(403).send({ code: "forbidden", message: "You do not have permission to modify this rule" });
    }

    try {
      const existing = (await deps.db.select().from(automationRules).where(eq(automationRules.id, id)).limit(1))[0];
      if (!existing) {
        return reply.code(404).send({ code: "not_found", message: "Rule not found" });
      }
      if (existing.igUserId !== callerIgUserId) {
        return reply.code(403).send({
          code: "forbidden",
          message: "You do not have permission to modify this rule",
        });
      }

      const updated = await deps.db
        .update(automationRules)
        .set({
          ...(patch.active !== undefined ? { active: patch.active } : {}),
          ...(patch.keyword !== undefined ? { keyword: patch.keyword } : {}),
          ...(patch.message !== undefined ? { message: patch.message } : {}),
          ...(patch.link !== undefined ? { link: patch.link } : {}),
          ...(patch.mediaId !== undefined ? { mediaId: patch.mediaId } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(automationRules.id, id), eq(automationRules.igUserId, callerIgUserId)))
        .returning();

      return { data: updated[0] };
    } catch {
      return reply.code(404).send({ code: "not_found", message: "Rule not found" });
    }
  });

  app.delete("/v1/ig/rules/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(req, reply);
    if (!session) return;

    const { id } = req.params as { id: string };

    // SEC-S1-04: Enforce object-level ownership check (IDOR protection)
    const callerIgUserId = await resolveCallerIgUserId(session.creatorId);
    if (!callerIgUserId) {
      return reply.code(403).send({ code: "forbidden", message: "You do not have permission to delete this rule" });
    }

    try {
      const existing = (await deps.db.select().from(automationRules).where(eq(automationRules.id, id)).limit(1))[0];
      if (!existing) {
        return reply.code(404).send({ code: "not_found", message: "Rule not found" });
      }
      if (existing.igUserId !== callerIgUserId) {
        return reply.code(403).send({
          code: "forbidden",
          message: "You do not have permission to delete this rule",
        });
      }

      await deps.db
        .delete(automationRules)
        .where(and(eq(automationRules.id, id), eq(automationRules.igUserId, callerIgUserId)));

      return { ok: true };
    } catch {
      return reply.code(404).send({ code: "not_found", message: "Rule not found" });
    }
  });

  app.get("/v1/ig/autodm/status", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(req, reply);
    if (!session?.creatorId) return;
    const creatorId = session.creatorId;

    try {
      const accounts = await deps.db
        .select({
          igUserId: igAccounts.igUserId,
          username: igAccounts.username,
          reauthRequiredAt: igAccounts.reauthRequiredAt,
          tokenExpiresAt: igAccounts.tokenExpiresAt,
        })
        .from(igAccounts)
        .where(eq(igAccounts.creatorId, creatorId))
        .limit(50);

      return {
        queueDepth: queueDepth(),
        accounts: accounts ?? [],
      };
    } catch {
      return {
        queueDepth: queueDepth(),
        accounts: [],
      };
    }
  });
}
