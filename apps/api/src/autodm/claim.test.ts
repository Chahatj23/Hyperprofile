import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  automationEvents,
  automationRules,
  createDb,
} from "@hyperprofile/db";
import { loadEnv } from "@hyperprofile/shared";
import { claimComment } from "./claim.js";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../../.env"),
});

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

describe("claimComment", () => {
  const igUserId = `test_ig_${Date.now()}`;
  let ruleId = "";
  let dbConnected = false;

  beforeAll(async () => {
    try {
      await db.execute(sql`SELECT 1`);
      dbConnected = true;
    } catch {
      dbConnected = false;
      console.warn("PostgreSQL not reachable at DATABASE_URL; skipping DB-dependent integration tests.");
    }
  });

  it("claims once; second claim is rejected", async (ctx) => {
    if (!dbConnected) {
      ctx.skip();
      return;
    }
    const [rule] = await db
      .insert(automationRules)
      .values({
        igUserId,
        keyword: "GUIDE",
        message: "Hi {name}",
        active: true,
      })
      .returning();
    ruleId = rule!.id;

    const commentId = `c_${Date.now()}`;
    const first = await claimComment(db, { commentId, igUserId, ruleId });
    const second = await claimComment(db, { commentId, igUserId, ruleId });
    expect(first).toBe(true);
    expect(second).toBe(false);

    const row = (
      await db
        .select()
        .from(automationEvents)
        .where(eq(automationEvents.commentId, commentId))
        .limit(1)
    )[0];
    expect(row?.status).toBe("queued");
  });

  it("handles 50 concurrent claims for one comment id and asserts exactly one winner", async (ctx) => {
    if (!dbConnected) {
      ctx.skip();
      return;
    }

    const commentId = `race_comment_${Date.now()}_${Math.random()}`;
    // Run 50 concurrent claims simultaneously
    const claimPromises = Array.from({ length: 50 }, () =>
      claimComment(db, { commentId, igUserId, ruleId }),
    );

    const results = await Promise.all(claimPromises);
    const winners = results.filter((res) => res === true);
    const losers = results.filter((res) => res === false);

    expect(winners.length).toBe(1);
    expect(losers.length).toBe(49);

    const eventRows = await db
      .select()
      .from(automationEvents)
      .where(eq(automationEvents.commentId, commentId));
    expect(eventRows.length).toBe(1);
  });

  afterAll(async () => {
    if (!dbConnected) return;
    try {
      await db.delete(automationEvents).where(eq(automationEvents.igUserId, igUserId));
      await db.delete(automationRules).where(eq(automationRules.igUserId, igUserId));
    } catch {
      // Ignore cleanup error if db disconnected
    }
  });
});
