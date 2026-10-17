import { type UserSession } from "@/db";
import { AuthError, toSafeUser, type SafeUser } from "./service";
import { extractTokenFromRequest, validateSession } from "./session";

/**
 * Enforces admin authorization.
 * Allows access if:
 * 1. An admin token matching process.env.CURIO_ADMIN_TOKEN is provided via `x-admin-token` or Bearer auth.
 * 2. A valid user session is provided whose user has `isAdmin === true`, or matches `ADMIN_EMAIL` or username "admin".
 */
export async function requireAdmin(
  req?: Request | Headers | string | null
): Promise<{ user: SafeUser; session: UserSession | null }> {
  const configuredAdminToken = process.env.CURIO_ADMIN_TOKEN?.trim();

  let xAdminToken: string | null = null;
  let authHeader: string | null = null;

  if (typeof req === "string") {
    const trimmed = req.trim();
    if (trimmed.toLowerCase().startsWith("bearer ")) {
      authHeader = trimmed;
    } else {
      xAdminToken = trimmed;
    }
  } else if (req instanceof Headers) {
    xAdminToken = req.get("x-admin-token");
    authHeader = req.get("authorization");
  } else if (req && "headers" in req && req.headers) {
    xAdminToken = req.headers.get("x-admin-token");
    authHeader = req.headers.get("authorization");
  }

  // 1. Direct admin token check
  if (configuredAdminToken) {
    const bearer = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : null;
    if (xAdminToken === configuredAdminToken || bearer === configuredAdminToken) {
      return {
        user: {
          id: "admin-root",
          email: process.env.ADMIN_EMAIL || "admin@curio.local",
          username: "admin",
          displayName: "Operator Admin",
          avatarUrl: null,
          onboardingCompleted: true,
          isPro: true,
          isAdmin: true,
          aiCreditsRemaining: 999999,
          aiCreditsResetAt: null,
          customDomain: null,
          affiliateTags: null,
          googleSyncTokens: null,
          createdAt: new Date().toISOString(),
        },
        session: null,
      };
    }
  }

  // 2. User session check
  const token = extractTokenFromRequest(req);
  if (!token) {
    throw new AuthError("Authentication required", 401);
  }

  const auth = await validateSession(token);
  if (!auth) {
    throw new AuthError("Invalid or expired session token", 401);
  }

  const { user, session } = auth;
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@curio.local").toLowerCase();
  const isOperator =
    Boolean(user.isAdmin) ||
    user.email.toLowerCase() === adminEmail ||
    user.username.toLowerCase() === "admin";

  if (!isOperator) {
    throw new AuthError("Forbidden: Operator privileges required", 403);
  }

  return {
    user: toSafeUser(user),
    session,
  };
}
