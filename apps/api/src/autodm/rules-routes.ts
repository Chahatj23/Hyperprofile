import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { automationRules, igAccounts, type Db } from "@hyperprofile/db";
import { queueDepth } from "./queue.js";

function resolveAccountFile(): string {
  const local = path.resolve(process.cwd(), "real-ig-account.json");
  if (fs.existsSync(local)) return local;
  const workspaceRoot = path.resolve(process.cwd(), "..", "..", "real-ig-account.json");
  if (fs.existsSync(workspaceRoot)) return workspaceRoot;
  const apiSubdir = path.resolve(process.cwd(), "apps", "api", "real-ig-account.json");
  if (fs.existsSync(apiSubdir)) return apiSubdir;
  return local;
}

function resolveRulesFile(): string {
  const local = path.resolve(process.cwd(), "real-ig-rules.json");
  if (fs.existsSync(local)) return local;
  const workspaceRoot = path.resolve(process.cwd(), "..", "..", "real-ig-rules.json");
  if (fs.existsSync(workspaceRoot)) return workspaceRoot;
  const apiSubdir = path.resolve(process.cwd(), "apps", "api", "real-ig-rules.json");
  if (fs.existsSync(apiSubdir)) return apiSubdir;
  return local;
}

function getConnectedIgUserId(): string {
  try {
    const file = resolveAccountFile();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (data?.igUserId) return data.igUserId;
    }
  } catch {
    // ignore
  }
  return "17841453478293915";
}

function loadDiskRules(): Array<any> {
  try {
    const file = resolveRulesFile();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveDiskRules(rules: Array<any>): void {
  try {
    const file = resolveRulesFile();
    fs.writeFileSync(file, JSON.stringify(rules, null, 2), "utf8");
  } catch {
    // ignore
  }
}

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
  deps: { db: Db },
): void {
  app.post("/v1/ig/rules", async (req, reply) => {
    const parsed = createRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        code: "validation_error",
        message: "Invalid rule",
        details: parsed.error.flatten(),
      });
    }
    const body = parsed.data;
    const igUserId = body.igUserId || getConnectedIgUserId();

    const ruleRecord = {
      id: `rule_${crypto.randomUUID().slice(0, 8)}`,
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

    // Instant save to disk (0ms latency)
    const disk = loadDiskRules();
    disk.unshift(ruleRecord);
    saveDiskRules(disk);

    // Background sync to DB if reachable
    deps.db
      .insert(automationRules)
      .values({
        id: ruleRecord.id,
        igUserId,
        keyword: body.keyword ?? "",
        mediaId: body.mediaId ?? null,
        message: body.message,
        link: body.link ?? null,
        active: body.active ?? true,
      })
      .catch(() => {});

    return { data: ruleRecord };
  });

  app.get("/v1/ig/rules", async (req, reply) => {
    const q = req.query as { igUserId?: string };
    const igUserId = q.igUserId || getConnectedIgUserId();

    // 1. Fetch DB rules first (cloud truth on Render)
    try {
      const dbRules = await deps.db
        .select()
        .from(automationRules)
        .where(eq(automationRules.igUserId, igUserId));
      if (dbRules && dbRules.length > 0) {
        return { data: dbRules };
      }
    } catch {
      // fallback
    }

    // 2. Fallback to disk rules
    const disk = loadDiskRules();
    const filtered = disk.filter((r) => !r.igUserId || r.igUserId === igUserId);
    return { data: filtered };
  });

  app.patch("/v1/ig/rules/:id", async (req, reply) => {
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

    // Instant update on disk
    const disk = loadDiskRules();
    const idx = disk.findIndex((r) => r.id === id);
    if (idx !== -1) {
      disk[idx] = { ...disk[idx], ...patch, updatedAt: new Date().toISOString() };
      saveDiskRules(disk);

      // Background sync to DB
      deps.db
        .update(automationRules)
        .set({
          ...(patch.active !== undefined ? { active: patch.active } : {}),
          ...(patch.keyword !== undefined ? { keyword: patch.keyword } : {}),
          ...(patch.message !== undefined ? { message: patch.message } : {}),
          ...(patch.link !== undefined ? { link: patch.link } : {}),
          ...(patch.mediaId !== undefined ? { mediaId: patch.mediaId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(automationRules.id, id))
        .catch(() => {});

      return { data: disk[idx] };
    }
    return reply.code(404).send({ code: "not_found", message: "Rule not found" });
  });

  app.delete("/v1/ig/rules/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    // Instant delete from disk
    const disk = loadDiskRules().filter((r) => r.id !== id);
    saveDiskRules(disk);

    // Background delete from DB
    deps.db
      .delete(automationRules)
      .where(eq(automationRules.id, id))
      .catch(() => {});

    return { ok: true };
  });

  app.get("/v1/ig/autodm/status", async () => {
    try {
      const accounts = await deps.db
        .select({
          igUserId: igAccounts.igUserId,
          username: igAccounts.username,
          reauthRequiredAt: igAccounts.reauthRequiredAt,
          tokenExpiresAt: igAccounts.tokenExpiresAt,
        })
        .from(igAccounts)
        .limit(50);
      if (accounts.length > 0) {
        return {
          queueDepth: queueDepth(),
          accounts,
        };
      }
    } catch {
      // db offline fallback
    }

    let accounts: Array<any> = [];
    try {
      const file = resolveAccountFile();
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        if (data?.igUserId) {
          accounts = [
            {
              igUserId: data.igUserId,
              username: data.username,
              reauthRequiredAt: null,
              tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null,
            },
          ];
        }
      }
    } catch {
      // ignore
    }

    return {
      queueDepth: queueDepth(),
      accounts,
    };
  });
}
