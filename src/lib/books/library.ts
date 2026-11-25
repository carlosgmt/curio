import type { GlobalEntity, UserSave } from "@/db";
import { sanitizeGoodreadsNote } from "./identity";
import type { CardData } from "@/components/cards/PolymorphicCard";

export type ReadingStatus = "WANT_TO_READ" | "READING" | "FINISHED";
export type BookSource = "OWNED" | "READ_ONLINE" | "BORROWED" | "GOODREADS";
export type BookOriginSource = "MY_STUFF" | "GOODREADS" | "MANUAL";
export type BookFormat = "PHYSICAL" | "KINDLE" | "EBOOK" | "AUDIOBOOK" | "ONLINE";

export interface LibraryBookView {
  saveId: string;
  entityId: string | null;
  title: string;
  author: string;
  coverUrl: string | null;
  summary: string | null;
  isbn: string | null;
  pageCount: number | null;
  publisher: string | null;
  year: number | null;
  readingStatus: ReadingStatus;
  bookSource: BookSource;
  sources: BookOriginSource[];
  format: BookFormat;
  isOwned: boolean;
  rating: number | null;
  dateRead: string | null;
  dateAdded: string;
  personalNotes: string | null;
  marginQuotes: string[];
  tags: string[];
  goodreadsShelves: string[];
  goodreadsBookId: string | null;
  retailer: string | null;
  purchaseDate: string | null;
  priceCents: number | null;
  currency: string | null;
  canonicalUrl: string;
  createdAt: string;
  card: CardData;
}

export interface LibraryStats {
  total: number;
  ownedCount: number;
  readOnlineCount: number;
  finishedCount: number;
  readingCount: number;
  wantToReadCount: number;
  readThisYear: number;
  totalPagesRead: number;
  avgRating: number | null;
  tagCounts: Array<{ tag: string; count: number }>;
}

const INTERNAL_NOISE_TAGS = new Set([
  "book",
  "books",
  "goodreads",
  "read",
  "currently-reading",
  "to-read",
  "owner:home",
  "owner:personal",
  "reading material",
  "bestseller",
  "sunday times",
  "media",
  "[edit]",
  "edit",
]);

function asRecord(val: unknown): Record<string, any> {
  return val && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, any>)
    : {};
}

export function normalizeReadingStatus(
  customValues: Record<string, any> | null | undefined,
  wishlist?: boolean | null
): ReadingStatus {
  const cv = asRecord(customValues);
  const rawStatus = typeof cv.readingStatus === "string" ? cv.readingStatus.trim().toUpperCase() : "";
  if (rawStatus === "FINISHED" || rawStatus === "READING" || rawStatus === "WANT_TO_READ") {
    return rawStatus;
  }

  const shelf = typeof cv.shelf === "string" ? cv.shelf.trim().toLowerCase() : "";
  if (shelf === "read") return "FINISHED";
  if (shelf === "currently-reading") return "READING";
  if (shelf === "to-read") return "WANT_TO_READ";

  if (wishlist) return "WANT_TO_READ";
  if (cv.dateRead || typeof cv.rating === "number" || typeof cv.myRating === "number") {
    return "FINISHED";
  }
  return "WANT_TO_READ";
}

export function readingStatusToShelf(
  status: ReadingStatus
): "read" | "currently-reading" | "to-read" {
  if (status === "FINISHED") return "read";
  if (status === "READING") return "currently-reading";
  return "to-read";
}

export function isOwnedBook(
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
  if (cv.bookSource === "OWNED" || cv.owned === true) return true;
  if (typeof cv.ownedCopies === "number" && cv.ownedCopies > 0) return true;
  if (typeof cv.ownedCopies === "string" && parseInt(cv.ownedCopies, 10) > 0) return true;
  return false;
}

