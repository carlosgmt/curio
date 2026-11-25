import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface StoredGoodreadsAuth {
  goodreadsUserId: string;
  cookie: string;
  updatedAt: string;
}

function getDataDirectory(): string {
  if (process.env.DATABASE_PATH) {
    return path.dirname(process.env.DATABASE_PATH);
  }
  if (process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test") {
    return "./data";
  }
  return "./data";
}

function getAuthStorePath(): string {
  return path.join(getDataDirectory(), ".goodreads-auth.json");
}

function getSyncSecretPath(): string {
  return path.join(getDataDirectory(), ".sync-secret");
}

function readAllAuthRecords(): Record<string, StoredGoodreadsAuth> {
  const storePath = getAuthStorePath();
  if (!fs.existsSync(storePath)) return {};
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, StoredGoodreadsAuth>)
      : {};
  } catch {
    return {};
  }
}

function writeAllAuthRecords(records: Record<string, StoredGoodreadsAuth>): void {
  const storePath = getAuthStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(records, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    fs.chmodSync(storePath, 0o600);
  } catch {
    // ignore on platforms without chmod semantics
  }
}

export function getGoodreadsAuthRecord(userId: string): StoredGoodreadsAuth | null {
  const all = readAllAuthRecords();
  const rec = all[userId];
  if (!rec || !rec.cookie || !rec.goodreadsUserId) return null;
  return rec;
}

export function setGoodreadsAuthRecord(
  userId: string,
  record: { goodreadsUserId: string; cookie: string }
): StoredGoodreadsAuth {
  const all = readAllAuthRecords();
  const next: StoredGoodreadsAuth = {
    goodreadsUserId: record.goodreadsUserId.trim(),
    cookie: record.cookie.trim(),
    updatedAt: new Date().toISOString(),
  };
  all[userId] = next;
  writeAllAuthRecords(all);
  return next;
}

export function clearGoodreadsAuthRecord(userId: string): void {
  const all = readAllAuthRecords();
  if (userId in all) {
    delete all[userId];
    writeAllAuthRecords(all);
  }
}

export function getOrCreateSyncSecret(): string {
  const envSecret = process.env.CURIO_SYNC_SECRET?.trim();
  if (envSecret) return envSecret;

  const secretPath = getSyncSecretPath();
  if (fs.existsSync(secretPath)) {
    const existing = fs.readFileSync(secretPath, "utf8").trim();
    if (existing.length >= 32) return existing;
  }

  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(secretPath, generated + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    fs.chmodSync(secretPath, 0o600);
  } catch {
    // ignore
  }
  return generated;
}

export function verifySyncSecret(candidate: string | null | undefined): boolean {
  if (!candidate || typeof candidate !== "string") return false;
  const trimmed = candidate.trim();
  if (!trimmed) return false;

  const expected = getOrCreateSyncSecret();
  const bufA = Buffer.from(trimmed, "utf8");
  const bufB = Buffer.from(expected, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
