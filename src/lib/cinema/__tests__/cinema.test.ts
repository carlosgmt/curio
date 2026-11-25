import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db, globalEntities, smartLists, users, userSaves, type GlobalEntity, type UserSave } from "@/db";
import {
  computeCinemaStats,
  extractFilmDisplayTags,
  toFilmView,
} from "../library";
import { createList, updateBoard } from "@/lib/lists/service";
import { parseLetterboxdCSV } from "@/lib/importers/letterboxd";
import { parseFilmAffinityCSV, parseFilmAffinityHtml } from "@/lib/importers/filmaffinity";
import { upsertFilmAffinityFilms } from "@/lib/sync/filmaffinitySync";
import {
  parseLetterboxdFilmGridHtml,
  syncLetterboxdRss,
  upsertLetterboxdFilms,
} from "@/lib/sync/letterboxdRss";
import { generateEntityKey } from "@/lib/ingest/cascade";

function makeFilmSave(overrides: Partial<UserSave> = {}): UserSave {
  return {
    id: "save-film-1",
    userId: "user-1",
    entityId: "ent-film-1",
    customTypeId: null,
    typeId: null,
    typePath: "/media/film",
    preferredSourceId: null,
    isPrivateMemo: false,
    wishlist: false,
    privateTitle: null,
    personalNotes: "Breathtaking longing and restraint.",
    userCustomValues: {
      watchStatus: "WATCHED",
      rating: 4.5,
      dateWatched: "2026-11-10",
      rewatch: true,
      letterboxdTags: ["theater", "35mm"],
    },
    candidateFallbacks: [],
    autoTags: ["a24", "media", "film"],
    hasConvertedPurchase: false,
    enrichmentStatus: "ENRICHED",
    visibility: "PRIVATE",
    privateEmbedding: null,
    createdAt: "2026-11-10T20:00:00Z",
    ...overrides,
  };
}

function makeFilmEntity(overrides: Partial<GlobalEntity> = {}): GlobalEntity {
  return {
    id: "ent-film-1",
    parentEntityId: null,
    canonicalExternalId: "letterboxd:past-lives",
    identityFingerprint: "fp-film-1",
    brandOrCreator: "Celine Song",
    typePath: "/media/film",
    urlHash: "uh-film-1",
    entityKey: "ek-film-1",
    canonicalUrl: "https://letterboxd.com/film/past-lives/",
    coreType: "FILM",
    title: "Past Lives",
    summary: "Two childhood friends reunite in New York.",
    heroImageUrl: "https://example.com/past-lives.jpg",
    coreStructuredData: {
      director: "Celine Song",
      releaseYear: 2023,
      runtimeMinutes: 106,
      tmdbId: "666277",
    },
    extendedAttributes: {},
    ucpSkuId: null,
    priceCents: null,
    bestPriceCents: null,
    currency: null,
    priceVerifiedAt: null,
    embedding: null,
    createdAt: "2026-11-10T20:00:00Z",
    updatedAt: "2026-11-10T20:00:00Z",
    ...overrides,
  };
}

