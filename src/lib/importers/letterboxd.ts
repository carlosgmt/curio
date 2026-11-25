import { parseCSV } from "./csvParser";
import { normalizeDateString } from "../books/library";

export interface ImportedFilm {
  title: string;
  releaseYear?: number;
  letterboxdUri?: string;
  rating?: number;
  dateWatched?: string;
  rewatch?: boolean;
  review?: string;
  letterboxdTags?: string[];
  tags?: string[];
  isWatchlist?: boolean;
  typePath: "/media/film";
  coreType: "MEDIA";
  canonicalExternalId: string;
  coreStructuredData: {
    title: string;
    releaseYear?: number;
    rating?: number;
    dateWatched?: string;
    cinematographer?: string;
    distributor?: string;
  };
}

/**
 * Parses Letterboxd watched.csv, diary.csv, reviews.csv, or watchlist.csv
 * including custom Tags, Rewatch flag, Review prose, and Watched Date.
 */
export function parseLetterboxdCSV(
  csvText: string,
  options?: { isWatchlist?: boolean }
): ImportedFilm[] {
  const rows = parseCSV(csvText);
  const films: ImportedFilm[] = [];

  for (const row of rows) {
    const title = row["Name"] || row["Title"];
    if (!title) continue;

    const yearStr = row["Year"];
    const parsedYear = yearStr ? parseInt(yearStr, 10) : NaN;
    const releaseYear = Number.isFinite(parsedYear) ? parsedYear : undefined;

    const uri =
      row["Letterboxd URI"] ||
      `https://letterboxd.com/film/${encodeURIComponent(
        title.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      )}/`;

    const ratingStr = row["Rating"];
    const parsedRating = ratingStr ? parseFloat(ratingStr) : NaN;
    const rating =
      Number.isFinite(parsedRating) && parsedRating > 0 && parsedRating <= 5
        ? parsedRating
        : undefined;

    const rawDate = row["Watched Date"] || row["Date"];
    const dateWatched = normalizeDateString(rawDate) || (rawDate?.trim() || undefined);

    const rewatch = /^yes$/i.test((row["Rewatch"] || "").trim());
    const review = row["Review"]?.trim() || undefined;

    const rawTags = (row["Tags"] || "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const letterboxdTags = [...new Set(rawTags)];

    const isWatchlist = Boolean(options?.isWatchlist);
    const tags = [
      ...new Set([
        "media",
        "film",
        "letterboxd",
        ...(isWatchlist ? ["watchlist"] : []),
        ...letterboxdTags,
      ]),
    ];

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const canonicalExternalId = `letterboxd:${slug}${releaseYear ? `-${releaseYear}` : ""}`;

    films.push({
      title,
      releaseYear,
      letterboxdUri: uri,
      rating,
      dateWatched,
      rewatch,
      review,
      letterboxdTags,
      tags,
      isWatchlist,
      typePath: "/media/film",
      coreType: "MEDIA",
      canonicalExternalId,
      coreStructuredData: {
        title,
        releaseYear,
        rating,
        dateWatched,
        distributor: "Letterboxd Ingestion",
      },
    });
  }

  return films;
}
