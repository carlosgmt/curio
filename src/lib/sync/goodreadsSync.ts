import { db, globalEntities, smartLists, userSaves } from "@/db";
import { and, eq } from "drizzle-orm";
import { ensureHierarchicalBoard } from "./engine";
import { generateEntityKey } from "../ingest/cascade";
import { computeIdentityFingerprint } from "../ingest/resolution";
import { normalizeEntityString } from "../enrichment/universalDiscovery";
import { resolveBook } from "../enrichment/providers/books";
import {
  cleanCommercialBookTitle,
  isOwnedBook,
  normalizeDateString,
  normalizeReadingStatus,
  readingStatusToShelf,
} from "../books/library";

export type GoodreadsShelf = "read" | "currently-reading" | "to-read";

export class GoodreadsAuthExpiredError extends Error {
  constructor(message = "Goodreads session cookie is missing or expired. Paste a fresh cookie from goodreads.com.") {
    super(message);
    this.name = "GoodreadsAuthExpiredError";
  }
}

export interface GoodreadsBookItem {
  bookId: string;
  title: string;
  author: string;
  isbn?: string;
  isbn13?: string;
  userRating?: number;
  userReadAt?: string;
  userDateAdded?: string;
  userReview?: string;
  privateNotes?: string;
  bookPublished?: number;
  numPages?: number;
  coverUrl?: string;
  bookDescription?: string;
  publisher?: string;
  link: string;
  shelf: GoodreadsShelf;
  customShelves: string[];
  ownedCopies?: number;
}

export interface GoodreadsUpsertResult {
  fetchedCount: number;
  createdEntities: number;
  createdSaves: number;
  updatedSaves: number;
  mergedWithOwned: number;
  tagsImportedCount: number;
}

const EXCLUSIVE_SHELVES = new Set(["read", "currently-reading", "to-read"]);

const GOODREADS_STAR_TITLE_MAP: Record<string, number> = {
  "it was amazing": 5,
  "really liked it": 4,
  "liked it": 3,
  "it was ok": 2,
  "did not like it": 1,
};

export function parseGoodreadsUserId(input: string): string {
  const trimmed = input.trim();
  const m =
    trimmed.match(/list_rss\/(\d+)/i) ||
    trimmed.match(/review\/list\/(\d+)/i) ||
    trimmed.match(/user\/show\/(\d+)/i) ||
    trimmed.match(/^(\d+)/);
  return m ? m[1] : trimmed;
}

export function upgradeGoodreadsCoverUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  if (rawUrl.includes("nophoto")) return undefined;
  return rawUrl
    .replace(/\._S[XY]\d+_\./i, ".")
    .replace(/\._S[XY]\d+_S[XY]\d+_\./i, ".");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)))
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

function extractTdByField(rowHtml: string, fieldName: string): string {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = rowHtml.match(
    new RegExp(`<td\\b[^>]*class="[^"]*\\bfield\\b[^"]*\\b${escaped}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/td>`, "i")
  );
  return m ? m[1] : "";
}

function normalizeGoodreadsAuthor(rawAuthor: string): string {
  const clean = rawAuthor.replace(/\s*\*$/, "").replace(/\s+/g, " ").trim();
  if (!clean) return "Unknown Author";
  // Goodreads table author column formats names as "Last, First"
  const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2 && !/^(jr\.?|sr\.?|iii?|iv)$/i.test(parts[1])) {
    return `${parts[1]} ${parts[0]}`.trim();
  }
  return clean;
}

