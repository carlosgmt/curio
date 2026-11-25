import type { GlobalEntity, UserSave } from "@/db";
import type { CardData } from "@/components/cards/PolymorphicCard";
import { normalizeDateString } from "@/lib/books/library";

export type WatchStatus = "WATCHLIST" | "WATCHED";

export interface FilmView {
  saveId: string;
  entityId: string | null;
  title: string;
  director: string;
  posterUrl: string | null;
  summary: string | null;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  tmdbId: string | null;
  imdbId: string | null;
  watchStatus: WatchStatus;
  isOwned: boolean;
  rating: number | null;
  dateWatched: string | null;
  rewatch: boolean;
  personalNotes: string | null;
  tags: string[];
  letterboxdTags: string[];
  retailer: string | null;
  canonicalUrl: string;
  createdAt: string;
  card: CardData;
}

export interface CinemaStats {
  total: number;
  watchedCount: number;
  watchlistCount: number;
  ownedCount: number;
  watchedThisYear: number;
  totalHoursWatched: number;
  avgRating: number | null;
  tagCounts: Array<{ tag: string; count: number }>;
}

const INTERNAL_FILM_NOISE_TAGS = new Set([
  "media",
  "film",
  "films",
  "movie",
  "movies",
  "cinema",
  "letterboxd",
  "watchlist",
  "owner:home",
  "owner:personal",
]);

function asRecord(val: unknown): Record<string, any> {
  return val && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, any>)
    : {};
}

export function isOwnedFilm(
  save: Pick<UserSave, "hasConvertedPurchase" | "userCustomValues">,
  entity?: Pick<GlobalEntity, "canonicalExternalId" | "extendedAttributes"> | null
): boolean {
  if (save.hasConvertedPurchase) return true;
  if (entity?.canonicalExternalId?.startsWith("purchase-hub:")) return true;
  const ext = asRecord(entity?.extendedAttributes);
  if (ext.source === "purchase-hub" || Boolean(ext.purchaseHubProductId) || ext.owned === true) {
    return true;
  }
  const cv = asRecord(save.userCustomValues);
  if (cv.owned === true || cv.filmSource === "OWNED") return true;
  return false;
}

export function normalizeWatchStatus(
  save: Pick<UserSave, "wishlist" | "userCustomValues">
): WatchStatus {
  const cv = asRecord(save.userCustomValues);
  const raw = typeof cv.watchStatus === "string" ? cv.watchStatus.trim().toUpperCase() : "";
  if (raw === "WATCHED" || raw === "WATCHLIST") {
    return raw;
  }
  if (save.wishlist && !cv.dateWatched && typeof cv.rating !== "number") {
    return "WATCHLIST";
  }
  if (save.wishlist) {
    return "WATCHLIST";
  }
  return "WATCHED";
}

