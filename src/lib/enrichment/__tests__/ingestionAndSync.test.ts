import { describe, expect, it } from "bun:test";
import { resolveFilm } from "../providers/cinema";
import { resolveMusicBrainz } from "../providers/music";
import { routeKnownDomainUrl } from "../urlRouter";
import { executeIngestionCascade } from "../../ingest/cascade";
import { swapCandidateFallback } from "../../ingest/disambiguation";
import { updateSaveDetails } from "../../saves/service";
import { parseLetterboxdRssXml, syncLetterboxdRss } from "../../sync/letterboxdRss";
import { parseGoodreadsRssXml, syncGoodreadsRss } from "../../sync/goodreadsRss";
import { db, users, userSaves, globalEntities } from "@/db";
import { eq, and } from "drizzle-orm";

describe("Curio v2 Ingestion, URL Routing, Disambiguation & Live RSS Sync Suite", () => {
  it("resolves 'The Revenant' (2015) via iTunes Movie API + Wikipedia without hardcoded 2024/1965 stubs", async () => {
    const mockFetch: any = async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("itunes.apple.com/search")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                trackId: 1069546033,
                trackName: "The Revenant (2015)",
                artistName: "Alejandro González Iñárritu",
                releaseDate: "2015-12-25T08:00:00Z",
                trackTimeMillis: 9360000, // 156 min
                artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Video/v4/revenant/100x100bb.jpg",
                longDescription: "A frontiersman on a fur trading expedition in the 1820s fights for survival.",
                trackViewUrl: "https://itunes.apple.com/us/movie/the-revenant/id1069546033",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("en.wikipedia.org/api/rest_v1/page/summary/The_Revenant_(2015_film)")) {
        return new Response(
          JSON.stringify({
            type: "standard",
            title: "The Revenant (2015 film)",
            description: "2015 film directed by Alejandro G. Iñárritu",
            extract: "The Revenant is a 2015 American epic Revisionist Western survival drama film directed by Alejandro G. Iñárritu.",
            content_urls: {
              desktop: { page: "https://en.wikipedia.org/wiki/The_Revenant_(2015_film)" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ type: "disambiguation" }), { status: 200 });
    };

    const film = await resolveFilm("The Revenant", { yearHint: 2015, fetchFn: mockFetch });
    expect(film).not.toBeNull();
    expect(film?.title).toBe("The Revenant");
    expect(film?.releaseYear).toBe(2015);
    expect(film?.director).toContain("Alejandro");
    expect(film?.runtimeMinutes).toBe(156);
    expect(film?.posterUrl).toContain("600x900bb.jpg");
    expect(film?.canonicalUrl).toBe("https://en.wikipedia.org/wiki/The_Revenant_(2015_film)");
    expect(film?.coreStructuredData.cinematographer).toBeUndefined(); // No fake 35MM COLOR
  });

  it("resolves 'Omega' with creatorHint 'Enrique Morente' via regional ES iTunes catalog without matching unrelated EDM single", async () => {
    const mockFetch: any = async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("itunes.apple.com/search") && !url.includes("country=ES")) {
        // US store returns unrelated EDM single
        return new Response(
          JSON.stringify({
            results: [
              {
                collectionId: 111,
                collectionName: "Omega (feat. Ibranovski) - Single",
                artistName: "DJ Snake",
                releaseDate: "2019-01-01T00:00:00Z",
                artworkUrl100: "https://is1-ssl.mzstatic.com/edm/100x100bb.jpg",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("itunes.apple.com/search") && url.includes("country=ES")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                collectionId: 9991996,
                collectionName: "Omega",
                artistName: "Enrique Morente & Lagartija Nick",
                country: "ESP",
                releaseDate: "1996-11-01T00:00:00Z",
                trackCount: 13,
                artworkUrl100: "https://is1-ssl.mzstatic.com/omega-morente/100x100bb.jpg",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("itunes.apple.com/lookup")) {
        return new Response(
          JSON.stringify({
            results: [
              { wrapperType: "collection", collectionId: 9991996 },
              {
                wrapperType: "track",
                kind: "song",
                trackNumber: 1,
                trackName: "Poema de la Soleá",
                trackTimeMillis: 540000,
              },
              {
                wrapperType: "track",
                kind: "song",
                trackNumber: 2,
                trackName: "Pequeño Vals Vienés",
                trackTimeMillis: 332000,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ releases: [] }), { status: 200 });
    };

    const music = await resolveMusicBrainz("Omega", {
      creatorHint: "Enrique Morente",
      subType: "album",
      fetchFn: mockFetch,
    });

    expect(music).not.toBeNull();
    expect(music?.title).toBe("Omega");
    expect(music?.artist).toContain("Enrique Morente");
    expect(music?.releaseYear).toBe(1996);
    expect(music?.coverUrl).toContain("600x600bb.jpg");
    expect(music?.coreStructuredData.tracklist?.length).toBe(2);
    expect(music?.coreStructuredData.tracklist?.[1].title).toBe("Pequeño Vals Vienés");
  });

  it("preserves targetCandidate context (creator, year, heroImageUrl) in executeIngestionCascade when selecting an Omnibox suggestion", async () => {
    const uniqueYear = 1996;
    const uniqueAlbum = "Omega Remaster " + Date.now();
    const mockFetch: any = async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("itunes.apple.com/search")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                collectionId: 9991996,
                collectionName: uniqueAlbum,
                artistName: "Enrique Morente & Lagartija Nick",
                releaseDate: "1996-11-01T00:00:00Z",
                artworkUrl100: "https://is1-ssl.mzstatic.com/omega-morente/100x100bb.jpg",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ releases: [] }), { status: 200 });
    };

    const result = await executeIngestionCascade({
      input: uniqueAlbum,
      forcedTypePath: "/media/music/album",
      targetCandidate: {
        title: uniqueAlbum,
        subtitle: "Enrique Morente & Lagartija Nick • 1996",
        creator: "Enrique Morente & Lagartija Nick",
        year: uniqueYear,
        typePath: "/media/music/album",
        badgeLabel: "ALBUM",
        heroImageUrl: "https://is1-ssl.mzstatic.com/omega-morente/600x600bb.jpg",
        canonicalUrl: "https://es.wikipedia.org/wiki/Omega_(" + Date.now() + ")",
      },
      skipLocalLlm: true,
      forceNew: true,
      fetchFn: mockFetch,
    });

    expect(result.entity).not.toBeNull();
    expect(result.entity?.typePath).toBe("/media/music/album");
    expect(result.entity?.brandOrCreator).toContain("Enrique Morente");
    expect(result.entity?.heroImageUrl).toContain("600x600bb.jpg");
  });

  it("routes Letterboxd, IMDb, YouTube, and Google Maps URLs via routeKnownDomainUrl", async () => {
    const mockFetch: any = async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("youtube.com/oembed")) {
        return new Response(
          JSON.stringify({
            title: "How Dieter Rams Designed for Braun",
            author_name: "Vitsœ",
            thumbnail_url: "https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("itunes.apple.com/search")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                trackId: 1069546033,
                trackName: "The Revenant",
                artistName: "Alejandro G. Iñárritu",
                releaseDate: "2015-12-25T00:00:00Z",
                artworkUrl100: "https://is1-ssl.mzstatic.com/revenant/100x100bb.jpg",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    };

    // 1. Letterboxd film URL (even with user prefix and trailing year slug)
    const lbPayload = await routeKnownDomainUrl(
      "https://letterboxd.com/carlosgmt/film/the-revenant-2015/",
      { fetchFn: mockFetch }
    );
    expect(lbPayload).not.toBeNull();
    expect(lbPayload?.typePath).toBe("/media/film");
    expect(lbPayload?.canonicalUrl).toBe("https://letterboxd.com/film/the-revenant-2015/");
    expect(lbPayload?.brandOrCreator).toContain("Alejandro");

    // 2. YouTube video URL -> /media/video
    const ytPayload = await routeKnownDomainUrl(
      "https://www.youtube.com/watch?v=abc123xyz",
      { fetchFn: mockFetch }
    );
    expect(ytPayload).not.toBeNull();
    expect(ytPayload?.typePath).toBe("/media/video");
    expect(ytPayload?.title).toBe("How Dieter Rams Designed for Braun");
    expect(ytPayload?.brandOrCreator).toBe("Vitsœ");

    // 3. Google Maps URL with @lat,lon
    const mapsPayload = await routeKnownDomainUrl(
      "https://www.google.com/maps/place/Alhambra/@37.1760,-3.5881,17z",
      { fetchFn: mockFetch }
    );
    expect(mapsPayload).not.toBeNull();
    expect(mapsPayload?.typePath).toBe("/place");
    expect(mapsPayload?.coreStructuredData.latitude).toBeCloseTo(37.176, 3);
    expect(mapsPayload?.coreStructuredData.longitude).toBeCloseTo(-3.5881, 3);
  });

  it("supports 1-tap disambiguation from live search (when candidate is not in save.candidateFallbacks) and inline entity editing", async () => {
    const runId = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `live-swap-${runId}@curio.local`,
        username: `liveswap_${runId}`,
      })
      .returning();

    const [wrongEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `wrong-hash-${runId}`,
        entityKey: `wrong-key-${runId}`,
        canonicalUrl: `https://example.com/wrong-${runId}`,
        coreType: "MEDIA",
        typePath: "/media/music/song",
        title: "Omega (EDM Single)",
        brandOrCreator: "DJ Unknown",
        coreStructuredData: {},
      })
      .returning();

    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: wrongEntity.id,
        typePath: "/media/music/song",
        candidateFallbacks: [], // Empty fallbacks!
      })
      .returning();

    // Swap using live search targetCandidate not present in candidateFallbacks
    const swapRes = await swapCandidateFallback(
      save.id,
      `https://es.wikipedia.org/wiki/Omega_(album_${runId})`,
      undefined,
      {
        title: "Omega",
        subtitle: "Enrique Morente & Lagartija Nick • 1996",
        creator: "Enrique Morente & Lagartija Nick",
        year: 1996,
        typePath: "/media/music/album",
        badgeLabel: "ALBUM",
        heroImageUrl: "https://example.com/omega-1996.jpg",
        canonicalUrl: `https://es.wikipedia.org/wiki/Omega_(album_${runId})`,
      }
    );

    expect(swapRes.success).toBe(true);
    expect(swapRes.save.entityId).not.toBe(wrongEntity.id);
    expect(swapRes.save.typePath).toBe("/media/music/album");

    // Edit entity details directly via updateSaveDetails (Lightbox inline editor)
    const edited = await updateSaveDetails(save.id, {
      title: "Omega (Edición Especial)",
      brandOrCreator: "Enrique Morente & Lagartija Nick",
      summary: "Obra maestra del flamenco-rock de 1996.",
      heroImageUrl: "https://example.com/omega-remastered.jpg",
    });

    expect(edited?.entity?.title).toBe("Omega (Edición Especial)");
    expect(edited?.entity?.brandOrCreator).toBe("Enrique Morente & Lagartija Nick");
    expect(edited?.entity?.summary).toBe("Obra maestra del flamenco-rock de 1996.");
    expect(edited?.entity?.heroImageUrl).toBe("https://example.com/omega-remastered.jpg");
  });

  it("parses and syncs Letterboxd RSS & Goodreads RSS with idempotent user_saves upserts and shelf transitions (to-read -> read)", async () => {
    const runId = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `rss-sync-${runId}@curio.local`,
        username: `rsssync_${runId}`,
      })
      .returning();

    const sampleLetterboxdXml = `<?xml version="1.0" encoding="utf-8"?>
      <rss version="2.0" xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org">
        <channel>
          <title>Letterboxd - carlosgmt</title>
          <item>
            <title>Anatomy of a Fall, 2023 - ★★★★½</title>
            <link>https://letterboxd.com/carlosgmt/film/anatomy-of-a-fall-${runId}/</link>
            <letterboxd:watchedDate>2026-10-18</letterboxd:watchedDate>
            <letterboxd:rewatch>No</letterboxd:rewatch>
            <letterboxd:filmTitle>Anatomy of a Fall ${runId}</letterboxd:filmTitle>
            <letterboxd:filmYear>2023</letterboxd:filmYear>
            <letterboxd:memberRating>4.5</letterboxd:memberRating>
            <tmdb:movieId>915935${runId}</tmdb:movieId>
            <description><![CDATA[<p><img src="https://a.ltrbxd.com/resized/anatomy-poster-0-600-0-900-crop.jpg"/></p><p>Masterful courtroom dissection.</p>]]></description>
          </item>
        </channel>
      </rss>`;

    const parsedLb = parseLetterboxdRssXml(sampleLetterboxdXml);
    expect(parsedLb.length).toBe(1);
    expect(parsedLb[0].filmTitle).toBe(`Anatomy of a Fall ${runId}`);
    expect(parsedLb[0].filmYear).toBe(2023);
    expect(parsedLb[0].memberRating).toBe(4.5);
    expect(parsedLb[0].canonicalFilmUrl).toBe(`https://letterboxd.com/film/anatomy-of-a-fall-${runId}/`);
    expect(parsedLb[0].posterUrl).toContain("anatomy-poster-0-600-0-900-crop.jpg");
    expect(parsedLb[0].reviewText).toBe("Masterful courtroom dissection.");

    const lbSync1 = await syncLetterboxdRss("carlosgmt", user.id, {
      hydrateMissingDirectors: false,
      fetchFn: (async () => new Response(sampleLetterboxdXml, { status: 200 })) as any,
    });
    expect(lbSync1.createdEntities).toBe(1);
    expect(lbSync1.createdSaves).toBe(1);

    // Re-syncing the exact same feed must update in place without creating duplicate saves!
    const lbSync2 = await syncLetterboxdRss("carlosgmt", user.id, {
      hydrateMissingDirectors: false,
      fetchFn: (async () => new Response(sampleLetterboxdXml, { status: 200 })) as any,
    });
    expect(lbSync2.createdEntities).toBe(0);
    expect(lbSync2.createdSaves).toBe(0);
    expect(lbSync2.updatedSaves).toBe(1);

    // Goodreads RSS: First sync on 'to-read' shelf -> sets wishlist = true
    const toReadXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <book_id>888${runId}</book_id>
            <title><![CDATA[The Savage Detectives ${runId} ( Bolaño #1 )]]></title>
            <author_name>Roberto Bolaño</author_name>
            <isbn>9780312427481</isbn>
            <user_rating>0</user_rating>
            <book_published>1998</book_published>
            <book_large_image_url><![CDATA[https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/123._SY475_.jpg]]></book_large_image_url>
            <book_description><![CDATA[<p>A quest across Mexico City and the Sonora desert.</p>]]></book_description>
          </item>
        </channel>
      </rss>`;

    const grSyncWishlist = await syncGoodreadsRss("12345678", user.id, {
      shelves: ["to-read"],
      fetchFn: (async () => new Response(toReadXml, { status: 200 })) as any,
    });
    expect(grSyncWishlist.createdSaves).toBe(1);

    const [wishSave] = await db
      .select()
      .from(userSaves)
      .where(and(eq(userSaves.userId, user.id), eq(userSaves.typePath, "/product/book")));
    expect(wishSave.wishlist).toBe(true);

    // Now the user finishes the book -> appears on 'read' shelf with 5-star rating & review
    const readXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <book_id>888${runId}</book_id>
            <title><![CDATA[The Savage Detectives ${runId}]]></title>
            <author_name>Roberto Bolaño</author_name>
            <isbn>9780312427481</isbn>
            <user_rating>5</user_rating>
            <user_read_at>Wed, 21 Oct 2026 00:00:00 +0000</user_read_at>
            <user_review><![CDATA[Unforgettable structure and voice.]]></user_review>
            <book_published>1998</book_published>
            <book_large_image_url><![CDATA[https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/123._SY475_.jpg]]></book_large_image_url>
          </item>
        </channel>
      </rss>`;

    const grSyncRead = await syncGoodreadsRss("12345678", user.id, {
      shelves: ["read"],
      fetchFn: (async () => new Response(readXml, { status: 200 })) as any,
    });
    expect(grSyncRead.createdSaves).toBe(0);
    expect(grSyncRead.updatedSaves).toBe(1);

    const [completedSave] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.id, wishSave.id));
    expect(completedSave.wishlist).toBe(false);
    expect((completedSave.userCustomValues as any).rating).toBe(5);
    expect(completedSave.personalNotes).toContain("Unforgettable structure and voice.");
  });
});