function normalizeGoodreadsShelvesList(rawShelves: string[]): string[] {
  const seen = new Map<string, string>();
  for (const s of rawShelves) {
    const clean = decodeHtmlEntities(s).replace(/^#+/, "").trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (EXCLUSIVE_SHELVES.has(lower)) continue;
    if (!seen.has(lower)) {
      seen.set(lower, lower);
    }
  }
  return [...seen.values()];
}

function isGoodreadsSignInHtml(html: string): boolean {
  const lower = html.toLowerCase();
  if (lower.includes("<title>sign in") || lower.includes("<title>goodreads sign in")) {
    return true;
  }
  if (lower.includes('name="signin"') || lower.includes('id="ap_email"') || lower.includes('action="/ap/signin"')) {
    return true;
  }
  if (lower.includes("/user/sign_in") && !lower.includes("bookalike review")) {
    return true;
  }
  return false;
}

export function parseGoodreadsShelfHtml(
  html: string,
  shelf: GoodreadsShelf = "read"
): { items: GoodreadsBookItem[]; hasNextPage: boolean } {
  if (!html || isGoodreadsSignInHtml(html)) {
    throw new GoodreadsAuthExpiredError();
  }

  const items: GoodreadsBookItem[] = [];
  const rowRegex = /<tr\b[^>]*class="[^"]*\bbookalike\b[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const match of html.matchAll(rowRegex)) {
    const rowHtml = match[1];

    const titleTd = extractTdByField(rowHtml, "title");
    if (!titleTd) continue;

    const bookHrefMatch = titleTd.match(/href="([^"]*\/book\/show\/(\d+)[^"]*)"/i);
    const bookId = bookHrefMatch ? bookHrefMatch[2] : "";
    const anchorInnerMatch = titleTd.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
    const rawTitle = anchorInnerMatch ? stripTags(anchorInnerMatch[1]) : stripTags(titleTd);
    if (!rawTitle) continue;

    const cleanTitle =
      rawTitle.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/g, "").trim() || rawTitle;

    const authorTd = extractTdByField(rowHtml, "author");
    const authorAnchor = authorTd.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
    const author = normalizeGoodreadsAuthor(
      authorAnchor ? stripTags(authorAnchor[1]) : stripTags(authorTd)
    );

    const coverTd = extractTdByField(rowHtml, "cover");
    const coverSrcMatch = coverTd.match(/<img\b[^>]*src="([^"]+)"/i);
    const coverUrl = upgradeGoodreadsCoverUrl(
      coverSrcMatch ? decodeHtmlEntities(coverSrcMatch[1]) : undefined
    );

    const isbnTd = extractTdByField(rowHtml, "isbn");
    const isbn13Td = extractTdByField(rowHtml, "isbn13");
    const isbn10Match = stripTags(isbnTd).match(/\b([0-9Xx]{10})\b/);
    const isbn13Match = stripTags(isbn13Td).match(/\b(97[89][0-9]{10})\b/);
    const isbn13 = isbn13Match?.[1];
    const isbn = isbn13 || isbn10Match?.[1];

    const pagesTd = extractTdByField(rowHtml, "num_pages");
    const pagesMatch = stripTags(pagesTd).match(/(\d{1,5})/);
    const numPages = pagesMatch ? parseInt(pagesMatch[1], 10) : undefined;

    const ratingTd = extractTdByField(rowHtml, "rating");
    let userRating: number | undefined;
    const dataRatingMatch = ratingTd.match(/data-rating="(\d)"/i);
    if (dataRatingMatch) {
      const r = parseInt(dataRatingMatch[1], 10);
      if (r >= 1 && r <= 5) userRating = r;
    }
    if (!userRating) {
      const starHits = ratingTd.match(/class="[^"]*\bstaticStar\b[^"]*\bp10\b[^"]*"/gi);
      if (starHits && starHits.length >= 1 && starHits.length <= 5) {
        userRating = starHits.length;
      }
    }
    if (!userRating) {
      const titleRatingMatch = ratingTd.match(/class="[^"]*staticStars[^"]*"[^>]*title="([^"]+)"/i);
      if (titleRatingMatch) {
        const mapped = GOODREADS_STAR_TITLE_MAP[titleRatingMatch[1].trim().toLowerCase()];
        if (mapped) userRating = mapped;
      }
    }

    const shelvesTd = extractTdByField(rowHtml, "shelves");
    const shelfAnchors = [...shelvesTd.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map(
      (m) => stripTags(m[1])
    );
    const customShelves = normalizeGoodreadsShelvesList(shelfAnchors);

    const dateReadTd = extractTdByField(rowHtml, "date_read");
    const rawDateRead = stripTags(
      dateReadTd.replace(/<span[^>]*class="[^"]*date_read_label[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "")
    );
    const cleanDateRead =
      rawDateRead && !/^not set$/i.test(rawDateRead)
        ? normalizeDateString(rawDateRead) || undefined
        : undefined;

    const dateAddedTd = extractTdByField(rowHtml, "date_added");
    const cleanDateAdded = normalizeDateString(stripTags(dateAddedTd)) || undefined;

    const reviewTd = extractTdByField(rowHtml, "review");
    let userReview: string | undefined;
    if (reviewTd) {
      const fullSpanMatch = reviewTd.match(
        /<span\b[^>]*id="freeText(?!Container)[^"]*"[^>]*>([\s\S]*?)<\/span>/i
      );
      const containerSpanMatch = reviewTd.match(
        /<span\b[^>]*id="freeTextContainer[^"]*"[^>]*>([\s\S]*?)<\/span>/i
      );
      const rawRevHtml = fullSpanMatch?.[1] || containerSpanMatch?.[1] || reviewTd;
      const cleanedRev = stripTags(rawRevHtml)
        .replace(/^\s*(?:None|Write a review)\s*$/i, "")
        .replace(/\s*\.\.\.more\s*$/i, "")
        .replace(/\s*\(less\)\s*$/i, "")
        .trim();
      if (cleanedRev) userReview = cleanedRev;
    }

    const notesTd = extractTdByField(rowHtml, "notes");
    const rawPrivateNotes = notesTd
      ? stripTags(notesTd).replace(/^\s*(?:None|Add notes)\s*$/i, "").trim()
      : "";
    const privateNotes = rawPrivateNotes || undefined;

    const ownedTd = extractTdByField(rowHtml, "owned");
    const ownedMatch = stripTags(ownedTd).match(/(\d+)/);
    const ownedCopies = ownedMatch ? parseInt(ownedMatch[1], 10) : undefined;

    const pubTd = extractTdByField(rowHtml, "date_pub");
    const pubYearMatch = stripTags(pubTd).match(/\b(1[4-9]\d{2}|20\d{2})\b/);
    const bookPublished = pubYearMatch ? parseInt(pubYearMatch[1], 10) : undefined;

    const effectiveBookId =
      bookId || cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const link = bookHrefMatch
      ? bookHrefMatch[1].startsWith("http")
        ? bookHrefMatch[1].split("?")[0]
        : `https://www.goodreads.com${bookHrefMatch[1].split("?")[0]}`
      : `https://www.goodreads.com/book/show/${effectiveBookId}`;

    items.push({
      bookId: effectiveBookId,
      title: cleanTitle,
      author,
      isbn,
      isbn13,
      userRating,
      userReadAt: cleanDateRead,
      userDateAdded: cleanDateAdded,
      userReview,
      privateNotes,
      bookPublished,
      numPages,
      coverUrl,
      link,
      shelf,
      customShelves,
      ownedCopies,
    });
  }

  const hasNextPage =
    /<a\b[^>]*class="[^"]*\bnext_page\b[^"]*"[^>]*rel="next"/i.test(html) ||
    /<a\b[^>]*rel="next"[^>]*class="[^"]*\bnext_page\b[^"]*"/i.test(html);

  return { items, hasNextPage };
}

