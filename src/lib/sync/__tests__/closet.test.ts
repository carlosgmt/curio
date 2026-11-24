import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import {
  db,
  users,
  userSaves,
  globalEntities,
  entryConnections,
  entitySources,
  entityPriceHistory,
  smartLists,
} from "@/db";
import { syncClosetWithCurio, syncCurioSaveEditToCloset } from "../closet";
import { AudioTranscriptionUnavailableError, transcribeAudio } from "@/lib/ingest/audio";
import { POST as POST_AUDIO } from "@/app/api/v1/capture/audio/route";
import { POST as POST_STREAM } from "@/app/api/v1/capture/stream/route";
import { GET as GET_CONNECTIONS } from "@/app/api/v1/connections/route";
import { GET as GET_MEMBERSHIPS } from "@/app/api/v1/lists/memberships/route";
import { POST as POST_CLOSET_SYNC } from "@/app/api/v1/sync/closet/route";
import { PATCH as PATCH_SAVE } from "@/app/api/v1/saves/[id]/route";
import { GET as GET_EXPORT } from "@/app/api/v1/export/route";
import { POST as POST_SHARE_TARGET } from "@/app/api/v1/share-target/route";
import { GET as GET_AUDIT } from "@/app/api/v1/system/audit/route";
import { GET as GET_NODES_EDGES } from "@/app/api/v1/graph/nodes-edges/route";
import { GET as GET_CLUSTERS } from "@/app/api/v1/graph/clusters/route";
import { GET as GET_SERENDIPITY } from "@/app/api/v1/graph/serendipity/route";
import { GET as GET_PATHS } from "@/app/api/v1/graph/paths/route";
import { POST as POST_LAZY_HYDRATE } from "@/app/api/v1/saves/lazy-hydrate/route";
import { POST as POST_CALIBRATE } from "@/app/api/v1/onboarding/calibrate/route";
import { GET as GET_MYMAPS } from "@/app/api/v1/export/mymaps-kml/route";
import { POST as POST_YT_MUSIC } from "@/app/api/v1/export/yt-music/route";
import { createSession } from "@/lib/auth/session";
import { enrichCaptureInput } from "@/lib/enrichment/dispatcher";
import { routeKnownDomainUrl } from "@/lib/enrichment/urlRouter";
import { executeIngestionCascade } from "@/lib/ingest/cascade";
import { getUserLists, matchesAutoRules } from "@/lib/lists/service";

