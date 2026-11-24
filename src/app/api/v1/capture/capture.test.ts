import { describe, expect, it } from "bun:test";
import { db, users, userSaves } from "@/db";
import { POST, GET } from "./route";
import { GET as GET_INTENT } from "./intent/route";
import { NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

describe("Capture API & Intent Execution (/api/v1/capture)", () => {
  it("creates new cards on add intent and mutates existing cards on edit intent without creating duplicates", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `capture-test-${timestamp}@curio.local`,
        username: `capture_test_${timestamp}`,
        displayName: "Capture Tester",
      })
      .returning();

    const { token } = await createSession(user.id);
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 1. Initial capture creates a new card (HTTP 201)
    const createReq = new NextRequest("http://localhost:3000/api/v1/capture", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: "Past Lives movie Celine Song" }),
    });
    const createRes = await POST(createReq);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.status).toBe("created");
    expect(createData.save).toBeDefined();
    const initialSaveId = createData.save.id;

    // Verify exactly 1 save exists
    let userSaveCount = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    expect(userSaveCount.length).toBe(1);

    // 2. Keystroke preview returns non-mutating preview without saving
    const previewReq = new NextRequest("http://localhost:3000/api/v1/capture?preview=true", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: "Change rating to 5 stars for Past Lives" }),
    });
    const previewRes = await POST(previewReq);
    expect(previewRes.status).toBe(200);
    const previewData = await previewRes.json();
    expect(previewData.preview).toBe(true);
    expect(previewData.intent).toBe("EDIT_SAVE");
    expect(previewData.action).toBe("RATING");
    expect(previewData.targetSave.saveId).toBe(initialSaveId);

    // Also test GET /api/v1/capture/intent?q=...
    const getIntentReq = new NextRequest(
      "http://localhost:3000/api/v1/capture/intent?q=" +
        encodeURIComponent("Change rating to 5 stars for Past Lives"),
      {
        method: "GET",
        headers: authHeaders,
      }
    );
    const getIntentRes = await GET_INTENT(getIntentReq);
    expect(getIntentRes.status).toBe(200);
    const getIntentData = await getIntentRes.json();
    expect(getIntentData.intent).toBe("EDIT_SAVE");

    // Verify still exactly 1 save exists after preview
    userSaveCount = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    expect(userSaveCount.length).toBe(1);

    // 3. Executing edit intent updates existing card in-place with HTTP 200 (Zero duplicates)
    const editReq = new NextRequest("http://localhost:3000/api/v1/capture", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: "Change rating to 5 stars for Past Lives" }),
    });
    const editRes = await POST(editReq);
    expect(editRes.status).toBe(200);
    const editData = await editRes.json();
    expect(editData.status).toBe("edited");
    expect(editData.action).toBe("edited");
    expect(editData.save.id).toBe(initialSaveId);
    expect(editData.save.userCustomValues.rating).toBe(5);

    // Verify still strictly 1 save exists (ZERO unwanted duplicates!)
    userSaveCount = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    expect(userSaveCount.length).toBe(1);
  });

  it("captures structured suggestion with targetCandidate and forcedTypePath cleanly", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `capture-sug-${timestamp}@curio.local`,
        username: `sug_cap_${timestamp}`,
        displayName: "Suggestion Capture Tester",
      })
      .returning();

    const { token } = await createSession(user.id);
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const sugPayload = {
      input: "Omega",
      forcedTypePath: "/media/music/album",
      targetCandidate: {
        title: "Omega",
        subtitle: "Enrique Morente • 1996",
        typePath: "/media/music/album",
        badgeLabel: "ALBUM",
        heroImageUrl: "https://example.com/omega.jpg",
        canonicalUrl: "https://open.spotify.com/search/Enrique%20Morente%20Omega",
      },
      forceNew: true,
    };

    const req = new NextRequest("http://localhost:3000/api/v1/capture", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(sugPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe("created");
    expect(data.entity).toBeDefined();
    expect(data.entity.title).toBe("Omega");
    expect(data.entity.title).not.toBe("Spotify – Web Player");
    expect(data.save.typePath).toBe("/media/music/album");
    expect(data.save.isPrivateMemo).toBe(false);
  });

  it("captures text note with isPrivateMemo=true and /memo/personal typePath", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `capture-note-${timestamp}@curio.local`,
        username: `note_cap_${timestamp}`,
        displayName: "Note Capture Tester",
      })
      .returning();

    const { token } = await createSession(user.id);
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const notePayload = {
      input: "Private thought about upcoming architecture review",
      isPrivateMemo: true,
      forcedTypePath: "/memo/personal",
      forceNew: true,
    };

    const req = new NextRequest("http://localhost:3000/api/v1/capture", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(notePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe("created");
    expect(data.is_private_memo).toBe(true);
    expect(data.save.isPrivateMemo).toBe(true);
    expect(data.save.typePath).toBe("/memo/personal");
    expect(data.save.personalNotes).toBe("Private thought about upcoming architecture review");
    expect(data.entity_id).toBeNull();
  });

  it("captures quote input and maps to /quote when Quote type is installed", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `quote-cap-${timestamp}@curio.local`,
        username: `quote_cap_${timestamp}`,
        displayName: "Quote Capture Tester",
      })
      .returning();

    const { token } = await createSession(user.id);
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Install Quote type for this user
    const { installCatalogType } = await import("@/lib/types/service");
    await installCatalogType(user.id, "quote");

    // Capture quotation
    const quotePayload = {
      input: '"We suffer more often in imagination than in reality." - Seneca (c. 65 AD)',
    };
    const req = new NextRequest("http://localhost:3000/api/v1/capture", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(quotePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe("created");
    expect(data.save.typePath).toBe("/quote");
    expect(data.save.userCustomValues.text).toBe("We suffer more often in imagination than in reality.");
    expect(data.save.userCustomValues.author).toBe("Seneca");
    expect(data.save.userCustomValues.date).toBe("c. 65 AD");
  });

  it("tucks daily /style/outfit wear-logs out of default GET /api/v1/capture stream while preserving ideas/memos, hydrating connections, and keeping Outfits/Wardrobe synced", async () => {
    const { globalEntities } = await import("@/db");
    const { createConnection } = await import("@/lib/connections/service");
    const { createList, getListBySlugWithItems } = await import("@/lib/lists/service");

    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `stream-wear-${ts}@curio.local`,
        username: `streamwear_${ts}`,
        displayName: "Stream Signal Tester",
      })
      .returning();

    const { token } = await createSession(user.id);
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 1. Seed older core curations: 1 private memo (NULL typePath/entityId), 1 film, 1 garment, 1 outfit idea
    const baseTime = ts - 100_000;
    const [memoSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: null,
        typePath: null,
        isPrivateMemo: true,
        privateTitle: "Quiet Morning Journal",
        createdAt: new Date(baseTime).toISOString(),
      })
      .returning();

    const [filmEnt] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/film-${ts}`,
        urlHash: `hash-film-${ts}`,
        entityKey: `key-film-${ts}`,
        coreType: "MEDIA",
        typePath: "/media/film",
        title: "In the Mood for Love",
        coreStructuredData: {},
      })
      .returning();
    const [filmSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: filmEnt.id,
        typePath: "/media/film",
        isPrivateMemo: false,
        createdAt: new Date(baseTime + 1000).toISOString(),
      })
      .returning();

    const [garmentEnt] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `closet://garment/${ts}`,
        urlHash: `hash-garm-${ts}`,
        entityKey: `key-garm-${ts}`,
        coreType: "PRODUCT",
        typePath: "/product/garment",
        title: "Olive Chore Coat",
        coreStructuredData: { category: "outerwear" },
      })
      .returning();
    const [garmentSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: garmentEnt.id,
        typePath: "/product/garment",
        isPrivateMemo: false,
        createdAt: new Date(baseTime + 2000).toISOString(),
      })
      .returning();

    const [ideaEnt] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `closet://outfit-idea/${ts}`,
        urlHash: `hash-idea-${ts}`,
        entityKey: `key-idea-${ts}`,
        coreType: "PRODUCT",
        typePath: "/style/outfit",
        title: "Autumn Layering Moodboard",
        coreStructuredData: { kind: "idea", items: [] },
      })
      .returning();
    const [ideaSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: ideaEnt.id,
        typePath: "/style/outfit",
        isPrivateMemo: false,
        createdAt: new Date(baseTime + 3000).toISOString(),
      })
      .returning();

    // Pair filmSave <-> garmentSave to verify batch connections hydration on GET /api/v1/capture
    await createConnection({
      userId: user.id,
      sourceSaveId: filmSave.id,
      targetSaveId: garmentSave.id,
      connectionType: "AESTHETIC_SIBLING",
    });

    // 2. Seed 55 NEWER daily /style/outfit wear-logs (exceeding limit=50 page 1!)
    for (let i = 0; i < 55; i++) {
      const [wornEnt] = await db
        .insert(globalEntities)
        .values({
          canonicalUrl: `closet://outfit/${ts}-${i}`,
          urlHash: `hash-worn-${ts}-${i}`,
          entityKey: `key-worn-${ts}-${i}`,
          coreType: "PRODUCT",
          typePath: "/style/outfit",
          title: `Daily Fit #${i}`,
          // Mix explicit kind="worn" and legacy undefined kind
          coreStructuredData: i % 2 === 0 ? { kind: "worn", wornDate: "2026-04-01" } : { items: [] },
        })
        .returning();
      await db.insert(userSaves).values({
        userId: user.id,
        entityId: wornEnt.id,
        typePath: "/style/outfit",
        isPrivateMemo: false,
        wishlist: i === 0, // Wishlist the first wear-log
        createdAt: new Date(ts + i * 1000).toISOString(),
      });
    }

    // Create Outfits & Wardrobe smart boards
    const outfitsBoard = await createList(user.id, {
      title: "Outfits",
      slug: `outfits-${ts}`,
      visibility: "PRIVATE",
      autoRules: { typePathPrefix: "/style/outfit" },
    });
    const wardrobeBoard = await createList(user.id, {
      title: "Wardrobe",
      slug: `wardrobe-${ts}`,
      visibility: "PRIVATE",
      autoRules: { typePathPrefix: "/product/garment" },
    });

    // 3. Default GET /api/v1/capture?limit=50 tucks all 55 wear-logs at the SQL layer!
    const defaultRes = await GET(
      new NextRequest("http://localhost:3000/api/v1/capture?limit=50", { headers: authHeaders })
    );
    expect(defaultRes.status).toBe(200);
    const defaultData = await defaultRes.json();
    expect(defaultData.wearLogCount).toBe(55);
    expect(defaultData.vaultTotalCount).toBe(59);
    expect(defaultData.totalCount).toBe(4);
    expect(defaultData.nextCursor).toBeNull();
    expect(defaultData.saves.length).toBe(4);

    const returnedIds = new Set(defaultData.saves.map((r: any) => r.save.id));
    expect(returnedIds.has(memoSave.id)).toBe(true);
    expect(returnedIds.has(filmSave.id)).toBe(true);
    expect(returnedIds.has(garmentSave.id)).toBe(true);
    expect(returnedIds.has(ideaSave.id)).toBe(true);

    // Every returned item has `connections` hydrated as an array (eliminating client N+1)
    for (const row of defaultData.saves) {
      expect(Array.isArray(row.connections)).toBe(true);
    }
    const filmRow = defaultData.saves.find((r: any) => r.save.id === filmSave.id);
    expect(filmRow.connections.length).toBe(1);
    expect(filmRow.connections[0].saveId).toBe(garmentSave.id);
    const ideaRow = defaultData.saves.find((r: any) => r.save.id === ideaSave.id);
    expect(ideaRow.connections).toEqual([]);

    // 4. Opt-in toggle ?includeWearLogs=true returns the full stream including daily wear-logs
    const withWearRes = await GET(
      new NextRequest("http://localhost:3000/api/v1/capture?limit=50&includeWearLogs=true", {
        headers: authHeaders,
      })
    );
    expect(withWearRes.status).toBe(200);
    const withWearData = await withWearRes.json();
    expect(withWearData.totalCount).toBe(59);
    expect(withWearData.wearLogCount).toBe(55);
    expect(withWearData.saves.length).toBe(50);
    expect(withWearData.nextCursor).not.toBeNull();
    expect(withWearData.saves[0].entity.title).toBe("Daily Fit #54");

    // 5. Wishlist filter (?wishlist=true) still includes wishlisted wear-logs
    const wishRes = await GET(
      new NextRequest("http://localhost:3000/api/v1/capture?wishlist=true", {
        headers: authHeaders,
      })
    );
    const wishData = await wishRes.json();
    expect(wishData.saves.length).toBe(1);
    expect(wishData.saves[0].entity.title).toBe("Daily Fit #0");

    // 6. Outfits & Wardrobe boards remain 100% populated
    const outfitsDetails = await getListBySlugWithItems(outfitsBoard.slug, user.id);
    expect(outfitsDetails?.itemCount).toBe(56); // 55 wear-logs + 1 idea
    const wardrobeDetails = await getListBySlugWithItems(wardrobeBoard.slug, user.id);
    expect(wardrobeDetails?.itemCount).toBe(1);

    // 7. excludeCloset=true hides garments while preserving film, memo, and idea
    const noClosetRes = await GET(
      new NextRequest("http://localhost:3000/api/v1/capture?limit=50&excludeCloset=true", {
        headers: authHeaders,
      })
    );
    expect(noClosetRes.status).toBe(200);
    const noClosetData = await noClosetRes.json();
    expect(noClosetData.closetCount).toBe(1);
    expect(noClosetData.myStuffCount).toBe(0);
    expect(noClosetData.totalCount).toBe(3);
    expect(noClosetData.saves.some((r: any) => r.save.id === garmentSave.id)).toBe(false);
    expect(noClosetData.saves.some((r: any) => r.save.id === filmSave.id)).toBe(true);
  });
});