export async function fetchGoodreadsShelvesWithCookie(
  userIdOrUrl: string,
  cookie: string,
  options?: {
    shelves?: GoodreadsShelf[];
    maxPages?: number;
    fetchFn?: typeof fetch;
  }
): Promise<{ goodreadsUserId: string; items: GoodreadsBookItem[] }> {
  const fetchFn = options?.fetchFn ?? fetch;
  const goodreadsUserId = parseGoodreadsUserId(userIdOrUrl);
  if (!goodreadsUserId || !/^\d+$/.test(goodreadsUserId)) {
    throw new Error("Valid numeric Goodreads User ID or profile URL is required");
  }
  const cleanCookie = cookie.trim();
  if (!cleanCookie) {
    throw new GoodreadsAuthExpiredError();
  }

  const shelves: GoodreadsShelf[] = options?.shelves ?? [
    "to-read",
    "currently-reading",
    "read",
  ];
  const maxPages = Math.max(1, Math.min(options?.maxPages ?? 8, 20));
  const mergedByBookId = new Map<string, GoodreadsBookItem>();

  for (const shelf of shelves) {
    for (let page = 1; page <= maxPages; page++) {
      const url = `https://www.goodreads.com/review/list/${goodreadsUserId}?shelf=${encodeURIComponent(
        shelf
      )}&per_page=100&page=${page}&view=table`;
      const res = await fetchFn(url, {
        headers: {
          Cookie: cleanCookie,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
      });

      if (res.status === 401 || res.status === 403 || (res.url && res.url.includes("/user/sign_in"))) {
        throw new GoodreadsAuthExpiredError();
      }
      if (!res.ok) {
        throw new Error(`Goodreads shelf '${shelf}' returned HTTP ${res.status}`);
      }

      const html = await res.text();
      const { items, hasNextPage } = parseGoodreadsShelfHtml(html, shelf);

      for (const item of items) {
        const existing = mergedByBookId.get(item.bookId);
        if (existing) {
          const combinedShelves = normalizeGoodreadsShelvesList([
            ...existing.customShelves,
            ...item.customShelves,
          ]);
          mergedByBookId.set(item.bookId, {
            ...existing,
            ...item,
            customShelves: combinedShelves,
            userReview: item.userReview || existing.userReview,
            privateNotes: item.privateNotes || existing.privateNotes,
            userRating: item.userRating ?? existing.userRating,
            userReadAt: item.userReadAt || existing.userReadAt,
            coverUrl: item.coverUrl || existing.coverUrl,
            numPages: item.numPages ?? existing.numPages,
            isbn: item.isbn || existing.isbn,
            isbn13: item.isbn13 || existing.isbn13,
            ownedCopies:
              Math.max(item.ownedCopies || 0, existing.ownedCopies || 0) || undefined,
          });
        } else {
          mergedByBookId.set(item.bookId, item);
        }
      }

      if (!hasNextPage || items.length === 0) break;
    }
  }

  return {
    goodreadsUserId,
    items: [...mergedByBookId.values()],
  };
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
    if (!seen.has(key)) {
      seen.set(key, clean);
    }
  }
  return [...seen.values()];
}

