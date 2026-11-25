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
  mainTitle: string;
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
    .replace(/&#0*39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSignificant(text: string): string[] {
  const stop = new Set(["by", "por", "de", "del", "la", "el", "los", "las", "the", "a", "an", "and", "y", "of", "una", "un"]);
  return normalizeBookText(text)
    .split(" ")
    .filter((w) => w.length >= 2 && !stop.has(w));
}

function hasRealBookAuthor(author?: string | null): boolean {
  const clean = (author || "").trim().toLowerCase();
  return Boolean(clean) && clean !== "unknown author" && clean !== "varios autores";
}

function scoreCandidateMatch(
  query: string,
  title: string,
  author?: string | null,
  authorHint?: string | null,
  options?: { mainTitle?: string; description?: string; editionCount?: number }
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

  const normCandTitle = normalizeBookText(title);
  const normQuery = normalizeBookText(query);
  const normMainTitle = normalizeBookText(options?.mainTitle || "");

  if (normMainTitle && normMainTitle.length >= 4) {
    const mainTokens = tokenizeSignificant(options?.mainTitle || "");
    const mainHits = mainTokens.filter((t) => hayTokens.has(t) || hay.includes(t)).length;
    const mainRatio = mainTokens.length > 0 ? mainHits / mainTokens.length : 0;
    const exactMainMatch =
      normCandTitle === normMainTitle ||
      normCandTitle.startsWith(`${normMainTitle} `) ||
      normMainTitle.startsWith(`${normCandTitle} `);

    if (exactMainMatch && hasRealBookAuthor(author)) {
      score = Math.max(score, 0.85);
    } else if (mainRatio > score) {
      score = mainRatio * 0.9;
    }

    if (options?.description) {
      const descNorm = normalizeBookText(options.description);
      const subTokens = queryTokens.filter((t) => !mainTokens.includes(t));
      if (subTokens.some((t) => descNorm.includes(t))) {
        score += 0.1;
      }
    }
  }

  if (authorHint && author && normalizeBookText(author).includes(normalizeBookText(authorHint))) {
    score += 0.25;
  }
  if (normCandTitle === normQuery) {
    score += 0.35;
  }
  if (typeof options?.editionCount === "number" && options.editionCount > 1) {
    score += Math.min(0.15, Math.log10(options.editionCount + 1) * 0.05);
  }
  return score;
}