export function resolveBookSources(
  save: Pick<UserSave, "hasConvertedPurchase" | "userCustomValues" | "autoTags">,
  entity?: Pick<GlobalEntity, "canonicalExternalId" | "canonicalUrl" | "coreStructuredData" | "extendedAttributes"> | null
): BookOriginSource[] {
  const sources: BookOriginSource[] = [];
  const cv = asRecord(save.userCustomValues);
  const csd = asRecord(entity?.coreStructuredData);
  const tags = Array.isArray(save.autoTags) ? save.autoTags : [];

  if (isOwnedBook(save, entity)) {
    sources.push("MY_STUFF");
  }

  const hasGoodreadsSignal =
    Boolean(cv.goodreadsBookId) ||
    Boolean(csd.goodreadsId) ||
    Boolean(entity?.canonicalExternalId?.startsWith("goodreads:")) ||
    (Array.isArray(cv.goodreadsShelves) && cv.goodreadsShelves.length > 0) ||
    (typeof cv.bookSource === "string" && cv.bookSource.trim().toUpperCase() === "GOODREADS") ||
    Boolean(entity?.canonicalUrl?.toLowerCase().includes("goodreads.com")) ||
    tags.some((t) => String(t).toLowerCase() === "goodreads");

  if (hasGoodreadsSignal) {
    sources.push("GOODREADS");
  }

  const rawSource = typeof cv.bookSource === "string" ? cv.bookSource.trim().toUpperCase() : "";
  if (
    rawSource === "READ_ONLINE" ||
    rawSource === "BORROWED" ||
    rawSource === "MANUAL" ||
    sources.length === 0
  ) {
    sources.push("MANUAL");
  }

  return sources;
}

export function formatBookSourceLabel(src: BookOriginSource): string {
  if (src === "MY_STUFF") return "My Stuff";
  if (src === "GOODREADS") return "Goodreads";
  return "Manual";
}

export function resolveBookSource(
  save: Pick<UserSave, "hasConvertedPurchase" | "userCustomValues">,
  entity?: Pick<GlobalEntity, "canonicalExternalId" | "extendedAttributes"> | null
): BookSource {
  if (isOwnedBook(save, entity)) return "OWNED";
  const cv = asRecord(save.userCustomValues);
  const raw = typeof cv.bookSource === "string" ? cv.bookSource.trim().toUpperCase() : "";
  if (raw === "READ_ONLINE" || raw === "BORROWED" || raw === "GOODREADS" || raw === "OWNED") {
    return raw;
  }
  if (cv.goodreadsBookId || entity?.canonicalExternalId?.startsWith("goodreads:")) {
    return "GOODREADS";
  }
  return "READ_ONLINE";
}

export function resolveBookFormat(
  save: Pick<UserSave, "hasConvertedPurchase" | "userCustomValues">,
  entity?: Pick<GlobalEntity, "canonicalExternalId" | "extendedAttributes"> | null
): BookFormat {
  const cv = asRecord(save.userCustomValues);
  const raw = typeof cv.format === "string" ? cv.format.trim().toUpperCase() : "";
  if (
    raw === "PHYSICAL" ||
    raw === "KINDLE" ||
    raw === "EBOOK" ||
    raw === "AUDIOBOOK" ||
    raw === "ONLINE"
  ) {
    return raw;
  }
  return isOwnedBook(save, entity) ? "PHYSICAL" : "ONLINE";
}

