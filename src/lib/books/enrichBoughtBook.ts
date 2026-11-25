import { eq } from "drizzle-orm";
import { db, globalEntities } from "@/db";
import {
  resolveBook,
  searchAppleBooks,
  type BookFetchFn,
} from "@/lib/enrichment/providers/books";
import { cleanCommercialBookTitle } from "./library";

export interface BookSearchCandidate {
  title: string;
  author: string;
  year?: number;
  pageCount?: number;
  isbn?: string;
  publisher?: string;
  coverUrl?: string;
  summary?: string;
  canonicalUrl?: string;
}

function normalizeDedup(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function searchBookCandidates(
  query: string,
  options?: { fetchFn?: BookFetchFn; limit?: number; timeoutMs?: number }
): Promise<BookSearchCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const fetchFn = options?.fetchFn ?? fetch;
  const limit = Math.max(1, Math.min(options?.limit ?? 6, 12));
  const timeoutMs = options?.timeoutMs ?? 3500;

  const olPromise = (async (): Promise<BookSearchCandidate[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
      const res = await fetchFn(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data = await res.json();
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      return docs
        .filter((doc: any) => typeof doc?.title === "string" && doc.title.trim())
        .map((doc: any): BookSearchCandidate => {
          const title = String(doc.title).trim();
          const author =
            (Array.isArray(doc.author_name) && doc.author_name[0]) ||
            "Unknown Author";
          const isbn =
            Array.isArray(doc.isbn) && typeof doc.isbn[0] === "string"
              ? doc.isbn[0]
              : undefined;
          const coverId = typeof doc.cover_i === "number" ? doc.cover_i : undefined;
          const coverUrl = coverId
            ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
            : isbn
            ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
            : undefined;
          const year =
            typeof doc.first_publish_year === "number"
              ? doc.first_publish_year
              : undefined;
          const pageCount =
            typeof doc.number_of_pages_median === "number"
              ? doc.number_of_pages_median
              : undefined;
          const publisher =
            Array.isArray(doc.publisher) && typeof doc.publisher[0] === "string"
              ? doc.publisher[0]
              : undefined;

          return {
            title,
            author: String(author),
            year,
            pageCount,
            isbn,
            publisher,
            coverUrl,
            summary: `By ${author}${year ? ` (${year})` : ""}${publisher ? ` · ${publisher}` : ""}`,
            canonicalUrl: doc.key
              ? `https://openlibrary.org${doc.key}`
              : `https://openlibrary.org/search?q=${encodeURIComponent(title)}`,
          };
        });
    } catch {
      clearTimeout(timer);
      return [];
    }
  })();

  const applePromise = searchAppleBooks(trimmed, {
    limit,
    timeoutMs,
    fetchFn,
  })
    .then((hits) =>
      hits.map((h): BookSearchCandidate => ({
        title: h.title,
        author: h.author,
        year: h.releaseYear,
        pageCount: h.pageCount,
        isbn: h.isbn,
        publisher: h.publisher,
        coverUrl: h.coverUrl,
        summary: h.summary,
        canonicalUrl: h.canonicalUrl,
      }))
    )
    .catch(() => [] as BookSearchCandidate[]);

  const [olHits, appleHits] = await Promise.all([olPromise, applePromise]);

  const byKey = new Map<string, BookSearchCandidate>();
  for (const cand of [...olHits, ...appleHits]) {
    const key = `${normalizeDedup(cand.title)}::${normalizeDedup(cand.author)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, cand);
    } else {
      byKey.set(key, {
        ...existing,
        coverUrl: existing.coverUrl || cand.coverUrl,
        pageCount: existing.pageCount || cand.pageCount,
        isbn: existing.isbn || cand.isbn,
        year: existing.year || cand.year,
        publisher: existing.publisher || cand.publisher,
        summary:
          existing.summary && existing.summary.length > (cand.summary?.length || 0)
            ? existing.summary
            : cand.summary || existing.summary,
      });
    }
  }

  return [...byKey.values()].slice(0, limit);
}

export async function enrichBookEntity(
  entityId: string,
  options?: { fetchFn?: BookFetchFn }
): Promise<{ updated: boolean; entity: typeof globalEntities.$inferSelect | null }> {
  const [entity] = await db
    .select()
    .from(globalEntities)
    .where(eq(globalEntities.id, entityId))
    .limit(1);

  if (!entity) {
    return { updated: false, entity: null };
  }

  const csd =
    entity.coreStructuredData && typeof entity.coreStructuredData === "object"
      ? ({ ...(entity.coreStructuredData as Record<string, any>) })
      : {};
  const ext =
    entity.extendedAttributes && typeof entity.extendedAttributes === "object"
      ? (entity.extendedAttributes as Record<string, any>)
      : {};

  const cleaned = cleanCommercialBookTitle(entity.title);
  const authorHint =
    (typeof csd.author === "string" && csd.author.trim()) ||
    (typeof entity.brandOrCreator === "string" &&
      !/^(amazon|galaxus|provini|google_play|buchhandlung|unknown)/i.test(
        entity.brandOrCreator.trim()
      ) &&
      entity.brandOrCreator.trim()) ||
    cleaned.authorHint ||
    null;

  const rawIsbn =
    (typeof csd.isbn === "string" && csd.isbn.trim()) ||
    (typeof ext.modelNumber === "string" &&
    /^[0-9Xx]{10,13}$/.test(ext.modelNumber.trim())
      ? ext.modelNumber.trim()
      : undefined);

  const resolved = await resolveBook(cleaned.title, {
    authorHint,
    isbnHint: rawIsbn,
    yearHint: typeof csd.year === "number" ? csd.year : undefined,
    fetchFn: options?.fetchFn,
    timeoutMs: 4500,
    requireStrongMatch: !rawIsbn,
  }).catch(() => null);

  if (!resolved) {
    // Still backfill authorHint from title parsing if missing
    if (!entity.brandOrCreator && cleaned.authorHint) {
      const nextCsd = { ...csd, author: csd.author || cleaned.authorHint };
      const [updatedEntity] = await db
        .update(globalEntities)
        .set({
          brandOrCreator: cleaned.authorHint,
          coreStructuredData: nextCsd,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(globalEntities.id, entity.id))
        .returning();
      return { updated: true, entity: updatedEntity };
    }
    return { updated: false, entity };
  }

  const patch: Record<string, unknown> = {};
  const nextCsd = { ...csd };
  let changed = false;

  if (!entity.heroImageUrl && resolved.coverUrl) {
    patch.heroImageUrl = resolved.coverUrl;
    changed = true;
  }
  if (
    (!entity.brandOrCreator ||
      /^(amazon|galaxus|provini|google_play|unknown)/i.test(
        entity.brandOrCreator.trim()
      )) &&
    resolved.author
  ) {
    patch.brandOrCreator = resolved.author;
    changed = true;
  }
  if ((!entity.summary || entity.summary.includes("Location:")) && resolved.summary) {
    patch.summary = resolved.summary;
    changed = true;
  }

  if (!nextCsd.author && resolved.author) {
    nextCsd.author = resolved.author;
    changed = true;
  }
  if (!nextCsd.isbn && (resolved.isbn || rawIsbn)) {
    nextCsd.isbn = resolved.isbn || rawIsbn;
    changed = true;
  }
  if (!nextCsd.pageCount && resolved.pageCount) {
    nextCsd.pageCount = resolved.pageCount;
    changed = true;
  }
  if (!nextCsd.year && resolved.releaseYear) {
    nextCsd.year = resolved.releaseYear;
    changed = true;
  }
  if (!nextCsd.publisher && resolved.publisher) {
    nextCsd.publisher = resolved.publisher;
    changed = true;
  }

  if (!changed) {
    return { updated: false, entity };
  }

  patch.coreStructuredData = nextCsd;
  patch.updatedAt = new Date().toISOString();

  const [updatedEntity] = await db
    .update(globalEntities)
    .set(patch)
    .where(eq(globalEntities.id, entity.id))
    .returning();

  return { updated: true, entity: updatedEntity };
}
