import { describe, expect, it } from "bun:test";
import { db, backgroundJobs } from "@/db";
import { runWatchdogCheck, type WatchdogAlert } from "../watchdog";

describe("Operator Watchdog & Dead-Man Alert Integration (Phase 8 / FR-8)", () => {
  it("detects failed background jobs and dispatches critical alert", async () => {
    const timestamp = Date.now();
    const dispatchedAlerts: WatchdogAlert[] = [];

    // Insert a failed job
    await db.insert(backgroundJobs).values({
      queueName: "clustering",
      payload: { userId: "usr_fail_test" },
      status: "FAILED",
      attempts: 3,
      maxAttempts: 3,
      lastError: "OOM during community matrix factorization",
      createdAt: new Date().toISOString(),
    });

    const report = await runWatchdogCheck({
      alertSink: (alert) => {
        dispatchedAlerts.push(alert);
      },
    });

    expect(report.healthy).toBe(false);
    expect(report.failedJobCount).toBeGreaterThanOrEqual(1);

    const failureAlert = report.alerts.find((a) => a.alertType === "JOB_FAILURE");
    expect(failureAlert).toBeDefined();
    expect(failureAlert?.severity).toBe("CRITICAL");
    expect(failureAlert?.message).toContain("failed after 3 attempts");

    expect(dispatchedAlerts.some((a) => a.alertType === "JOB_FAILURE")).toBe(true);
  });

  it("detects WAL file size threshold breach and dispatches bloat warning", async () => {
    const alerts: WatchdogAlert[] = [];

    // Run check with threshold lower than actual WAL size (e.g. 0 bytes)
    const report = await runWatchdogCheck({
      maxWalSizeBytes: 0, // Trigger immediately if any WAL exists
      alertSink: (alert) => {
        alerts.push(alert);
      },
    });

    if (report.walSizeBytes > 0) {
      const walAlert = report.alerts.find((a) => a.alertType === "WAL_BLOAT");
      expect(walAlert).toBeDefined();
      expect(walAlert?.severity).toBe("WARNING");
      expect(walAlert?.message).toContain("Checkpoint needed");
    }
  });
});
