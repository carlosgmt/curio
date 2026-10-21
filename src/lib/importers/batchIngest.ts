import { db, globalEntities, userSaves } from "@/db";
import { eq, and } from "drizzle-orm";
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
 * Deterministically hydrates films via TMDB API, iTunes Movie API, or Wikipedia Summary REST API.
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
  try {
    const film = await resolveFilm(title, { yearHint: releaseYear });
    if (film) {
      return {
        posterUrl: film.posterUrl,
        summary: film.summary,
        director: film.director,
        coreStructuredData: film.coreStructuredData,
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
  try {
    const resolved = await resolveBook(title, { authorHint: author, isbnHint: isbn });
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
        entityId = existingEntity.id;
        cacheHitCount++;
      } else {
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

      // Step 4: Idempotent User Save Upsert on (userId, entityId)
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

      const [existingSave] = await db
        .select()
        .from(userSaves)
        .where(and(eq(userSaves.userId, targetUserId), eq(userSaves.entityId, entityId)))
        .limit(1);

      if (existingSave) {
        await db
          .update(userSaves)
          .set({
            userCustomValues: {
              ...((existingSave.userCustomValues as Record<string, any>) || {}),
              ...userCustomValues,
            },
            personalNotes: personalNotes || existingSave.personalNotes,
          })
          .where(eq(userSaves.id, existingSave.id));
      } else {
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
      }

      insertedCount++;
    } catch (err: any) {
      errors.push(`Item ${item.title}: ${err.message || String(err)}`);
    }
  }

  return { insertedCount, cacheHitCount, errors };
}
