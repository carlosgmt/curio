import { and, eq } from "drizzle-orm";
import { db, globalEntities, smartLists, users, userSaves } from "@/db";
import type { ImportedFilmAffinityItem } from "@/lib/importers/filmaffinity";
import { parseFilmAffinityHtml } from "@/lib/importers/filmaffinity";
import { isOwnedFilm } from "@/lib/cinema/library";
import { normalizeDateString } from "@/lib/books/library";
import { resolveFilm } from "@/lib/enrichment/providers/cinema";
import { generateEntityKey } from "@/lib/ingest/cascade";
import { computeIdentityFingerprint } from "@/lib/ingest/resolution";
import { normalizeEntityString } from "@/lib/enrichment/universalDiscovery";
import { ensureHierarchicalBoard } from "./engine";

export class FilmAffinityBlockedError extends Error {
  readonly code = "FILMAFFINITY_CLOUDFLARE_BLOCKED";
  constructor(message: string) {
    super(message);
    this.name = "FilmAffinityBlockedError";
  }
}

function mergeDistinctTags(
  existingTags: string[] | null | undefined,
  incomingTags: string[]
): string[] {
  const seen = new Map<string, string>();
  for (const t of [...(existingTags || []), ...incomingTags]) {
    const clean = String(t || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) seen.set(key, clean);
  }
  return [...seen.values()];
}

