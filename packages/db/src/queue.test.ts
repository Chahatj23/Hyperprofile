import { describe, expect, it, vi } from "vitest";
import { PostgresJobQueue } from "./queue.js";

describe("PostgresJobQueue", () => {
  it("enqueues jobs with default options into job_queue table", async () => {
    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "mock-job-uuid-123" }]),
        }),
      }),
    };

    const queue = new PostgresJobQueue(mockDb as any);
    const id = await queue.enqueue("autodm", { commentId: "c_123", igUserId: "ig_456" });

    expect(id).toBe("mock-job-uuid-123");
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("claims pending jobs using transaction lock", async () => {
    const mockSelected = [
      {
        id: "job-1",
        queue: "autodm",
        payload: { commentId: "c_1" },
        attempts: 0,
        maxAttempts: 5,
      },
    ];

    const mockTx = {
      execute: vi.fn().mockResolvedValue(mockSelected),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    };

    const queue = new PostgresJobQueue(mockDb as any);
    const claimed = await queue.claimNext("autodm", 5, "worker-test");

    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.id).toBe("job-1");
    expect(claimed[0]!.payload).toEqual({ commentId: "c_1" });
    expect(mockTx.execute).toHaveBeenCalledTimes(1);
    expect(mockTx.update).toHaveBeenCalledTimes(1);
  });

  it("completes a job cleanly", async () => {
    const mockDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    const queue = new PostgresJobQueue(mockDb as any);
    await queue.complete("job-123");

    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("handles job failure with retry backoff and terminal failure", async () => {
    // 1. Retry scenario (attempt 1 of 5)
    const mockDbRetry = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ attempts: 1, maxAttempts: 5 }]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    const queueRetry = new PostgresJobQueue(mockDbRetry as any);
    const canRetry = await queueRetry.fail("job-123", "Meta network timeout", 30_000);
    expect(canRetry).toBe(true);

    // 2. Terminal failure scenario (attempt 4 -> 5 of 5)
    const mockDbTerminal = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ attempts: 4, maxAttempts: 5 }]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    const queueTerminal = new PostgresJobQueue(mockDbTerminal as any);
    const canRetryTerminal = await queueTerminal.fail("job-123", "Permanent invalid token");
    expect(canRetryTerminal).toBe(false);
  });

  it("counts sent rows in the last hour for an account", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 42 }]),
        }),
      }),
    };

    const queue = new PostgresJobQueue(mockDb as any);
    const count = await queue.countSentInLastHour("ig_user_789");

    expect(count).toBe(42);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });
});
