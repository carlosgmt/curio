import { db, globalEntities, smartLists, users, userSaves } from "@/db";
import { eq, and } from "drizzle-orm";
import { ensureHierarchicalBoard, type SyncAdapter, type SyncOptions, type SyncRunResult } from "./engine";
import { registerSyncAdapter } from "./registry";
import { generateEntityKey } from "../ingest/cascade";
import { computeIdentityFingerprint } from "../ingest/resolution";
import { normalizeEntityString } from "../enrichment/universalDiscovery";
import { resolveFilm } from "../enrichment/providers/cinema";
import { isOwnedFilm } from "../cinema/library";
import { normalizeDateString } from "../books/library";

export interface LetterboxdRssItem {
  title: string;
  filmTitle: string;
  filmYear?: number;
  memberRating?: number;
  watchedDate?: string;
  rewatch?: boolean;
  isWatchlist?: boolean;
  tmdbId?: string;
  link: string;
  canonicalFilmUrl: string;
  slug: string;
  posterUrl?: string;
  reviewText?: string;
  pubDate?: string;
  letterboxdTags?: string[];
}

export interface LetterboxdSyncResult {
  username: string;
  fetchedCount: number;
  createdEntities: number;
  createdSaves: number;
  updatedSaves: number;
  items: LetterboxdRssItem[];
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .trim();
}

