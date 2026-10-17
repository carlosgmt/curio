import { db, globalEntities, userSaves, sqlite } from "@/db";
import { eq, or } from "drizzle-orm";
import { generateEntityKey, getOrCreateDefaultUser } from "../ingest/cascade";
import type { ImportedFilm } from "./letterboxd";
import type { ImportedBook } from "./goodreads";
import type { ImportedBookmark } from "./bookmarks";
import type { ImportedKeepNote, ImportedPlace } from "./takeout";
import { resolveFilm } from "../enrichment/providers/cinema";
import { resolveBook } from "../enrichment/providers/books";

export type AnyImportedItem =
  | ImportedFilm
  | ImportedBook
  | ImportedBookmark
  | ImportedKeepNote
  | ImportedPlace;

/**
 * Deterministically hydrates films via TMDB API or Wikipedia Summary REST API.
 * Unit Economics: $0.00 (zero LLM / SERP calls).
 */
async function hydrateFilmDeterministic(
  title: string,
  releaseYear?: number
): Promise<{
  posterUrl?: string;
  summary?: string;
  director?: string;
  coreStructuredData: Record<string, any>;
}> {
  const tmdbKey = process.env.TMDB_API_KEY;
  if (tmdbKey) {
    try {
      const yearQuery = releaseYear ? `&year=${releaseYear}` : "";
      const tmdbUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(
        title
      )}${yearQuery}`;
      const res = await fetch(tmdbUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = (await res.json()) as any;
        const first = data.results?.[0];
        if (first) {
          const posterUrl = first.poster_path
            ? `https://image.tmdb.org/t/p/w500${first.poster_path}`
            : undefined;
          return {
            posterUrl,
            summary: first.overview,
            coreStructuredData: {
              title: first.title || title,
              releaseYear: first.release_date
                ? parseInt(first.release_date.slice(0, 4), 10)
                : releaseYear,
              tmdbId: first.id,
              voteAverage: first.vote_average,
            },
          };
        }
      }
    } catch {}
  }

  // Fallback to Wikipedia Page Summary REST API
  try {
    const wikiFilm = await resolveFilm(title);
    if (wikiFilm) {
      return {
        posterUrl: wikiFilm.posterUrl,
        summary: wikiFilm.summary,
        director: wikiFilm.director,
        coreStructuredData: wikiFilm.coreStructuredData,
      };
    }
  } catch {}

  return {
    coreStructuredData: { title, releaseYear },
  };
}

/**
 * Deterministically hydrates books via OpenLibrary & Google Books REST APIs.
 * Unit Economics: $0.00 (zero LLM / SERP calls).
 */
async function hydrateBookDeterministic(
  title: string,
  author?: string,
  isbn?: string
): Promise<{
  coverUrl?: string;
  summary?: string;
  author?: string;
  coreStructuredData: Record<string, any>;
}> {
  const query = isbn ? `isbn:${isbn}` : `${title} ${author || ""}`.trim();
  try {
    const resolved = await resolveBook(query);
    if (resolved) {
      return {
        coverUrl: resolved.coverUrl,
        summary: resolved.summary,
        author: resolved.author || author,
        coreStructuredData: resolved.coreStructuredData,
      };
    }
  } catch {}

  return {
    author,
    coreStructuredData: { title, author, isbn },
  };
}

