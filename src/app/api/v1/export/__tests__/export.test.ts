import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { GET as exportGet } from "../route";
import { POST as ytMusicPost } from "../yt-music/route";
import { GET as mymapsGet } from "../mymaps-kml/route";
import { POST as clonePost } from "../../lists/[slug]/clone/route";
import { db, users, smartLists, listItems, userSaves, globalEntities } from "@/db";
import { eq } from "drizzle-orm";

describe("Symmetric Data Export & External Ecosystem Connectors (Phase 7 / FR-4.3)", () => {
  it("GET /api/v1/export supports JSON-LD, Markdown ZIP, and Full Portable Backup ZIP", async () => {
    const timestamp = Date.now();

    const [user] = await db
      .insert(users)
      .values({
        email: `export-user-${timestamp}@curio.local`,
        username: `export_${timestamp}`,
        displayName: "Export Curator",
      })
      .returning();

    const [entity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `hash_exp_${timestamp}`,
        entityKey: `key_exp_${timestamp}`,
        canonicalUrl: "https://archival.design/chair",
        coreType: "PRODUCT",
        title: "Eames Lounge Chair",
        coreStructuredData: {},
      })
      .returning();

    await db.insert(userSaves).values({
      userId: user.id,
      entityId: entity.id,
      personalNotes: "Iconic molded plywood and leather lounger.",
      autoTags: ["furniture", "modernist", "eames"],
    });

    // 1. JSON-LD format
    const jsonReq = new NextRequest(
      `http://localhost:3000/api/v1/export?format=jsonld&userId=${user.id}`,
      { headers: { host: "localhost:3000" } }
    );
    const jsonRes = await exportGet(jsonReq);
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers.get("Content-Type")).toContain("application/ld+json");

    const jsonLdData = await jsonRes.json();
    expect(jsonLdData["@type"]).toBe("ItemList");
    expect(jsonLdData.itemListElement.length).toBeGreaterThanOrEqual(1);

    // 2. Markdown ZIP format
    const mdReq = new NextRequest(
      `http://localhost:3000/api/v1/export?format=markdown&userId=${user.id}`
    );
    const mdRes = await exportGet(mdReq);
    expect(mdRes.status).toBe(200);
    expect(mdRes.headers.get("Content-Type")).toBe("application/zip");
    expect(mdRes.headers.get("Content-Disposition")).toContain("curio-markdown-export.zip");
    const mdBuffer = await mdRes.arrayBuffer();
    expect(mdBuffer.byteLength).toBeGreaterThan(100);

    // 3. Full Portable Backup ZIP format
    const zipReq = new NextRequest(
      `http://localhost:3000/api/v1/export?format=zip&userId=${user.id}`
    );
    const zipRes = await exportGet(zipReq);
    expect(zipRes.status).toBe(200);
    expect(zipRes.headers.get("Content-Type")).toBe("application/zip");
    expect(zipRes.headers.get("Content-Disposition")).toContain("curio-backup-");
    const zipBuffer = await zipRes.arrayBuffer();
    expect(zipBuffer.byteLength).toBeGreaterThan(100);
  });

  it("POST /api/v1/export/yt-music exports audio items to YouTube Music playlist payload", async () => {
    const timestamp = Date.now();

    const [user] = await db
      .insert(users)
      .values({
        email: `yt-curator-${timestamp}@curio.local`,
        username: `yt_curator_${timestamp}`,
      })
      .returning();

    const [board] = await db
      .insert(smartLists)
      .values({
        userId: user.id,
        title: "Late Night Vinyl Sessions",
        slug: `late-night-vinyl-${timestamp}`,
      })
      .returning();

    const [vinylEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `hash_yt_${timestamp}`,
        entityKey: `key_yt_${timestamp}`,
        canonicalUrl: "https://open.spotify.com/album/30Rhn9W6s153J9t6wB4rGk",
        coreType: "VINYL",
        title: "A Love Supreme",
        brandOrCreator: "John Coltrane",
        coreStructuredData: {},
      })
      .returning();

    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: vinylEntity.id,
      })
      .returning();

    await db.insert(listItems).values({
      listId: board.id,
      saveId: save.id,
      positionIndex: 0,
    });

    const req = new NextRequest("http://localhost:3000/api/v1/export/yt-music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: board.id }),
    });

    const res = await ytMusicPost(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.trackCount).toBe(1);
    expect(data.tracks[0].title).toBe("A Love Supreme");
    expect(data.tracks[0].artist).toBe("John Coltrane");
    expect(data.tracks[0].searchQuery).toBe("John Coltrane - A Love Supreme");
    expect(data.playlistUrl).toContain("https://music.youtube.com/playlist?list=");
  });

  it("GET /api/v1/export/mymaps-kml generates KML & GeoJSON spatial collections", async () => {
    const timestamp = Date.now();

    const [user] = await db
      .insert(users)
      .values({
        email: `map-curator-${timestamp}@curio.local`,
        username: `map_curator_${timestamp}`,
      })
      .returning();

    const [board] = await db
      .insert(smartLists)
      .values({
        userId: user.id,
        title: "Tokyo Architecture Pilgrimage",
        slug: `tokyo-arch-${timestamp}`,
      })
      .returning();

    const [spotEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `hash_map_${timestamp}`,
        entityKey: `key_map_${timestamp}`,
        canonicalUrl: "https://maps.google.com/?q=Tokyo+Kitte",
        coreType: "PLACE",
        title: "KITTE Marunouchi",
        summary: "Kengo Kuma renovated postal building.",
        extendedAttributes: {
          address: "2-7-2 Marunouchi, Chiyoda-ku, Tokyo",
          latitude: 35.6795,
          longitude: 139.7648,
        },
        coreStructuredData: {},
      })
      .returning();

    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: spotEntity.id,
      })
      .returning();

    await db.insert(listItems).values({
      listId: board.id,
      saveId: save.id,
      positionIndex: 0,
    });

    // 1. KML format
    const kmlReq = new NextRequest(
      `http://localhost:3000/api/v1/export/mymaps-kml?boardId=${board.id}&format=kml`
    );
    const kmlRes = await mymapsGet(kmlReq);
    expect(kmlRes.status).toBe(200);
    expect(kmlRes.headers.get("Content-Type")).toContain("application/vnd.google-earth.kml+xml");

    const kmlText = await kmlRes.text();
    expect(kmlText).toContain("<kml xmlns=");
    expect(kmlText).toContain("<name>KITTE Marunouchi</name>");
    expect(kmlText).toContain("139.7648,35.6795,0");

    // 2. GeoJSON format
    const geoReq = new NextRequest(
      `http://localhost:3000/api/v1/export/mymaps-kml?boardId=${board.id}&format=geojson`
    );
    const geoRes = await mymapsGet(geoReq);
    expect(geoRes.status).toBe(200);
    expect(geoRes.headers.get("Content-Type")).toContain("application/geo+json");

    const geoData = await geoRes.json();
    expect(geoData.type).toBe("FeatureCollection");
    expect(geoData.features.length).toBe(1);
    expect(geoData.features[0].geometry.coordinates).toEqual([139.7648, 35.6795]);
    expect(geoData.features[0].properties.title).toBe("KITTE Marunouchi");
  });

  it("POST /api/v1/lists/[slug]/clone replicates public items into visitor library", async () => {
    const timestamp = Date.now();

    const [curator] = await db
      .insert(users)
      .values({
        email: `clone-curator-${timestamp}@curio.local`,
        username: `curator_clone_${timestamp}`,
      })
      .returning();

    const [visitor] = await db
      .insert(users)
      .values({
        email: `clone-visitor-${timestamp}@curio.local`,
        username: `visitor_clone_${timestamp}`,
      })
      .returning();

    const [board] = await db
      .insert(smartLists)
      .values({
        userId: curator.id,
        title: "Scandinavian Modernist Living",
        slug: `scandi-modern-${timestamp}`,
        visibility: "PUBLIC",
      })
      .returning();

    const [itemEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `hash_clone_${timestamp}`,
        entityKey: `key_clone_${timestamp}`,
        canonicalUrl: "https://iittala.com/aalto-vase",
        coreType: "PRODUCT",
        title: "Alvar Aalto Savoy Vase",
        coreStructuredData: {},
      })
      .returning();

    const [curatorSave] = await db
      .insert(userSaves)
      .values({
        userId: curator.id,
        entityId: itemEntity.id,
        autoTags: ["glassware", "finland", "aalto"],
      })
      .returning();

    await db.insert(listItems).values({
      listId: board.id,
      saveId: curatorSave.id,
      positionIndex: 0,
    });

    const req = new NextRequest(
      `http://localhost:3000/api/v1/lists/${board.slug}/clone`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: visitor.id }),
      }
    );

    const res = await clonePost(req, {
      params: Promise.resolve({ slug: board.slug }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.clonedCount).toBe(1);

    // Verify visitor now has the cloned save
    const [visitorSave] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, visitor.id));

    expect(visitorSave).toBeDefined();
    expect(visitorSave.entityId).toBe(itemEntity.id);
    expect(visitorSave.personalNotes).toContain(`Cloned from @${board.slug}`);
  });
});
