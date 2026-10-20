import { db, backgroundJobs } from "@/db";
import { eq, desc } from "drizzle-orm";
import { statSync, existsSync } from "fs";

export interface WatchdogAlert {
  alertType: "JOB_FAILURE" | "WAL_BLOAT" | "INFERENCE_OFFLINE";
  severity: "CRITICAL" | "WARNING";
  title: string;
  message: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface WatchdogCheckOptions {
  webhookUrl?: string;
  maxWalSizeBytes?: number;
  dbPath?: string;
  alertSink?: (alert: WatchdogAlert) => Promise<void> | void;
}

export interface WatchdogReport {
  timestamp: string;
  healthy: boolean;
  alerts: WatchdogAlert[];
  walSizeBytes: number;
  failedJobCount: number;
}

/**
 * Checks system telemetry, WAL bloat, and job failures, dispatching alerts if thresholds are breached.
 */
export async function runWatchdogCheck(
  options?: WatchdogCheckOptions
): Promise<WatchdogReport> {
  const alerts: WatchdogAlert[] = [];
  const maxWalSizeBytes = options?.maxWalSizeBytes ?? 52428800; // 50MB
  const now = new Date().toISOString();

  // 1. Check for Failed Background Jobs
  const failedJobs = await db
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.status, "FAILED"))
    .orderBy(desc(backgroundJobs.createdAt))
    .limit(10);

  const failedJobCount = failedJobs.length;

  if (failedJobCount > 0) {
    const mostRecent = failedJobs[0];
    alerts.push({
      alertType: "JOB_FAILURE",
      severity: "CRITICAL",
      title: `Background Job Failure Detected (${failedJobCount} failed)`,
      message: `Job ${mostRecent.id} in queue '${mostRecent.queueName}' failed after ${mostRecent.attempts} attempts: ${mostRecent.lastError || "Unknown error"}`,
      details: {
        jobId: mostRecent.id,
        queueName: mostRecent.queueName,
        attempts: mostRecent.attempts,
        lastError: mostRecent.lastError,
        totalFailedJobs: failedJobCount,
      },
      timestamp: now,
    });
  }

  // 2. Check SQLite WAL File Size
  const dbPath = options?.dbPath ?? (process.env.DATABASE_PATH || "./data/curio.db");
  const walPath = `${dbPath}-wal`;
  let walSizeBytes = 0;

  if (existsSync(walPath)) {
    try {
      const stats = statSync(walPath);
      walSizeBytes = stats.size;
      if (walSizeBytes > maxWalSizeBytes) {
        alerts.push({
          alertType: "WAL_BLOAT",
          severity: "WARNING",
          title: "SQLite WAL File Bloat Warning",
          message: `WAL file size (${(walSizeBytes / 1024 / 1024).toFixed(2)} MB) exceeds threshold (${(maxWalSizeBytes / 1024 / 1024).toFixed(2)} MB). Checkpoint needed.`,
          details: {
            walPath,
            walSizeBytes,
            thresholdBytes: maxWalSizeBytes,
          },
          timestamp: now,
        });
      }
    } catch (e) {
      console.warn("Could not inspect WAL size:", e);
    }
  }

  // 3. Dispatch Alerts
  const webhookUrl = options?.webhookUrl || process.env.WATCHDOG_WEBHOOK_URL;

  for (const alert of alerts) {
    if (options?.alertSink) {
      await Promise.resolve(options.alertSink(alert));
    }

    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🚨 **Curio Watchdog Alert**: ${alert.title}\n> ${alert.message}`,
            embeds: [
              {
                title: alert.title,
                description: alert.message,
                color: alert.severity === "CRITICAL" ? 0xff0000 : 0xffaa00,
                fields: Object.entries(alert.details).map(([key, value]) => ({
                  name: key,
                  value: String(value),
                  inline: true,
                })),
                timestamp: alert.timestamp,
              },
            ],
            ...alert,
          }),
        });
      } catch (postErr) {
        console.error("Failed to post watchdog alert to webhook:", postErr);
      }
    }
  }

  return {
    timestamp: now,
    healthy: alerts.length === 0,
    alerts,
    walSizeBytes,
    failedJobCount,
  };
}
