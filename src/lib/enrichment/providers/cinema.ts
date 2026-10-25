import { normalizeEntityString } from "../universalDiscovery";

export interface ResolvedFilm {
  title: string;
  director?: string;
  releaseYear?: number;
  runtimeMinutes?: number;
  posterUrl?: string;
  summary?: string;
  typePath: "/media/film";
  coreType: "MEDIA";
  canonicalExternalId: string;
  canonicalUrl: string;
  priceCents: number;
  coreStructuredData: {
    title: string;
    director?: string;
    releaseYear?: number;
    runtimeMinutes?: number;
    cinematographer?: string;
    distributor?: string;
    tmdbId?: number | string;
    imdbId?: string;
  };
}

export interface ResolveFilmOptions {
  yearHint?: number | null;
  creatorHint?: string | null;
  wikiUrlHint?: string | null;
  tmdbId?: number | string | null;
  imdbId?: string | null;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Resolves film metadata across a 3-tier zero-cost cascade:
 * Tier 1: Optional TMDB API (by tmdbId, imdbId, or title + yearHint)
 * Tier 2: Free iTunes Movie Search API (600x900bb theatrical poster, director, runtime, release year)
 * Tier 3: Wikipedia REST Summary API (using wikiUrlHint, yearHint, and EN/ES Wikipedia)
 */
export async function resolveFilm(
  query: string,
  options?: ResolveFilmOptions
): Promise<ResolvedFilm | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 6000;

  // Extract inline year if present in query (e.g. "The Revenant (2015)" or "The Revenant 2015")
  const inlineYearMatch = query.match(/\b(19\d\d|20[0-2]\d)\b/);
  const effectiveYearHint =
    options?.yearHint ?? (inlineYearMatch ? parseInt(inlineYearMatch[1], 10) : null);

  // Normalize query (e.g. "Dune: Part Two movie" -> "Dune: Part Two")
  const cleanTitle = query
    .replace(/\s*\((?:19\d\d|20[0-2]\d)(?:\s*film)?\)\s*/gi, " ")
    .replace(/\b(?:movie|film|cinema|criterion|pel[ií]cula)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || query.trim();

  // =========================================================================
  // TIER 1: Optional TMDB API (Exact TMDB ID, IMDb ID, or Title + Year Search)
  // =========================================================================
  const tmdbKey = process.env.TMDB_API_KEY;
  if (tmdbKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 4500));

      let movieId: number | string | null = options?.tmdbId ?? null;
      let movieData: any = null;

      if (!movieId && options?.imdbId) {
        const findUrl = `https://api.themoviedb.org/3/find/${encodeURIComponent(
          options.imdbId
        )}?api_key=${tmdbKey}&external_source=imdb_id`;
        const findRes = await fetchFn(findUrl, { signal: controller.signal });
        if (findRes.ok) {
          const findJson = await findRes.json();
          const firstMovie = findJson?.movie_results?.[0];
          if (firstMovie?.id) {
            movieId = firstMovie.id;
          }
        }
      }

