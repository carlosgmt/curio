import { parseCSV } from "./csvParser";

export interface ImportedFilm {
  title: string;
  releaseYear?: number;
  letterboxdUri?: string;
  rating?: number;
  dateWatched?: string;
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
 * Parses Letterboxd watched.csv or diary.csv or watchlist.csv
 */
export function parseLetterboxdCSV(csvText: string): ImportedFilm[] {
  const rows = parseCSV(csvText);
  const films: ImportedFilm[] = [];

  for (const row of rows) {
    const title = row["Name"] || row["Title"];
    if (!title) continue;

    const yearStr = row["Year"];
    const parsedYear = yearStr ? parseInt(yearStr, 10) : NaN;
    const releaseYear = Number.isFinite(parsedYear) ? parsedYear : undefined;

    const uri = row["Letterboxd URI"] || `https://letterboxd.com/film/${encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}/`;

    const ratingStr = row["Rating"];
    const parsedRating = ratingStr ? parseFloat(ratingStr) : NaN;
    const rating = Number.isFinite(parsedRating) ? parsedRating : undefined;

    const dateWatched = row["Date"] || row["Watched Date"];

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const canonicalExternalId = `letterboxd:${slug}${releaseYear ? `-${releaseYear}` : ""}`;

    films.push({
      title,
      releaseYear,
      letterboxdUri: uri,
      rating,
      dateWatched,
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