export async function upsertFilmAffinityFilms(
  userId: string,
  parsedItems: ImportedFilmAffinityItem[],
  options?: { fetchFn?: typeof fetch; hydrateMissingMetadata?: boolean }
): Promise<{
  fetchedCount: number;
  createdEntities: number;
  createdSaves: number;
  updatedSaves: number;
}> {
  const fetchFn = options?.fetchFn ?? fetch;
  let createdEntities = 0;
  let createdSaves = 0;
  let updatedSaves = 0;
  let hydratedCount = 0;

  const existingFilms = await db
    .select()
    .from(globalEntities)
    .where(eq(globalEntities.typePath, "/media/film"));

  const userFilmSaves = await db
    .select({ entity: globalEntities })
    .from(userSaves)
    .innerJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
    .where(
      and(
        eq(userSaves.userId, userId),
        eq(globalEntities.typePath, "/media/film")
      )
    );
  const userFilmIds = new Set(userFilmSaves.map((r) => r.entity.id));
  const prioritizedFilms = [
    ...userFilmSaves.map((r) => r.entity),
    ...existingFilms.filter((e) => !userFilmIds.has(e.id)),
  ];

  for (const item of parsedItems) {
    const faExtId = item.filmaffinityId ? `filmaffinity:${item.filmaffinityId}` : null;
    const fingerprint = computeIdentityFingerprint("/media/film", item.title, item.director, {
      releaseYear: item.releaseYear,
    });
    const normTitle = normalizeEntityString(item.title);

    let matchedEntity = prioritizedFilms.find((e) => {
      if (faExtId && e.canonicalExternalId === faExtId) return true;
      if (e.canonicalUrl === item.canonicalUrl) return true;
      if (e.identityFingerprint === fingerprint) return true;
      const eCore = (e.coreStructuredData as Record<string, any>) || {};
      if (item.filmaffinityId && String(eCore.filmaffinityId) === item.filmaffinityId) return true;
      const normETitle = normalizeEntityString(e.title);
      const eYear = eCore.releaseYear || eCore.year;
      if (
        normETitle === normTitle &&
        (!item.releaseYear || !eYear || Number(eYear) === item.releaseYear)
      ) {
        return true;
      }
      return false;
    });

    if (!matchedEntity) {
      let posterUrl = item.posterUrl;
      let director = item.director;
      let genres = item.genres || [];
      let runtimeMinutes: number | undefined;
      let summary = item.review ? item.review.slice(0, 240) : `Feature film (${item.releaseYear || "Cinema"})`;

      if (
        options?.hydrateMissingMetadata !== false &&
        (!posterUrl || !director || genres.length === 0) &&
        hydratedCount < 25
      ) {
        hydratedCount++;
        const resolved = await resolveFilm(item.title, {
          yearHint: item.releaseYear,
          creatorHint: director,
          fetchFn,
          timeoutMs: 3500,
        }).catch(() => null);
        if (resolved) {
          posterUrl = posterUrl || resolved.posterUrl;
          director = director || resolved.director;
          runtimeMinutes = resolved.runtimeMinutes;
          if (genres.length === 0 && resolved.genres?.length) genres = resolved.genres;
          if (resolved.summary && !resolved.summary.startsWith("Feature film:")) {
            summary = resolved.summary;
          }
        }
      }

      const { urlHash, entityKey } = generateEntityKey(item.canonicalUrl, item.title);
      const [inserted] = await db
        .insert(globalEntities)
        .values({
          urlHash,
          entityKey,
          canonicalUrl: item.canonicalUrl,
          coreType: "MEDIA",
          typePath: "/media/film",
          canonicalExternalId: faExtId || `filmaffinity:${normTitle.replace(/\s+/g, "-")}`,
          identityFingerprint: fingerprint,
          brandOrCreator: director || null,
          title: item.title,
          summary,
          heroImageUrl: posterUrl || null,
          coreStructuredData: {
            title: item.title,
            ...(director ? { director } : {}),
            ...(item.releaseYear ? { releaseYear: item.releaseYear } : {}),
            ...(runtimeMinutes ? { runtimeMinutes } : {}),
            ...(genres.length > 0 ? { genres } : {}),
            ...(item.filmaffinityId ? { filmaffinityId: item.filmaffinityId } : {}),
            filmaffinityUrl: item.canonicalUrl,
            aliases: [item.title],
          },
          extendedAttributes: {},
          priceCents: 399,
          currency: "USD",
        })
        .returning();

      matchedEntity = inserted;
      existingFilms.push(inserted);
      prioritizedFilms.unshift(inserted);
      createdEntities++;
    } else if (item.genres?.length || item.filmaffinityId) {
      const existingCsd =
        matchedEntity.coreStructuredData && typeof matchedEntity.coreStructuredData === "object"
          ? (matchedEntity.coreStructuredData as Record<string, any>)
          : {};
      const nextGenres = Array.isArray(existingCsd.genres) && existingCsd.genres.length > 0
        ? existingCsd.genres
        : item.genres || [];
      await db
        .update(globalEntities)
        .set({
          ...( !matchedEntity.heroImageUrl && item.posterUrl ? { heroImageUrl: item.posterUrl } : {}),
          ...(!matchedEntity.brandOrCreator && item.director ? { brandOrCreator: item.director } : {}),
          coreStructuredData: {
            ...existingCsd,
            ...(nextGenres.length > 0 ? { genres: nextGenres } : {}),
            ...(item.filmaffinityId ? { filmaffinityId: item.filmaffinityId } : {}),
            filmaffinityUrl: item.canonicalUrl,
          },
          updatedAt: new Date().toISOString(),
        })
        .where(eq(globalEntities.id, matchedEntity.id));
    }

    const [existingSave] = await db
      .select()
      .from(userSaves)
      .where(and(eq(userSaves.userId, userId), eq(userSaves.entityId, matchedEntity.id)))
      .limit(1);

    const existingCv =
      existingSave?.userCustomValues && typeof existingSave.userCustomValues === "object"
        ? (existingSave.userCustomValues as Record<string, any>)
        : {};
    const alreadyOwned = existingSave ? isOwnedFilm(existingSave, matchedEntity) : false;
    const isWishlist = alreadyOwned ? false : Boolean(item.isWatchlist);

    const customVals: Record<string, any> = {
      ...existingCv,
      watchStatus: Boolean(item.isWatchlist) ? "WATCHLIST" : "WATCHED",
      ...(item.filmaffinityId ? { filmaffinityId: item.filmaffinityId } : {}),
      ...(item.filmaffinityRating10 !== undefined
        ? { filmaffinityRating10: item.filmaffinityRating10 }
        : {}),
      ...(item.genres && item.genres.length > 0 ? { genres: item.genres } : {}),
    };
    if (item.rating !== undefined) customVals.rating = item.rating;
    if (item.dateWatched) {
      customVals.dateWatched = normalizeDateString(item.dateWatched) || item.dateWatched;
    }

    const incomingTags = [
      "media",
      "film",
      "filmaffinity",
      ...(item.isWatchlist ? ["watchlist"] : []),
    ];

    if (existingSave) {
      const updatedNotes =
        item.review && !existingSave.personalNotes?.includes(item.review)
          ? existingSave.personalNotes
            ? `${existingSave.personalNotes}\n\n${item.review}`
            : item.review
          : existingSave.personalNotes;

      await db
        .update(userSaves)
        .set({
          wishlist: isWishlist,
          userCustomValues: customVals,
          autoTags: mergeDistinctTags(existingSave.autoTags, incomingTags),
          personalNotes: updatedNotes,
        })
        .where(eq(userSaves.id, existingSave.id));
      updatedSaves++;
    } else {
      await db.insert(userSaves).values({
        userId,
        entityId: matchedEntity.id,
        typePath: "/media/film",
        isPrivateMemo: false,
        wishlist: isWishlist,
        personalNotes: item.review || null,
        userCustomValues: customVals,
        autoTags: mergeDistinctTags([], incomingTags),
        enrichmentStatus: "ENRICHED",
        visibility: "PRIVATE",
      });
      createdSaves++;
    }
  }

  if (parsedItems.length > 0) {
    const boardRes = await ensureHierarchicalBoard(userId, {
      rootSlug: "films",
      rootTitle: "Films",
      rootDefaultLayout: "posters",
      autoRules: { typePathPrefix: "/media/film" },
    });
    await db
      .update(smartLists)
      .set({ defaultLayout: "posters" })
      .where(and(eq(smartLists.id, boardRes.rootId)));
  }

  return {
    fetchedCount: parsedItems.length,
    createdEntities,
    createdSaves,
    updatedSaves,
  };
}

