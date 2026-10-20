import { describe, it, expect } from "bun:test";
import {
  discoverUniversalEntities,
  mapDescriptionToOntology,
  extractYearAndCreator,
  normalizeEntityString,
} from "../universalDiscovery";

describe("Universal Entity Discovery & Ontology Mapper", () => {
  it("maps semantic descriptions correctly across cultural domains", () => {
    expect(mapDescriptionToOntology("2003 film by Isabel Coixet")).toEqual({
      coreType: "MEDIA",
      typePath: "/media/film",
      badgeLabel: "FILM",
    });

    expect(mapDescriptionToOntology("1987 novel by Haruki Murakami")).toEqual({
      coreType: "BOOK",
      typePath: "/product/book",
      badgeLabel: "BOOK",
    });

    expect(mapDescriptionToOntology("1965 song by The Beatles")).toEqual({
      coreType: "MEDIA",
      typePath: "/media/music/song",
      badgeLabel: "SONG",
    });

    expect(mapDescriptionToOntology("1975 studio album by Pink Floyd")).toEqual({
      coreType: "MEDIA",
      typePath: "/media/music/album",
      badgeLabel: "ALBUM",
    });

    expect(mapDescriptionToOntology("Swiss luxury watchmaker and manufacturer")).toEqual({
      coreType: "PRODUCT",
      typePath: "/product/watch",
      badgeLabel: "WATCH",
    });

    expect(mapDescriptionToOntology("Italian red wine from Piedmont")).toEqual({
      coreType: "PRODUCT",
      typePath: "/product/beverage/wine",
      badgeLabel: "WINE",
    });

    expect(mapDescriptionToOntology("comune in Piedmont, Italy")).toEqual({
      coreType: "PLACE",
      typePath: "/place",
      badgeLabel: "PLACE",
    });

    expect(mapDescriptionToOntology("2011 action role-playing video game")).toEqual({
      coreType: "VIDEOGAME",
      typePath: "/media/videogame",
      badgeLabel: "GAME",
    });

    expect(mapDescriptionToOntology("1503 oil painting by Leonardo da Vinci")).toEqual({
      coreType: "PRODUCT",
      typePath: "/product/art",
      badgeLabel: "ART",
    });

    expect(mapDescriptionToOntology("traditional Italian pasta dish")).toEqual({
      coreType: "CULINARY",
      typePath: "/article/recipe",
      badgeLabel: "RECIPE",
    });
  });

  it("extracts release year and creator accurately", () => {
    const film = extractYearAndCreator("2003 film directed by Isabel Coixet");
    expect(film.year).toBe(2003);
    expect(film.creator).toBe("Isabel Coixet");

    const book = extractYearAndCreator("1987 novel by Haruki Murakami");
    expect(book.year).toBe(1987);
    expect(book.creator).toBe("Haruki Murakami");
  });

  it("resolves multilingual 'Mi vida sin mi' to 2003 film candidate using live or mock fetch", async () => {
    const candidates = await discoverUniversalEntities("Mi vida sin mi", { limit: 5 });
    expect(candidates.length).toBeGreaterThan(0);
    const top = candidates[0];
    expect(top.typePath).toBe("/media/film");
    expect(top.badgeLabel).toBe("FILM");
    expect(top.title).toContain("Life Without Me");
  });

  it("discovers cross-type same-name candidates for 'Norwegian Wood'", async () => {
    const candidates = await discoverUniversalEntities("Norwegian Wood", { limit: 6 });
    expect(candidates.length).toBeGreaterThanOrEqual(3);

    const typePaths = candidates.map((c) => c.typePath);
    // Should contain book, song/album, and film
    expect(typePaths).toContain("/product/book");
    expect(typePaths.some((p) => p.startsWith("/media/music") || p === "/media/film")).toBe(true);
  });

  it("discovers cross-type candidates for 'Barolo' (Wine and Place)", async () => {
    const candidates = await discoverUniversalEntities("Barolo", { limit: 6 });
    expect(candidates.length).toBeGreaterThanOrEqual(2);

    const typePaths = candidates.map((c) => c.typePath);
    expect(typePaths).toContain("/product/beverage/wine");
    expect(typePaths).toContain("/place");
  });

  it("invokes ONLY the winning specialist provider (no N-provider fan-out)", async () => {
    const { enrichCaptureInput } = await import("../dispatcher");

    const calledUrls: string[] = [];
    const spyFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      calledUrls.push(urlStr);

      if (urlStr.includes("wikidata.org") || urlStr.includes("wikipedia.org/w/rest.php/v1/search")) {
        // Return simulated candidate where top result is a Book
        return new Response(
          JSON.stringify({
            search: [
              {
                id: "Q751348",
                label: "Norwegian Wood",
                description: "1987 novel by Haruki Murakami",
                concepturi: "http://www.wikidata.org/entity/Q751348",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (urlStr.includes("openlibrary.org")) {
        return new Response(
          JSON.stringify({
            docs: [
              {
                title: "Norwegian Wood",
                author_name: ["Haruki Murakami"],
                first_publish_year: 1987,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const payload = await enrichCaptureInput("Norwegian Wood", { fetchFn: spyFetch as any });
    expect(payload.coreType).toBe("BOOK");
    expect(payload.typePath).toBe("/product/book");

    // OpenLibrary must be called for the winning Book candidate
    expect(calledUrls.some((u) => u.includes("openlibrary.org"))).toBe(true);

    // Film APIs (Wikipedia summary for film) and MusicBrainz must NOT be called!
    expect(calledUrls.some((u) => u.includes("musicbrainz.org"))).toBe(false);
  });

  it("re-hydrates specialist metadata when swapping candidates across types", async () => {
    const { db, users, userSaves, globalEntities } = await import("@/db");
    const { swapCandidateFallback } = await import("../../ingest/disambiguation");

    const [user] = await db
      .insert(users)
      .values({
        email: `swap-test-${Date.now()}@curio.local`,
        username: `swap_user_${Date.now()}`,
      })
      .returning();

    const [initialEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `hash_${Date.now()}`,
        entityKey: `key_${Date.now()}`,
        canonicalUrl: "https://openlibrary.org/works/OL751348W",
        coreType: "BOOK",
        typePath: "/product/book",
        title: "Norwegian Wood",
        summary: "1987 novel by Haruki Murakami",
        coreStructuredData: {},
      })
      .returning();

    const filmFallbackUrl = "https://en.wikipedia.org/wiki/Norwegian_Wood_(film)";
    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: initialEntity.id,
        typePath: "/product/book",
        candidateFallbacks: [
          {
            title: "Norwegian Wood (2010)",
            url: filmFallbackUrl,
            snippet: "2010 film directed by Tran Anh Hung",
            coreType: "MEDIA",
            typePath: "/media/film",
            badgeLabel: "FILM",
          },
        ],
      })
      .returning();

    const swapResult = await swapCandidateFallback(save.id, filmFallbackUrl);
    expect(swapResult.success).toBe(true);
    expect(swapResult.save.typePath).toBe("/media/film");

    // Verify entity was hydrated with /media/film
    const { eq } = await import("drizzle-orm");
    const [newEntity] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, swapResult.save.entityId!));
    expect(swapResult.save.entityId).not.toBe(initialEntity.id);
    expect(newEntity).toBeDefined();
    expect(newEntity.typePath).toBe("/media/film");
  });
});


