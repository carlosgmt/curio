import { describe, expect, it } from "bun:test";
import { db, backgroundJobs } from "@/db";
import { processNextJob } from "../worker";
import { registerJobHandler } from "@/lib/jobs/registry";
import { eq } from "drizzle-orm";

describe("Autonomous Background Worker Daemon (Phase 8 / Concurrency & Queue)", () => {
  it("claims and processes a queued background job atomically without transaction errors", async () => {
    const queueName = `test_queue_${Date.now()}`;
    let executedPayload: any = null;

    registerJobHandler(queueName, async (payload) => {
      executedPayload = payload;
      return { success: true };
    });

    // 1. Insert a test job
    const [job] = await db
      .insert(backgroundJobs)
      .values({
        queueName,
        payload: { task: "cluster_graph", userId: "usr_worker_test" },
        status: "QUEUED",
      })
      .returning();

    expect(job.status).toBe("QUEUED");

    // 2. Process job with atomic worker step
    const result = await processNextJob({ queueName });
    expect(result.processed).toBe(true);
    expect(result.jobId).toBe(job.id);
    expect(result.status).toBe("COMPLETED");

    expect(executedPayload).toEqual({ task: "cluster_graph", userId: "usr_worker_test" });

    // 3. Verify in database
    const [updated] = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, job.id));

    expect(updated.status).toBe("COMPLETED");
    expect(updated.completedAt).not.toBeNull();
    expect(updated.attempts).toBe(1);
  });

  it("marks job as FAILED when attempts reach maxAttempts", async () => {
    const failingQueue = `failing_queue_${Date.now()}`;

    registerJobHandler(failingQueue, async () => {
      throw new Error("Simulated remote inference timeout");
    });

    const [job] = await db
      .insert(backgroundJobs)
      .values({
        queueName: failingQueue,
        payload: { action: "fail" },
        status: "QUEUED",
        attempts: 2,
        maxAttempts: 3,
      })
      .returning();

    const result = await processNextJob({ queueName: failingQueue });
    expect(result.processed).toBe(true);
    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("Simulated remote inference timeout");

    const [dbJob] = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, job.id));

    expect(dbJob.status).toBe("FAILED");
    expect(dbJob.lastError).toContain("Simulated remote inference timeout");
    expect(dbJob.attempts).toBe(3);
  });
});