describe("Personal Cinema helpers & Letterboxd import", () => {
  it("normalizes FilmView, extracts non-noise tags, and computes CinemaStats", () => {
    const watchedSave = makeFilmSave();
    const watchedEntity = makeFilmEntity();
    const watchedView = toFilmView(watchedSave, watchedEntity);

    expect(watchedView.director).toBe("Celine Song");
    expect(watchedView.releaseYear).toBe(2023);
    expect(watchedView.runtimeMinutes).toBe(106);
    expect(watchedView.watchStatus).toBe("WATCHED");
    expect(watchedView.rewatch).toBe(true);
    expect(watchedView.rating).toBe(4.5);
    expect(extractFilmDisplayTags(watchedSave)).toEqual(["theater", "35mm", "a24"]);

    const watchlistSave = makeFilmSave({
      id: "save-film-2",
      entityId: "ent-film-2",
      wishlist: true,
      hasConvertedPurchase: true,
      personalNotes: null,
      userCustomValues: { watchStatus: "WATCHLIST", rating: null },
      autoTags: ["criterion"],
    });
    const watchlistEntity = makeFilmEntity({
      id: "ent-film-2",
      canonicalExternalId: "purchase-hub:bluray-1",
      title: "In the Mood for Love",
      coreStructuredData: {
        director: "Wong Kar-wai",
        releaseYear: 2000,
        runtimeMinutes: 98,
      },
      extendedAttributes: { source: "purchase-hub", retailer: "Criterion" },
    });
    const watchlistView = toFilmView(watchlistSave, watchlistEntity);

    expect(watchlistView.isOwned).toBe(true);
    expect(watchlistView.watchStatus).toBe("WATCHLIST");

    const stats = computeCinemaStats([watchedView, watchlistView]);
    expect(stats.total).toBe(2);
    expect(stats.watchedCount).toBe(1);
    expect(stats.watchlistCount).toBe(1);
    expect(stats.ownedCount).toBe(1);
    expect(stats.totalHoursWatched).toBe(1.8);
    expect(stats.avgRating).toBe(4.5);
  });

  it("parses Letterboxd diary.csv tags, rewatch, review, and watchlist.csv", () => {
    const diaryCsv = [
      "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date,Review",
      '2026-11-12,Stalker,1979,https://boxd.it/123,5,Yes,"35mm, criterion, sci-fi",2026-11-11,"Hypnotic zone cinematography."',
    ].join("\n");

    const diaryRows = parseLetterboxdCSV(diaryCsv);
    expect(diaryRows).toHaveLength(1);
    expect(diaryRows[0].title).toBe("Stalker");
    expect(diaryRows[0].releaseYear).toBe(1979);
    expect(diaryRows[0].rating).toBe(5);
    expect(diaryRows[0].rewatch).toBe(true);
    expect(diaryRows[0].dateWatched).toBe("2026-11-11");
    expect(diaryRows[0].letterboxdTags).toEqual(["35mm", "criterion", "sci-fi"]);
    expect(diaryRows[0].review).toBe("Hypnotic zone cinematography.");
    expect(diaryRows[0].isWatchlist).toBe(false);

    const watchlistCsv = [
      "Date,Name,Year,Letterboxd URI",
      "2026-11-14,Close-Up,1990,https://letterboxd.com/film/close-up/",
    ].join("\n");

    const watchlistRows = parseLetterboxdCSV(watchlistCsv, { isWatchlist: true });
    expect(watchlistRows).toHaveLength(1);
    expect(watchlistRows[0].isWatchlist).toBe(true);
    expect(watchlistRows[0].tags).toContain("watchlist");
  });

  it("deduplicates Letterboxd upserts, promotes watchlist to watched, and preserves owned physical copies", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `cinema-${ts}@curio.local`, username: `cinema_${ts}` })
      .returning();

    const [ownedEnt] = await db
      .insert(globalEntities)
      .values({
        urlHash: `owned-film-${ts}`,
        entityKey: `purchase-hub:film-${ts}`,
        canonicalExternalId: `purchase-hub:film-${ts}`,
        canonicalUrl: `https://example.com/film-${ts}`,
        coreType: "FILM",
        typePath: "/media/film",
        brandOrCreator: "Bong Joon-ho",
        title: "Parasite",
        coreStructuredData: { director: "Bong Joon-ho", releaseYear: 2019 },
        extendedAttributes: { source: "purchase-hub", owned: true },
      })
      .returning();

    const [ownedSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: ownedEnt.id,
        typePath: "/media/film",
        hasConvertedPurchase: true,
        wishlist: false,
        userCustomValues: { owned: true, watchStatus: "WATCHLIST" },
        autoTags: ["4k"],
      })
      .returning();

    // Sync Parasite as watched from Letterboxd (should promote WATCHLIST -> WATCHED, merge tags/review, keep owned)
    const firstRun = await upsertLetterboxdFilms(
      user.id,
      [
        {
          title: "Parasite, 2019",
          filmTitle: "Parasite",
          filmYear: 2019,
          memberRating: 5,
          watchedDate: "2026-11-15",
          rewatch: true,
          isWatchlist: false,
          link: "https://letterboxd.com/film/parasite-2019/",
          canonicalFilmUrl: "https://letterboxd.com/film/parasite-2019/",
          slug: "parasite-2019",
          reviewText: "Sharp architecture and class satire.",
          letterboxdTags: ["criterion", "theater"],
        },
        {
          title: "Close-Up, 1990",
          filmTitle: "Close-Up",
          filmYear: 1990,
          isWatchlist: true,
          link: "https://letterboxd.com/film/close-up/",
          canonicalFilmUrl: "https://letterboxd.com/film/close-up/",
          slug: "close-up",
          letterboxdTags: ["iranian"],
        },
      ],
      { hydrateMissingDirectors: false }
    );

    expect(firstRun.updatedSaves).toBe(1);
    expect(firstRun.createdSaves).toBe(1);
    expect(firstRun.tagsImportedCount).toBe(3);

    const [updatedOwned] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.id, ownedSave.id));
    expect(updatedOwned.hasConvertedPurchase).toBe(true);
    expect(updatedOwned.wishlist).toBe(false);
    expect(updatedOwned.personalNotes).toContain("Sharp architecture");
    const cv = updatedOwned.userCustomValues as Record<string, any>;
    expect(cv.watchStatus).toBe("WATCHED");
    expect(cv.rating).toBe(5);
    expect(cv.rewatch).toBe(true);
    expect(cv.owned).toBe(true);
    expect(cv.letterboxdTags).toEqual(["criterion", "theater"]);
    expect(updatedOwned.autoTags).toEqual(
      expect.arrayContaining(["4k", "criterion", "theater"])
    );

    // Promote Close-Up from Watchlist to Watched on second sync
    const secondRun = await upsertLetterboxdFilms(
      user.id,
      [
        {
          title: "Close-Up, 1990",
          filmTitle: "Close-Up",
          filmYear: 1990,
          memberRating: 4.5,
          watchedDate: "2026-11-18",
          isWatchlist: false,
          link: "https://letterboxd.com/film/close-up/",
          canonicalFilmUrl: "https://letterboxd.com/film/close-up/",
          slug: "close-up",
        },
      ],
      { hydrateMissingDirectors: false }
    );

    expect(secondRun.createdSaves).toBe(0);
    expect(secondRun.updatedSaves).toBe(1);

    const allUserSaves = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    expect(allUserSaves).toHaveLength(2);
    const closeUpSave = allUserSaves.find((s) => s.id !== ownedSave.id)!;
    expect(closeUpSave.wishlist).toBe(false);
    expect((closeUpSave.userCustomValues as Record<string, any>).watchStatus).toBe(
      "WATCHED"
    );
  });

  it("supports 'posters' layout mode on Films boards", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `posters-${ts}@curio.local`, username: `posters_${ts}` })
      .returning();

    const board = await createList(user.id, {
      title: "Films",
      slug: `films-${ts}`,
      defaultLayout: "posters",
      autoRules: { typePathPrefix: "/media/film" },
    });
    expect(board.defaultLayout).toBe("posters");

    const updated = await updateBoard(board.id, { defaultLayout: "grid" }, user.id);
    expect(updated.defaultLayout).toBe("grid");

    const restored = await updateBoard(board.id, { defaultLayout: "posters" }, user.id);
    expect(restored.defaultLayout).toBe("posters");

    const [row] = await db
      .select({ defaultLayout: smartLists.defaultLayout })
      .from(smartLists)
      .where(eq(smartLists.id, board.id));
    expect(row.defaultLayout).toBe("posters");
  });

  it("parses Letterboxd public films & watchlist grids and errors on empty profiles", async () => {
    const filmsHtml = `
      <ul>
        <li class="griditem">
          <div class="react-component" data-item-slug="past-lives" data-item-name="Past Lives (2023)">
            <img src="https://a.ltrbxd.com/past-lives.jpg" alt="Past Lives" />
          </div>
          <p class="poster-viewingdata"><span class="rating rated-9">★★★★½</span></p>
        </li>
      </ul>
      <a class="next" href="/testuser/films/page/2/">Older</a>
    `;
    const parsedGrid = parseLetterboxdFilmGridHtml(filmsHtml);
    expect(parsedGrid.items).toHaveLength(1);
    expect(parsedGrid.items[0].filmTitle).toBe("Past Lives");
    expect(parsedGrid.items[0].filmYear).toBe(2023);
    expect(parsedGrid.items[0].memberRating).toBe(4.5);
    expect(parsedGrid.items[0].isWatchlist).toBe(false);
    expect(parsedGrid.nextPath).toBe("/testuser/films/page/2/");

    const wlGrid = parseLetterboxdFilmGridHtml(
      `<li class="griditem"><div data-item-slug="close-up" data-item-name="Close-Up (1990)"></div></li>`,
      { isWatchlist: true }
    );
    expect(wlGrid.items[0].isWatchlist).toBe(true);

    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `lbempty-${ts}@curio.local`, username: `lbempty_${ts}` })
      .returning();

    const emptyFetch = (async () =>
      new Response("<rss><channel></channel></rss>", { status: 200 })) as unknown as typeof fetch;
    await expect(
      syncLetterboxdRss("emptyuser", user.id, { fetchFn: emptyFetch, hydrateMissingDirectors: false })
    ).rejects.toThrow(/no public films, diary entries, or watchlist items/i);
  });

  it("parses FilmAffinity CSV & saved HTML (1-10 scaled to 0.5-5 stars) and upserts with genres", async () => {
    const csv = [
      "Title,Year,Director,Rating,WatchedDate,Genres,Review,URL",
      '"Volver",2006,"Pedro Almodóvar",9,2026-10-05,"Drama, Comedy","Warm and sharp.","https://www.filmaffinity.com/en/film252216.html"',
    ].join("\n");
    const csvItems = parseFilmAffinityCSV(csv);
    expect(csvItems).toHaveLength(1);
    expect(csvItems[0].filmaffinityId).toBe("252216");
    expect(csvItems[0].director).toBe("Pedro Almodóvar");
    expect(csvItems[0].rating).toBe(4.5);
    expect(csvItems[0].genres).toEqual(["Drama", "Comedy"]);

    const faHtml = `
      <div class="movie-card" data-movie-id="809297">
        <div class="mc-poster"><img src="https://pics.filmaffinity.com/aftersun.jpg" /></div>
        <div class="mc-title"><a href="/en/film809297.html">Aftersun</a> (2022)</div>
        <div class="mc-director">Charlotte Wells</div>
        <div class="ur-mr-rat">8</div>
      </div>
    `;
    const htmlItems = parseFilmAffinityHtml(faHtml);
    expect(htmlItems).toHaveLength(1);
    expect(htmlItems[0].title).toBe("Aftersun");
    expect(htmlItems[0].releaseYear).toBe(2022);
    expect(htmlItems[0].director).toBe("Charlotte Wells");
    expect(htmlItems[0].rating).toBe(4);

    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `fa-${ts}@curio.local`, username: `fa_${ts}` })
      .returning();

    const res = await upsertFilmAffinityFilms(user.id, [...csvItems, ...htmlItems], {
      hydrateMissingMetadata: false,
    });
    expect(res.createdSaves).toBe(2);

    const saved = await db
      .select({ save: userSaves, entity: globalEntities })
      .from(userSaves)
      .innerJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.userId, user.id));
    expect(saved).toHaveLength(2);
    const volver = saved.find((r) => r.entity.title === "Volver")!;
    const volverView = toFilmView(volver.save, volver.entity);
    expect(volverView.sources).toContain("FILMAFFINITY");
    expect(volverView.genres).toEqual(["Drama", "Comedy"]);
    expect(volverView.rating).toBe(4.5);
  });

  it("reuses existing global_entities rows colliding on entity_key across non-film type_path", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `ekey-${ts}@curio.local`, username: `ekey_${ts}` })
      .returning();

    const lbUrl = `https://letterboxd.com/film/dune-part-two-${ts}/`;
    const lbTitle = `Dune Part Two ${ts}`;
    const lbKey = generateEntityKey(lbUrl, lbTitle);
    const [preExistingLb] = await db
      .insert(globalEntities)
      .values({
        urlHash: lbKey.urlHash,
        entityKey: lbKey.entityKey,
        canonicalUrl: lbUrl,
        coreType: "PRODUCT",
        typePath: "/media",
        title: lbTitle,
        coreStructuredData: {},
        extendedAttributes: {},
      })
      .returning();

    const lbRes = await upsertLetterboxdFilms(
      user.id,
      [
        {
          title: lbTitle,
          filmTitle: lbTitle,
          filmYear: 2024,
          memberRating: 4.5,
          isWatchlist: false,
          link: lbUrl,
          canonicalFilmUrl: lbUrl,
          slug: `dune-part-two-${ts}`,
        },
      ],
      { hydrateMissingDirectors: false }
    );
    expect(lbRes.createdEntities).toBe(0);
    expect(lbRes.createdSaves).toBe(1);

    const [upgradedLb] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, preExistingLb.id));
    expect(upgradedLb.typePath).toBe("/media/film");

    const faUrl = `https://www.filmaffinity.com/en/film${ts}.html`;
    const faTitle = `Anatomy of a Fall ${ts}`;
    const faKey = generateEntityKey(faUrl, faTitle);
    const [preExistingFa] = await db
      .insert(globalEntities)
      .values({
        urlHash: faKey.urlHash,
        entityKey: faKey.entityKey,
        canonicalUrl: faUrl,
        coreType: "MEDIA",
        typePath: "/media",
        title: faTitle,
        coreStructuredData: {},
        extendedAttributes: {},
      })
      .returning();

    const faRes = await upsertFilmAffinityFilms(
      user.id,
      [
        {
          filmaffinityId: String(ts),
          title: faTitle,
          releaseYear: 2023,
          director: "Justine Triet",
          rating: 4.5,
          isWatchlist: false,
          canonicalUrl: faUrl,
        },
      ],
      { hydrateMissingMetadata: false }
    );
    expect(faRes.createdEntities).toBe(0);
    expect(faRes.createdSaves).toBe(1);

    const [upgradedFa] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, preExistingFa.id));
    expect(upgradedFa.typePath).toBe("/media/film");
  });
});
