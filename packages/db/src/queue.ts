import { sql, eq, and, lte, desc } from "drizzle-orm";
import type { Db } from "./client.js";
import { automationEvents, jobQueueTable } from "./schema.js";

export interface EnqueueOptions {
  runAt?: Date;
  maxAttempts?: number;
}

export interface ClaimedJob<T = Record<string, unknown>> {
  id: string;
  queue: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
}

export interface JobQueue {
  enqueue<T extends Record<string, unknown>>(
    queue: string,
    payload: T,
    options?: EnqueueOptions,
  ): Promise<string>;

  claimNext<T extends Record<string, unknown>>(
    queue: string,
    batchSize?: number,
    workerId?: string,
  ): Promise<ClaimedJob<T>[]>;

  complete(jobId: string): Promise<void>;

  fail(jobId: string, error: string, retryDelayMs?: number): Promise<boolean>;

  countSentInLastHour(igUserId: string): Promise<number>;
}

export class PostgresJobQueue implements JobQueue {
  constructor(private db: Db) {}

  async enqueue<T extends Record<string, unknown>>(
    queue: string,
    payload: T,
    options?: EnqueueOptions,
  ): Promise<string> {
    const runAt = options?.runAt ?? new Date();
    const maxAttempts = options?.maxAttempts ?? 5;

    const [inserted] = await this.db
      .insert(jobQueueTable)
      .values({
        queue,
        payload,
        status: "pending",
        attempts: 0,
        maxAttempts,
        runAt,
      })
      .returning({ id: jobQueueTable.id });

    return inserted!.id;
  }

  async claimNext<T extends Record<string, unknown>>(
    queue: string,
    batchSize = 10,
    workerId = `worker-${process.pid}`,
  ): Promise<ClaimedJob<T>[]> {
    // Zero-cost concurrency: SELECT ... FOR UPDATE SKIP LOCKED
    // Uses raw SQL transaction to ensure row lock atomicity
    const rows = await this.db.transaction(async (tx) => {
      const selected = await tx.execute<typeof jobQueueTable.$inferSelect>(sql`
        SELECT *
        FROM ${jobQueueTable}
        WHERE ${jobQueueTable.queue} = ${queue}
          AND ${jobQueueTable.status} = 'pending'
          AND ${jobQueueTable.runAt} <= NOW()
        ORDER BY ${jobQueueTable.runAt} ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `);

      if (!selected || selected.length === 0) {
        return [];
      }

      const ids = selected.map((r) => r.id as string);
      await tx
        .update(jobQueueTable)
        .set({
          status: "processing",
          lockedAt: new Date(),
          lockedBy: workerId,
          updatedAt: new Date(),
        })
        .where(sql`${jobQueueTable.id} = ANY(${ids})`);

      return selected;
    });

    return rows.map((r) => ({
      id: r.id as string,
      queue: r.queue as string,
      payload: r.payload as T,
      attempts: (r.attempts as number) ?? 0,
      maxAttempts: (r.maxAttempts as number) ?? 5,
    }));
  }

  async complete(jobId: string): Promise<void> {
    await this.db
      .update(jobQueueTable)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(jobQueueTable.id, jobId));
  }

  async fail(jobId: string, error: string, retryDelayMs = 60_000): Promise<boolean> {
    const [row] = await this.db
      .select({ attempts: jobQueueTable.attempts, maxAttempts: jobQueueTable.maxAttempts })
      .from(jobQueueTable)
      .where(eq(jobQueueTable.id, jobId))
      .limit(1);

    if (!row) return false;

    const nextAttempts = row.attempts + 1;
    const canRetry = nextAttempts < row.maxAttempts;
    const nextRunAt = canRetry ? new Date(Date.now() + retryDelayMs) : new Date();

    await this.db
      .update(jobQueueTable)
      .set({
        attempts: nextAttempts,
        status: canRetry ? "pending" : "failed",
        runAt: nextRunAt,
        lastError: error,
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(jobQueueTable.id, jobId));

    return canRetry;
  }

  /**
   * Section 5: Implement the per-account send cap by counting sent rows
   * in the last 60 minutes in Postgres (cap: 700 / hour).
   */
  async countSentInLastHour(igUserId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationEvents)
      .where(
        and(
          eq(automationEvents.igUserId, igUserId),
          eq(automationEvents.status, "sent"),
          sql`${automationEvents.updatedAt} >= ${oneHourAgo}`,
        ),
      );

    return Number(result[0]?.count ?? 0);
  }
}
