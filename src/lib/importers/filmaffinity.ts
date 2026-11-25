import { parseCSV } from "./csvParser";
import { normalizeDateString } from "../books/library";

export interface ImportedFilmAffinityItem {
  filmaffinityId?: string;
  title: string;
  releaseYear?: number;
  director?: string;
  genres?: string[];
  rating?: number;
  filmaffinityRating10?: number;
  dateWatched?: string;
  isWatchlist: boolean;
  review?: string;
  posterUrl?: string;
  canonicalUrl: string;
}

function normalizeFaRatingToFiveStar(raw?: string | number | null): {
  fiveStar?: number;
  rating10?: number;
} {
  if (raw === undefined || raw === null) return {};
  const str = String(raw).replace(",", ".").trim();
  if (!str || str === "-" || /^n\/a$/i.test(str)) return {};
  const val = parseFloat(str);
  if (!Number.isFinite(val) || val <= 0) return {};
  if (val > 5 && val <= 10) {
    return {
      rating10: val,
      fiveStar: Math.max(0.5, Math.min(5, Math.round(val) / 2)),
    };
  }
  if (val <= 5) {
    return {
      fiveStar: Math.round(val * 2) / 2,
    };
  }
  return {};
}

function decodeHtmlText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFilmAffinityIdFromUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const m = url.match(/film(\d{4,9})\.html/i) || url.match(/[?&]id=(\d{4,9})/i);
  return m ? m[1] : undefined;
}

export function parseFilmAffinityCSV(
  csvText: string,
  options?: { isWatchlist?: boolean }
): ImportedFilmAffinityItem[] {
  const rows = parseCSV(csvText);
  const items: ImportedFilmAffinityItem[] = [];

  for (const row of rows) {
    const title = (
      row["Title"] ||
      row["Título"] ||
      row["Original Title"] ||
      row["Título original"] ||
      row["Name"] ||
      ""
    ).trim();
    if (!title) continue;

    const rawYear = row["Year"] || row["Año"] || "";
    const parsedYear = rawYear ? parseInt(rawYear, 10) : NaN;
    const releaseYear =
      Number.isFinite(parsedYear) && parsedYear > 1880 && parsedYear < 2100
        ? parsedYear
        : undefined;

    const rawDirector = (
      row["Director"] ||
      row["Directors"] ||
      row["Dirección"] ||
      ""
    ).trim();
    const director = rawDirector || undefined;

    const rawGenres = (row["Genres"] || row["Géneros"] || row["Genre"] || row["Género"] || "")
      .split(/[,;|/]/)
      .map((g) => g.trim())
      .filter(Boolean);

    const { fiveStar, rating10 } = normalizeFaRatingToFiveStar(
      row["Rating"] || row["Nota"] || row["My Rating"] || row["Score"] || row["Puntuación"]
    );

    const rawDate = row["WatchedDate"] || row["Watched Date"] || row["Fecha"] || row["Date"] || "";
    const dateWatched = normalizeDateString(rawDate) || (rawDate.trim() || undefined);

    const review = (row["Review"] || row["Crítica"] || row["Comment"] || "").trim() || undefined;
    const rawUrl = (row["URL"] || row["Link"] || row["FilmAffinity URL"] || "").trim();
    const rawId = (row["ID"] || row["Movie ID"] || "").trim();
    const faId = rawId || extractFilmAffinityIdFromUrl(rawUrl);

    const wlCell = (row["Watchlist"] || row["Pendientes"] || row["List"] || "").trim().toLowerCase();
    const isWatchlist =
      Boolean(options?.isWatchlist) ||
      wlCell === "yes" ||
      wlCell === "true" ||
      wlCell === "1" ||
      wlCell.includes("watchlist") ||
      wlCell.includes("pendiente");

    const canonicalUrl =
      rawUrl ||
      (faId
        ? `https://www.filmaffinity.com/en/film${faId}.html`
        : `https://www.filmaffinity.com/en/search.php?stext=${encodeURIComponent(title)}`);

    items.push({
      filmaffinityId: faId,
      title,
      releaseYear,
      director,
      ...(rawGenres.length > 0 ? { genres: rawGenres } : {}),
      rating: fiveStar,
      filmaffinityRating10: rating10,
      dateWatched,
      isWatchlist,
      review,
      canonicalUrl,
    });
  }

  return items;
}