      if (!movieId) {
        const yearParam = effectiveYearHint ? `&year=${effectiveYearHint}` : "";
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(
          cleanTitle
        )}${yearParam}`;
        const searchRes = await fetchFn(searchUrl, { signal: controller.signal });
        if (searchRes.ok) {
          const searchJson = await searchRes.json();
          const firstMovie = searchJson?.results?.[0];
          if (firstMovie?.id) {
            movieId = firstMovie.id;
            movieData = firstMovie;
          }
        }
      }

      if (movieId) {
        const detailUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbKey}&append_to_response=credits`;
        const detailRes = await fetchFn(detailUrl, { signal: controller.signal });
        if (detailRes.ok) {
          movieData = await detailRes.json();
        }
      }

      clearTimeout(timer);

      if (movieData && (movieData.title || movieData.original_title)) {
        const title = movieData.title || movieData.original_title || cleanTitle;
        const releaseYear = movieData.release_date
          ? parseInt(String(movieData.release_date).slice(0, 4), 10)
          : effectiveYearHint ?? undefined;
        const runtimeMinutes =
          typeof movieData.runtime === "number" && movieData.runtime > 0
            ? movieData.runtime
            : undefined;
        const posterUrl = movieData.poster_path
          ? `https://image.tmdb.org/t/p/w780${movieData.poster_path}`
          : undefined;
        const crew: any[] = movieData.credits?.crew || [];
        const directorObj = crew.find((c) => c.job === "Director");
        const dopObj = crew.find(
          (c) => c.job === "Director of Photography" || c.job === "Cinematography"
        );
        const director = directorObj?.name || options?.creatorHint || undefined;
        const cinematographer = dopObj?.name || undefined;
        const distributor = movieData.production_companies?.[0]?.name || undefined;
        const summary = movieData.overview || undefined;
        const resolvedTmdbId = movieData.id || movieId;

        return {
          title,
          director,
          releaseYear,
          runtimeMinutes,
          posterUrl,
          summary,
          typePath: "/media/film",
          coreType: "MEDIA",
          canonicalExternalId: `tmdb:movie:${resolvedTmdbId}`,
          canonicalUrl: `https://www.themoviedb.org/movie/${resolvedTmdbId}`,
          priceCents: 399,
          coreStructuredData: {
            title,
            director,
            releaseYear,
            runtimeMinutes,
            cinematographer,
            distributor,
            tmdbId: resolvedTmdbId,
            ...(options?.imdbId ? { imdbId: options.imdbId } : {}),
          },
        };
      }
    } catch {
      // Fall through to Tier 2 & Tier 3
    }
  }

  // =========================================================================
  // TIER 2 & TIER 3: Free iTunes Movie API + Wikipedia REST Summary (Parallel)
  // =========================================================================
  const fetchItunesMovie = async (): Promise<{
    title: string;
    director?: string;
    releaseYear?: number;
    runtimeMinutes?: number;
    posterUrl?: string;
    summary?: string;
    trackViewUrl?: string;
    trackId?: number;
    distributor?: string;
  } | null> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 4500));
      const searchTerm = [cleanTitle, options?.creatorHint].filter(Boolean).join(" ").trim();
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        searchTerm
      )}&entity=movie&limit=6`;

      let res = await fetchFn(itunesUrl, { signal: controller.signal });
      let results: any[] = [];
      if (res.ok) {
        const data = await res.json();
        results = Array.isArray(data?.results) ? data.results : [];
      }

      if (results.length === 0 && options?.creatorHint) {
        const fallbackUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
          cleanTitle
        )}&entity=movie&limit=6`;
        const fbRes = await fetchFn(fallbackUrl, { signal: controller.signal });
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          results = Array.isArray(fbData?.results) ? fbData.results : [];
        }
      }

      if (results.length === 0) {
        const esUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
          cleanTitle
        )}&entity=movie&country=ES&limit=6`;
        const esRes = await fetchFn(esUrl, { signal: controller.signal });
        if (esRes.ok) {
          const esData = await esRes.json();
          results = Array.isArray(esData?.results) ? esData.results : [];
        }
      }

      clearTimeout(timer);
      if (results.length === 0) return null;

      const normTarget = normalizeEntityString(cleanTitle);
      const normCreator = options?.creatorHint
        ? normalizeEntityString(options.creatorHint)
        : "";

      let bestItem: any = null;
      let bestScore = -Infinity;

      for (let i = 0; i < results.length; i++) {
        const item = results[i];
        const rawTrackName = String(item.trackName || item.collectionName || "").replace(
          /\s*\([^)]*\)\s*$/,
          ""
        );
        const normTrack = normalizeEntityString(rawTrackName);
        const normArtist = normalizeEntityString(String(item.artistName || ""));
        const itemYear = item.releaseDate
          ? parseInt(String(item.releaseDate).slice(0, 4), 10)
          : null;

        let score = (results.length - i) * 5;
        if (normTrack === normTarget) score += 80;
        else if (normTrack.includes(normTarget) || normTarget.includes(normTrack)) score += 35;
        else score -= 30;

        if (effectiveYearHint && itemYear) {
          if (itemYear === effectiveYearHint) score += 70;
          else if (Math.abs(itemYear - effectiveYearHint) === 1) score += 35;
          else score -= 45;
        }

        if (normCreator && normArtist) {
          if (normArtist.includes(normCreator) || normCreator.includes(normArtist)) {
            score += 65;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestItem = item;
        }
      }

      if (!bestItem || bestScore < 20) return null;

      const rawArt: string | undefined = bestItem.artworkUrl100 || bestItem.artworkUrl60;
      const posterUrl = rawArt
        ? rawArt.replace(/\d+x\d+bb/, "600x900bb")
        : undefined;
      const releaseYear = bestItem.releaseDate
        ? parseInt(String(bestItem.releaseDate).slice(0, 4), 10)
        : undefined;
      const runtimeMinutes =
        typeof bestItem.trackTimeMillis === "number" && bestItem.trackTimeMillis > 0
          ? Math.round(bestItem.trackTimeMillis / 60000)
          : undefined;

      return {
        title: String(bestItem.trackName || cleanTitle).replace(/\s*\((?:19\d\d|20[0-2]\d)\)\s*$/, ""),
        director: bestItem.artistName || undefined,
        releaseYear: Number.isFinite(releaseYear) ? releaseYear : undefined,
        runtimeMinutes,
        posterUrl,
        summary: bestItem.longDescription || bestItem.shortDescription || undefined,
        trackViewUrl: bestItem.trackViewUrl || undefined,
        trackId: bestItem.trackId || undefined,
      };
    } catch {
      return null;
    }
  };

  const fetchWikipediaFilm = async (): Promise<{
    title: string;
    director?: string;
    releaseYear?: number;
    posterUrl?: string;
    summary?: string;
    canonicalExternalId: string;
    canonicalUrl: string;
  } | null> => {
    const slugBase = cleanTitle.replace(/\s+/g, "_");
    const candidates: Array<{ domain: string; pageTitle: string }> = [];

    // 1. If wikiUrlHint is provided, try exact Wikipedia slug first
    if (options?.wikiUrlHint) {
      const m = options.wikiUrlHint.match(/https?:\/\/([a-z]{2}\.wikipedia\.org)\/wiki\/([^#?]+)/i);
      if (m) {
        candidates.push({ domain: m[1], pageTitle: decodeURIComponent(m[2]) });
      }
    }

    // 2. If yearHint is known, try _(YEAR_film) before generic _(film) and bare title
    if (effectiveYearHint) {
      candidates.push({
        domain: "en.wikipedia.org",
        pageTitle: `${slugBase}_(${effectiveYearHint}_film)`,
      });
    }

    candidates.push(
      { domain: "en.wikipedia.org", pageTitle: `${slugBase}_(film)` },
      { domain: "en.wikipedia.org", pageTitle: slugBase },
      { domain: "es.wikipedia.org", pageTitle: `${slugBase}_(película)` },
      { domain: "es.wikipedia.org", pageTitle: slugBase }
    );

    const seen = new Set<string>();
    for (const cand of candidates) {
      const key = `${cand.domain}:${cand.pageTitle}`;
      if (seen.has(key)) continue;
      seen.add(key);

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const url = `https://${cand.domain}/api/rest_v1/page/summary/${encodeURIComponent(
          cand.pageTitle
        )}`;
        const res = await fetchFn(url, {
          signal: controller.signal,
          headers: { "User-Agent": "Curio/1.0 (https://curio.local; hello@curio.local)" },
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          if (data.type === "standard" && data.title) {
            const descAndExtract = `${data.description || ""} ${data.extract || ""}`;
            // When testing bare slugBase without a wikiUrlHint, verify it's actually a film/series if disambiguated variations exist
            const looksLikeFilm =
              cand.pageTitle.includes("film") ||
              cand.pageTitle.includes("película") ||
              Boolean(options?.wikiUrlHint && cand.pageTitle === candidates[0]?.pageTitle) ||
              /\b(?:film|movie|directed by|película|dirigida por|motion picture|documentary|miniseries)\b/i.test(
                descAndExtract
              );

            if (!looksLikeFilm && candidates.length > 1 && cand.pageTitle === slugBase) {
              continue;
            }

            const displayTitle = String(data.title)
              .replace(/\s*\([^)]*(?:film|película|movie)[^)]*\)/i, "")
              .trim();
            const posterUrl = data.originalimage?.source || data.thumbnail?.source;
            const summary = data.extract || "";

            const yearMatch = (data.description || summary).match(/\b(19\d\d|20[0-2]\d)\b/);
            const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

            const directorMatch =
              summary.match(
                /(?:directed by|dirigida por)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:[A-ZÁÉÍÓÚÑ]\.|[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)){1,3})/
              ) ||
              (data.description || "").match(
                /(?:directed by|dirigida por)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:[A-ZÁÉÍÓÚÑ]\.|[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)){1,3})/
              );
            const director = directorMatch
              ? directorMatch[1].replace(/\.\s+(?:The|It|In|A|An|His|Her)\b.*$/i, "").replace(/\.$/, "").trim()
              : undefined;

            return {
              title: displayTitle,
              director,
              releaseYear,
              posterUrl,
              summary: summary.length > 260 ? summary.slice(0, 257) + "..." : summary,
              canonicalExternalId: `wiki:${data.titles?.canonical || cand.pageTitle}`,
              canonicalUrl:
                data.content_urls?.desktop?.page ||
                `https://${cand.domain}/wiki/${encodeURIComponent(cand.pageTitle)}`,
            };
          }
        }
      } catch {
        // Continue to next candidate
      }
    }
    return null;
  };

  const [itunesFilm, wikiFilm] = await Promise.all([fetchItunesMovie(), fetchWikipediaFilm()]);

  if (itunesFilm || wikiFilm) {
    const title = wikiFilm?.title || itunesFilm?.title || cleanTitle;
    const director =
      itunesFilm?.director || wikiFilm?.director || options?.creatorHint || undefined;
    const releaseYear =
      itunesFilm?.releaseYear ||
      wikiFilm?.releaseYear ||
      effectiveYearHint ||
      undefined;
    const runtimeMinutes = itunesFilm?.runtimeMinutes;
    // Prefer iTunes 600x900 theatrical poster over Wikipedia image (which is often a low-res stub or missing)
    const posterUrl = itunesFilm?.posterUrl || wikiFilm?.posterUrl;
    const summary =
      wikiFilm?.summary ||
      (itunesFilm?.summary
        ? itunesFilm.summary.length > 260
          ? itunesFilm.summary.slice(0, 257) + "..."
          : itunesFilm.summary
        : undefined);
    const canonicalExternalId = options?.tmdbId
      ? `tmdb:movie:${options.tmdbId}`
      : options?.imdbId
      ? `imdb:${options.imdbId}`
      : wikiFilm?.canonicalExternalId ||
        (itunesFilm?.trackId
          ? `itunes:movie:${itunesFilm.trackId}`
          : `film:${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
    const canonicalUrl =
      wikiFilm?.canonicalUrl ||
      itunesFilm?.trackViewUrl ||
      `https://letterboxd.com/search/${encodeURIComponent(cleanTitle)}/`;

    return {
      title,
      director,
      releaseYear,
      runtimeMinutes,
      posterUrl,
      summary,
      typePath: "/media/film",
      coreType: "MEDIA",
      canonicalExternalId,
      canonicalUrl,
      priceCents: 399,
      coreStructuredData: {
        title,
        ...(director ? { director } : {}),
        ...(releaseYear ? { releaseYear } : {}),
        ...(runtimeMinutes ? { runtimeMinutes } : {}),
        ...(options?.tmdbId ? { tmdbId: options.tmdbId } : {}),
        ...(options?.imdbId ? { imdbId: options.imdbId } : {}),
      },
    };
  }

  // Graceful fallback for queries with clear film intent (no fake 118m / 35MM COLOR metadata)
  return {
    title: cleanTitle,
    director: options?.creatorHint || undefined,
    releaseYear: effectiveYearHint ?? undefined,
    summary: `Feature film: ${cleanTitle}`,
    typePath: "/media/film",
    coreType: "MEDIA",
    canonicalExternalId: options?.tmdbId
      ? `tmdb:movie:${options.tmdbId}`
      : options?.imdbId
      ? `imdb:${options.imdbId}`
      : `film:${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    canonicalUrl:
      options?.wikiUrlHint ||
      `https://letterboxd.com/search/${encodeURIComponent(cleanTitle)}/`,
    priceCents: 399,
    coreStructuredData: {
      title: cleanTitle,
      ...(options?.creatorHint ? { director: options.creatorHint } : {}),
      ...(effectiveYearHint ? { releaseYear: effectiveYearHint } : {}),
      ...(options?.tmdbId ? { tmdbId: options.tmdbId } : {}),
      ...(options?.imdbId ? { imdbId: options.imdbId } : {}),
    },
  };
}
