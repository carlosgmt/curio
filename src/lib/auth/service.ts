import crypto from "node:crypto";
import { db, users, type User, type UserSession } from "@/db";
import { eq, or } from "drizzle-orm";
import {
  createSession,
  validateSession,
  revokeSession,
  clearSessionCookie,
  extractTokenFromRequest,
} from "./session";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha256";

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

export type SafeUser = Omit<User, "passwordHash">;

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

/**
 * Hashes a plain-text password using salted PBKDF2 (SHA-256, 100k iterations).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  ).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Validates a candidate password against the stored salt:hash string using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  ).toString("hex");

  const hashBuf = Buffer.from(hash, "hex");
  const originalBuf = Buffer.from(originalHash, "hex");

  if (hashBuf.length !== originalBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, originalBuf);
}

export interface RegisterInput {
  email: string;
  username: string;
  displayName?: string;
  password: string;
}

export interface AuthResult {
  user: SafeUser;
  session: UserSession;
  token: string;
  cookie: string;
}

/**
 * Registers a new user, hashes their password, and creates an initial session.
 */
export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const email = input.email?.trim().toLowerCase();
  let username = input.username?.trim().toLowerCase();
  const displayName = input.displayName?.trim() || username;
  const password = input.password;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("Valid email address is required", 400);
  }

  if (username) {
    username = username.replace(/^@+/, "");
  }

  if (!username || username.length < 4 || username.length > 30 || !/^[a-z0-9_-]+$/.test(username)) {
    throw new AuthError(
      "Username must be 4-30 characters and contain only letters, numbers, underscores, and hyphens",
      400
    );
  }

  if (!password || password.length < 6) {
    throw new AuthError("Password must be at least 6 characters long", 400);
  }

  // Check email uniqueness
  const [existingEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingEmail) {
    throw new AuthError("An account with this email already exists", 409);
  }

  // Check username uniqueness
  const [existingUsername] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUsername) {
    throw new AuthError("This username is already taken", 409);
  }

  const passwordHash = hashPassword(password);

  const [createdUser] = await db
    .insert(users)
    .values({
      email,
      username,
      displayName,
      passwordHash,
      onboardingCompleted: false,
      isPro: false,
      aiCreditsRemaining: 25,
    })
    .returning();

  const { session, token, cookie } = await createSession(createdUser.id);

  return {
    user: toSafeUser(createdUser),
    session,
    token,
    cookie,
  };
}

export interface LoginInput {
  usernameOrEmail: string;
  password: string;
}

/**
 * Authenticates user credentials and issues a new session.
 */
export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const identifier = input.usernameOrEmail?.trim().toLowerCase().replace(/^@+/, "");
  const password = input.password;

  if (!identifier || !password) {
    throw new AuthError("Username/email and password are required", 400);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.email, identifier),
        eq(users.username, identifier)
      )
    )
    .limit(1);

  if (!user || !user.passwordHash) {
    throw new AuthError("Invalid username/email or password", 401);
  }

  const isValid = verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new AuthError("Invalid username/email or password", 401);
  }

  const { session, token, cookie } = await createSession(user.id);

  return {
    user: toSafeUser(user),
    session,
    token,
    cookie,
  };
}

/**
 * Logs out user by revoking the session token.
 */
export async function logoutUser(
  tokenOrReq?: Request | Headers | string | null
): Promise<{ success: boolean; clearCookie: string }> {
  const token = extractTokenFromRequest(tokenOrReq);
  if (token) {
    await revokeSession(token);
  }

  return {
    success: true,
    clearCookie: clearSessionCookie(),
  };
}

/**
 * Retrieves the authenticated user and session if available, or returns null.
 */
export async function getOptionalAuth(
  req?: Request | Headers | string | null
): Promise<{ user: SafeUser; session: UserSession } | null> {
  const token = extractTokenFromRequest(req);
  if (!token) return null;

  const auth = await validateSession(token);
  if (!auth) return null;

  return {
    user: toSafeUser(auth.user),
    session: auth.session,
  };
}

/**
 * Enforces authentication. If an invalid or expired token is passed, throws 401.
 * If no token is provided:
 * - If dev/test fallback is permitted, falls back to local user.
 * - Otherwise throws 401.
 */
export async function requireAuth(
  req?: Request | Headers | string | null,
  options?: { allowFallback?: boolean }
): Promise<{ user: SafeUser; session: UserSession | null }> {
  const token = extractTokenFromRequest(req);

  if (token) {
    const auth = await validateSession(token);
    if (!auth) {
      throw new AuthError("Invalid or expired session token", 401);
    }
    return {
      user: toSafeUser(auth.user),
      session: auth.session,
    };
  }

  // No token provided. Check fallback allowance.
  const isStrict =
    req instanceof Request || (req && typeof req === "object" && "headers" in req)
      ? (req as Request).headers?.get("x-strict-auth") === "true"
      : false;

  const canFallback =
    options?.allowFallback ??
    (!isStrict && (process.env.CURIO_ALLOW_ANON === "true" || process.env.NODE_ENV !== "production"));

  if (canFallback) {
    const defaultUser = await getOrCreateDefaultUser();
    return {
      user: toSafeUser(defaultUser),
      session: null,
    };
  }

  throw new AuthError("Authentication required", 401);
}
