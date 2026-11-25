import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { type SyncAdapter, type SyncOptions, type SyncRunResult } from "./engine";
import { registerSyncAdapter } from "./registry";
import { getGoodreadsAuthRecord } from "./goodreadsAuthStore";
import {
  fetchGoodreadsShelvesWithCookie,
  GoodreadsAuthExpiredError,
  parseGoodreadsUserId,
  upgradeGoodreadsCoverUrl,
  upsertGoodreadsBooks,
  type GoodreadsBookItem,
  type GoodreadsShelf,
} from "./goodreadsSync";

export type { GoodreadsShelf };
export { parseGoodreadsUserId, upgradeGoodreadsCoverUrl };

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
  customShelves?: string[];
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
 * Pure XML parser for Goodreads shelf RSS feed (<item> entries), kept for unit tests and legacy XML fixtures.
 */
export function parseGoodreadsRssXml(
  xmlText: string,
  shelf: GoodreadsShelf = "read"
): GoodreadsRssItem[] {
  const items: GoodreadsRssItem[] = [];
  const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  const exclusive = new Set(["read", "currently-reading", "to-read"]);

  for (const match of itemMatches) {
    const block = match[1];
    const rawTitle = extractXmlTag(block, "title");
    if (!rawTitle) continue;

    const cleanTitle =
      rawTitle.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/g, "").trim() || rawTitle;
    const author = extractXmlTag(block, "author_name") || "Unknown Author";
    const bookId =
      extractXmlTag(block, "book_id") ||
      cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const rawIsbn = extractXmlTag(block, "isbn");
    const isbn =
      rawIsbn && /^[0-9Xx]{10,13}$/.test(rawIsbn.trim())
        ? rawIsbn.trim()
        : undefined;

    const ratingStr = extractXmlTag(block, "user_rating");
    const parsedRating = ratingStr ? parseInt(ratingStr, 10) : NaN;
    const userRating =
      Number.isFinite(parsedRating) && parsedRating > 0 ? parsedRating : undefined;

    const userReadAt = extractXmlTag(block, "user_read_at") || undefined;
    const rawReview = extractXmlTag(block, "user_review") || "";
    const userReview =
      rawReview
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim() || undefined;

    const rawShelves = extractXmlTag(block, "user_shelves") || "";
    const customShelves = rawShelves
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && !exclusive.has(s));

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
      customShelves,
    });
  }

  return items;
}

/**
 * Syncs parsed RSS items via unified Goodreads upsert (used by tests & XML imports).
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

  const shelves: GoodreadsShelf[] = options?.shelves ?? [
    "to-read",
    "currently-reading",
    "read",
  ];
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

  const bookItems: GoodreadsBookItem[] = allItems.map((it) => ({
    ...it,
    customShelves: it.customShelves || [],
  }));

  const upsertRes = await upsertGoodreadsBooks(curioUserId, bookItems, { fetchFn });

  return {
    goodreadsUserId,
    fetchedCount: upsertRes.fetchedCount,
    createdEntities: upsertRes.createdEntities,
    createdSaves: upsertRes.createdSaves,
    updatedSaves: upsertRes.updatedSaves,
    items: allItems,
  };
}

export const goodreadsSyncAdapter: SyncAdapter<
  SyncOptions & {
    goodreadsUserId?: string;
    cookie?: string;
    shelves?: GoodreadsShelf[];
  }
> = {
  sourceId: "goodreads",
  displayName: "Goodreads Shelves (Books)",
  supportsWishlistPromotion: false,
  supportsPruning: false,
  async getStatus(userId: string) {
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const tokens = (u?.googleSyncTokens as Record<string, any>) || {};
    const authRec = getGoodreadsAuthRecord(userId);
    const goodreadsUserId = authRec?.goodreadsUserId || tokens.goodreadsUserId || null;
    const hasCookie = Boolean(authRec?.cookie);
    return {
      configured: Boolean(goodreadsUserId && hasCookie),
      goodreadsUserId,
      hasCookie,
      authStatus:
        tokens.goodreadsAuthStatus || (hasCookie ? "ok" : "unconfigured"),
      lastError: tokens.goodreadsLastError || null,
      lastSyncedAt:
        tokens.goodreadsLastSyncedAt || tokens.lastFeedSyncAt || null,
    };
  },
  async run(userId: string, options): Promise<SyncRunResult> {
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const tokens = (u?.googleSyncTokens as Record<string, any>) || {};
    const storedAuth = getGoodreadsAuthRecord(userId);

    const grId =
      (typeof options?.goodreadsUserId === "string" && options.goodreadsUserId.trim()) ||
      storedAuth?.goodreadsUserId ||
      String(tokens.goodreadsUserId || "").trim();
    const cookie =
      (typeof options?.cookie === "string" && options.cookie.trim()) ||
      storedAuth?.cookie ||
      "";

    if (!grId || !cookie) {
      return {
        sourceId: "goodreads",
        synced: false,
        skippedReason: !grId ? "not_configured" : "cookie_required",
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
      const fetched = await fetchGoodreadsShelvesWithCookie(grId, cookie, {
        fetchFn: options?.fetchFn as typeof fetch | undefined,
        shelves: options?.shelves,
      });
      const upsertRes = await upsertGoodreadsBooks(userId, fetched.items, {
        fetchFn: options?.fetchFn as typeof fetch | undefined,
      });
      const syncedAt = new Date().toISOString();

      await db
        .update(users)
        .set({
          googleSyncTokens: {
            ...tokens,
            goodreadsUserId: fetched.goodreadsUserId,
            goodreadsAuthStatus: "ok",
            goodreadsLastError: null,
            goodreadsLastSyncedAt: syncedAt,
            lastFeedSyncAt: syncedAt,
          },
        })
        .where(eq(users.id, userId));

      return {
        sourceId: "goodreads",
        synced: true,
        recordsProcessed: upsertRes.fetchedCount,
        createdSaves: upsertRes.createdSaves,
        updatedSaves: upsertRes.updatedSaves,
        promotedFromWishlist: 0,
        prunedSaves: 0,
        prunedEntities: 0,
        connectionsSynced: 0,
        boardsCreated: 0,
        digest: `gr-${fetched.goodreadsUserId}-${upsertRes.fetchedCount}`,
        syncedAt,
        meta: {
          goodreadsUserId: fetched.goodreadsUserId,
          mergedWithOwned: upsertRes.mergedWithOwned,
          tagsImportedCount: upsertRes.tagsImportedCount,
        },
      };
    } catch (err: any) {
      const isExpired = err instanceof GoodreadsAuthExpiredError;
      await db
        .update(users)
        .set({
          googleSyncTokens: {
            ...tokens,
            goodreadsUserId: grId,
            goodreadsAuthStatus: isExpired ? "expired" : tokens.goodreadsAuthStatus || "ok",
            goodreadsLastError: err?.message || "Goodreads sync failed",
          },
        })
        .where(eq(users.id, userId));
      throw err;
    }
  },
};

registerSyncAdapter(goodreadsSyncAdapter);