function extractMainTitleFromSubtitle(titleHint: string): string {
  const sep = titleHint.match(/^([^:—-]{3,}?)\s*(?::|—|-)\s+.+$/);
  if (sep && sep[1].trim().length >= 3) {
    return sep[1].trim();
  }
  return titleHint;
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
      mainTitle: extractMainTitleFromSubtitle(titleHint),
      authorHint,
    };
  }

  return {
    cleanQuery: base,
    titleHint: base,
    mainTitle: extractMainTitleFromSubtitle(base),
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

  const queryStorefront = async (qTerm: string, country?: string): Promise<ResolvedBook[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const countryParam = country ? `&country=${country}` : "";
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(qTerm)}&media=ebook&limit=${limit}${countryParam}`;
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

  let results = await queryStorefront(term);
  const scoreHit = (b: ResolvedBook) =>
    scoreCandidateMatch(hints.cleanQuery, b.title, b.author, effectiveAuthor, {
      mainTitle: hints.mainTitle,
      description: b.summary,
    });
  let bestInitialScore = results.reduce((max, b) => Math.max(max, scoreHit(b)), 0);
  if (results.length === 0 || bestInitialScore < 0.72) {
    const esResults = await queryStorefront(term, "es");
    if (esResults.length > 0) results = [...results, ...esResults];
    bestInitialScore = results.reduce((max, b) => Math.max(max, scoreHit(b)), 0);
  }
  if (results.length === 0 || bestInitialScore < 0.72) {
    const deResults = await queryStorefront(term, "de");
    if (deResults.length > 0) results = [...results, ...deResults];
    bestInitialScore = results.reduce((max, b) => Math.max(max, scoreHit(b)), 0);
  }
  if (
    (results.length === 0 || bestInitialScore < 0.72) &&
    hints.mainTitle &&
    normalizeBookText(hints.mainTitle) !== normalizeBookText(term)
  ) {
    const mainTerm = effectiveAuthor
      ? `${hints.mainTitle} ${effectiveAuthor}`
      : hints.mainTitle;
    const [usMain, esMain] = await Promise.all([
      queryStorefront(mainTerm),
      queryStorefront(mainTerm, "es"),
    ]);
    results = [...results, ...usMain, ...esMain];
  }

  const seen = new Set<string>();
  const scored: Array<{ book: ResolvedBook; score: number }> = [];
  for (const book of results) {
    const dedupKey = `${normalizeBookText(book.title)}::${normalizeBookText(book.author)}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const score = scoreHit(book);
    scored.push({ book, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.book);
}

/**
 * Fallback lookup via Goodreads public book autocomplete JSON (covers Spanish/European & indie releases).
 */
export async function searchGoodreadsPublicBooks(
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

  const queryGr = async (q: string): Promise<any[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `https://www.goodreads.com/book/auto_complete?format=json&q=${encodeURIComponent(q)}`;
      const res = await fetchFn(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Curio/3.2 (https://curio.local; book-enrichment)",
          Accept: "application/json",
        },
      });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      clearTimeout(timer);
      return [];
    }
  };

  let rawHits = await queryGr(hints.cleanQuery);
  if (
    rawHits.length === 0 &&
    hints.mainTitle &&
    normalizeBookText(hints.mainTitle) !== normalizeBookText(hints.cleanQuery)
  ) {
    rawHits = await queryGr(hints.mainTitle);
  }

  const mapped: Array<{ book: ResolvedBook; score: number }> = [];
  for (const hit of rawHits.slice(0, limit)) {
    const title = String(hit?.bookTitleBare || hit?.title || "").trim();
    const author = String(hit?.author?.name || effectiveAuthor || "Unknown Author").trim();
    if (!title) continue;

    const rawImg = typeof hit?.imageUrl === "string" ? hit.imageUrl.trim() : "";
    const coverUrl = rawImg
      ? rawImg.replace(/\._S[XY]\d+_\./, "._SX400_.")
      : undefined;
    const rawDesc =
      typeof hit?.description?.html === "string"
        ? stripHtmlTags(hit.description.html)
        : typeof hit?.description === "string"
        ? stripHtmlTags(hit.description)
        : "";
    const summary = rawDesc
      ? rawDesc.length > 240
        ? rawDesc.slice(0, 237) + "..."
        : rawDesc
      : `By ${author}`;
    const pageCount =
      typeof hit?.numPages === "number" && hit.numPages > 0 ? hit.numPages : undefined;
    const bookId = hit?.bookId ? String(hit.bookId) : undefined;
    const bookUrl = typeof hit?.bookUrl === "string" ? hit.bookUrl : "";
    const canonicalUrl = bookUrl.startsWith("http")
      ? bookUrl
      : bookUrl
      ? `https://www.goodreads.com${bookUrl}`
      : `https://www.goodreads.com/search?q=${encodeURIComponent(title)}`;

    const book: ResolvedBook = {
      title,
      author,
      pageCount,
      coverUrl,
      summary,
      typePath: "/product/book",
      coreType: "BOOK",
      canonicalExternalId: bookId
        ? `goodreads:${bookId}`
        : `book:${normalizeBookText(title).replace(/\s+/g, "-")}`,
      canonicalUrl,
      priceCents: 1899,
      coreStructuredData: {
        title,
        author,
        ...(pageCount ? { pageCount } : {}),
        ...(rawDesc ? { obiText: rawDesc.slice(0, 140) } : {}),
      },
    };
    const score = scoreCandidateMatch(hints.cleanQuery, title, author, effectiveAuthor, {
      mainTitle: hints.mainTitle,
      description: rawDesc,
      editionCount: typeof hit?.ratingsCount === "number" ? Math.max(1, Math.round(hit.ratingsCount / 25)) : undefined,
    });
    mapped.push({ book, score });
  }

  mapped.sort((a, b) => b.score - a.score);
  return mapped.map((m) => m.book);
}

