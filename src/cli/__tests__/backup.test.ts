import { describe, expect, it } from "bun:test";
import { performBackup } from "../backup";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

describe("Automated Non-Blocking SQLite Backup Snapshots (Phase 8)", () => {
  it("creates a valid backup database snapshot that passes integrity check", async () => {
    const backupPath = join(
      process.cwd(),
      "backups",
      `test-backup-${Date.now()}.db`
    );

    const result = await performBackup(backupPath);
    expect(result.success).toBe(true);
    expect(result.destinationPath).toBe(backupPath);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(existsSync(backupPath)).toBe(true);

    // Verify SQLite integrity of snapshot
    const backupDb = new Database(backupPath);
    const integrity = backupDb.prepare("PRAGMA integrity_check").get() as {
      integrity_check: string;
    };
    expect(integrity.integrity_check).toBe("ok");
    backupDb.close();

    // Cleanup test snapshot
    try {
      unlinkSync(backupPath);
    } catch {}
  });
});
