import { sqlite, db } from "@/db";
import { backgroundJobs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { executeJobPayload } from "@/lib/jobs/registry";

export interface ProcessJobResult {
  processed: boolean;
  jobId?: string;
  queueName?: string;
  status?: "COMPLETED" | "FAILED";
  error?: string;
}

/**
 * Claims and executes a single pending background job atomically.
 * Single-statement atomic UPDATE ... WHERE id = (SELECT ...) RETURNING *
 * executes outside any long-running transactions to avoid SQLite busy crashes.
 */
export async function processNextJob(options?: { queueName?: string }): Promise<ProcessJobResult> {
  const queueClause = options?.queueName
    ? `AND queue_name = '${options.queueName.replace(/'/g, "''")}'`
    : "";

  // 1. Atomic single-statement lock and fetch
  const locked = sqlite
    .prepare(
      `
    UPDATE background_jobs
    SET status = 'PROCESSING',
        locked_at = datetime('now'),
        attempts = attempts + 1
    WHERE id = (
      SELECT id FROM background_jobs
      WHERE status = 'QUEUED' AND scheduled_at <= datetime('now') ${queueClause}
      ORDER BY attempts ASC, scheduled_at ASC
      LIMIT 1
    )
    RETURNING *
  `
    )
    .get() as any;

  if (!locked) {
    return { processed: false };
  }

  const jobId = locked.id;
  const queueName = locked.queue_name;
  const attempts = locked.attempts;
  const maxAttempts = locked.max_attempts ?? 3;

  try {
    const rawPayload = locked.payload;
    const payload =
      typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;

    // Asynchronous payload execution OUTSIDE SQLite transactions
    await executeJobPayload(queueName, payload);

    await db
      .update(backgroundJobs)
      .set({
        status: "COMPLETED",
        completedAt: sql`datetime('now')`,
      })
      .where(eq(backgroundJobs.id, jobId));

    return {
      processed: true,
      jobId,
      queueName,
      status: "COMPLETED",
    };
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    const newStatus = attempts >= maxAttempts ? "FAILED" : "QUEUED";

    await db
      .update(backgroundJobs)
      .set({
        status: newStatus,
        lastError: errorMessage,
      })
      .where(eq(backgroundJobs.id, jobId));

    return {
      processed: true,
      jobId,
      queueName,
      status: newStatus as any,
      error: errorMessage,
    };
  }
}

/**
 * Long-running daemon worker process
 */
export async function startWorkerDaemon(options?: {
  pollIntervalMs?: number;
  maxIterations?: number;
}) {
  const pollIntervalMs = options?.pollIntervalMs ?? 1000;
  let iterations = 0;

  console.log(`[Curio Worker] Daemon started (PID: ${process.pid})`);

  while (true) {
    try {
      const result = await processNextJob();
      if (result.processed) {
        console.log(
          `[Curio Worker] Processed job ${result.jobId} (${result.queueName}) -> ${result.status}`
        );
      } else {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
    } catch (err) {
      console.error("[Curio Worker] Error during worker loop step:", err);
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    iterations++;
    if (options?.maxIterations && iterations >= options.maxIterations) {
      break;
    }
  }
}

// Direct CLI invocation
if (import.meta.main || process.argv[1]?.endsWith("worker.ts")) {
  startWorkerDaemon().catch((err) => {
    console.error("[Curio Worker] Fatal worker daemon error:", err);
    process.exit(1);
  });
}
