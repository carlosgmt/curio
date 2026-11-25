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
  genres?: string[];
}

export interface LetterboxdSyncResult {
  username: string;
  fetchedCount: number;
  watchedCount: number;
  watchlistCount: number;
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

function decodeHtmlAttr(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .trim();
}

/**
 * Parses Letterboxd public HTML grid pages (`/<username>/films/` and `/<username>/watchlist/`)
 * which expose every watched film (with half-star rating `rated-1..10`) and watchlist item.
 */
export function parseLetterboxdFilmGridHtml(
  html: string,
  options?: { isWatchlist?: boolean }
): { items: LetterboxdRssItem[]; nextPath: string | null } {
  const items: LetterboxdRssItem[] = [];
  const seenSlugs = new Set<string>();
  const liRegex = /<li[^>]*class=["'][^"']*(?:griditem|poster-container)[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;

  for (const match of html.matchAll(liRegex)) {
    const block = match[1];
    const slugMatch =
      block.match(/data-item-slug=["']([^"']+)["']/i) ||
      block.match(/data-film-slug=["']([^"']+)["']/i) ||
      block.match(/data-target-link=["']\/(?:[^/]+\/)?film\/([^/"']+)/i);
    if (!slugMatch) continue;
    const slug = slugMatch[1].trim().toLowerCase();
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const rawNameMatch =
      block.match(/data-item-name=["']([^"']+)["']/i) ||
      block.match(/data-film-name=["']([^"']+)["']/i) ||
      block.match(/alt=["']([^"']+)["']/i);
    const rawName = rawNameMatch ? decodeHtmlAttr(rawNameMatch[1]) : slug.replace(/-/g, " ");
    let filmTitle = rawName;
    let filmYear: number | undefined;
    const yearParen = rawName.match(/^(.+?)\s*\((\d{4})\)\s*$/);
    if (yearParen) {
      filmTitle = yearParen[1].trim();
      const y = parseInt(yearParen[2], 10);
      if (y > 1880 && y < 2100) filmYear = y;
    } else {
      const yearAttr = block.match(/data-film-release-year=["'](\d{4})["']/i);
      if (yearAttr) filmYear = parseInt(yearAttr[1], 10);
    }

    const ratedMatch = block.match(/\brated-(\d{1,2})\b/i);
    const memberRating = ratedMatch
      ? Math.max(0.5, Math.min(5, parseInt(ratedMatch[1], 10) / 2))
      : undefined;

    const imgMatch = block.match(/<img[^>]+src=["']([^"']+)["']/i);
    const rawPoster = imgMatch ? decodeHtmlAttr(imgMatch[1]) : undefined;
    const posterUrl =
      rawPoster && !/empty-poster/i.test(rawPoster) ? rawPoster : undefined;

    const canonicalFilmUrl = `https://letterboxd.com/film/${slug}/`;
    items.push({
      title: rawName,
      filmTitle,
      filmYear,
      memberRating,
      isWatchlist: Boolean(options?.isWatchlist),
      link: canonicalFilmUrl,
      canonicalFilmUrl,
      slug,
      posterUrl,
    });
  }

  const nextMatch = html.match(/<a[^>]+class=["'][^"']*\bnext\b[^"']*["'][^>]+href=["']([^"']+)["']/i);
  const nextPath = nextMatch ? decodeHtmlAttr(nextMatch[1]) : null;
  return { items, nextPath };
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

  let resolvedEntityCount = 0;
  const maxInlineHydrations = 25;

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

    const { urlHash, entityKey } = generateEntityKey(item.canonicalFilmUrl, item.filmTitle);

    if (!matchedEntity) {
      const [byEntityKey] = await db
        .select()
        .from(globalEntities)
        .where(eq(globalEntities.entityKey, entityKey))
        .limit(1);
      if (byEntityKey) {
        matchedEntity = byEntityKey;
        prioritizedFilms.unshift(byEntityKey);
      }
    }

    if (!matchedEntity) {
      let posterUrl = item.posterUrl;
      let director: string | undefined;
      let runtimeMinutes: number | undefined;
      let genres: string[] = Array.isArray(item.genres) ? item.genres : [];
      let summary = item.reviewText
        ? item.reviewText.slice(0, 240)
        : `Feature film (${item.filmYear || "Cinema"})`;

      if (
        (!posterUrl || options?.hydrateMissingDirectors !== false) &&
        resolvedEntityCount < maxInlineHydrations
      ) {
        resolvedEntityCount++;
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
          if (Array.isArray(resolved.genres) && resolved.genres.length > 0) {
            genres = resolved.genres;
          }
          if (resolved.summary && !resolved.summary.startsWith("Feature film:")) {
            summary = resolved.summary;
          }
        }
      }

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
            ...(genres.length > 0 ? { genres } : {}),
            ...(item.tmdbId ? { tmdbId: item.tmdbId } : {}),
            letterboxdUrl: item.canonicalFilmUrl,
            aliases: [item.filmTitle],
          },
          extendedAttributes: {},
          priceCents: 399,
          currency: "USD",
        })
        .onConflictDoNothing({ target: globalEntities.entityKey })
        .returning();

      if (inserted) {
        matchedEntity = inserted;
        existingFilms.push(inserted);
        prioritizedFilms.unshift(inserted);
        createdEntities++;
      } else {
        const [existingOnConflict] = await db
          .select()
          .from(globalEntities)
          .where(eq(globalEntities.entityKey, entityKey))
          .limit(1);
        if (!existingOnConflict) {
          throw new Error(`Failed to resolve entity for ${item.filmTitle} (${entityKey})`);
        }
        matchedEntity = existingOnConflict;
        prioritizedFilms.unshift(existingOnConflict);
      }
    }

    if (matchedEntity) {
      const entityPatch: Record<string, unknown> = {};
      if (matchedEntity.typePath !== "/media/film") {
        entityPatch.typePath = "/media/film";
        entityPatch.coreType = "MEDIA";
        matchedEntity.typePath = "/media/film";
        matchedEntity.coreType = "MEDIA";
      }
      if (!matchedEntity.heroImageUrl && item.posterUrl) {
        entityPatch.heroImageUrl = item.posterUrl;
        matchedEntity.heroImageUrl = item.posterUrl;
      }
      if (Object.keys(entityPatch).length > 0) {
        entityPatch.updatedAt = new Date().toISOString();
        await db
          .update(globalEntities)
          .set(entityPatch)
          .where(eq(globalEntities.id, matchedEntity.id));
      }
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
    .replace(/\/(?:rss|films|watchlist)\/?$/i, "")
    .replace(/^@+/, "")
    .split("/")[0]
    .trim();

  if (!cleanUsername) {
    throw new Error("Valid Letterboxd username is required");
  }

  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; Curio/3.2; +https://curio.local)",
    Accept: "application/rss+xml, application/xml, text/xml, text/html, */*",
  };

  // 1. Recent diary/reviews RSS
  const rssUrl = `https://letterboxd.com/${encodeURIComponent(cleanUsername)}/rss/`;
  const rssRes = await fetchFn(rssUrl, { headers });
  if (!rssRes.ok) {
    if (rssRes.status === 404) {
      throw new Error(`Letterboxd user @${cleanUsername} was not found (HTTP 404).`);
    }
    throw new Error(`Letterboxd RSS returned HTTP ${rssRes.status} for @${cleanUsername}`);
  }
  const xmlText = await rssRes.text();
  const rssItems = parseLetterboxdRssXml(xmlText);

  // 2. Full public watched films grid (/films/ + pagination up to 5 pages)
  const fetchPagedGrid = async (
    startPath: string,
    maxPages: number,
    isWatchlist: boolean
  ): Promise<LetterboxdRssItem[]> => {
    const collected: LetterboxdRssItem[] = [];
    let currentPath: string | null = startPath;
    for (let page = 0; page < maxPages && currentPath; page++) {
      const targetUrl = currentPath.startsWith("http")
        ? currentPath
        : `https://letterboxd.com${currentPath.startsWith("/") ? "" : "/"}${currentPath}`;
      try {
        const pageRes = await fetchFn(targetUrl, { headers });
        if (!pageRes.ok) break;
        const html = await pageRes.text();
        const parsed = parseLetterboxdFilmGridHtml(html, { isWatchlist });
        collected.push(...parsed.items);
        currentPath = parsed.nextPath;
      } catch {
        break;
      }
    }
    return collected;
  };

  const [watchedGridItems, watchlistGridItems] = await Promise.all([
    fetchPagedGrid(`/${encodeURIComponent(cleanUsername)}/films/`, 5, false),
    fetchPagedGrid(`/${encodeURIComponent(cleanUsername)}/watchlist/`, 3, true),
  ]);

  // Merge RSS diary entries + watched films + watchlist by slug (watched overrides watchlist)
  const mergedBySlug = new Map<string, LetterboxdRssItem>();
  for (const wl of watchlistGridItems) {
    mergedBySlug.set(wl.slug, wl);
  }
  for (const wf of watchedGridItems) {
    const prev = mergedBySlug.get(wf.slug);
    mergedBySlug.set(wf.slug, {
      ...(prev || wf),
      ...wf,
      isWatchlist: false,
      memberRating: wf.memberRating ?? prev?.memberRating,
      posterUrl: wf.posterUrl || prev?.posterUrl,
    });
  }
  for (const r of rssItems) {
    const prev = mergedBySlug.get(r.slug);
    mergedBySlug.set(r.slug, {
      ...(prev || r),
      ...r,
      isWatchlist: prev && !prev.isWatchlist ? false : r.isWatchlist,
      memberRating: r.memberRating ?? prev?.memberRating,
      posterUrl: r.posterUrl || prev?.posterUrl,
      filmYear: r.filmYear ?? prev?.filmYear,
    });
  }

  const parsedItems = [...mergedBySlug.values()];
  if (parsedItems.length === 0) {
    throw new Error(
      `Connected to @${cleanUsername}, but no public films, diary entries, or watchlist items were found. Check that your Letterboxd profile is public, or use Import History CSV.`
    );
  }

  const upsertRes = await upsertLetterboxdFilms(userId, parsedItems, options);
  const watchedCount = parsedItems.filter((i) => !i.isWatchlist).length;
  const watchlistCount = parsedItems.filter((i) => i.isWatchlist).length;

  return {
    username: cleanUsername,
    fetchedCount: upsertRes.fetchedCount,
    watchedCount,
    watchlistCount,
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
        meta: {
          username: res.username,
          watchedCount: res.watchedCount,
          watchlistCount: res.watchlistCount,
        },
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
