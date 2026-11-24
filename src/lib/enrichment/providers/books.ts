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

export type BookFetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface ResolveBookOptions {
  authorHint?: string | null;
  isbnHint?: string | null;
  yearHint?: number | null;
  fetchFn?: BookFetchFn;
  timeoutMs?: number;
  requireStrongMatch?: boolean;
}

export interface BookQueryHints {
  cleanQuery: string;
  titleHint: string;
  authorHint: string | null;
}

function normalizeBookText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSignificant(text: string): string[] {
  const stop = new Set(["by", "por", "de", "del", "la", "el", "los", "las", "the", "a", "an", "and", "y", "of"]);
  return normalizeBookText(text)
    .split(" ")
    .filter((w) => w.length >= 2 && !stop.has(w));
}

function scoreCandidateMatch(
  query: string,
  title: string,
  author?: string | null,
  authorHint?: string | null
): number {
  const queryTokens = tokenizeSignificant(query);
  if (queryTokens.length === 0) return 0;
  const hay = normalizeBookText(`${title} ${author || ""}`);
  const hayTokens = new Set(hay.split(" "));
  let hits = 0;
  for (const tok of queryTokens) {
    if (hayTokens.has(tok) || hay.includes(tok)) {
      hits++;
    }
  }
  let score = hits / queryTokens.length;
  if (authorHint && author && normalizeBookText(author).includes(normalizeBookText(authorHint))) {
    score += 0.25;
  }
  if (normalizeBookText(title) === normalizeBookText(query)) {
    score += 0.35;
  }
  return score;
}

