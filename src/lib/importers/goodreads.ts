import { parseCSV } from "./csvParser";

export interface ImportedBook {
  title: string;
  author: string;
  isbn?: string;
  pageCount?: number;
  publisher?: string;
  yearPublished?: number;
  myRating?: number;
  review?: string;
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
  };
}

/**
 * Parses Goodreads goodreads_library_export.csv
 */
export function parseGoodreadsCSV(csvText: string): ImportedBook[] {
  const rows = parseCSV(csvText);
  const books: ImportedBook[] = [];

  for (const row of rows) {
    const rawTitle = row["Title"];
    if (!rawTitle) continue;

    // Clean title (Goodreads sometimes appends series info like "Dune (Dune #1)")
    const cleanTitle = rawTitle.replace(/\s*\([^)]*#\d+[^)]*\)/g, "").trim();
    const author = row["Author"] || "Unknown";

    // Clean ISBN (Goodreads wraps ISBNs in ="1234567890")
    const cleanIsbnField = (val?: string) => {
      if (!val) return undefined;
      const unquoted = val.replace(/^="?|"?$/g, "").trim();
      return unquoted || undefined;
    };

    const isbn13 = cleanIsbnField(row["ISBN13"]);
    const isbn10 = cleanIsbnField(row["ISBN"]);
    const bookId = row["Book Id"];
    const finalIsbn = isbn13 || isbn10;

    const pagesStr = row["Number of Pages"];
    const pageCount = pagesStr ? parseInt(pagesStr, 10) : undefined;

    const yearStr = row["Year Published"] || row["Original Publication Year"];
    const yearPublished = yearStr ? parseInt(yearStr, 10) : undefined;

    const publisher = row["Publisher"] || undefined;
    const ratingStr = row["My Rating"];
    const myRating = ratingStr && ratingStr !== "0" ? parseInt(ratingStr, 10) : undefined;
    const review = row["My Review"] || undefined;

    const canonicalExternalId = finalIsbn
      ? `isbn:${finalIsbn}`
      : `goodreads:${bookId || cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    books.push({
      title: cleanTitle,
      author,
      isbn: finalIsbn,
      pageCount,
      publisher,
      yearPublished,
      myRating,
      review,
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
      },
    });
  }

  return books;
}
