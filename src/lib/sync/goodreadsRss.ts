import { db, globalEntities, userSaves } from "@/db";
import { eq, and } from "drizzle-orm";
import { generateEntityKey } from "../ingest/cascade";
import { computeIdentityFingerprint } from "../ingest/resolution";
import { normalizeEntityString } from "../enrichment/universalDiscovery";
import { resolveBook } from "../enrichment/providers/books";

export type GoodreadsShelf = "read" | "currently-reading" | "to-read";

export interface GoodreadsRssItem {
  bookId: string;
  title: string;
  author: string;
  isbn?: string;
  userRating?: number;
  userReadAt?: string;
  userReview?: string;
  bookPublished?: number;
  numPages?: number;
  coverUrl?: string;
  bookDescription?: string;
  link: string;
  shelf: GoodreadsShelf;
}

export interface GoodreadsSyncResult {
  goodreadsUserId: string;
  fetchedCount: number;
  createdEntities: number;
  createdSaves: number;
  updatedSaves: number;
  items: GoodreadsRssItem[];
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

function extractXmlTag(block: string, tagName: string): string | undefined {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const m = block.match(regex);
  if (!m) return undefined;
  return decodeXmlEntities(m[1]);
}

/**
 * Cleans and upgrades Goodreads cover image URLs, filtering out "nophoto" placeholders
 */
export function upgradeGoodreadsCoverUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  if (rawUrl.includes("nophoto")) return undefined;
  // Upgrade Amazon/Goodreads resized thumbnails (e.g. ._SX98_. or ._SY160_.) to high-res ._SY600_.
  return rawUrl
    .replace(/\._S[XY]\d+_\./i, ".")
    .replace(/\._S[XY]\d+_S[XY]\d+_\./i, ".");
}

/**
 * Extracts numeric Goodreads user ID from either a raw ID or a Goodreads profile/RSS URL
 */
export function parseGoodreadsUserId(input: string): string {
  const trimmed = input.trim();
  const m =
    trimmed.match(/list_rss\/(\d+)/i) ||
    trimmed.match(/user\/show\/(\d+)/i) ||
    trimmed.match(/^(\d+)/);
  return m ? m[1] : trimmed;
}

/**
 * Pure XML parser for Goodreads shelf RSS feed (<item> entries)
 */
export function parseGoodreadsRssXml(
  xmlText: string,
  shelf: GoodreadsShelf = "read"
): GoodreadsRssItem[] {
  const items: GoodreadsRssItem[] = [];
  const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi);

  for (const match of itemMatches) {
    const block = match[1];
    const rawTitle = extractXmlTag(block, "title");
    if (!rawTitle) continue;

    // Strip series suffix like "Dune (Dune #1)"
    const cleanTitle = rawTitle.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/g, "").trim() || rawTitle;
    const author = extractXmlTag(block, "author_name") || "Unknown Author";
    const bookId = extractXmlTag(block, "book_id") || cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const rawIsbn = extractXmlTag(block, "isbn");
    const isbn = rawIsbn && /^[0-9Xx]{10,13}$/.test(rawIsbn.trim()) ? rawIsbn.trim() : undefined;

    const ratingStr = extractXmlTag(block, "user_rating");
    const parsedRating = ratingStr ? parseInt(ratingStr, 10) : NaN;
    const userRating = Number.isFinite(parsedRating) && parsedRating > 0 ? parsedRating : undefined;

    const userReadAt = extractXmlTag(block, "user_read_at") || undefined;
    const rawReview = extractXmlTag(block, "user_review") || "";
    const userReview = rawReview
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim() || undefined;

    const pubStr = extractXmlTag(block, "book_published");
    const pubYear = pubStr ? parseInt(pubStr, 10) : NaN;
    const bookPublished = Number.isFinite(pubYear) ? pubYear : undefined;

    const numPagesMatch = block.match(/<num_pages>(\d+)<\/num_pages>/i);
    const numPages = numPagesMatch ? parseInt(numPagesMatch[1], 10) : undefined;

    const rawCover =
      extractXmlTag(block, "book_large_image_url") ||
      extractXmlTag(block, "book_medium_image_url") ||
      extractXmlTag(block, "book_image_url");
    const coverUrl = upgradeGoodreadsCoverUrl(rawCover);

    const rawDesc = extractXmlTag(block, "book_description") || "";
    const bookDescription = rawDesc.replace(/<[^>]+>/g, "").trim() || undefined;

    const link =
      extractXmlTag(block, "link")?.split("?")[0] ||
      `https://www.goodreads.com/book/show/${bookId}`;

    items.push({
      bookId,
      title: cleanTitle,
      author,
      isbn,
      userRating,
      userReadAt,
      userReview,
      bookPublished,
      numPages,
      coverUrl,
      bookDescription,
      link,
      shelf,
    });
  }

  return items;
}

/**
 * Fetches and syncs a user's Goodreads shelves (read, currently-reading, to-read) into Curio
 */