describe("Closet UI Bidirectional Sync & Phase 1 Security/Audio Contracts", () => {
  it("syncs garments (transparent PNG cutouts + laundry + wear counts) & outfits, links WORN_ON/PAIRED_WITH edges, and prunes removed outfits without touching non-Closet saves", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `closet-sync-${ts}@curio.local`,
        username: `closet_sync_${ts}`,
      })
      .returning();

    // Seed a non-Closet save (film) to prove pruning never deletes unrelated user saves
    const [filmEntity] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/past-lives-${ts}`,
        urlHash: `hash-pl-${ts}`,
        entityKey: `film:pl:${ts}`,
        coreType: "MEDIA",
        typePath: "/media/film",
        title: "Past Lives",
        coreStructuredData: {},
      })
      .returning();

    await db.insert(userSaves).values({
      userId: user.id,
      entityId: filmEntity.id,
      typePath: "/media/film",
      isPrivateMemo: false,
    });

    let outfitsState = [
      {
        id: 501,
        name: "Autumn Gallery Walk",
        date: "2026-10-14",
        occasion: "Evening",
        weather: "Crisp",
        temp_c: 14,
        cover_path: "/api/media/covers/outfit_501.png",
        items: [
          { id: 101, name: "Olive Linen Overshirt", type: "Outerwear" },
          { id: 102, name: "Ecru Selvedge Jeans", type: "Bottoms" },
        ],
      },
      {
        id: 502,
        name: "Duplicate Outfit To Prune",
        date: "2026-10-15",
        occasion: "Casual",
        cover_path: "/api/media/covers/outfit_502.png",
        items: [{ id: 101, name: "Olive Linen Overshirt", type: "Outerwear" }],
      },
    ];

    const garmentsState = [
      {
        id: 101,
        name: "IMG_8412_olive_linen_overshirt.PNG",
        brand: "Loewe",
        type: "Outerwear",
        color: "Olive",
        material: "100% Linen",
        season: "Autumn",
        wear_count: 7,
        in_laundry: 1,
        cutout_path: "/api/media/cutouts/garment_101.png",
        photo_path: "/api/media/garments/garment_101.jpg",
      },
      {
        id: 102,
        name: "Ecru Selvedge Jeans",
        brand: "OrSlow",
        type: "Bottoms",
        color: "Ecru",
        material: "Cotton Denim",
        wear_count: 12,
        in_laundry: 0,
        cutout_path: "/api/media/cutouts/garment_102.png",
      },
    ];

    const mockClosetFetch = (async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/api/garments")) {
        return new Response(JSON.stringify(garmentsState), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/api/outfits")) {
        return new Response(JSON.stringify(outfitsState), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    }) as typeof fetch;

    // 1. Initial sync: 2 garments + 2 outfits
    const sync1 = await syncClosetWithCurio(user.id, {
      force: true,
      closetApiUrl: "http://127.0.0.1:8710",
      fetchFn: mockClosetFetch,
    });
    expect(sync1.synced).toBe(true);
    expect(sync1.garmentsSynced).toBe(2);
    expect(sync1.outfitsSynced).toBe(2);
    expect(sync1.prunedSaves).toBe(0);
    expect(sync1.connectionsSynced).toBeGreaterThanOrEqual(3); // 2 WORN_ON + 1 PAIRED_WITH on outfit 501

    // Verify garment 101 cutout URL, laundry flag, and cleaned title
    const [garmentEnt101] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.entityKey, "garment:101"));
    expect(garmentEnt101).toBeDefined();
    expect(garmentEnt101.typePath).toBe("/product/garment");
    expect(garmentEnt101.heroImageUrl).toBe("/curio/api/v1/media/closet/cutouts/garment_101.png");
    expect(garmentEnt101.title.toLowerCase()).toContain("olive linen overshirt");
    expect(garmentEnt101.title.toLowerCase()).not.toContain("img_8412");
    expect((garmentEnt101.coreStructuredData as any).inLaundry).toBe(true);
    expect((garmentEnt101.coreStructuredData as any).timesWorn).toBe(7);

    // Verify OutfitCard-compatible structured data on outfit 501
    const [outfitEnt501] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.entityKey, "outfit:501"));
    expect(outfitEnt501).toBeDefined();
    const outfitData501 = outfitEnt501.coreStructuredData as any;
    expect(outfitData501.datesWorn).toEqual(["2026-10-14"]);
    expect(outfitData501.weatherCondition).toBe("Crisp (14°C)");
    expect(outfitData501.items[0].title.toLowerCase()).toContain("olive linen overshirt");
    expect(outfitData501.items[0].photoUrl).toBe("/curio/api/v1/media/closet/cutouts/garment_101.png");
    expect(outfitData501.items[0].category).toBe("Outerwear");

    // Seed entity_sources & entity_price_history on outfit 502 to prove pruning cleans FK dependents safely
    const [outfitEnt502] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.entityKey, "outfit:502"));
    expect(outfitEnt502).toBeDefined();
    const [src502] = await db
      .insert(entitySources)
      .values({
        entityId: outfitEnt502.id,
        sellerName: "Closet",
        sourceUrl: "https://mini.orca-banjo.ts.net/closet/outfit/502",
        urlHash: `hash-502-${ts}`,
      })
      .returning();
    await db.insert(entityPriceHistory).values({
      entityId: outfitEnt502.id,
      sourceId: src502.id,
      sellerName: "Closet",
      priceCents: 0,
      currency: "EUR",
    });

    // Verify WORN_ON & PAIRED_WITH edges exist for user
    const edges = await db
      .select()
      .from(entryConnections)
      .where(eq(entryConnections.userId, user.id));
    expect(edges.some((e) => e.connectionType === "WORN_ON")).toBe(true);
    expect(edges.some((e) => e.connectionType === "PAIRED_WITH")).toBe(true);

    // 2. Simulate closet-ui deduplicating outfit 502; re-sync prunes outfit 502 ONLY
    outfitsState = outfitsState.filter((o) => o.id !== 502);
    const sync2 = await syncClosetWithCurio(user.id, {
      force: true,
      closetApiUrl: "http://127.0.0.1:8710",
      fetchFn: mockClosetFetch,
    });
    expect(sync2.synced).toBe(true);
    expect(sync2.outfitsSynced).toBe(1);
    expect(sync2.prunedSaves).toBe(1);

    const remainingUserSaves = await db
      .select({ save: userSaves, entity: globalEntities })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.userId, user.id));

    // 1 film + 2 garments + 1 remaining outfit = 4 saves
    expect(remainingUserSaves.length).toBe(4);
    expect(remainingUserSaves.some((r) => r.entity?.title === "Past Lives")).toBe(true);
    expect(remainingUserSaves.some((r) => r.entity?.entityKey === "outfit:502")).toBe(false);
  });

  it("writes Curio garment & outfit edits back to Closet UI via PUT and tolerates offline daemon", async () => {
    const putCalls: Array<{ url: string; body: any }> = [];
    const mockPutFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      putCalls.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const okGarment = await syncCurioSaveEditToCloset(
      "garment:101",
      { title: "Olive Linen Overshirt", brandOrCreator: "Loewe", personalNotes: "Dry clean only" },
      { closetApiUrl: "http://127.0.0.1:8710", fetchFn: mockPutFetch }
    );
    expect(okGarment).toBe(true);
    expect(putCalls[0].url).toBe("http://127.0.0.1:8710/api/garments/101");
    expect(putCalls[0].body).toEqual({
      name: "Olive Linen Overshirt",
      brand: "Loewe",
      notes: "Dry clean only",
    });

    const okOutfit = await syncCurioSaveEditToCloset(
      "outfit:501",
      { title: "Autumn Gallery Walk", personalNotes: "Loved this silhouette" },
      { closetApiUrl: "http://127.0.0.1:8710", fetchFn: mockPutFetch }
    );
    expect(okOutfit).toBe(true);
    expect(putCalls[1].url).toBe("http://127.0.0.1:8710/api/outfits/501");

    // Non-closet keys are ignored
    expect(
      await syncCurioSaveEditToCloset(
        "https://example.com/book",
        { title: "Ignored" },
        { fetchFn: mockPutFetch }
      )
    ).toBe(false);

    // Offline Closet daemon returns false without throwing
    const offlineFetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(
      await syncCurioSaveEditToCloset(
        "garment:101",
        { title: "Offline Edit" },
        { fetchFn: offlineFetch }
      )
    ).toBe(false);
  });

  it("throws AudioTranscriptionUnavailableError (HTTP 503) instead of saving fake text when Whisper is offline, and enforces strict auth on protected routes", async () => {
    const offlineWhisperFetch = (async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8080");
    }) as unknown as typeof fetch;

    // 1. Direct transcribeAudio rejects empty buffer and throws AudioTranscriptionUnavailableError when offline
    await expect(
      transcribeAudio(new Uint8Array(0), "audio/webm", { fetchFn: offlineWhisperFetch })
    ).rejects.toThrow("Empty audio payload");

    await expect(
      transcribeAudio(new Uint8Array([1, 2, 3, 4]), "audio/webm", {
        fetchFn: offlineWhisperFetch,
      })
    ).rejects.toBeInstanceOf(AudioTranscriptionUnavailableError);

    // 2. Authenticated POST /api/v1/capture/audio returns 503 (never creates fake save) when Whisper is offline
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `audio-sec-${ts}@curio.local`,
        username: `audio_sec_${ts}`,
      })
      .returning();
    const { token } = await createSession(user.id);

    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array([10, 20, 30])], { type: "audio/webm" }), "memo.webm");
    const prevEndpoint = process.env.WHISPER_URL;
    process.env.WHISPER_URL = "http://127.0.0.1:59999/unavailable";
    try {
      const audioReq = new NextRequest("http://localhost:3000/api/v1/capture/audio", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const audioRes = await POST_AUDIO(audioReq);
      expect(audioRes.status).toBe(503);
      const savesForUser = await db.select().from(userSaves).where(eq(userSaves.userId, user.id));
      expect(savesForUser.length).toBe(0);
    } finally {
      if (prevEndpoint === undefined) delete process.env.WHISPER_URL;
      else process.env.WHISPER_URL = prevEndpoint;
    }

    // 3. Unauthenticated requests to locked-down routes return 401 when strict auth is active
    const unauthHeaders = { "x-strict-auth": "true", "Content-Type": "application/json" };

    const streamRes = await POST_STREAM(
      new NextRequest("http://localhost:3000/api/v1/capture/stream", {
        method: "POST",
        headers: unauthHeaders,
        body: JSON.stringify({ input: "Test" }),
      })
    );
    expect(streamRes.status).toBe(401);

    const connRes = await GET_CONNECTIONS(
      new NextRequest("http://localhost:3000/api/v1/connections?saveId=abc", {
        method: "GET",
        headers: unauthHeaders,
      })
    );
    expect(connRes.status).toBe(401);

    const memRes = await GET_MEMBERSHIPS(
      new NextRequest("http://localhost:3000/api/v1/lists/memberships?saveId=abc", {
        method: "GET",
        headers: unauthHeaders,
      })
    );
    expect(memRes.status).toBe(401);

    const syncRes = await POST_CLOSET_SYNC(
      new NextRequest("http://localhost:3000/api/v1/sync/closet", {
        method: "POST",
        headers: unauthHeaders,
        body: JSON.stringify({ force: true }),
      })
    );
    expect(syncRes.status).toBe(401);

    // 4. Verify strict auth across all 10 additional locked-down routes
    expect(
      (
        await GET_EXPORT(
          new NextRequest("http://localhost:3000/api/v1/export?format=jsonld", {
            headers: unauthHeaders,
          })
        )
      ).status
    ).toBe(401);

    expect(
      (
        await POST_SHARE_TARGET(
          new NextRequest("http://localhost:3000/api/v1/share-target", {
            method: "POST",
            headers: { ...unauthHeaders, Accept: "application/json" },
            body: JSON.stringify({ url: "https://example.com" }),
          })
        )
      ).status
    ).toBe(401);

    const browserShareRes = await POST_SHARE_TARGET(
      new NextRequest("http://localhost:3000/curio/api/v1/share-target", {
        method: "POST",
        headers: { "x-strict-auth": "true", "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    expect(browserShareRes.status).toBe(303);
    expect(browserShareRes.headers.get("Location")).toBe("/curio/?auth=required");

    expect(
      (
        await GET_AUDIT(
          new NextRequest("http://localhost:3000/api/v1/system/audit", {
            headers: unauthHeaders,
          })
        )
      ).status
    ).toBe(401);

    // Non-admin authenticated user gets 403 on system/audit
    expect(
      (
        await GET_AUDIT(
          new NextRequest("http://localhost:3000/api/v1/system/audit", {
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      ).status
    ).toBe(403);

    expect(
      (
        await GET_NODES_EDGES(
          new NextRequest("http://localhost:3000/api/v1/graph/nodes-edges", {
            headers: unauthHeaders,
          })
        )
      ).status
    ).toBe(401);

    expect(
      (
        await GET_CLUSTERS(
          new NextRequest("http://localhost:3000/api/v1/graph/clusters", {
            headers: unauthHeaders,
          })
        )
      ).status
    ).toBe(401);

    expect(
      (
        await GET_SERENDIPITY(
          new NextRequest("http://localhost:3000/api/v1/graph/serendipity", {
            headers: unauthHeaders,
          })
        )
      ).status
    ).toBe(401);

    expect(
      (
        await GET_PATHS(
          new NextRequest("http://localhost:3000/api/v1/graph/paths?sourceSaveId=a&targetSaveId=b", {
            headers: unauthHeaders,
          })
        )
      ).status
    ).toBe(401);

    expect(
      (
        await POST_LAZY_HYDRATE(
          new NextRequest("http://localhost:3000/api/v1/saves/lazy-hydrate", {
            method: "POST",
            headers: unauthHeaders,
            body: JSON.stringify({}),
          })
        )
      ).status
    ).toBe(401);

    expect(
      (
        await POST_CALIBRATE(
          new NextRequest("http://localhost:3000/api/v1/onboarding/calibrate", {
            method: "POST",
            headers: unauthHeaders,
            body: JSON.stringify({ acceptedIds: ["calib-cinema-1"] }),
          })
        )
      ).status
    ).toBe(401);

    // Private board KML & YT-Music export blocked for unauthenticated / non-owner callers
    const [privBoard] = await db
      .insert(smartLists)
      .values({
        userId: user.id,
        title: "Secret Spots",
        slug: `secret-spots-${ts}`,
        visibility: "PRIVATE",
      })
      .returning();

    expect(
      (
        await GET_MYMAPS(
          new NextRequest(
            `http://localhost:3000/api/v1/export/mymaps-kml?boardId=${privBoard.id}`,
            { headers: unauthHeaders }
          )
        )
      ).status
    ).toBe(401);

    expect(
      (
        await POST_YT_MUSIC(
          new NextRequest("http://localhost:3000/api/v1/export/yt-music", {
            method: "POST",
            headers: unauthHeaders,
            body: JSON.stringify({ boardId: privBoard.id }),
          })
        )
      ).status
    ).toBe(401);
  });

  it("wires PATCH /api/v1/saves/[id] end-to-end to Closet UI for garment:<id> and outfit:<id>", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `patch-closet-${ts}@curio.local`,
        username: `patch_closet_${ts}`,
      })
      .returning();
    const { token } = await createSession(user.id);

    const dynamicGarmentId = (ts % 900000) + 100000;
    const [garmentEnt] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://mini.orca-banjo.ts.net/closet/garment/${dynamicGarmentId}-${ts}`,
        urlHash: `hash-g${dynamicGarmentId}-${ts}`,
        entityKey: `garment:${dynamicGarmentId}`,
        coreType: "PRODUCT",
        typePath: "/product/garment",
        title: "Navy Blazer",
        brandOrCreator: "Dries Van Noten",
        coreStructuredData: { inLaundry: false },
      })
      .returning();

    const [garmentSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: garmentEnt.id,
        typePath: "/product/garment",
        personalNotes: "Old note",
      })
      .returning();

    const putPayloads: Array<{ url: string; body: any }> = [];
    const origFetch = globalThis.fetch;
    const prevClosetUrl = process.env.CLOSET_API_URL;
    process.env.CLOSET_API_URL = "http://127.0.0.1:8710";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (u.startsWith("http://127.0.0.1:8710/")) {
        putPayloads.push({
          url: u,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return origFetch(input, init);
    }) as typeof fetch;

    try {
      const patchRes = await PATCH_SAVE(
        new NextRequest(`http://localhost:3000/api/v1/saves/${garmentSave.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: "Structured Navy Blazer",
            personalNotes: "",
            userCustomValues: { inLaundry: true, size: "48" },
          }),
        }),
        { params: Promise.resolve({ id: garmentSave.id }) }
      );
      expect(patchRes.status).toBe(200);
      expect(putPayloads.length).toBe(1);
      expect(putPayloads[0].url).toBe(`http://127.0.0.1:8710/api/garments/${dynamicGarmentId}`);
      expect(putPayloads[0].body).toEqual({
        name: "Structured Navy Blazer",
        notes: "",
        size: "48",
        in_laundry: 1,
      });
    } finally {
      globalThis.fetch = origFetch;
      if (prevClosetUrl === undefined) delete process.env.CLOSET_API_URL;
      else process.env.CLOSET_API_URL = prevClosetUrl;
    }
  });

  it("resolves 'Mimar Granada' on Enter, board-contextual 'Mimar' inside Granada board, EU Maps consent shortlinks, Music/Films auto-rules, and inline-edit Undo state", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `phase2-reg-${ts}@curio.local`,
        username: `phase2_reg_${ts}`,
      })
      .returning();

    const mockGranadaFetch = (async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("wikidata.org") && u.includes("wbsearchentities")) {
        if (u.toLowerCase().includes("granada")) {
          return new Response(JSON.stringify({ search: [] }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            search: [
              {
                id: "Q5600",
                label: "Mimar Sinan",
                description: "chief Ottoman architect (c. 1489–1588)",
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (u.includes("nominatim.openstreetmap.org")) {
        return new Response(
          JSON.stringify([
            {
              osm_type: "node",
              osm_id: 987654,
              lat: "37.1731",
              lon: "-3.5962",
              name: "Mimar",
              class: "amenity",
              type: "bar",
              display_name: "Mimar, Calle San Matías, Centro, Granada, Andalucía, España",
              address: { city: "Granada", country: "España" },
              extratags: { opening_hours: "19:00-02:00" },
            },
          ]),
          { status: 200 }
        );
      }
      if (u.includes("maps.app.goo.gl")) {
        return new Response(
          '<html><body><a href="https://www.google.com/maps/place/Mimar/@37.1731,-3.5962,17z">Continue</a></body></html>',
          { status: 200, headers: { "Content-Type": "text/html" } }
        );
      }
      return new Response("Not found", { status: 404 });
    }) as typeof fetch;

    // 1. Q3 Enter on "Mimar Granada" when Wikidata returns [] -> resolves /place (NOT /product/generic $29)
    const mimarGranada = await enrichCaptureInput("Mimar Granada", {
      queryContext: "Mimar Granada",
      fetchFn: mockGranadaFetch,
    });
    expect(mimarGranada.typePath).toBe("/place");
    expect(mimarGranada.coreType).toBe("PLACE");
    expect(mimarGranada.title).toBe("Mimar");
    expect(mimarGranada.coreStructuredData.city).toBe("Granada");
    expect(mimarGranada.priceCents).toBeNull();

    // 2. Board-contextual "Mimar" inside "Granada" board overrides Wikidata "Mimar Sinan" (/person) -> /place
    const mimarInBoard = await enrichCaptureInput("Mimar", {
      locationHint: "Granada",
      fetchFn: mockGranadaFetch,
    });
    expect(mimarInBoard.typePath).toBe("/place");
    expect(mimarInBoard.title).toBe("Mimar");

    // 3. EU consent HTML Google Maps shortlink resolves place & coordinates
    const mapsExpanded = await routeKnownDomainUrl("https://maps.app.goo.gl/euConsent123", {
      fetchFn: mockGranadaFetch,
    });
    expect(mapsExpanded?.typePath).toBe("/place");
    expect(mapsExpanded?.title).toBe("Mimar");
    expect(mapsExpanded?.coreStructuredData?.latitude).toBeCloseTo(37.1731, 3);

    // 4. Music vs Films smart list isolation + O(1) getUserLists counts
    await db.insert(smartLists).values([
      { userId: user.id, title: "Films", slug: `films-${ts}`, autoRules: { typePathPrefix: "/media/film" } },
      { userId: user.id, title: "Music", slug: `music-${ts}`, autoRules: { typePathPrefix: "/media/music" } },
    ]);
    const [albumEnt] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/omega-${ts}`,
        urlHash: `hash-omega-${ts}`,
        entityKey: `music:omega:${ts}`,
        coreType: "MEDIA",
        typePath: "/media/music/album",
        title: "Omega",
        coreStructuredData: {},
      })
      .returning();
    const [albumSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: albumEnt.id,
        typePath: "/media/music/album",
        personalNotes: "Original note",
        userCustomValues: { rating: 4 },
        isPrivateMemo: false,
      })
      .returning();

    expect(matchesAutoRules(null, { save: albumSave, entity: albumEnt }, "music")).toBe(true);
    expect(matchesAutoRules(null, { save: albumSave, entity: albumEnt }, "films")).toBe(false);

    const userBoards = await getUserLists(user.id);
    expect(userBoards.find((b) => b.slug === `music-${ts}`)?.itemCount).toBe(1);
    expect(userBoards.find((b) => b.slug === `films-${ts}`)?.itemCount).toBe(0);

    // 5. Inline edit returns pre-mutation previousSave AND honors explicit targetSaveId
    const editRes = await executeIngestionCascade({
      input: "Omega: 5 stars",
      userId: user.id,
      targetSaveId: albumSave.id,
      skipLocalLlm: true,
    });
    expect(editRes.status).toBe("edited");
    expect(editRes.previousSave?.personalNotes).toBe("Original note");
    expect((editRes.previousSave?.userCustomValues as any)?.rating).toBe(4);
    expect((editRes.save.userCustomValues as any)?.rating).toBe(5);
  });
});
