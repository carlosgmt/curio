import { parseCSV } from "./csvParser";
import {
  normalizeDateString,
  normalizeReadingStatus,
  readingStatusToShelf,
  type ReadingStatus,
} from "../books/library";

export interface ImportedBook {
  bookId?: string;
  title: string;
  author: string;
  isbn?: string;
  isbn13?: string;
  pageCount?: number;
  publisher?: string;
  yearPublished?: number;
  myRating?: number;
  review?: string;
  privateNotes?: string;
  shelf?: "read" | "currently-reading" | "to-read";
  readingStatus?: ReadingStatus;
  wishlist?: boolean;
  goodreadsShelves?: string[];
  tags?: string[];
  dateRead?: string;
  dateAdded?: string;
  ownedCopies?: number;
  typePath: "/product/book";
  coreType: "BOOK";
  canonicalExternalId: string;
  coreStructuredData: {
    title: string;
    author: string;
    isbn?: string;
    pageCount?: number;
    publisher?: string;
    year?: number;
    rating?: number;
    obiText?: string;
    goodreadsId?: string;
  };
}

const EXCLUSIVE_SHELVES = new Set(["read", "currently-reading", "to-read"]);

/**
 * Parses Goodreads goodreads_library_export.csv including custom shelves (tags),
 * exclusive shelf, reading status, dates, private notes, and owned copies.
 */
export function parseGoodreadsCSV(csvText: string): ImportedBook[] {
  const rows = parseCSV(csvText);
  const books: ImportedBook[] = [];

  for (const row of rows) {
    const rawTitle = row["Title"];
    if (!rawTitle) continue;

    // Clean title (Goodreads sometimes appends series info like "Dune (Dune #1)")
    const cleanTitle = rawTitle.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/g, "").trim() || rawTitle.trim();
    const author = row["Author"] || "Unknown";

    // Clean ISBN (Goodreads wraps ISBNs in ="1234567890")
    const cleanIsbnField = (val?: string) => {
      if (!val) return undefined;
      const unquoted = val.replace(/^="?|"?$/g, "").trim();
      return unquoted || undefined;
    };

    const isbn13 = cleanIsbnField(row["ISBN13"]);
    const isbn10 = cleanIsbnField(row["ISBN"]);
    const bookId = row["Book Id"]?.trim() || undefined;
    const finalIsbn = isbn13 || isbn10;

    const pagesStr = row["Number of Pages"];
    const parsedPages = pagesStr ? parseInt(pagesStr, 10) : NaN;
    const pageCount = Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : undefined;

    const yearStr = row["Year Published"] || row["Original Publication Year"];
    const parsedYear = yearStr ? parseInt(yearStr, 10) : NaN;
    const yearPublished = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : undefined;

    const publisher = row["Publisher"]?.trim() || undefined;
    const ratingStr = row["My Rating"];
    const parsedRating = ratingStr && ratingStr !== "0" ? parseInt(ratingStr, 10) : NaN;
    const myRating =
      Number.isFinite(parsedRating) && parsedRating > 0 && parsedRating <= 5
        ? parsedRating
        : undefined;
    const review = row["My Review"]?.trim() || undefined;
    const privateNotes = row["Private Notes"]?.trim() || undefined;

    const rawExclusive = (row["Exclusive Shelf"] || "read").trim().toLowerCase();
    const shelf: "read" | "currently-reading" | "to-read" =
      rawExclusive === "to-read"
        ? "to-read"
        : rawExclusive === "currently-reading"
        ? "currently-reading"
        : "read";

    const rawShelves = (row["Bookshelves"] || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && !EXCLUSIVE_SHELVES.has(s));
    const goodreadsShelves = [...new Set(rawShelves)];

    const dateRead = normalizeDateString(row["Date Read"]) || undefined;
    const dateAdded = normalizeDateString(row["Date Added"]) || undefined;

    const ownedStr = row["Owned Copies"];
    const parsedOwned = ownedStr ? parseInt(ownedStr, 10) : NaN;
    const ownedCopies = Number.isFinite(parsedOwned) && parsedOwned > 0 ? parsedOwned : 0;

    const wishlist = ownedCopies > 0 ? false : shelf === "to-read";
    const readingStatus = normalizeReadingStatus(
      { shelf: readingStatusToShelf(shelf === "read" ? "FINISHED" : shelf === "currently-reading" ? "READING" : "WANT_TO_READ") },
      wishlist
    );

    const tags = [...new Set(["book", "goodreads", shelf, ...goodreadsShelves])];

    const canonicalExternalId = finalIsbn
      ? `isbn:${finalIsbn}`
      : `goodreads:${bookId || cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    books.push({
      bookId,
      title: cleanTitle,
      author,
      isbn: finalIsbn,
      isbn13,
      pageCount,
      publisher,
      yearPublished,
      myRating,
      review,
      privateNotes,
      shelf,
      readingStatus,
      wishlist,
      goodreadsShelves,
      tags,
      dateRead,
      dateAdded,
      ownedCopies,
      typePath: "/product/book",
      coreType: "BOOK",
      canonicalExternalId,
      coreStructuredData: {
        title: cleanTitle,
        author,
        isbn: finalIsbn,
        pageCount,
        publisher,
        year: yearPublished,
        rating: myRating,
        obiText: review ? review.slice(0, 140) : undefined,
        ...(bookId ? { goodreadsId: bookId } : {}),
      },
    });
  }

  return books;
}
