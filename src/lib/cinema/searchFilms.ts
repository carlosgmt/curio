export interface FilmSearchCandidate {
  title: string;
  director?: string;
  releaseYear?: number;
  runtimeMinutes?: number;
  posterUrl?: string;
  summary?: string;
  canonicalUrl?: string;
  tmdbId?: string;
}

function normalizeFilmDedup(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function searchFilmCandidates(
  query: string,
  options?: { fetchFn?: typeof fetch; limit?: number; timeoutMs?: number }
): Promise<FilmSearchCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const fetchFn = options?.fetchFn ?? fetch;
  const limit = Math.max(1, Math.min(options?.limit ?? 6, 12));
  const timeoutMs = options?.timeoutMs ?? 3500;

  const itunesPromise = (async (): Promise<FilmSearchCandidate[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
        trimmed
      )}&entity=movie&limit=${limit}`;
      const res = await fetchFn(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      return results
        .filter((item: any) => typeof item?.trackName === "string" && item.trackName.trim())
        .map((item: any): FilmSearchCandidate => {
          const title = String(item.trackName)
            .replace(/\s*\((?:19\d\d|20[0-2]\d)\)\s*$/, "")
            .trim();
          const rawArt = String(item.artworkUrl100 || item.artworkUrl60 || "").trim();
          const posterUrl = rawArt
            ? rawArt.replace(/\d+x\d+bb/, "600x900bb")
            : undefined;
          const yearStr =
            typeof item.releaseDate === "string" ? item.releaseDate.slice(0, 4) : "";
          const releaseYear = /^\d{4}$/.test(yearStr)
            ? parseInt(yearStr, 10)
            : undefined;
          const runtimeMinutes =
            typeof item.trackTimeMillis === "number" && item.trackTimeMillis > 0
              ? Math.round(item.trackTimeMillis / 60000)
              : undefined;
          return {
            title,
            director:
              typeof item.artistName === "string" ? item.artistName.trim() : undefined,
            releaseYear,
            runtimeMinutes,
            posterUrl,
            summary:
              (typeof item.longDescription === "string" && item.longDescription.trim()) ||
              (typeof item.shortDescription === "string" && item.shortDescription.trim()) ||
              undefined,
            canonicalUrl:
              typeof item.trackViewUrl === "string"
                ? item.trackViewUrl
                : `https://letterboxd.com/search/${encodeURIComponent(title)}/`,
          };
        });
    } catch {
      clearTimeout(timer);
      return [];
    }
  })();

  const tmdbKey = process.env.TMDB_API_KEY;
  const tmdbPromise = tmdbKey
    ? (async (): Promise<FilmSearchCandidate[]> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const url = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(
            trimmed
          )}`;
          const res = await fetchFn(url, { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) return [];
          const data = await res.json();
          const results = Array.isArray(data?.results) ? data.results.slice(0, limit) : [];
          return results
            .filter((m: any) => m?.title)
            .map((m: any): FilmSearchCandidate => {
              const yearStr =
                typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "";
              return {
                title: String(m.title).trim(),
                releaseYear: /^\d{4}$/.test(yearStr)
                  ? parseInt(yearStr, 10)
                  : undefined,
                posterUrl: m.poster_path
                  ? `https://image.tmdb.org/t/p/w780${m.poster_path}`
                  : undefined,
                summary:
                  typeof m.overview === "string" ? m.overview.trim() : undefined,
                canonicalUrl: `https://www.themoviedb.org/movie/${m.id}`,
                tmdbId: String(m.id),
              };
            });
        } catch {
          clearTimeout(timer);
          return [];
        }
      })()
    : Promise.resolve([] as FilmSearchCandidate[]);

  const [tmdbHits, itunesHits] = await Promise.all([tmdbPromise, itunesPromise]);

  const byKey = new Map<string, FilmSearchCandidate>();
  for (const cand of [...tmdbHits, ...itunesHits]) {
    const key = `${normalizeFilmDedup(cand.title)}::${cand.releaseYear || ""}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, cand);
    } else {
      byKey.set(key, {
        ...existing,
        director: existing.director || cand.director,
        runtimeMinutes: existing.runtimeMinutes || cand.runtimeMinutes,
        posterUrl: existing.posterUrl || cand.posterUrl,
        summary: existing.summary || cand.summary,
        tmdbId: existing.tmdbId || cand.tmdbId,
      });
    }
  }

  return [...byKey.values()].slice(0, limit);
}