export async function ingestImportedItems(
  items: AnyImportedItem[],
  userId?: string
): Promise<{ insertedCount: number; cacheHitCount: number; errors: string[] }> {
  const targetUserId = userId || (await getOrCreateDefaultUser()).id;
  let insertedCount = 0;
  let cacheHitCount = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      // Step 0: Handle Google Keep Private Memos (Strict Privacy Guarantee)
      if ("isPrivateMemo" in item && item.isPrivateMemo) {
        // Zero outbound network calls. Stored strictly in user_saves.
        await db.insert(userSaves).values({
          userId: targetUserId,
          entityId: null,
          typePath: item.typePath,
          isPrivateMemo: true,
          privateTitle: item.title,
          personalNotes: item.textContent,
          autoTags: item.tags || ["keep", "memo"],
          enrichmentStatus: "LOCAL_ONLY",
          visibility: "PRIVATE",
        });
        insertedCount++;
        continue;
      }

      // Step 1: Canonical Deduplication & Cache Match ($0.00 compute)
      let canonicalUrl = "";
      if ("letterboxdUri" in item && item.letterboxdUri) {
        canonicalUrl = item.letterboxdUri;
      } else if ("url" in item && item.url) {
        canonicalUrl = item.url;
      } else if ("googleMapsUrl" in item && item.googleMapsUrl) {
        canonicalUrl = item.googleMapsUrl;
      } else if ("externalUrl" in item && item.externalUrl) {
        canonicalUrl = item.externalUrl;
      } else if (item.coreType === "BOOK") {
        canonicalUrl = `https://openlibrary.org/search?q=${encodeURIComponent(item.title)}`;
      } else {
        canonicalUrl = `https://curio.local/item/${encodeURIComponent(
          item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        )}`;
      }

      const { urlHash, entityKey } = generateEntityKey(canonicalUrl, item.title);

      // Search existing canonical entity in global_entities
      let existingEntity: any = null;
      if (item.canonicalExternalId) {
        const [byExtId] = await db
          .select()
          .from(globalEntities)
          .where(eq(globalEntities.canonicalExternalId, item.canonicalExternalId))
          .limit(1);
        if (byExtId) existingEntity = byExtId;
      }

      if (!existingEntity) {
        const [byKey] = await db
          .select()
          .from(globalEntities)
          .where(eq(globalEntities.entityKey, entityKey))
          .limit(1);
        if (byKey) existingEntity = byKey;
      }

      let entityId: string;

      if (existingEntity) {
        // Cache Hit! Reuse existing canonical entity
        entityId = existingEntity.id;
        cacheHitCount++;
      } else {
        // Step 2 & 3: Deterministic Hydration for new canonical entities ($0.00 cost)
        let heroImageUrl: string | undefined = undefined;
        let summary: string | undefined = undefined;
        let brandOrCreator: string | undefined = undefined;
        let structuredData: Record<string, any> = {};

        if (item.coreType === "MEDIA") {
          const filmItem = item as ImportedFilm;
          const hydrated = await hydrateFilmDeterministic(
            filmItem.title,
            filmItem.releaseYear
          );
          heroImageUrl = hydrated.posterUrl;
          summary = hydrated.summary;
          brandOrCreator = hydrated.director;
          structuredData = { ...filmItem.coreStructuredData, ...hydrated.coreStructuredData };
        } else if (item.coreType === "BOOK") {
          const bookItem = item as ImportedBook;
          const hydrated = await hydrateBookDeterministic(
            bookItem.title,
            bookItem.author,
            bookItem.isbn
          );
          heroImageUrl = hydrated.coverUrl;
          summary = hydrated.summary;
          brandOrCreator = hydrated.author;
          structuredData = { ...bookItem.coreStructuredData, ...hydrated.coreStructuredData };
        } else if (item.coreType === "PLACE") {
          const placeItem = item as ImportedPlace;
          structuredData = placeItem.coreStructuredData;
          summary = placeItem.address || `Saved Place: ${placeItem.title}`;
        } else if ("heroImageUrl" in item && item.heroImageUrl) {
          heroImageUrl = item.heroImageUrl;
          summary = item.summary;
        }

        const [createdEntity] = await db
          .insert(globalEntities)
          .values({
            urlHash,
            entityKey,
            canonicalUrl,
            coreType: item.coreType,
            typePath: item.typePath,
            canonicalExternalId: item.canonicalExternalId,
            title: item.title,
            summary: summary || "",
            heroImageUrl: heroImageUrl || null,
            brandOrCreator: brandOrCreator || null,
            coreStructuredData: structuredData,
            priceCents: item.coreType === "BOOK" ? 1899 : 399,
            currency: "USD",
          })
          .returning();

        entityId = createdEntity.id;
      }

      // Step 4: Attach new user save with personal metadata
      let personalNotes: string | undefined = undefined;
      let userCustomValues: Record<string, any> = {};
      let autoTags: string[] = [item.coreType.toLowerCase()];

      if ("rating" in item && item.rating !== undefined) {
        userCustomValues.rating = item.rating;
      }
      if ("dateWatched" in item && item.dateWatched) {
        userCustomValues.dateWatched = item.dateWatched;
      }
      if ("myRating" in item && item.myRating !== undefined) {
        userCustomValues.myRating = item.myRating;
      }
      if ("review" in item && item.review) {
        personalNotes = item.review;
      }
      if ("comment" in item && item.comment) {
        personalNotes = item.comment;
      }
      if ("tags" in item && Array.isArray(item.tags)) {
        autoTags = item.tags;
      }

      const enrichmentStatus =
        "enrichmentStatus" in item && item.enrichmentStatus
          ? item.enrichmentStatus
          : "ENRICHED";

      await db.insert(userSaves).values({
        userId: targetUserId,
        entityId,
        typePath: item.typePath,
        isPrivateMemo: false,
        personalNotes: personalNotes || null,
        userCustomValues,
        autoTags,
        enrichmentStatus,
        visibility: "PRIVATE",
      });

      insertedCount++;
    } catch (err: any) {
      errors.push(`Item ${item.title}: ${err.message || String(err)}`);
    }
  }

  return { insertedCount, cacheHitCount, errors };
}