/**
 * Parses saved FilmAffinity HTML pages (`userratings.php`, `mylist.php`, custom lists)
 * exported directly from the user's browser (`Cmd+S`).
 */
export function parseFilmAffinityHtml(
  htmlText: string,
  options?: { isWatchlist?: boolean }
): ImportedFilmAffinityItem[] {
  const items: ImportedFilmAffinityItem[] = [];
  const seenIds = new Set<string>();

  const defaultWatchlist =
    Boolean(options?.isWatchlist) ||
    /mis pendientes|my watchlist|mylist\.php/i.test(htmlText.slice(0, 6000));

  const cardRegex =
    /<div[^>]*class=["'][^"']*movie-card(?:-ac|\s|["'])[^"']*["'][^>]*data-movie-id=["'](\d+)["'][^>]*>([\s\S]*?)(?=<div[^>]*class=["'][^"']*movie-card|<\/ul>|<div[^>]*class=["'][^"']*footer|$)/gi;

  const parseBlock = (faId: string | undefined, block: string) => {
    const titleMatch =
      block.match(/class=["'][^"']*mc-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
      block.match(/<a[^>]+href=["'][^"']*film\d+\.html["'][^>]*title=["']([^"']+)["']/i) ||
      block.match(/<a[^>]+href=["'][^"']*film\d+\.html["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) return;

    let rawTitle = decodeHtmlText(titleMatch[1]);
    let releaseYear: number | undefined;
    const inlineYear = rawTitle.match(/^(.*?)\s*\((\d{4})\)\s*$/);
    if (inlineYear) {
      rawTitle = inlineYear[1].trim();
      releaseYear = parseInt(inlineYear[2], 10);
    }
    if (!releaseYear) {
      const yearMatch = block.match(/class=["'][^"']*mc-year[^"']*["'][^>]*>\s*(\d{4})\s*</i);
      if (yearMatch) releaseYear = parseInt(yearMatch[1], 10);
    }
    if (!rawTitle) return;

    const hrefMatch = block.match(/<a[^>]+href=["']([^"']*film\d+\.html[^"']*)["']/i);
    const resolvedId = faId || extractFilmAffinityIdFromUrl(hrefMatch?.[1]);
    const key = resolvedId || `${rawTitle.toLowerCase()}::${releaseYear || ""}`;
    if (seenIds.has(key)) return;
    seenIds.add(key);

    const dirMatch = block.match(/class=["'][^"']*mc-director[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const director = dirMatch ? decodeHtmlText(dirMatch[1]) || undefined : undefined;

    const posterMatch = block.match(/class=["'][^"']*mc-poster[^"']*["'][\s\S]*?<img[^>]+(?:data-src|src)=["']([^"']+)["']/i);
    const posterUrl = posterMatch?.[1]?.trim() || undefined;

    const ratingMatch =
      block.match(/class=["'][^"']*(?:ur-mr-rat|user-rat|my-rating)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
      block.match(/data-user-rating=["'](\d+(?:[.,]\d+)?)["']/i);
    const { fiveStar, rating10 } = normalizeFaRatingToFiveStar(
      ratingMatch ? decodeHtmlText(ratingMatch[1]) : undefined
    );

    const reviewMatch = block.match(/class=["'][^"']*(?:ur-mr-rev|review-text)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const review = reviewMatch ? decodeHtmlText(reviewMatch[1]) || undefined : undefined;

    const canonicalUrl = resolvedId
      ? `https://www.filmaffinity.com/en/film${resolvedId}.html`
      : hrefMatch?.[1] || `https://www.filmaffinity.com/en/search.php?stext=${encodeURIComponent(rawTitle)}`;

    items.push({
      filmaffinityId: resolvedId,
      title: rawTitle,
      releaseYear,
      director,
      rating: fiveStar,
      filmaffinityRating10: rating10,
      isWatchlist: fiveStar === undefined ? defaultWatchlist : false,
      review,
      posterUrl,
      canonicalUrl,
    });
  };

  for (const m of htmlText.matchAll(cardRegex)) {
    parseBlock(m[1], m[2]);
  }

  // Fallback for list rows wrapped with <li data-movie-id="...">
  if (items.length === 0) {
    const altRegex = /data-movie-id=["'](\d+)["'][\s\S]{0,2200}?(?=data-movie-id=["']\d+["']|$)/gi;
    for (const m of htmlText.matchAll(altRegex)) {
      parseBlock(m[1], m[0]);
    }
  }

  return items;
}