export function parseBookQueryHints(raw: string): BookQueryHints {
  const withoutTags = raw
    .replace(/\b(?:book|libro|novel|novela|memoir|hardcover|paperback|author|autor)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = withoutTags || raw.trim();

  const sepMatch = base.match(/^(.{2,}?)\s+(?:by|por|-|—)\s+(.{2,})$/i);
  if (sepMatch) {
    const titleHint = sepMatch[1].trim();
    const authorHint = sepMatch[2].trim();
    return {
      cleanQuery: `${titleHint} ${authorHint}`.trim(),
      titleHint,
      authorHint,
    };
  }

  return {
    cleanQuery: base,
    titleHint: base,
    authorHint: null,
  };
}

function mapItunesEbookResult(item: any): ResolvedBook | null {
  const title = typeof item?.trackName === "string" ? item.trackName.trim() : "";
  const author = typeof item?.artistName === "string" ? item.artistName.trim() : "";
  if (!title) return null;

  const rawArtwork = String(item?.artworkUrl100 || item?.artworkUrl60 || "").trim();
  const coverUrl = rawArtwork
    ? rawArtwork.replace(/\/\d+x\d+bb\./, "/600x600bb.")
    : undefined;
  const isbnMatch = rawArtwork.match(/\/(97[89]\d{10})(?:\.[a-z0-9]+)?\//i);
  const isbn = isbnMatch ? isbnMatch[1] : undefined;

  const yearStr = typeof item?.releaseDate === "string" ? item.releaseDate.slice(0, 4) : "";
  const releaseYear = /^\d{4}$/.test(yearStr) ? parseInt(yearStr, 10) : undefined;
  const rawDesc = typeof item?.description === "string" ? stripHtmlTags(item.description) : "";
  const summary = rawDesc
    ? rawDesc.length > 240
      ? rawDesc.slice(0, 237) + "..."
      : rawDesc
    : `By ${author || "Unknown Author"}${releaseYear ? ` (${releaseYear})` : ""}`;

  const canonicalExternalId = isbn
    ? `isbn:${isbn}`
    : item?.trackId
    ? `itunes:book:${item.trackId}`
    : `book:${normalizeBookText(title).replace(/\s+/g, "-")}`;
  const canonicalUrl =
    (typeof item?.trackViewUrl === "string" && item.trackViewUrl) ||
    `https://books.apple.com/search?term=${encodeURIComponent(title)}`;

  const priceCents =
    typeof item?.price === "number" && item.price > 0
      ? Math.round(item.price * 100)
      : 1899;

  return {
    title,
    author: author || "Unknown Author",
    isbn,
    releaseYear,
    coverUrl,
    summary,
    typePath: "/product/book",
    coreType: "BOOK",
    canonicalExternalId,
    canonicalUrl,
    priceCents,
    coreStructuredData: {
      title,
      author: author || "Unknown Author",
      ...(isbn ? { isbn } : {}),
      ...(releaseYear ? { year: releaseYear } : {}),
      obiText: rawDesc
        ? rawDesc.slice(0, 140)
        : `A definitive work by ${author || title}.`,
    },
  };
}

export async function searchAppleBooks(
  query: string,
  options?: {
    limit?: number;
    timeoutMs?: number;
    fetchFn?: BookFetchFn;
    authorHint?: string | null;
  }
): Promise<ResolvedBook[]> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 4000;
  const limit = Math.max(1, Math.min(options?.limit ?? 5, 10));
  const hints = parseBookQueryHints(query);
  const effectiveAuthor = options?.authorHint || hints.authorHint;
  const term =
    effectiveAuthor && !normalizeBookText(hints.titleHint).includes(normalizeBookText(effectiveAuthor))
      ? `${hints.titleHint} ${effectiveAuthor}`
      : hints.cleanQuery;
  if (!term || term.length < 2) return [];

  const queryStorefront = async (country?: string): Promise<ResolvedBook[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const countryParam = country ? `&country=${country}` : "";
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=ebook&limit=${limit}${countryParam}`;
      const res = await fetchFn(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data?.results)) return [];
      return data.results
        .map(mapItunesEbookResult)
        .filter((b: ResolvedBook | null): b is ResolvedBook => Boolean(b));
    } catch {
      clearTimeout(timer);
      return [];
    }
  };

  let results = await queryStorefront();
  const bestInitialScore = results.reduce(
    (max, b) => Math.max(max, scoreCandidateMatch(hints.cleanQuery, b.title, b.author, effectiveAuthor)),
    0
  );
  if (results.length === 0 || bestInitialScore < 0.72) {
    const esResults = await queryStorefront("es");
    if (esResults.length > 0) {
      results = [...results, ...esResults];
    }
  }

  const seen = new Set<string>();
  const scored: Array<{ book: ResolvedBook; score: number }> = [];
  for (const book of results) {
    const dedupKey = `${normalizeBookText(book.title)}::${normalizeBookText(book.author)}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const score = scoreCandidateMatch(
      hints.cleanQuery,
      book.title,
      book.author,
      effectiveAuthor
    );
    scored.push({ book, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.book);
}

/**
 * Resolves book publication details via Apple Books, OpenLibrary, Google Books, and optional Tavily fallback.
 */
export async function resolveBook(
  query: string,
  options?: ResolveBookOptions
): Promise<ResolvedBook | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 6000;
  const hints = parseBookQueryHints(query);
  const cleanQuery = hints.cleanQuery || query.trim();
  const effectiveAuthor = options?.authorHint || hints.authorHint;
  const searchQuery = options?.isbnHint
    ? `isbn:${options.isbnHint}`
    : effectiveAuthor && !normalizeBookText(hints.titleHint).includes(normalizeBookText(effectiveAuthor))
    ? `${hints.titleHint} ${effectiveAuthor}`
    : cleanQuery;

  // 1. Primary: Apple Books / iTunes Ebook Catalog (fast, free, multilingual/new releases)
  if (!options?.isbnHint) {
    const appleHits = await searchAppleBooks(cleanQuery, {
      limit: 3,
      timeoutMs: Math.min(timeoutMs, 3500),
      fetchFn,
      authorHint: effectiveAuthor,
    });
    const topApple = appleHits[0];
    if (topApple) {
      const score = scoreCandidateMatch(cleanQuery, topApple.title, topApple.author, effectiveAuthor);
      if (!options?.requireStrongMatch || score >= 0.72) {
        return topApple;
      }
    }
  }

  // 2. Fallback: OpenLibrary Search API
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
        const author = doc.author_name?.[0] || effectiveAuthor || "Unknown Author";
        const score = scoreCandidateMatch(cleanQuery, title, author, effectiveAuthor);
        if (!options?.requireStrongMatch || score >= 0.72) {
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
    }
  } catch {
    // Fall through to Google Books
  }

  // 3. Fallback: Google Books Volumes API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=1${keyParam}`;
    const res = await fetchFn(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const item = data?.items?.[0];
      const vol = item?.volumeInfo;

      if (vol && vol.title) {
        const title = vol.title;
        const author = vol.authors?.[0] || effectiveAuthor || "Unknown Author";
        const score = scoreCandidateMatch(cleanQuery, title, author, effectiveAuthor);
        if (!options?.requireStrongMatch || score >= 0.72) {
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
    }
  } catch {
    // Fall through to Tavily
  }

  // 4. Optional Tavily Web Discovery Fallback (when structured catalogs miss and key is configured)
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetchFn("https://api.tavily.com/search", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `${cleanQuery} book OR libro OR novela`,
          max_results: 3,
          include_images: true,
        }),
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const hit = (Array.isArray(data?.results) ? data.results : []).find((r: any) =>
          /\b(book|libro|novela|isbn|goodreads|casadellibro|fnac|amazon|todostuslibros|penguin|planeta)\b/i.test(
            `${r?.url || ""} ${r?.title || ""} ${r?.content || ""}`
          )
        );
        if (hit && hit.title) {
          const cleanTitle = hints.titleHint || String(hit.title).split(/[-|:]/)[0].trim();
          const author = effectiveAuthor || "Unknown Author";
          const content = String(hit.content || "").trim();
          return {
            title: cleanTitle,
            author,
            coverUrl: Array.isArray(data?.images) ? data.images[0] : undefined,
            summary: content ? content.slice(0, 240) : `Book discovered via web lookup: ${cleanTitle}`,
            typePath: "/product/book",
            coreType: "BOOK",
            canonicalExternalId: `webbook:${normalizeBookText(cleanTitle).replace(/\s+/g, "-")}`,
            canonicalUrl: String(hit.url || `https://openlibrary.org/search?q=${encodeURIComponent(cleanTitle)}`),
            priceCents: 1899,
            coreStructuredData: {
              title: cleanTitle,
              author,
              obiText: content ? content.slice(0, 120) : `By ${author}.`,
            },
          };
        }
      }
    } catch {
      // Ignore Tavily errors cleanly
    }
  }

  return null;
}