function extractXmlTag(block: string, tagName: string): string | undefined {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const m = block.match(regex);
  if (!m) return undefined;
  return decodeXmlEntities(m[1]);
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

/**
 * Pure XML parser for Letterboxd RSS feed (<item> entries)
 */
export function parseLetterboxdRssXml(xmlText: string): LetterboxdRssItem[] {
  const items: LetterboxdRssItem[] = [];
  const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi);

  for (const match of itemMatches) {
    const block = match[1];
    const rawTitle = extractXmlTag(block, "title") || "";
    const filmTitleTag = extractXmlTag(block, "letterboxd:filmTitle");
    const filmYearTag = extractXmlTag(block, "letterboxd:filmYear");
    const ratingTag = extractXmlTag(block, "letterboxd:memberRating");
    const watchedDateTag = extractXmlTag(block, "letterboxd:watchedDate");
    const rewatchTag = extractXmlTag(block, "letterboxd:rewatch");
    const watchlistTag = extractXmlTag(block, "letterboxd:watchlist");
    const guidTag = extractXmlTag(block, "guid") || "";
    const tmdbId = extractXmlTag(block, "tmdb:movieId");
    const link = extractXmlTag(block, "link") || "";
    const pubDate = extractXmlTag(block, "pubDate");
    const rawDescription = extractXmlTag(block, "description") || "";

    const slugMatch = link.match(/letterboxd\.com\/(?:[^/]+\/)?film\/([^/?#]+)/i);
    if (!filmTitleTag && !slugMatch) continue;

    let filmTitle = filmTitleTag || rawTitle;
    let filmYear = filmYearTag ? parseInt(filmYearTag, 10) : undefined;
    if (!filmTitleTag && rawTitle) {
      const tm =
        rawTitle.match(/^(.+?),\s*(\d{4})(?:\s*-\s*[★½]+)?$/) ||
        rawTitle.match(/^(.+?)\s*\((\d{4})\)$/);
      if (tm) {
        filmTitle = tm[1].trim();
        if (!filmYear) filmYear = parseInt(tm[2], 10);
      }
    }
    if (!filmTitle) continue;

    const slug = slugMatch
      ? slugMatch[1].toLowerCase()
      : filmTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const canonicalFilmUrl = `https://letterboxd.com/film/${slug}/`;

    const memberRating = ratingTag ? parseFloat(ratingTag) : undefined;
    const rewatch = rewatchTag?.toLowerCase() === "yes";
    const isWatchlist =
      watchlistTag?.toLowerCase() === "yes" ||
      guidTag.toLowerCase().includes("watchlist") ||
      link.toLowerCase().includes("/watchlist") ||
      /added .* to their watchlist/i.test(rawDescription);

    const imgMatch = rawDescription.match(/<img[^>]+src=["']([^"']+)["']/i);
    const posterUrl = imgMatch ? imgMatch[1] : undefined;

    const cleanReview = rawDescription
      .replace(/<p>\s*<img[^>]*>\s*<\/p>/gi, "")
      .replace(/<p>\s*Watched on [^<]*<\/p>/gi, "")
      .replace(/<p>[^<]*added [^<]* to their watchlist[^<]*<\/p>/gi, "")
      .replace(/<\/p>\s*<p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();

    items.push({
      title: rawTitle || filmTitle,
      filmTitle,
      filmYear: Number.isFinite(filmYear) ? filmYear : undefined,
      memberRating: Number.isFinite(memberRating) ? memberRating : undefined,
      watchedDate: watchedDateTag || undefined,
      rewatch,
      isWatchlist,
      tmdbId: tmdbId || undefined,
      link: link || canonicalFilmUrl,
      canonicalFilmUrl,
      slug,
      posterUrl,
      reviewText: cleanReview || undefined,
      pubDate,
    });
  }

  return items;
}

export async function upsertLetterboxdFilms(
  userId: string,
  parsedItems: LetterboxdRssItem[],
  options?: { fetchFn?: typeof fetch; hydrateMissingDirectors?: boolean }
): Promise<{
  fetchedCount: number;
  createdEntities: number;
  createdSaves: number;
  updatedSaves: number;
  tagsImportedCount: number;
}> {
  const fetchFn = options?.fetchFn ?? fetch;
  let createdEntities = 0;
  let createdSaves = 0;
  let updatedSaves = 0;
  let tagsImportedCount = 0;

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
    const tmdbExtId = item.tmdbId ? `tmdb:movie:${item.tmdbId}` : null;
    const lbExtId = `letterboxd:${item.slug}${item.filmYear ? `-${item.filmYear}` : ""}`;
    const fingerprint = computeIdentityFingerprint("/media/film", item.filmTitle, undefined, {
      releaseYear: item.filmYear,
    });
    const normItemTitle = normalizeEntityString(item.filmTitle);

    let matchedEntity = prioritizedFilms.find((e) => {
      if (tmdbExtId && e.canonicalExternalId === tmdbExtId) return true;
      if (e.canonicalExternalId === lbExtId) return true;
      if (e.canonicalUrl === item.canonicalFilmUrl) return true;
      if (e.identityFingerprint === fingerprint) return true;
      const eCore = (e.coreStructuredData as Record<string, any>) || {};
      if (item.tmdbId && String(eCore.tmdbId) === String(item.tmdbId)) return true;
      const normETitle = normalizeEntityString(e.title);
      const eYear = eCore.releaseYear || eCore.year;
      if (
        normETitle === normItemTitle &&
        (!item.filmYear || !eYear || Number(eYear) === item.filmYear)
      ) {
        return true;
      }
      return false;
    });

    if (!matchedEntity) {
      let posterUrl = item.posterUrl;
      let director: string | undefined;
      let runtimeMinutes: number | undefined;
      let summary = item.reviewText
        ? item.reviewText.slice(0, 240)
        : `Feature film (${item.filmYear || "Cinema"})`;

      if (!posterUrl || options?.hydrateMissingDirectors !== false) {
        const resolved = await resolveFilm(item.filmTitle, {
          yearHint: item.filmYear,
          tmdbId: item.tmdbId,
          fetchFn,
          timeoutMs: 3500,
        }).catch(() => null);

        if (resolved) {
          posterUrl = posterUrl || resolved.posterUrl;
          director = resolved.director;
          runtimeMinutes = resolved.runtimeMinutes;
          if (resolved.summary && !resolved.summary.startsWith("Feature film:")) {
            summary = resolved.summary;
          }
        }
      }

      const { urlHash, entityKey } = generateEntityKey(item.canonicalFilmUrl, item.filmTitle);
      const [inserted] = await db
        .insert(globalEntities)
        .values({
          urlHash,
          entityKey,
          canonicalUrl: item.canonicalFilmUrl,
          coreType: "MEDIA",
          typePath: "/media/film",
          canonicalExternalId: tmdbExtId || lbExtId,
          identityFingerprint: fingerprint,
          brandOrCreator: director || null,
          title: item.filmTitle,
          summary,
          heroImageUrl: posterUrl || null,
          coreStructuredData: {
            title: item.filmTitle,
            ...(director ? { director } : {}),
            ...(item.filmYear ? { releaseYear: item.filmYear } : {}),
            ...(runtimeMinutes ? { runtimeMinutes } : {}),
            ...(item.tmdbId ? { tmdbId: item.tmdbId } : {}),
            letterboxdUrl: item.canonicalFilmUrl,
            aliases: [item.filmTitle],
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
    } else if (!matchedEntity.heroImageUrl && item.posterUrl) {
      await db
        .update(globalEntities)
        .set({ heroImageUrl: item.posterUrl })
        .where(eq(globalEntities.id, matchedEntity.id));
      matchedEntity.heroImageUrl = item.posterUrl;
    }

    const [existingSave] = await db
      .select()
      .from(userSaves)
      .where(and(eq(userSaves.userId, userId), eq(userSaves.entityId, matchedEntity.id)))
      .limit(1);

    const existingCv =
      existingSave?.userCustomValues &&
      typeof existingSave.userCustomValues === "object"
        ? (existingSave.userCustomValues as Record<string, any>)
        : {};
    const alreadyOwned = existingSave
      ? isOwnedFilm(existingSave, matchedEntity)
      : false;
    const isWishlist = alreadyOwned ? false : Boolean(item.isWatchlist);

    const incomingLbTags = (item.letterboxdTags || [])
      .map((t) => String(t || "").trim().toLowerCase())
      .filter(Boolean);
    const existingLbTags = Array.isArray(existingCv.letterboxdTags)
      ? (existingCv.letterboxdTags as string[])
      : [];
    const combinedLbTags = [
      ...new Set([...existingLbTags, ...incomingLbTags]),
    ];
    tagsImportedCount += incomingLbTags.length;

    const customVals: Record<string, any> = {
      ...existingCv,
      watchStatus: Boolean(item.isWatchlist) ? "WATCHLIST" : "WATCHED",
      ...(combinedLbTags.length > 0 ? { letterboxdTags: combinedLbTags } : {}),
    };
    if (item.memberRating !== undefined) customVals.rating = item.memberRating;
    if (item.watchedDate) {
      customVals.dateWatched = normalizeDateString(item.watchedDate) || item.watchedDate;
    }
    if (item.rewatch) customVals.rewatch = true;

    const incomingTags = [
      "media",
      "film",
      "letterboxd",
      ...(item.isWatchlist ? ["watchlist"] : []),
      ...incomingLbTags,
    ];

    if (existingSave) {
      const updatedNotes =
        item.reviewText && !existingSave.personalNotes?.includes(item.reviewText)
          ? existingSave.personalNotes
            ? `${existingSave.personalNotes}\n\n${item.reviewText}`
            : item.reviewText
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
        personalNotes: item.reviewText || null,
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
    tagsImportedCount,
  };
}

/**
 * Fetches and syncs a user's Letterboxd RSS feed into global_entities and user_saves
 */
export async function syncLetterboxdRss(
  usernameInput: string,
  userId: string,
  options?: { fetchFn?: typeof fetch; hydrateMissingDirectors?: boolean }
): Promise<LetterboxdSyncResult> {
  const fetchFn = options?.fetchFn ?? fetch;
  const cleanUsername = usernameInput
    .trim()
    .replace(/^https?:\/\/(?:www\.)?letterboxd\.com\//i, "")
    .replace(/\/rss\/?$/i, "")
    .replace(/^@+/, "")
    .split("/")[0]
    .trim();

  if (!cleanUsername) {
    throw new Error("Valid Letterboxd username is required");
  }

  const rssUrl = `https://letterboxd.com/${encodeURIComponent(cleanUsername)}/rss/`;
  const res = await fetchFn(rssUrl, {
    headers: {
      "User-Agent": "Curio/3.2 (https://curio.local; live-rss-sync)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  if (!res.ok) {
    throw new Error(`Letterboxd RSS returned HTTP ${res.status} for @${cleanUsername}`);
  }

  const xmlText = await res.text();
  const parsedItems = parseLetterboxdRssXml(xmlText);

  const upsertRes = await upsertLetterboxdFilms(userId, parsedItems, options);

  return {
    username: cleanUsername,
    fetchedCount: upsertRes.fetchedCount,
    createdEntities: upsertRes.createdEntities,
    createdSaves: upsertRes.createdSaves,
    updatedSaves: upsertRes.updatedSaves,
    items: parsedItems,
  };
}

export const letterboxdSyncAdapter: SyncAdapter<
  SyncOptions & { username?: string; hydrateMissingDirectors?: boolean }
> = {
  sourceId: "letterboxd",
  displayName: "Letterboxd RSS (Films)",
  supportsWishlistPromotion: false,
  supportsPruning: false,
  async getStatus(userId: string) {
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const tokens = (u?.googleSyncTokens as Record<string, any>) || {};
    return {
      configured: Boolean(tokens.letterboxdUsername),
      letterboxdUsername: tokens.letterboxdUsername || null,
      lastSyncedAt:
        tokens.letterboxdLastSyncedAt || tokens.lastFeedSyncAt || null,
      lastError: tokens.letterboxdLastError || null,
    };
  },
  async run(userId: string, options): Promise<SyncRunResult> {
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const tokens = (u?.googleSyncTokens as Record<string, any>) || {};
    const username =
      (typeof options?.username === "string" && options.username.trim()) ||
      String(tokens.letterboxdUsername || "").trim();

    if (!username) {
      return {
        sourceId: "letterboxd",
        synced: false,
        skippedReason: "not_configured",
        recordsProcessed: 0,
        createdSaves: 0,
        updatedSaves: 0,
        promotedFromWishlist: 0,
        prunedSaves: 0,
        prunedEntities: 0,
        connectionsSynced: 0,
        boardsCreated: 0,
        digest: "",
        syncedAt: new Date().toISOString(),
      };
    }

    try {
      const res = await syncLetterboxdRss(username, userId, {
        fetchFn: options?.fetchFn as typeof fetch | undefined,
        hydrateMissingDirectors: options?.hydrateMissingDirectors,
      });
      const syncedAt = new Date().toISOString();

      await db
        .update(users)
        .set({
          googleSyncTokens: {
            ...tokens,
            letterboxdUsername: res.username,
            letterboxdLastSyncedAt: syncedAt,
            letterboxdLastError: null,
            lastFeedSyncAt: syncedAt,
          },
        })
        .where(eq(users.id, userId));

      return {
        sourceId: "letterboxd",
        synced: true,
        recordsProcessed: res.fetchedCount,
        createdSaves: res.createdSaves,
        updatedSaves: res.updatedSaves,
        promotedFromWishlist: 0,
        prunedSaves: 0,
        prunedEntities: 0,
        connectionsSynced: 0,
        boardsCreated: 0,
        digest: `lb-${res.username}-${res.fetchedCount}`,
        syncedAt,
        meta: { username: res.username },
      };
    } catch (err: any) {
      await db
        .update(users)
        .set({
          googleSyncTokens: {
            ...tokens,
            letterboxdUsername: username,
            letterboxdLastError: err?.message || "Letterboxd sync failed",
          },
        })
        .where(eq(users.id, userId));
      throw err;
    }
  },
};

registerSyncAdapter(letterboxdSyncAdapter);