export async function syncGoodreadsRss(
  userIdOrUrl: string,
  curioUserId: string,
  options?: {
    shelves?: GoodreadsShelf[];
    fetchFn?: typeof fetch;
  }
): Promise<GoodreadsSyncResult> {
  const fetchFn = options?.fetchFn ?? fetch;
  const goodreadsUserId = parseGoodreadsUserId(userIdOrUrl);
  if (!goodreadsUserId || !/^\d+$/.test(goodreadsUserId)) {
    throw new Error("Valid numeric Goodreads User ID or profile URL is required");
  }

  // Order shelves so 'to-read' is processed first, and 'currently-reading' / 'read' override wishlist -> false if on both
  const shelves: GoodreadsShelf[] = options?.shelves ?? ["to-read", "currently-reading", "read"];
  const allItems: GoodreadsRssItem[] = [];

  for (const shelf of shelves) {
    const rssUrl = `https://www.goodreads.com/review/list_rss/${goodreadsUserId}?shelf=${encodeURIComponent(
      shelf
    )}&per_page=100`;
    const res = await fetchFn(rssUrl, {
      headers: {
        "User-Agent": "Curio/3.2 (https://curio.local; live-rss-sync)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (!res.ok) {
      throw new Error(`Goodreads RSS returned HTTP ${res.status} for shelf '${shelf}'`);
    }

    const xmlText = await res.text();
    const shelfItems = parseGoodreadsRssXml(xmlText, shelf);
    allItems.push(...shelfItems);
  }

  let createdEntities = 0;
  let createdSaves = 0;
  let updatedSaves = 0;

  const existingBooks = await db
    .select()
    .from(globalEntities)
    .where(eq(globalEntities.typePath, "/product/book"));

  for (const item of allItems) {
    const isbnExtId = item.isbn ? `isbn:${item.isbn}` : null;
    const grExtId = `goodreads:${item.bookId}`;
    const fingerprint = computeIdentityFingerprint("/product/book", item.title, item.author);
    const normTitle = normalizeEntityString(item.title);
    const normAuthor = normalizeEntityString(item.author);

    // 1. Multi-Key Canonical Deduplication
    let matchedEntity = existingBooks.find((e) => {
      if (isbnExtId && e.canonicalExternalId === isbnExtId) return true;
      if (e.canonicalExternalId === grExtId) return true;
      if (e.identityFingerprint === fingerprint) return true;
      const eCore = (e.coreStructuredData as Record<string, any>) || {};
      if (item.isbn && eCore.isbn === item.isbn) return true;
      const normETitle = normalizeEntityString(e.title);
      const normEAuthor = normalizeEntityString(e.brandOrCreator || eCore.author || "");
      if (normETitle === normTitle && (!normAuthor || !normEAuthor || normEAuthor.includes(normAuthor) || normAuthor.includes(normEAuthor))) {
        return true;
      }
      return false;
    });

    if (!matchedEntity) {
      let coverUrl = item.coverUrl;
      let summary = item.bookDescription
        ? item.bookDescription.slice(0, 260)
        : `By ${item.author}${item.bookPublished ? ` (${item.bookPublished})` : ""}`;

      // Zero-Call Fast Path: Only invoke OpenLibrary/Google Books if coverUrl is missing from RSS
      if (!coverUrl) {
        const resolved = await resolveBook(item.title, {
          authorHint: item.author,
          isbnHint: item.isbn,
          yearHint: item.bookPublished,
          fetchFn,
          timeoutMs: 3500,
        }).catch(() => null);
        if (resolved) {
          coverUrl = resolved.coverUrl;
          if (!item.bookDescription && resolved.summary) {
            summary = resolved.summary;
          }
        }
      }

      const canonicalUrl = `https://www.goodreads.com/book/show/${item.bookId}`;
      const { urlHash, entityKey } = generateEntityKey(canonicalUrl, item.title);

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
            ...(item.isbn ? { isbn: item.isbn } : {}),
            ...(item.numPages ? { pageCount: item.numPages } : {}),
            ...(item.bookPublished ? { year: item.bookPublished } : {}),
            goodreadsId: item.bookId,
            aliases: [item.title],
          },
          extendedAttributes: {},
          priceCents: 1899,
          currency: "USD",
        })
        .returning();

      matchedEntity = inserted;
      existingBooks.push(inserted);
      createdEntities++;
    } else if (!matchedEntity.heroImageUrl && item.coverUrl) {
      await db
        .update(globalEntities)
        .set({ heroImageUrl: item.coverUrl })
        .where(eq(globalEntities.id, matchedEntity.id));
      matchedEntity.heroImageUrl = item.coverUrl;
    }

    // 2. Shelf Transition & Idempotent User Save Upsert on (userId, entityId)
    const isWishlist = item.shelf === "to-read";
    const [existingSave] = await db
      .select()
      .from(userSaves)
      .where(and(eq(userSaves.userId, curioUserId), eq(userSaves.entityId, matchedEntity.id)))
      .limit(1);

    const customVals: Record<string, any> = {
      ...((existingSave?.userCustomValues as Record<string, any>) || {}),
      shelf: item.shelf,
    };
    if (item.userRating !== undefined) {
      customVals.rating = item.userRating;
      customVals.myRating = item.userRating;
    }
    if (item.userReadAt) {
      customVals.dateRead = item.userReadAt;
    }

    if (existingSave) {
      const updatedNotes =
        item.userReview && !existingSave.personalNotes?.includes(item.userReview)
          ? existingSave.personalNotes
            ? `${existingSave.personalNotes}\n\n${item.userReview}`
            : item.userReview
          : existingSave.personalNotes;

      await db
        .update(userSaves)
        .set({
          wishlist: isWishlist,
          userCustomValues: customVals,
          personalNotes: updatedNotes,
        })
        .where(eq(userSaves.id, existingSave.id));
      updatedSaves++;
    } else {
      await db.insert(userSaves).values({
        userId: curioUserId,
        entityId: matchedEntity.id,
        typePath: "/product/book",
        isPrivateMemo: false,
        wishlist: isWishlist,
        personalNotes: item.userReview || null,
        userCustomValues: customVals,
        autoTags: ["book", "goodreads", item.shelf],
        enrichmentStatus: "ENRICHED",
        visibility: "PRIVATE",
      });
      createdSaves++;
    }
  }

  return {
    goodreadsUserId,
    fetchedCount: allItems.length,
    createdEntities,
    createdSaves,
    updatedSaves,
    items: allItems,
  };
}
