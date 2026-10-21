export interface ResolvedBook {
  title: string;
  author: string;
  isbn?: string;
  pageCount?: number;
  publisher?: string;
  releaseYear?: number;
  coverUrl?: string;
  summary?: string;
  typePath: "/product/book";
  coreType: "BOOK";
  canonicalExternalId: string;
  canonicalUrl: string;
  priceCents: number;
  coreStructuredData: {
    title: string;
    author: string;
    isbn?: string;
    pageCount?: number;
    publisher?: string;
    year?: number;
    obiText?: string;
  };
}

export interface ResolveBookOptions {
  authorHint?: string | null;
  isbnHint?: string | null;
  yearHint?: number | null;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Resolves book publication details from OpenLibrary and Google Books APIs
 */
export async function resolveBook(
  query: string,
  options?: ResolveBookOptions
): Promise<ResolvedBook | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 6000;
  const cleanQuery = query.replace(/\b(?:book|novel|hardcover|paperback)\b/gi, "").trim() || query.trim();
  const searchQuery = options?.isbnHint
    ? `isbn:${options.isbnHint}`
    : options?.authorHint && !cleanQuery.toLowerCase().includes(options.authorHint.toLowerCase())
    ? `${cleanQuery} ${options.authorHint}`
    : cleanQuery;

  // 1. Try OpenLibrary Search API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=1`;
    const res = await fetchFn(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const doc = data?.docs?.[0];
      if (doc && doc.title) {
        const title = doc.title;
        const author = doc.author_name?.[0] || options?.authorHint || "Unknown Author";
        const isbn = options?.isbnHint || doc.isbn?.[0];
        const pageCount = doc.number_of_pages_median;
        const publisher = doc.publisher?.[0];
        const releaseYear = doc.first_publish_year || options?.yearHint || undefined;
        const coverId = doc.cover_i;
        const coverUrl = coverId
          ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
          : isbn
          ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
          : undefined;

        const canonicalExternalId = isbn ? `isbn:${isbn}` : `openlibrary:${doc.key?.replace("/works/", "") || cleanQuery}`;
        const canonicalUrl = `https://openlibrary.org${doc.key || `/search?q=${encodeURIComponent(title)}`}`;

        return {
          title,
          author,
          isbn,
          pageCount,
          publisher,
          releaseYear,
          coverUrl,
          summary: `By ${author}${releaseYear ? ` (${releaseYear})` : ""}${publisher ? ` • Published by ${publisher}` : ""}`,
          typePath: "/product/book",
          coreType: "BOOK",
          canonicalExternalId,
          canonicalUrl,
          priceCents: 1899,
          coreStructuredData: {
            title,
            author,
            isbn,
            pageCount,
            publisher,
            year: releaseYear,
            obiText: `A definitive work by ${author}.`,
          },
        };
      }
    }
  } catch {
    // Fall through to Google Books
  }

  // 2. Fallback to Google Books Volumes API (Zero Auth required for search)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=1`;
    const res = await fetchFn(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const item = data?.items?.[0];
      const vol = item?.volumeInfo;

      if (vol && vol.title) {
        const title = vol.title;
        const author = vol.authors?.[0] || options?.authorHint || "Unknown Author";
        const isbn13 = vol.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier;
        const isbn10 = vol.industryIdentifiers?.find((id: any) => id.type === "ISBN_10")?.identifier;
        const isbn = options?.isbnHint || isbn13 || isbn10;
        const pageCount = vol.pageCount;
        const publisher = vol.publisher;
        const yearStr = vol.publishedDate?.split("-")[0];
        const releaseYear = yearStr ? parseInt(yearStr, 10) : options?.yearHint || undefined;
        const coverUrl =
          vol.imageLinks?.thumbnail?.replace("http://", "https://") ||
          vol.imageLinks?.smallThumbnail?.replace("http://", "https://");

        const canonicalExternalId = isbn ? `isbn:${isbn}` : `googlebooks:${item.id || cleanQuery}`;
        const canonicalUrl = vol.infoLink || `https://books.google.com/books?id=${item.id}`;

        return {
          title,
          author,
          isbn,
          pageCount,
          publisher,
          releaseYear,
          coverUrl,
          summary: vol.description ? vol.description.slice(0, 240) + "..." : `By ${author}`,
          typePath: "/product/book",
          coreType: "BOOK",
          canonicalExternalId,
          canonicalUrl,
          priceCents: 1899,
          coreStructuredData: {
            title,
            author,
            isbn,
            pageCount,
            publisher,
            year: releaseYear,
            obiText: vol.description ? vol.description.slice(0, 120) : `A milestone title by ${author}.`,
          },
        };
      }
    }
  } catch {
    // Both providers failed
  }

  return null;
}