/**
 * Resolves book publication details via ISBN lookup, Apple Books, Goodreads public catalog, OpenLibrary, Google Books, and optional Tavily fallback.
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

  // 0. Exact ISBN lookup via OpenLibrary Bibkeys API (when ISBN is known)
  if (options?.isbnHint) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 3500));
      const bibUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(
        options.isbnHint
      )}&format=json&jscmd=data`;
      const res = await fetchFn(bibUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const entry = data?.[`ISBN:${options.isbnHint}`];
        if (entry && entry.title) {
          const title = String(entry.title).trim();
          const author =
            entry.authors?.[0]?.name || effectiveAuthor || "Unknown Author";
          const pageCount =
            typeof entry.number_of_pages === "number" ? entry.number_of_pages : undefined;
          const publisher = entry.publishers?.[0]?.name || undefined;
          const yearMatch = String(entry.publish_date || "").match(/\b(1[89]\d\d|20[0-2]\d)\b/);
          const releaseYear = yearMatch
            ? parseInt(yearMatch[1], 10)
            : options?.yearHint || undefined;
          const coverUrl =
            entry.cover?.large ||
            entry.cover?.medium ||
            `https://covers.openlibrary.org/b/isbn/${options.isbnHint}-L.jpg`;
          return {
            title,
            author,
            isbn: options.isbnHint,
            pageCount,
            publisher,
            releaseYear,
            coverUrl,
            summary: `By ${author}${releaseYear ? ` (${releaseYear})` : ""}${publisher ? ` • Published by ${publisher}` : ""}`,
            typePath: "/product/book",
            coreType: "BOOK",
            canonicalExternalId: `isbn:${options.isbnHint}`,
            canonicalUrl: entry.url || `https://openlibrary.org/isbn/${options.isbnHint}`,
            priceCents: 1899,
            coreStructuredData: {
              title,
              author,
              isbn: options.isbnHint,
              pageCount,
              publisher,
              year: releaseYear,
              obiText: `A definitive work by ${author}.`,
            },
          };
        }
      }
    } catch {
      // Fall through to search providers
    }
  }

  // 1. Primary: Apple Books / iTunes Ebook Catalog (fast, free, multilingual/new releases)
  if (!options?.isbnHint) {
    const appleHits = await searchAppleBooks(cleanQuery, {
      limit: 5,
      timeoutMs: Math.min(timeoutMs, 3500),
      fetchFn,
      authorHint: effectiveAuthor,
    });
    const topApple = appleHits[0];
    if (topApple) {
      const score = scoreCandidateMatch(cleanQuery, topApple.title, topApple.author, effectiveAuthor, {
        mainTitle: hints.mainTitle,
        description: topApple.summary,
      });
      if (!options?.requireStrongMatch || score >= 0.72) {
        return topApple;
      }
    }
  }

  // 2. Fallback: Goodreads Public Catalog Autocomplete (strong Spanish/European & indie fiction coverage)
  try {
    const grQuery = options?.isbnHint ? options.isbnHint : cleanQuery;
    const grHits = await searchGoodreadsPublicBooks(grQuery, {
      limit: 5,
      timeoutMs: Math.min(timeoutMs, 3500),
      fetchFn,
      authorHint: effectiveAuthor,
    });
    const topGr = grHits[0];
    if (topGr) {
      const score = scoreCandidateMatch(cleanQuery, topGr.title, topGr.author, effectiveAuthor, {
        mainTitle: hints.mainTitle,
        description: topGr.summary,
      });
      if (options?.isbnHint || !options?.requireStrongMatch || score >= 0.72) {
        return {
          ...topGr,
          ...(options?.isbnHint ? { isbn: options.isbnHint } : {}),
        };
      }
    }
  } catch {
    // Fall through to OpenLibrary
  }

  // 3. Fallback: OpenLibrary Search API (top 5 ranked by match + edition popularity)
  try {
    const olQueries = [searchQuery];
    if (
      !options?.isbnHint &&
      hints.mainTitle &&
      normalizeBookText(hints.mainTitle) !== normalizeBookText(hints.cleanQuery)
    ) {
      olQueries.push(
        effectiveAuthor ? `${hints.mainTitle} ${effectiveAuthor}` : hints.mainTitle
      );
    }
    for (const q of olQueries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5`;
      const res = await fetchFn(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) continue;
      const data = await res.json();
      const docs: any[] = Array.isArray(data?.docs) ? data.docs : [];
      let bestDoc: any = null;
      let bestDocScore = -1;
      for (const doc of docs) {
        if (!doc?.title) continue;
        const author = doc.author_name?.[0] || effectiveAuthor || "Unknown Author";
        const sc = scoreCandidateMatch(cleanQuery, doc.title, author, effectiveAuthor, {
          mainTitle: hints.mainTitle,
          editionCount: typeof doc.edition_count === "number" ? doc.edition_count : undefined,
        });
        if (sc > bestDocScore) {
          bestDocScore = sc;
          bestDoc = doc;
        }
      }

      if (bestDoc && (!options?.requireStrongMatch || bestDocScore >= 0.72)) {
        const title = bestDoc.title;
        const author = bestDoc.author_name?.[0] || effectiveAuthor || "Unknown Author";
        const isbn = options?.isbnHint || bestDoc.isbn?.[0];
        const pageCount = bestDoc.number_of_pages_median;
        const publisher = bestDoc.publisher?.[0];
        const releaseYear = bestDoc.first_publish_year || options?.yearHint || undefined;
        const coverId = bestDoc.cover_i;
        const coverUrl = coverId
          ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
          : isbn
          ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
          : undefined;

        const canonicalExternalId = isbn
          ? `isbn:${isbn}`
          : `openlibrary:${bestDoc.key?.replace("/works/", "") || cleanQuery}`;
        const canonicalUrl = `https://openlibrary.org${
          bestDoc.key || `/search?q=${encodeURIComponent(title)}`
        }`;

        return {
          title,
          author,
          isbn,
          pageCount,
          publisher,
          releaseYear,
          coverUrl,
          summary: `By ${author}${releaseYear ? ` (${releaseYear})` : ""}${
            publisher ? ` • Published by ${publisher}` : ""
          }`,
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

  // 4. Fallback: Google Books Volumes API (top 5, retry with intitle:mainTitle)
  try {
    const gbQueries = [searchQuery];
    if (
      !options?.isbnHint &&
      hints.mainTitle &&
      normalizeBookText(hints.mainTitle) !== normalizeBookText(hints.cleanQuery)
    ) {
      gbQueries.push(
        effectiveAuthor
          ? `intitle:${hints.mainTitle} inauthor:${effectiveAuthor}`
          : `intitle:${hints.mainTitle}`
      );
    }
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";
    for (const q of gbQueries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5${keyParam}`;
      const res = await fetchFn(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;

      const data = await res.json();
      const items: any[] = Array.isArray(data?.items) ? data.items : [];
      let bestItem: any = null;
      let bestScore = -1;
      for (const it of items) {
        const vol = it?.volumeInfo;
        if (!vol?.title) continue;
        const author = vol.authors?.[0] || effectiveAuthor || "Unknown Author";
        const sc = scoreCandidateMatch(cleanQuery, vol.title, author, effectiveAuthor, {
          mainTitle: hints.mainTitle,
          description: vol.description,
        });
        if (sc > bestScore) {
          bestScore = sc;
          bestItem = it;
        }
      }

      if (bestItem?.volumeInfo && (!options?.requireStrongMatch || bestScore >= 0.72)) {
        const vol = bestItem.volumeInfo;
        const title = vol.title;
        const author = vol.authors?.[0] || effectiveAuthor || "Unknown Author";
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

        const canonicalExternalId = isbn ? `isbn:${isbn}` : `googlebooks:${bestItem.id || cleanQuery}`;
        const canonicalUrl = vol.infoLink || `https://books.google.com/books?id=${bestItem.id}`;

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
