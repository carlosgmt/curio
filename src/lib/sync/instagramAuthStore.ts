import fs from "node:fs";
import path from "node:path";

export interface StoredInstagramAuth {
  cookie: string;
  sessionId: string;
  csrfToken?: string;
  dsUserId?: string;
  igUsername?: string;
  updatedAt: string;
}

export interface ParsedInstagramCookie {
  cookie: string;
  sessionId: string;
  csrfToken?: string;
  dsUserId?: string;
}

function getDataDirectory(): string {
  if (process.env.DATABASE_PATH) {
    return path.dirname(process.env.DATABASE_PATH);
  }
  return "./data";
}

function getAuthStorePath(): string {
  return path.join(getDataDirectory(), ".instagram-auth.json");
}

function readAllAuthRecords(): Record<string, StoredInstagramAuth> {
  const storePath = getAuthStorePath();
  if (!fs.existsSync(storePath)) return {};
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, StoredInstagramAuth>)
      : {};
  } catch {
    return {};
  }
}

function writeAllAuthRecords(records: Record<string, StoredInstagramAuth>): void {
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

/**
 * Parses a raw Cookie header string (or JSON map of cookie key/values)
 * and extracts Instagram authentication fields without logging secrets.
 */
export function parseInstagramCookieString(rawInput: string): ParsedInstagramCookie | null {
  const trimmed = String(rawInput || "").trim();
  if (!trimmed) return null;

  const kv = new Map<string, string>();

  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string" && v.trim()) {
          kv.set(k.trim(), v.trim());
        }
      }
    } catch {
      return null;
    }
  } else {
    const cleanHeader = trimmed.replace(/^cookie:\s*/i, "");
    for (const part of cleanHeader.split(";")) {
      const idx = part.indexOf("=");
      if (idx <= 0) continue;
      const name = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (name && value) {
        kv.set(name, value);
      }
    }
  }

  let sessionId = kv.get("sessionid") || kv.get("sessionId") || "";
  if (!sessionId && !trimmed.includes("=") && !trimmed.startsWith("{") && trimmed.length >= 16) {
    // Allow pasting bare sessionid token directly
    sessionId = trimmed;
    kv.set("sessionid", sessionId);
  }

  if (!sessionId) return null;

  const csrfToken = kv.get("csrftoken") || kv.get("csrfToken") || undefined;
  const dsUserId =
    kv.get("ds_user_id") ||
    kv.get("dsUserId") ||
    (sessionId.includes("%3A") ? sessionId.split("%3A")[0] : sessionId.split(":")[0] || undefined);

  const orderedPairs: string[] = [];
  orderedPairs.push(`sessionid=${sessionId}`);
  if (csrfToken) orderedPairs.push(`csrftoken=${csrfToken}`);
  if (dsUserId) orderedPairs.push(`ds_user_id=${dsUserId}`);

  for (const [k, v] of kv.entries()) {
    const lower = k.toLowerCase();
    if (lower === "sessionid" || lower === "csrftoken" || lower === "ds_user_id") continue;
    if (lower === "ig_did" || lower === "mid" || lower === "datr" || lower === "rur") {
      orderedPairs.push(`${k}=${v}`);
    }
  }

  return {
    cookie: orderedPairs.join("; "),
    sessionId,
    csrfToken,
    dsUserId,
  };
}

export function getInstagramAuthRecord(userId: string): StoredInstagramAuth | null {
  const all = readAllAuthRecords();
  const rec = all[userId];
  if (!rec || !rec.cookie || !rec.sessionId) return null;
  return rec;
}

export function setInstagramAuthRecord(
  userId: string,
  input: { cookie: string; igUsername?: string }
): StoredInstagramAuth {
  const parsed = parseInstagramCookieString(input.cookie);
  if (!parsed) {
    throw new Error("Invalid Instagram cookie: missing required sessionid cookie.");
  }

  const all = readAllAuthRecords();
  const prev = all[userId];
  const next: StoredInstagramAuth = {
    cookie: parsed.cookie,
    sessionId: parsed.sessionId,
    csrfToken: parsed.csrfToken,
    dsUserId: parsed.dsUserId,
    igUsername: input.igUsername?.trim() || prev?.igUsername,
    updatedAt: new Date().toISOString(),
  };
  all[userId] = next;
  writeAllAuthRecords(all);
  return next;
}

export function clearInstagramAuthRecord(userId: string): void {
  const all = readAllAuthRecords();
  if (userId in all) {
    delete all[userId];
    writeAllAuthRecords(all);
  }
}