function mergeNoteBlocks(
  existingNotes: string | null | undefined,
  incomingBlocks: Array<string | undefined>
): string | null {
  let out = (existingNotes || "").trim();
  for (const raw of incomingBlocks) {
    const clean = (raw || "").trim();
    if (!clean) continue;
    if (!out) {
      out = clean;
    } else if (!out.toLowerCase().includes(clean.toLowerCase())) {
      out = `${out}\n\n${clean}`;
    }
  }
  return out || null;
}

export async function upsertGoodreadsBooks(
  curioUserId: string,
  items: GoodreadsBookItem[],
  options?: { fetchFn?: typeof fetch }
): Promise<GoodreadsUpsertResult> {
  const fetchFn = options?.fetchFn ?? fetch;
  let createdEntities = 0;
  let createdSaves = 0;
  let updatedSaves = 0;
  let mergedWithOwned = 0;
  let tagsImportedCount = 0;

  const existingBooks = await db
    .select()
    .from(globalEntities)
    .where(eq(globalEntities.typePath, "/product/book"));

  const userBookSaves = await db
    .select({ entity: globalEntities })
    .from(userSaves)
    .innerJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
    .where(
      and(
        eq(userSaves.userId, curioUserId),
        eq(globalEntities.typePath, "/product/book")
      )
    );
  const userBookIds = new Set(userBookSaves.map((r) => r.entity.id));
  const prioritizedBooks = [
    ...userBookSaves.map((r) => r.entity),
    ...existingBooks.filter((e) => !userBookIds.has(e.id)),
  ];

  for (const item of items) {
    const cleanIsbn = item.isbn13 || item.isbn;
    const isbnExtId = cleanIsbn ? `isbn:${cleanIsbn}` : null;
    const grExtId = `goodreads:${item.bookId}`;
    const cleanedItem = cleanCommercialBookTitle(item.title);
    const fingerprint = computeIdentityFingerprint(
      "/product/book",
      cleanedItem.title,
      item.author
    );
    const normTitle = normalizeEntityString(cleanedItem.title);
    const normAuthor = normalizeEntityString(item.author);

    let matchedEntity = prioritizedBooks.find((e) => {
      if (isbnExtId && e.canonicalExternalId === isbnExtId) return true;
      if (e.canonicalExternalId === grExtId) return true;
      if (e.identityFingerprint === fingerprint) return true;
      const eCore = (e.coreStructuredData as Record<string, any>) || {};
      const eExt = (e.extendedAttributes as Record<string, any>) || {};
      const eIsbn = String(eCore.isbn || eExt.modelNumber || "").trim();
      if (
        (item.isbn && eIsbn === item.isbn) ||
        (item.isbn13 && eIsbn === item.isbn13)
      ) {
        return true;
      }
      const cleanedExisting = cleanCommercialBookTitle(e.title);
      const normETitle = normalizeEntityString(cleanedExisting.title);
      const normEAuthor = normalizeEntityString(
        e.brandOrCreator || eCore.author || cleanedExisting.authorHint || ""
      );
      if (
        normETitle &&
        normETitle === normTitle &&
        (!normAuthor ||
          !normEAuthor ||
          normEAuthor.includes(normAuthor) ||
          normAuthor.includes(normEAuthor))
      ) {
        return true;
      }
      return false;
    });

    if (!matchedEntity) {
      let coverUrl = item.coverUrl;
      let summary = item.bookDescription
        ? item.bookDescription.slice(0, 260)
        : `By ${item.author}${item.bookPublished ? ` (${item.bookPublished})` : ""}`;
      let numPages = item.numPages;
      let publisher = item.publisher;
      let pubYear = item.bookPublished;
      let resolvedIsbn = cleanIsbn;

      if (!coverUrl || !numPages) {
        const resolved = await resolveBook(cleanedItem.title, {
          authorHint: item.author,
          isbnHint: cleanIsbn,
          yearHint: item.bookPublished,
          fetchFn,
          timeoutMs: 3500,
        }).catch(() => null);
        if (resolved) {
          coverUrl = coverUrl || resolved.coverUrl;
          numPages = numPages ?? resolved.pageCount;
          publisher = publisher || resolved.publisher;
          pubYear = pubYear ?? resolved.releaseYear;
          resolvedIsbn = resolvedIsbn || resolved.isbn;
          if (!item.bookDescription && resolved.summary) {
            summary = resolved.summary;
          }
        }
      }

      const canonicalUrl = item.link || `https://www.goodreads.com/book/show/${item.bookId}`;
      const { urlHash, entityKey } = generateEntityKey(canonicalUrl, cleanedItem.title);

      const [inserted] = await db
        .insert(globalEntities)
        .values({
          urlHash,
          entityKey,
          canonicalUrl,
          coreType: "BOOK",
          typePath: "/product/book",
          canonicalExternalId: isbnExtId || grExtId,
          identityFingerprint: fingerprint,
          brandOrCreator: item.author,
          title: item.title,
          summary,
          heroImageUrl: coverUrl || null,
          coreStructuredData: {
            title: item.title,
            author: item.author,
            ...(resolvedIsbn ? { isbn: resolvedIsbn } : {}),
            ...(numPages ? { pageCount: numPages } : {}),
            ...(publisher ? { publisher } : {}),
            ...(pubYear ? { year: pubYear } : {}),
            goodreadsId: item.bookId,
            aliases: [item.title],
            ...(item.userReview ? { obiText: item.userReview.slice(0, 140) } : {}),
          },
          extendedAttributes: {},
          priceCents: 1899,
          currency: "USD",
        })
        .returning();

      matchedEntity = inserted;
      existingBooks.push(inserted);
      prioritizedBooks.unshift(inserted);
      createdEntities++;
    } else {
      const eCore =
        matchedEntity.coreStructuredData &&
        typeof matchedEntity.coreStructuredData === "object"
          ? ({ ...(matchedEntity.coreStructuredData as Record<string, any>) })
          : {};
      const entityPatch: Record<string, unknown> = {};
      let csdChanged = false;

      if (!matchedEntity.heroImageUrl && item.coverUrl) {
        entityPatch.heroImageUrl = item.coverUrl;
      }
      if (!matchedEntity.brandOrCreator && item.author && item.author !== "Unknown Author") {
        entityPatch.brandOrCreator = item.author;
      }
      if (!eCore.author && item.author) {
        eCore.author = item.author;
        csdChanged = true;
      }
      if (!eCore.isbn && cleanIsbn) {
        eCore.isbn = cleanIsbn;
        csdChanged = true;
      }
      if (!eCore.pageCount && item.numPages) {
        eCore.pageCount = item.numPages;
        csdChanged = true;
      }
      if (!eCore.year && item.bookPublished) {
        eCore.year = item.bookPublished;
        csdChanged = true;
      }
      if (!eCore.publisher && item.publisher) {
        eCore.publisher = item.publisher;
        csdChanged = true;
      }
      if (!eCore.goodreadsId && item.bookId) {
        eCore.goodreadsId = item.bookId;
        csdChanged = true;
      }
      if (csdChanged) {
        entityPatch.coreStructuredData = eCore;
      }
      if (Object.keys(entityPatch).length > 0) {
        entityPatch.updatedAt = new Date().toISOString();
        const [updatedEnt] = await db
          .update(globalEntities)
          .set(entityPatch)
          .where(eq(globalEntities.id, matchedEntity.id))
          .returning();
        if (updatedEnt) {
          matchedEntity = updatedEnt;
        }
      }
    }

    const [existingSave] = await db
      .select()
      .from(userSaves)
      .where(
        and(
          eq(userSaves.userId, curioUserId),
          eq(userSaves.entityId, matchedEntity.id)
        )
      )
      .limit(1);

    const existingCv =
      existingSave?.userCustomValues &&
      typeof existingSave.userCustomValues === "object"
        ? (existingSave.userCustomValues as Record<string, any>)
        : {};

    const alreadyOwned = existingSave
      ? isOwnedBook(existingSave, matchedEntity)
      : false;
    const grOwned = Boolean(item.ownedCopies && item.ownedCopies > 0);
    const owned = alreadyOwned || grOwned;
    const isWishlist = owned ? false : item.shelf === "to-read";
    const readingStatus = normalizeReadingStatus({ shelf: item.shelf }, isWishlist);

    const existingShelves = Array.isArray(existingCv.goodreadsShelves)
      ? (existingCv.goodreadsShelves as string[])
      : [];
    const combinedCustomShelves = normalizeGoodreadsShelvesList([
      ...existingShelves,
      ...item.customShelves,
    ]);
    tagsImportedCount += item.customShelves.length;

    const customVals: Record<string, any> = {
      ...existingCv,
      shelf: readingStatusToShelf(readingStatus),
      readingStatus,
      goodreadsBookId: item.bookId,
      goodreadsShelves: combinedCustomShelves,
      owned,
      bookSource: owned
        ? "OWNED"
        : existingCv.bookSource || "GOODREADS",
    };

    if (item.userRating !== undefined) {
      customVals.rating = item.userRating;
      customVals.myRating = item.userRating;
    }
    if (item.userReadAt) {
      customVals.dateRead = normalizeDateString(item.userReadAt) || item.userReadAt;
    }
    if (item.userDateAdded) {
      customVals.dateAdded = normalizeDateString(item.userDateAdded) || item.userDateAdded;
    }

    const incomingTags = ["book", "goodreads", item.shelf, ...item.customShelves];
    const nextNotes = mergeNoteBlocks(existingSave?.personalNotes, [
      item.userReview,
      item.privateNotes,
    ]);

    if (existingSave) {
      await db
        .update(userSaves)
        .set({
          wishlist: isWishlist,
          hasConvertedPurchase: existingSave.hasConvertedPurchase || owned,
          userCustomValues: customVals,
          autoTags: mergeDistinctTags(existingSave.autoTags, incomingTags),
          personalNotes: nextNotes,
        })
        .where(eq(userSaves.id, existingSave.id));
      updatedSaves++;
      if (alreadyOwned) mergedWithOwned++;
    } else {
      await db.insert(userSaves).values({
        userId: curioUserId,
        entityId: matchedEntity.id,
        typePath: "/product/book",
        isPrivateMemo: false,
        wishlist: isWishlist,
        hasConvertedPurchase: owned,
        personalNotes: nextNotes,
        userCustomValues: customVals,
        autoTags: mergeDistinctTags([], incomingTags),
        enrichmentStatus: "ENRICHED",
        visibility: "PRIVATE",
      });
      createdSaves++;
    }
  }

  if (items.length > 0) {
    const boardRes = await ensureHierarchicalBoard(curioUserId, {
      rootSlug: "books",
      rootTitle: "Books",
      rootDefaultLayout: "shelf",
      autoRules: { coreType: "BOOK" },
    });
    await db
      .update(smartLists)
      .set({ defaultLayout: "shelf" })
      .where(eq(smartLists.id, boardRes.rootId));
  }

  return {
    fetchedCount: items.length,
    createdEntities,
    createdSaves,
    updatedSaves,
    mergedWithOwned,
    tagsImportedCount,
  };
}
