import { sqlite } from "@/db";
import { mkdirSync, statSync } from "fs";
import { dirname, join } from "path";

export interface BackupResult {
  success: boolean;
  destinationPath: string;
  sizeBytes: number;
  durationMs: number;
  timestamp: string;
}

/**
 * Creates an atomic non-blocking snapshot of the SQLite WAL database.
 */
export async function performBackup(customPath?: string): Promise<BackupResult> {
  const startTime = Date.now();
  const dateStr = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const destPath =
    customPath || join(process.cwd(), "backups", `curio-snapshot-${dateStr}.db`);

  mkdirSync(dirname(destPath), { recursive: true });

  await sqlite.backup(destPath);

  const stats = statSync(destPath);
  const durationMs = Date.now() - startTime;

  return {
    success: true,
    destinationPath: destPath,
    sizeBytes: stats.size,
    durationMs,
    timestamp: new Date().toISOString(),
  };
}

if (import.meta.main || process.argv[1]?.endsWith("backup.ts")) {
  performBackup()
    .then((res) => {
      console.log(
        `[Curio Backup] Snapshot created successfully at ${res.destinationPath} (${res.sizeBytes} bytes, ${res.durationMs}ms)`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Curio Backup] Fatal backup error:", err);
      process.exit(1);
    });
}