export function extractFilmDisplayTags(
  save: Pick<UserSave, "autoTags" | "userCustomValues">
): string[] {
  const cv = asRecord(save.userCustomValues);
  const lbTags = Array.isArray(cv.letterboxdTags) ? cv.letterboxdTags : [];
  const autoTags = Array.isArray(save.autoTags) ? save.autoTags : [];

  const seen = new Map<string, string>();
  for (const raw of [...lbTags, ...autoTags]) {
    const clean = String(raw || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (INTERNAL_FILM_NOISE_TAGS.has(key)) continue;
    if (key.startsWith("owner:")) continue;
    if (!seen.has(key)) {
      seen.set(key, clean);
    }
  }
  return [...seen.values()];
}

export function toFilmView(
  save: UserSave,
  entity: GlobalEntity | null
): FilmView {
  const csd = asRecord(entity?.coreStructuredData);
  const ext = asRecord(entity?.extendedAttributes);
  const cv = asRecord(save.userCustomValues);

  const title = (save.privateTitle || entity?.title || "Untitled Film").trim();
  const director = String(
    csd.director || ext.director || entity?.brandOrCreator || "Unknown Director"
  ).trim();

  const rawYear = csd.releaseYear ?? csd.year ?? ext.releaseYear;
  const parsedYear = typeof rawYear === "number" ? rawYear : parseInt(String(rawYear || ""), 10);
  const releaseYear = Number.isFinite(parsedYear) && parsedYear > 1880 ? parsedYear : null;

  const rawRuntime = csd.runtimeMinutes ?? csd.runtime ?? ext.runtimeMinutes;
  const parsedRuntime =
    typeof rawRuntime === "number" ? rawRuntime : parseInt(String(rawRuntime || ""), 10);
  const runtimeMinutes =
    Number.isFinite(parsedRuntime) && parsedRuntime > 0 ? parsedRuntime : null;

  const rawRating = cv.rating ?? cv.myRating ?? csd.rating;
  const parsedRating = typeof rawRating === "number" ? rawRating : parseFloat(String(rawRating || ""));
  const rating =
    Number.isFinite(parsedRating) && parsedRating > 0 && parsedRating <= 5
      ? Math.round(parsedRating * 2) / 2
      : null;

  const dateWatched = normalizeDateString(
    typeof cv.dateWatched === "string" ? cv.dateWatched : null
  );

  const watchStatus = normalizeWatchStatus(save);
  const owned = isOwnedFilm(save, entity);
  const letterboxdTags = Array.isArray(cv.letterboxdTags)
    ? cv.letterboxdTags.map((t) => String(t)).filter(Boolean)
    : [];

  const card: CardData = {
    save: {
      id: save.id,
      isPrivateMemo: save.isPrivateMemo,
      privateTitle: save.privateTitle,
      wishlist: save.wishlist,
      personalNotes: save.personalNotes,
      userCustomValues: save.userCustomValues,
      candidateFallbacks: save.candidateFallbacks,
      typePath: save.typePath,
      autoTags: save.autoTags,
      enrichmentStatus: save.enrichmentStatus,
      createdAt: save.createdAt,
    },
    entity: entity
      ? {
          id: entity.id,
          title: entity.title,
          summary: entity.summary,
          heroImageUrl: entity.heroImageUrl,
          coreType: entity.coreType,
          typePath: entity.typePath,
          brandOrCreator: entity.brandOrCreator,
          canonicalUrl: entity.canonicalUrl,
          priceCents: entity.priceCents,
          currency: entity.currency,
          ucpSkuId: entity.ucpSkuId,
          coreStructuredData: entity.coreStructuredData,
          extendedAttributes: entity.extendedAttributes,
        }
      : null,
  };

  return {
    saveId: save.id,
    entityId: entity?.id ?? null,
    title,
    director,
    posterUrl: entity?.heroImageUrl || null,
    summary: entity?.summary || null,
    releaseYear,
    runtimeMinutes,
    tmdbId: csd.tmdbId ? String(csd.tmdbId) : null,
    imdbId: csd.imdbId ? String(csd.imdbId) : null,
    watchStatus,
    isOwned: owned,
    rating,
    dateWatched,
    rewatch: Boolean(cv.rewatch),
    personalNotes: save.personalNotes || null,
    tags: extractFilmDisplayTags(save),
    letterboxdTags,
    retailer:
      (typeof ext.retailers === "string" && ext.retailers) ||
      (typeof csd.retailer === "string" && csd.retailer) ||
      null,
    canonicalUrl:
      entity?.canonicalUrl ||
      `https://letterboxd.com/search/${encodeURIComponent(title)}/`,
    createdAt: save.createdAt,
    card,
  };
}

export function computeCinemaStats(films: FilmView[]): CinemaStats {
  const currentYear = String(new Date().getFullYear());
  let watchedCount = 0;
  let watchlistCount = 0;
  let ownedCount = 0;
  let watchedThisYear = 0;
  let totalMinutes = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  const tagMap = new Map<string, { label: string; count: number }>();

  for (const film of films) {
    if (film.isOwned) ownedCount++;
    if (film.watchStatus === "WATCHED") {
      watchedCount++;
      if (film.runtimeMinutes) totalMinutes += film.runtimeMinutes;
      if (film.dateWatched?.startsWith(currentYear)) watchedThisYear++;
    } else {
      watchlistCount++;
    }

    if (film.rating !== null) {
      ratingSum += film.rating;
      ratingCount++;
    }

    for (const tag of film.tags) {
      const key = tag.toLowerCase();
      const cur = tagMap.get(key);
      if (cur) cur.count++;
      else tagMap.set(key, { label: tag, count: 1 });
    }
  }

  const tagCounts = [...tagMap.values()]
    .map((v) => ({ tag: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return {
    total: films.length,
    watchedCount,
    watchlistCount,
    ownedCount,
    watchedThisYear,
    totalHoursWatched: Math.round((totalMinutes / 60) * 10) / 10,
    avgRating:
      ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    tagCounts,
  };
}
