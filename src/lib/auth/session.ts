import crypto from "node:crypto";
import { db, userSessions, users, type User, type UserSession } from "@/db";
import { eq, and, gt } from "drizzle-orm";

export const SESSION_COOKIE_NAME = "curio_session";
export const SESSION_DURATION_DAYS = 7;
export const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
export const SESSION_DURATION_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60;

/**
 * Generates a cryptographically secure random session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Serializes the session cookie with HttpOnly, SameSite=Lax, Path=/ and Secure (in prod).
 */
export function createSessionCookie(
  token: string,
  maxAgeSeconds: number = SESSION_DURATION_SECONDS
): string {
  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureFlag}`;
}

/**
 * Serializes an expired cookie to clear the session on the client.
 */
export function clearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`;
}

/**
 * Extracts a session token from an HTTP Request, Headers object, or cookie/token string.
 */
export function extractTokenFromRequest(
  req?: Request | Headers | string | null
): string | null {
  if (!req) return null;

  if (typeof req === "string") {
    const trimmed = req.trim();
    if (trimmed.toLowerCase().startsWith("bearer ")) {
      return trimmed.slice(7).trim();
    }
    if (trimmed.includes(`${SESSION_COOKIE_NAME}=`)) {
      const match = trimmed.match(
        new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`)
      );
      return match ? match[1] : null;
    }
    return trimmed;
  }

  let authHeader: string | null = null;
  let cookieHeader: string | null = null;

  if (req instanceof Headers) {
    authHeader = req.get("authorization");
    cookieHeader = req.get("cookie");
  } else if ("headers" in req && req.headers) {
    authHeader = req.headers.get("authorization");
    cookieHeader = req.headers.get("cookie");
  }

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  if (cookieHeader) {
    const match = cookieHeader.match(
      new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`)
    );
    if (match) return match[1];
  }

  return null;
}

/**
 * Creates a new session in the database for the given user.
 */
export async function createSession(
  userId: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<{ session: UserSession; token: string; cookie: string }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  const [session] = await db
    .insert(userSessions)
    .values({
      userId,
      token,
      expiresAt,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    })
    .returning();

  const cookie = createSessionCookie(token);

  return { session, token, cookie };
}

/**
 * Validates a session token, applying a 7-day sliding window if session is near expiration.
 */
export async function validateSession(
  token: string
): Promise<{ user: User; session: UserSession } | null> {
  if (!token || typeof token !== "string") return null;

  const [session] = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.token, token))
    .limit(1);

  if (!session) return null;

  const now = Date.now();
  const expiresTime = new Date(session.expiresAt).getTime();

  // Expired session check
  if (expiresTime <= now) {
    await db.delete(userSessions).where(eq(userSessions.id, session.id));
    return null;
  }

  // Fetch the user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    await db.delete(userSessions).where(eq(userSessions.id, session.id));
    return null;
  }

  // 7-day sliding window: if less than 3.5 days remain, slide the window by 7 days
  const halfWindowMs = SESSION_DURATION_MS / 2;
  if (expiresTime - now < halfWindowMs) {
    const newExpiresAt = new Date(now + SESSION_DURATION_MS).toISOString();
    await db
      .update(userSessions)
      .set({ expiresAt: newExpiresAt })
      .where(eq(userSessions.id, session.id));
    session.expiresAt = newExpiresAt;
  }

  return { user, session };
}

/**
 * Revokes a single session by token.
 */
export async function revokeSession(token: string): Promise<boolean> {
  const result = await db
    .delete(userSessions)
    .where(eq(userSessions.token, token));
  return true;
}

/**
 * Revokes all active sessions for a user (e.g. password reset / logout all).
 */
export async function revokeAllUserSessions(userId: string): Promise<boolean> {
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
  return true;
}
