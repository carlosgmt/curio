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

    // Rejects handle shorter than 4 characters
    expect(
      registerUser({
        email: `short-${timestamp}@curio.local`,
        username: "cat",
        password: "password123",
      })
    ).rejects.toThrow("Username must be 4-30 characters");
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

    // 2. GET /api/v1/auth/me with Bearer token (and NO Cookie header) heals curio_session cookie
    const meReq = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${regData.token}` },
    });
    const meRes = await meRoute(meReq);
    expect(meRes.status).toBe(200);
    const healedCookie = meRes.headers.get("Set-Cookie");
    expect(healedCookie).toBeTruthy();
    expect(healedCookie).toContain(`curio_session=${regData.token}`);
    expect(healedCookie).toContain("Path=/");
    expect(healedCookie).toContain("HttpOnly");
    expect(healedCookie).toContain("SameSite=Lax");
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

  it("serves public/unlisted non-paywalled board media without auth while blocking private/paywalled/memo media", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { NextRequest } = await import("next/server");
    const { GET: getMedia } = await import("@/app/api/v1/media/[...slug]/route");
    const { db, globalEntities, userSaves } = await import("@/db");
    const { createList, addItemToList } = await import("@/lib/lists/service");

    const ts = Date.now();
    const { user, token } = await registerUser({
      email: `media-board-${ts}@curio.local`,
      username: `mediabrd_${ts}`,
      password: "mediaPassword123",
    });

    const testBucketDir = path.resolve(process.cwd(), "data", "media", `pubtest_${ts}`);
    fs.mkdirSync(testBucketDir, { recursive: true });
    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const files = [
      "public_hero_1.png",
      "public_hero_10.png",
      "unlisted_cutout.png",
      "private_only.png",
      "paywalled_item.png",
      "private_memo.png",
    ];
    for (const f of files) {
      fs.writeFileSync(path.join(testBucketDir, f), tinyPng);
    }

    try {
      // 1. Entity on a PUBLIC manual board (heroImageUrl)
      const [pubEntity] = await db
        .insert(globalEntities)
        .values({
          canonicalUrl: `https://example.com/pub-${ts}`,
          urlHash: `hash-pub-${ts}`,
          entityKey: `key-pub-${ts}`,
          coreType: "PRODUCT",
          typePath: "/product/garment",
          title: "Public Linen Jacket",
          heroImageUrl: `/curio/api/v1/media/pubtest_${ts}/public_hero_1.png`,
          coreStructuredData: {},
        })
        .returning();
      const [pubSave] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: pubEntity.id,
          typePath: "/product/garment",
          isPrivateMemo: false,
          visibility: "PRIVATE",
        })
        .returning();
      const pubBoard = await createList(user.id, {
        title: `Public Lookbook ${ts}`,
        visibility: "PUBLIC",
      });
      await addItemToList(pubBoard.id, pubSave.id);

      // 2. Entity matched by autoRules on an UNLISTED board via nested coreStructuredData.items[].photoUrl
      const [outfitEntity] = await db
        .insert(globalEntities)
        .values({
          canonicalUrl: `https://example.com/outfit-${ts}`,
          urlHash: `hash-outfit-${ts}`,
          entityKey: `key-outfit-${ts}`,
          coreType: "PRODUCT",
          typePath: "/style/outfit",
          title: "Unlisted Capsule Outfit",
          heroImageUrl: null,
          coreStructuredData: {
            kind: "worn",
            items: [
              {
                name: "Cutout Tee",
                photoUrl: `/curio/api/v1/media/pubtest_${ts}/unlisted_cutout.png`,
              },
            ],
          },
        })
        .returning();
      await db.insert(userSaves).values({
        userId: user.id,
        entityId: outfitEntity.id,
        typePath: "/style/outfit",
        isPrivateMemo: false,
        visibility: "PRIVATE",
      });
      await createList(user.id, {
        title: `Unlisted Outfits ${ts}`,
        visibility: "UNLISTED",
        autoRules: { typePathPrefix: "/style/outfit" },
      });

      // 3. Entity ONLY on a PRIVATE board
      const [privEntity] = await db
        .insert(globalEntities)
        .values({
          canonicalUrl: `https://example.com/priv-${ts}`,
          urlHash: `hash-priv-${ts}`,
          entityKey: `key-priv-${ts}`,
          coreType: "PRODUCT",
          typePath: "/product/watch",
          title: "Private Watch",
          heroImageUrl: `/curio/api/v1/media/pubtest_${ts}/private_only.png`,
          coreStructuredData: {},
        })
        .returning();
      const [privSave] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: privEntity.id,
          typePath: "/product/watch",
          isPrivateMemo: false,
          visibility: "PRIVATE",
        })
        .returning();
      const privBoard = await createList(user.id, {
        title: `Private Vault ${ts}`,
        visibility: "PRIVATE",
      });
      await addItemToList(privBoard.id, privSave.id);

      // 4. Entity ONLY on a PUBLIC PAYWALLED board
      const [payEntity] = await db
        .insert(globalEntities)
        .values({
          canonicalUrl: `https://example.com/pay-${ts}`,
          urlHash: `hash-pay-${ts}`,
          entityKey: `key-pay-${ts}`,
          coreType: "PRODUCT",
          typePath: "/product/book",
          title: "Paywalled Guide",
          heroImageUrl: `/curio/api/v1/media/pubtest_${ts}/paywalled_item.png`,
          coreStructuredData: {},
        })
        .returning();
      const [paySave] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: payEntity.id,
          typePath: "/product/book",
          isPrivateMemo: false,
          visibility: "PRIVATE",
        })
        .returning();
      const payBoard = await createList(user.id, {
        title: `Paywalled Board ${ts}`,
        visibility: "PUBLIC",
        isPaywalled: true,
        accessPriceCents: 999,
      });
      await addItemToList(payBoard.id, paySave.id);

      // 5. Private memo linked to an entity on a PUBLIC board MUST remain blocked
      const [memoEntity] = await db
        .insert(globalEntities)
        .values({
          canonicalUrl: `https://example.com/memo-${ts}`,
          urlHash: `hash-memo-${ts}`,
          entityKey: `key-memo-${ts}`,
          coreType: "NOTE",
          typePath: "/memo/personal",
          title: "Memo Attachment",
          heroImageUrl: `/curio/api/v1/media/pubtest_${ts}/private_memo.png`,
          coreStructuredData: {},
        })
        .returning();
      const [memoSave] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: memoEntity.id,
          typePath: "/memo/personal",
          isPrivateMemo: true,
          visibility: "PUBLIC",
        })
        .returning();
      await addItemToList(pubBoard.id, memoSave.id);

      const callMedia = (file: string, extraHeaders: Record<string, string> = {}) =>
        getMedia(
          new NextRequest(`http://localhost:3000/api/v1/media/pubtest_${ts}/${file}`, {
            headers: { "x-strict-auth": "true", ...extraHeaders },
          }),
          { params: Promise.resolve({ slug: [`pubtest_${ts}`, file] }) }
        );

      // Unauthenticated visitor on PUBLIC manual board -> 200
      const resPub = await callMedia("public_hero_1.png");
      expect(resPub.status).toBe(200);
      expect(resPub.headers.get("Content-Type")).toBe("image/png");

      // Visitor with stale/expired curio_session cookie on UNLISTED autoRules board -> 200
      const resUnlisted = await callMedia("unlisted_cutout.png", {
        Cookie: "curio_session=expired_or_invalid_session_token",
      });
      expect(resUnlisted.status).toBe(200);

      // Prefix-collision filename not on any public entity -> 401 (no substring leak)
      const resCollision = await callMedia("public_hero_10.png");
      expect(resCollision.status).toBe(401);

      // PRIVATE board media -> 401 when unauthenticated
      const resPriv = await callMedia("private_only.png");
      expect(resPriv.status).toBe(401);

      // PAYWALLED public board media -> 401 when unauthenticated
      const resPay = await callMedia("paywalled_item.png");
      expect(resPay.status).toBe(401);

      // Private memo media -> 401 even if save.visibility="PUBLIC" and in list_items
      const resMemo = await callMedia("private_memo.png");
      expect(resMemo.status).toBe(401);

      // Nonexistent file -> 401 (no disk-existence oracle for unauthenticated callers)
      const resMissing = await callMedia("does_not_exist.png");
      expect(resMissing.status).toBe(401);

      // Authenticated owner via healed curio_session cookie -> 200 on PRIVATE board media
      const resOwnerPriv = await callMedia("private_only.png", {
        Cookie: `curio_session=${token}`,
      });
      expect(resOwnerPriv.status).toBe(200);

      // 6. Percent-encoded filename on PUBLIC board resolves cleanly
      const spaceFile = "outfit hero 1.png";
      fs.writeFileSync(path.join(testBucketDir, spaceFile), tinyPng);
      const [encodedEnt] = await db
        .insert(globalEntities)
        .values({
          canonicalUrl: `https://example.com/enc-${ts}`,
          urlHash: `hash-enc-${ts}`,
          entityKey: `key-enc-${ts}`,
          coreType: "PRODUCT",
          typePath: "/product/garment",
          title: "Percent Encoded Garment",
          heroImageUrl: `/curio/api/v1/media/pubtest_${ts}/outfit%20hero%201.png`,
          coreStructuredData: {},
        })
        .returning();
      const [encodedSave] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: encodedEnt.id,
          typePath: "/product/garment",
          isPrivateMemo: false,
          visibility: "PRIVATE",
        })
        .returning();
      await addItemToList(pubBoard.id, encodedSave.id);

      const resEncoded = await callMedia("outfit%20hero%201.png");
      expect(resEncoded.status).toBe(200);

      // 7. Curator avatarUrl is served publicly ONLY when curator owns a non-paywalled PUBLIC/UNLISTED board or save
      const { users: usersTable } = await import("@/db");
      const { eq: eqOp } = await import("drizzle-orm");
      fs.writeFileSync(path.join(testBucketDir, "curator_avatar.png"), tinyPng);
      fs.writeFileSync(path.join(testBucketDir, "private_user_avatar.png"), tinyPng);

      await db
        .update(usersTable)
        .set({ avatarUrl: `/curio/api/v1/media/pubtest_${ts}/curator_avatar.png` })
        .where(eqOp(usersTable.id, user.id));

      const { user: privOnlyUser } = await registerUser({
        email: `priv-avatar-${ts}@curio.local`,
        username: `privav_${ts}`,
        password: "mediaPassword123",
      });
      await db
        .update(usersTable)
        .set({ avatarUrl: `/curio/api/v1/media/pubtest_${ts}/private_user_avatar.png` })
        .where(eqOp(usersTable.id, privOnlyUser.id));

      const resCuratorAvatar = await callMedia("curator_avatar.png");
      expect(resCuratorAvatar.status).toBe(200);

      const resPrivateUserAvatar = await callMedia("private_user_avatar.png");
      expect(resPrivateUserAvatar.status).toBe(401);
    } finally {
      fs.rmSync(testBucketDir, { recursive: true, force: true });
    }
  });

  it("clears stale curio_session cookie on 401 and falls back to valid cookie when Bearer token is stale", async () => {
    const { GET: meRoute } = await import("@/app/api/v1/auth/me/route");
    const { NextRequest } = await import("next/server");

    const ts = Date.now();
    const { user, token } = await registerUser({
      email: `heal-fallback-${ts}@curio.local`,
      username: `healfb_${ts}`,
      password: "healPassword123",
    });

    // 1. Stale curio_session cookie with no valid Bearer -> 401 + Set-Cookie clearing curio_session
    const staleCookieReq = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      headers: { Cookie: "curio_session=expired_cookie_token" },
    });
    const staleCookieRes = await meRoute(staleCookieReq);
    expect(staleCookieRes.status).toBe(401);
    expect(staleCookieRes.headers.get("Set-Cookie")).toContain("Max-Age=0");

    // 2. Stale Bearer token + valid curio_session cookie -> 200 (falls back to valid cookie & returns active token)
    const mixedReq = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      headers: {
        Authorization: "Bearer stale_localstorage_token",
        Cookie: `curio_session=${token}`,
      },
    });
    const mixedRes = await meRoute(mixedReq);
    expect(mixedRes.status).toBe(200);
    const mixedData = await mixedRes.json();
    expect(mixedData.user.id).toBe(user.id);
    expect(mixedData.token).toBe(token);
  });
});