export async function syncFilmAffinityProfile(
  profileInput: string,
  userId: string,
  options?: { fetchFn?: typeof fetch }
): Promise<{
  filmaffinityUserId: string;
  fetchedCount: number;
  createdSaves: number;
  updatedSaves: number;
}> {
  const fetchFn = options?.fetchFn ?? fetch;
  const trimmed = profileInput.trim();
  const idMatch = trimmed.match(/user_id=(\d+)/i) || trimmed.match(/^(\d{4,12})$/);
  const faUserId = idMatch?.[1];
  if (!faUserId) {
    throw new Error(
      "Enter your numeric FilmAffinity user ID or ratings URL (e.g. https://www.filmaffinity.com/en/userratings.php?user_id=123456)."
    );
  }

  const targetUrl = `https://www.filmaffinity.com/en/userratings.php?user_id=${encodeURIComponent(faUserId)}`;
  const res = await fetchFn(targetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Curio/3.2; +https://curio.local)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (res.status === 403 || res.status === 429) {
    throw new FilmAffinityBlockedError(
      "FilmAffinity blocks automated server fetches with Cloudflare protection. Open your FilmAffinity ratings/watchlist page in your browser, save it as HTML (Cmd+S), and upload it under 'Import Saved HTML / CSV'."
    );
  }
  if (!res.ok) {
    throw new Error(`FilmAffinity returned HTTP ${res.status}`);
  }

  const html = await res.text();
  if (/Just a moment|cf-browser-verification|Attention Required/i.test(html)) {
    throw new FilmAffinityBlockedError(
      "FilmAffinity returned a Cloudflare verification challenge. Save the page as HTML (Cmd+S) in your browser and upload it under 'Import Saved HTML / CSV'."
    );
  }

  const parsed = parseFilmAffinityHtml(html);
  if (parsed.length === 0) {
    throw new Error(
      `No public ratings found for FilmAffinity user ${faUserId}. Use 'Import Saved HTML / CSV' to import ratings, reviews, or watchlist pages.`
    );
  }

  const upsertRes = await upsertFilmAffinityFilms(userId, parsed);
  const [freshUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const tokens = (freshUser?.googleSyncTokens as Record<string, any>) || {};
  await db
    .update(users)
    .set({
      googleSyncTokens: {
        ...tokens,
        filmaffinityUserId: faUserId,
        filmaffinityLastSyncedAt: new Date().toISOString(),
        filmaffinityLastError: null,
      },
    })
    .where(eq(users.id, userId));

  return {
    filmaffinityUserId: faUserId,
    fetchedCount: upsertRes.fetchedCount,
    createdSaves: upsertRes.createdSaves,
    updatedSaves: upsertRes.updatedSaves,
  };
}