export function extractDisplayTags(
  save: Pick<UserSave, "autoTags" | "userCustomValues">
): string[] {
  const cv = asRecord(save.userCustomValues);
  const shelves = Array.isArray(cv.goodreadsShelves) ? cv.goodreadsShelves : [];
  const autoTags = Array.isArray(save.autoTags) ? save.autoTags : [];

  const seen = new Map<string, string>();
  for (const raw of [...shelves, ...autoTags]) {
    const clean = String(raw || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (INTERNAL_NOISE_TAGS.has(key)) continue;
    if (key.startsWith("owner:")) continue;
    if (!seen.has(key)) {
      seen.set(key, clean);
    }
  }
  return [...seen.values()];
}

export function cleanCommercialBookTitle(rawTitle: string): {
  title: string;
  authorHint: string | null;
} {
  let title = rawTitle.trim();
  let authorHint: string | null = null;

  // Strip Goodreads series suffixes like "Dune (Dune #1)"
  title = title.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/g, "").trim();

  // Leading "Lastname, Firstname: Title" (common in Swiss/German bookshops)
  const leadingAuthorMatch = title.match(/^([A-ZÀ-Ü][^,:]{1,28},\s*[A-ZÀ-Ü][^:]{1,28}):\s+(.{3,})$/);
  if (leadingAuthorMatch && !/^insight guides|national geographic/i.test(leadingAuthorMatch[1])) {
    const [last, first] = leadingAuthorMatch[1].split(",").map((s) => s.trim());
    if (first && last) {
      authorHint = `${first} ${last}`;
      title = leadingAuthorMatch[2].trim();
    }
  }

  // Trailing " de Author" (Spanish Amazon export pattern)
  const trailingDeMatch = title.match(
    /^(.{4,}?)\s+de\s+([A-ZÀ-Ü][A-Za-zÀ-ü.,\s-]{2,55})$/
  );
  if (trailingDeMatch && !/\b(de la|de los|de las|de un|de una)\b/i.test(`de ${trailingDeMatch[2]}`)) {
    const candidateTitle = trailingDeMatch[1].trim();
    const rawAuthor = trailingDeMatch[2].trim();
    if (/[,]/.test(rawAuthor) || rawAuthor.split(/\s+/).length <= 3) {
      title = candidateTitle;
      if (!authorHint) {
        if (rawAuthor.includes(",")) {
          const parts = rawAuthor.split(",").map((p) => p.trim()).filter(Boolean);
          if (parts.length >= 2 && !/^national$/i.test(parts[1])) {
            authorHint = `${parts[1]} ${parts[0]}`.trim();
          } else {
            authorHint = parts.reverse().join(" ").trim();
          }
        } else {
          authorHint = rawAuthor;
        }
      }
    }
  }

  // Strip Amazon/Galaxus subtitles and edition noise
  title = title
    .replace(/:\s*The\s+(?:SUNDAY\s+TIMES|instant\s+#?1|New\s+York\s+Times)[\s\S]*$/i, "")
    .replace(/:\s*(?:A\s+Novel|Una\s+novela|Premio\s+(?:Planeta|de\s+Novela)[^()]*)$/i, "")
    .replace(/\s*-\s*Deutsch\s*\/\s*Englisch\s*$/i, "")
    .replace(/\s*\((?:Narrativas\s+hispánicas|Dos\s+amigas|Episodios\s+de\s+una\s+guerra|Guías\s+(?:de\s+País|De\s+cerca)\s+Lonely\s+Planet|GUIAS|Guiarama\s+Compact|Insight\s+Great\s+Breaks|Cocina\s+T|Los\s+crímenes\s+de\s+Fjällbacka|Juego\s+completo)[^)]*\)/gi, "")
    .replace(/,\s*\d+(?:st|nd|rd|th)\s+Edition\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: title || rawTitle.trim(),
    authorHint,
  };
}

export function normalizeDateString(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[3].padStart(2, "0")}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function toLibraryBookView(
  save: UserSave,
  entity: GlobalEntity | null
): LibraryBookView {
  const csd = asRecord(entity?.coreStructuredData);
  const ext = asRecord(entity?.extendedAttributes);
  const cv = asRecord(save.userCustomValues);

  const rawTitle = (save.privateTitle || entity?.title || "Untitled Book").trim();
  const cleaned = cleanCommercialBookTitle(rawTitle);
  const title = rawTitle;

  const author = String(
    csd.author ||
      ext.author ||
      entity?.brandOrCreator ||
      cleaned.authorHint ||
      "Unknown Author"
  ).trim();

  const rawPages = csd.pageCount ?? csd.pages ?? csd.numberOfPagesMedian ?? ext.pageCount;
  const parsedPages = typeof rawPages === "number" ? rawPages : parseInt(String(rawPages || ""), 10);
  const pageCount = Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : null;

  const rawYear = csd.year ?? csd.releaseYear ?? csd.firstPublishYear ?? ext.year;
  const parsedYear = typeof rawYear === "number" ? rawYear : parseInt(String(rawYear || ""), 10);
  const year = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : null;

  const rawRating = cv.rating ?? cv.myRating ?? csd.rating;
  const parsedRating = typeof rawRating === "number" ? rawRating : parseFloat(String(rawRating || ""));
  const rating =
    Number.isFinite(parsedRating) && parsedRating > 0 && parsedRating <= 5
      ? parsedRating
      : null;

  const isbn =
    (typeof csd.isbn === "string" && csd.isbn.trim()) ||
    (entity?.canonicalExternalId?.startsWith("isbn:")
      ? entity.canonicalExternalId.slice(5)
      : null) ||
    (typeof ext.modelNumber === "string" && /^[0-9Xx]{10,13}$/.test(ext.modelNumber.trim())
      ? ext.modelNumber.trim()
      : null);

  const owned = isOwnedBook(save, entity);
  const readingStatus = normalizeReadingStatus(cv, save.wishlist);
  const bookSource = resolveBookSource(save, entity);
  const sources = resolveBookSources(save, entity);
  const format = resolveBookFormat(save, entity);

  const marginQuotes = Array.isArray(cv.marginQuotes)
    ? cv.marginQuotes.map((q) => String(q)).filter(Boolean)
    : [];

  const goodreadsShelves = Array.isArray(cv.goodreadsShelves)
    ? cv.goodreadsShelves
        .map((s) => String(s).trim())
        .filter((s) => Boolean(s) && s.toLowerCase() !== "[edit]" && s.toLowerCase() !== "edit")
    : [];

  const dateRead = normalizeDateString(
    typeof cv.dateRead === "string" ? cv.dateRead : null
  );
  const dateAdded =
    normalizeDateString(typeof cv.dateAdded === "string" ? cv.dateAdded : null) ||
    normalizeDateString(save.createdAt) ||
    save.createdAt.slice(0, 10);
  const cleanNotes = sanitizeGoodreadsNote(save.personalNotes);

  const card: CardData = {
    save: {
      id: save.id,
      isPrivateMemo: save.isPrivateMemo,
      privateTitle: save.privateTitle,
      wishlist: save.wishlist,
      personalNotes: cleanNotes,
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
    author,
    coverUrl: entity?.heroImageUrl || null,
    summary: entity?.summary || null,
    isbn,
    pageCount,
    publisher: (typeof csd.publisher === "string" && csd.publisher.trim()) || null,
    year,
    readingStatus,
    bookSource,
    sources,
    format,
    isOwned: owned,
    rating,
    dateRead,
    dateAdded,
    personalNotes: cleanNotes,
    marginQuotes,
    tags: extractDisplayTags(save),
    goodreadsShelves,
    goodreadsBookId:
      (typeof cv.goodreadsBookId === "string" && cv.goodreadsBookId) ||
      (typeof csd.goodreadsId === "string" && csd.goodreadsId) ||
      (entity?.canonicalExternalId?.startsWith("goodreads:")
        ? entity.canonicalExternalId.slice(10)
        : null),
    retailer:
      (typeof ext.retailers === "string" && ext.retailers) ||
      (typeof csd.retailer === "string" && csd.retailer) ||
      null,
    purchaseDate:
      (typeof ext.lastBought === "string" && ext.lastBought) ||
      (typeof ext.firstBought === "string" && ext.firstBought) ||
      (typeof csd.purchaseDate === "string" && csd.purchaseDate) ||
      null,
    priceCents: entity?.priceCents ?? null,
    currency: entity?.currency ?? null,
    canonicalUrl: entity?.canonicalUrl || `https://openlibrary.org/search?q=${encodeURIComponent(cleaned.title)}`,
    createdAt: save.createdAt,
    card,
  };
}

export function computeLibraryStats(books: LibraryBookView[]): LibraryStats {
  const currentYear = String(new Date().getFullYear());
  let ownedCount = 0;
  let readOnlineCount = 0;
  let finishedCount = 0;
  let readingCount = 0;
  let wantToReadCount = 0;
  let readThisYear = 0;
  let totalPagesRead = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  const tagMap = new Map<string, { label: string; count: number }>();

  for (const book of books) {
    if (book.isOwned) ownedCount++;
    else readOnlineCount++;

    if (book.readingStatus === "FINISHED") {
      finishedCount++;
      if (book.pageCount) totalPagesRead += book.pageCount;
      if (book.dateRead?.startsWith(currentYear)) readThisYear++;
    } else if (book.readingStatus === "READING") {
      readingCount++;
    } else {
      wantToReadCount++;
    }

    if (book.rating !== null) {
      ratingSum += book.rating;
      ratingCount++;
    }

    for (const tag of book.tags) {
      const key = tag.toLowerCase();
      const cur = tagMap.get(key);
      if (cur) {
        cur.count++;
      } else {
        tagMap.set(key, { label: tag, count: 1 });
      }
    }
  }

  const tagCounts = [...tagMap.values()]
    .map((v) => ({ tag: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return {
    total: books.length,
    ownedCount,
    readOnlineCount,
    finishedCount,
    readingCount,
    wantToReadCount,
    readThisYear,
    totalPagesRead,
    avgRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    tagCounts,
  };
}

export type BookSortKey =
  | "dateAdded"
  | "author"
  | "title"
  | "read"
  | "dateRead"
  | "rating"
  | "pages";

const READ_STATUS_SORT_ORDER: Record<ReadingStatus, number> = {
  FINISHED: 0,
  READING: 1,
  WANT_TO_READ: 2,
};

export function compareLibraryBooks(
  a: LibraryBookView,
  b: LibraryBookView,
  sortBy: BookSortKey
): number {
  if (sortBy === "author") {
    const unknownA = !a.author || a.author.toLowerCase() === "unknown author";
    const unknownB = !b.author || b.author.toLowerCase() === "unknown author";
    if (unknownA !== unknownB) return unknownA ? 1 : -1;
    const cmp = a.author.localeCompare(b.author, undefined, { sensitivity: "base" });
    if (cmp !== 0) return cmp;
    return cleanCommercialBookTitle(a.title).title.localeCompare(
      cleanCommercialBookTitle(b.title).title,
      undefined,
      { sensitivity: "base" }
    );
  }
  if (sortBy === "title") {
    const titleA = cleanCommercialBookTitle(a.title).title;
    const titleB = cleanCommercialBookTitle(b.title).title;
    return titleA.localeCompare(titleB, undefined, { sensitivity: "base" });
  }
  if (sortBy === "read") {
    const statusDiff =
      READ_STATUS_SORT_ORDER[a.readingStatus] -
      READ_STATUS_SORT_ORDER[b.readingStatus];
    if (statusDiff !== 0) return statusDiff;
    const dateCmp = (b.dateRead || "").localeCompare(a.dateRead || "");
    if (dateCmp !== 0) return dateCmp;
    return cleanCommercialBookTitle(a.title).title.localeCompare(
      cleanCommercialBookTitle(b.title).title,
      undefined,
      { sensitivity: "base" }
    );
  }
  if (sortBy === "rating") {
    const rDiff = (b.rating ?? 0) - (a.rating ?? 0);
    if (rDiff !== 0) return rDiff;
  }
  if (sortBy === "pages") {
    const pDiff = (b.pageCount ?? 0) - (a.pageCount ?? 0);
    if (pDiff !== 0) return pDiff;
  }
  if (sortBy === "dateRead") {
    const dCmp = (b.dateRead || "").localeCompare(a.dateRead || "");
    if (dCmp !== 0) return dCmp;
  }
  const addCmp = (b.dateAdded || b.createdAt).localeCompare(a.dateAdded || a.createdAt);
  if (addCmp !== 0) return addCmp;
  return b.createdAt.localeCompare(a.createdAt);
}
