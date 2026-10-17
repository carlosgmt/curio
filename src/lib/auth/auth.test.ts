import { describe, expect, it } from "bun:test";
import {
  hashPassword,
  verifyPassword,
  registerUser,
  loginUser,
  logoutUser,
  requireAuth,
  getOptionalAuth,
  AuthError,
} from "./service";
import { validateSession } from "./session";

describe("Authentication & Session Service", () => {
  it("hashes and verifies passwords securely using PBKDF2", () => {
    const rawPassword = "superSecretPassword123!";
    const hash = hashPassword(rawPassword);

    expect(hash).toContain(":");
    expect(verifyPassword(rawPassword, hash)).toBe(true);
    expect(verifyPassword("wrongPassword", hash)).toBe(false);
  });

  it("registers a new user and generates a valid session cookie", async () => {
    const timestamp = Date.now();
    const result = await registerUser({
      email: `test-${timestamp}@curio.local`,
      username: `curator_${timestamp}`,
      displayName: "Curator Master",
      password: "securePassword2026",
    });

    expect(result.user.email).toBe(`test-${timestamp}@curio.local`);
    expect(result.user.username).toBe(`curator_${timestamp}`);
    expect(result.user.displayName).toBe("Curator Master");
    expect(result.user.onboardingCompleted).toBe(false);
    expect((result.user as any).passwordHash).toBeUndefined();
    expect(result.token).toBeDefined();
    expect(result.cookie).toContain("curio_session=");
    expect(result.cookie).toContain("HttpOnly");
    expect(result.cookie).toContain("SameSite=Lax");
  });

  it("rejects duplicate email and duplicate username during registration", async () => {
    const timestamp = Date.now();
    await registerUser({
      email: `unique-${timestamp}@curio.local`,
      username: `unique_${timestamp}`,
      password: "password123",
    });

    // Duplicate email
    expect(
      registerUser({
        email: `unique-${timestamp}@curio.local`,
        username: `diff_${timestamp}`,
        password: "password123",
      })
    ).rejects.toThrow("already exists");

    // Duplicate username
    expect(
      registerUser({
        email: `diff-${timestamp}@curio.local`,
        username: `unique_${timestamp}`,
        password: "password123",
      })
    ).rejects.toThrow("already taken");
  });

  it("authenticates via login with username or email and validates session", async () => {
    const timestamp = Date.now();
    const email = `login-${timestamp}@curio.local`;
    const username = `login_${timestamp}`;
    const password = "myCorrectPassword";

    await registerUser({ email, username, password });

    // Login via email
    const emailLogin = await loginUser({ usernameOrEmail: email, password });
    expect(emailLogin.user.username).toBe(username);
    expect(emailLogin.token).toBeDefined();

    // Login via username (including with leading @)
    const handleLogin = await loginUser({ usernameOrEmail: `@${username}`, password });
    expect(handleLogin.user.email).toBe(email);

    // Reject wrong password
    expect(
      loginUser({ usernameOrEmail: email, password: "wrongPassword" })
    ).rejects.toThrow("Invalid username/email or password");

    // RequireAuth with Bearer token
    const authFromBearer = await requireAuth(`Bearer ${handleLogin.token}`);
    expect(authFromBearer.user.id).toBe(handleLogin.user.id);
    expect(authFromBearer.session).not.toBeNull();

    // OptionalAuth returns user
    const optionalAuth = await getOptionalAuth(`Bearer ${handleLogin.token}`);
    expect(optionalAuth?.user.id).toBe(handleLogin.user.id);

    // Logout revokes session
    const logoutRes = await logoutUser(handleLogin.token);
    expect(logoutRes.success).toBe(true);

    // After logout, token validation fails
    const checkAfterLogout = await validateSession(handleLogin.token);
    expect(checkAfterLogout).toBeNull();

    // Optional auth returns null
    const optionalAfterLogout = await getOptionalAuth(`Bearer ${handleLogin.token}`);
    expect(optionalAfterLogout).toBeNull();
  });

  it("enforces strict auth when x-strict-auth header is passed without token", async () => {
    const req = new Request("http://localhost:3000/api/v1/capture", {
      headers: { "x-strict-auth": "true" },
    });

    expect(requireAuth(req)).rejects.toThrow("Authentication required");
  });

  it("handles registration, login, me, and logout REST endpoints correctly", async () => {
    const { POST: registerRoute } = await import("@/app/api/v1/auth/register/route");
    const { POST: loginRoute } = await import("@/app/api/v1/auth/login/route");
    const { GET: meRoute } = await import("@/app/api/v1/auth/me/route");
    const { POST: logoutRoute } = await import("@/app/api/v1/auth/logout/route");
    const { NextRequest } = await import("next/server");

    const ts = Date.now();
    const email = `rest-${ts}@curio.local`;
    const username = `rest_${ts}`;
    const password = "restPassword123";

    // 1. POST /api/v1/auth/register
    const regReq = new NextRequest("http://localhost:3000/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password, displayName: "REST User" }),
    });
    const regRes = await registerRoute(regReq);
    expect(regRes.status).toBe(201);
    const regData = await regRes.json();
    expect(regData.success).toBe(true);
    expect(regData.user.username).toBe(username);
    expect(regData.token).toBeDefined();

    const cookieHeader = regRes.headers.get("Set-Cookie");
    expect(cookieHeader).toContain("curio_session=");

    // 2. GET /api/v1/auth/me with Bearer token
    const meReq = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${regData.token}` },
    });
    const meRes = await meRoute(meReq);
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.success).toBe(true);
    expect(meData.user.email).toBe(email);
    expect(meData.session).toBeDefined();

    // 3. GET /api/v1/auth/me without auth fails with 401
    const unauthReq = new NextRequest("http://localhost:3000/api/v1/auth/me");
    const unauthRes = await meRoute(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 4. POST /api/v1/auth/login
    const loginReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernameOrEmail: username, password }),
    });
    const loginRes = await loginRoute(loginReq);
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.token).toBeDefined();

    // 5. POST /api/v1/auth/logout
    const logoutReq = new NextRequest("http://localhost:3000/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    const logoutRes = await logoutRoute(logoutReq);
    expect(logoutRes.status).toBe(200);
    const logoutCookie = logoutRes.headers.get("Set-Cookie");
    expect(logoutCookie).toContain("Max-Age=0");
  });

  it("handles complete user onboarding flow via POST /api/v1/user/onboarding", async () => {
    const { POST: registerRoute } = await import("@/app/api/v1/auth/register/route");
    const { POST: onboardingRoute } = await import("@/app/api/v1/user/onboarding/route");
    const { NextRequest } = await import("next/server");

    const ts = Date.now();
    const regReq = new NextRequest("http://localhost:3000/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `onboard-${ts}@curio.local`,
        username: `onboard_${ts}`,
        password: "securePassword123",
      }),
    });
    const regRes = await registerRoute(regReq);
    const { token, user } = await regRes.json();
    expect(user.onboardingCompleted).toBe(false);

    // Call onboarding
    const onboardReq = new NextRequest("http://localhost:3000/api/v1/user/onboarding", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: "Sovereign Curator",
        username: `curator_${ts}`,
        archetypes: ["cinema", "books", "vinyl"],
      }),
    });
    const onboardRes = await onboardingRoute(onboardReq);
    expect(onboardRes.status).toBe(200);
    const onboardData = await onboardRes.json();

    expect(onboardData.success).toBe(true);
    expect(onboardData.user.onboardingCompleted).toBe(true);
    expect(onboardData.user.displayName).toBe("Sovereign Curator");
    expect(onboardData.user.username).toBe(`curator_${ts}`);
    expect(onboardData.createdLists.length).toBe(3);
    expect(onboardData.createdLists.some((l: any) => l.title === "Cinema Watchlist")).toBe(true);
    expect(onboardData.createdLists.some((l: any) => l.title === "The Library")).toBe(true);
    expect(onboardData.createdLists.some((l: any) => l.title === "Vinyl & Sound Rotation")).toBe(true);
  });
});

