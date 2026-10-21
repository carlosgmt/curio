import { normalizeEntityString } from "../universalDiscovery";

export interface MusicTrack {
  number?: string | number;
  title: string;
  duration?: string;
  previewUrl?: string;
}

export interface ResolvedMusic {
  title: string;
  artist: string;
  releaseYear?: number;
  coverUrl?: string;
  recordLabel?: string;
  summary?: string;
  typePath: "/media/music/album" | "/media/music/song" | "/media/music/vinyl";
  coreType: "MEDIA";
  canonicalExternalId: string;
  canonicalUrl: string;
  priceCents: number;
  coreStructuredData: {
    artist: string;
    album: string;
    releaseYear?: number;
    rpm?: string;
    recordLabel?: string;
    format?: "album" | "song" | "vinyl";
    tracklist?: MusicTrack[];
    trackCount?: number;
  };
}

/**
 * Scores a candidate music item (from iTunes or MusicBrainz) against the query and artistHint.
 */
function scoreMusicCandidate(
  candidateTitle: string,
  candidateArtist: string,
  query: string,
  artistHint?: string
): number {
  const normTitle = normalizeEntityString(candidateTitle);
  const normArtist = normalizeEntityString(candidateArtist);
  const normQuery = normalizeEntityString(query);
  const normHint = artistHint ? normalizeEntityString(artistHint) : "";

  let score = 0;

  if (normTitle === normQuery) {
    score += 75;
  } else if (normQuery.includes(normTitle) && normTitle.length >= 2) {
    score += 55;
  } else if (normTitle.includes(normQuery) && normQuery.length >= 2) {
    score += 40;
  }

  // Check token overlap across title + artist against full query + artistHint
  const targetTokens = normalizeEntityString(`${query} ${artistHint || ""}`)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  const candidateTokens = `${normTitle} ${normArtist}`.split(/\s+/).filter(Boolean);

  for (const tok of targetTokens) {
    if (candidateTokens.some((ct) => ct === tok || ct.includes(tok) || tok.includes(ct))) {
      score += 20;
    }
  }

  if (normHint) {
    const hintTokens = normHint.split(/\s+/).filter((t) => t.length >= 2);
    const matchesHint =
      normArtist.includes(normHint) ||
      normHint.includes(normArtist) ||
      hintTokens.some((ht) => normArtist.includes(ht));
    if (matchesHint) {
      score += 80;
    } else {
      score -= 60;
    }
  }

  return score;
}

/**
 * Fetches high-resolution 600x600 album/song cover artwork and metadata from the free iTunes Search API,
 * including real tracklist resolution for albums and regional ES catalog fallback.
 */
export async function fetchItunesMusicMetadata(
  query: string,
  options?: {
    artistHint?: string;
    subType?: "album" | "song";
    fetchFn?: typeof fetch;
    timeoutMs?: number;
  }
): Promise<{
  title?: string;
  artist?: string;
  album?: string;
  releaseYear?: number;
  coverUrl?: string;
  tracklist?: MusicTrack[];
  trackCount?: number;
  score?: number;
} | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 4500;
  const entity = options?.subType === "song" ? "song" : "album";
  const searchTerm = [query, options?.artistHint].filter(Boolean).join(" ").trim();
  if (!searchTerm) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      searchTerm
    )}&entity=${entity}&limit=5`;

    const pickBestFromResults = (results: any[]): { item: any; score: number } | null => {
      if (!Array.isArray(results) || results.length === 0) return null;
      let best: any = null;
      let bestScore = -Infinity;
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const rTitle = entity === "song" ? r.trackName || r.collectionName || "" : r.collectionName || r.trackName || "";
        const rArtist = r.artistName || "";
        const s = scoreMusicCandidate(rTitle, rArtist, query, options?.artistHint) + (results.length - i) * 3;
        if (s > bestScore) {
          bestScore = s;
          best = r;
        }
      }
      return best ? { item: best, score: bestScore } : null;
    };

    let res = await fetchFn(itunesUrl, { signal: controller.signal });
    let bestPick: { item: any; score: number } | null = null;
    let matchedCountry = "us";

    if (res.ok) {
      const data = await res.json();
      bestPick = pickBestFromResults(data?.results || []);
    }

    // Trigger regional ES fallback when US returned no results OR failed artistHint/token match
    const needsRegionalFallback =
      !bestPick ||
      (options?.artistHint && bestPick.score < 60) ||
      bestPick.score < 35;

    if (needsRegionalFallback) {
      try {
        const esRes = await fetchFn(`${itunesUrl}&country=ES`, { signal: controller.signal });
        if (esRes.ok) {
          const esData = await esRes.json();
          const esPick = pickBestFromResults(esData?.results || []);
          if (esPick && (!bestPick || esPick.score > bestPick.score)) {
            bestPick = esPick;
            matchedCountry = "es";
          }
        }
      } catch {
        // Non-fatal
      }
    }

    const item = bestPick?.item;
    if (item) {
      const rawArt: string | undefined = item.artworkUrl100 || item.artworkUrl60;
      const coverUrl = rawArt
        ? rawArt.replace(/\d+x\d+bb/, "600x600bb")
        : undefined;
      const dateStr: string | undefined = item.releaseDate;
      const yearMatch = dateStr?.match(/\b(19\d\d|20\d\d)\b/);
      const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

      let tracklist: MusicTrack[] | undefined;
      let trackCount: number | undefined = item.trackCount;

      // Hydrate real tracklist if collectionId is present
      if (item.collectionId && entity === "album") {
        try {
          const countryCode = item.country
            ? item.country.slice(0, 2).toLowerCase()
            : matchedCountry;
          const countryParam = countryCode ? `&country=${countryCode}` : "";
          const lookupUrl = `https://itunes.apple.com/lookup?id=${item.collectionId}&entity=song${countryParam}`;
          const lookupRes = await fetchFn(lookupUrl, { signal: controller.signal });
          if (lookupRes.ok) {
            const lookupData = await lookupRes.json();
            const songItems = (lookupData?.results || []).filter(
              (r: any) => r.wrapperType === "track" && r.kind === "song"
            );
            if (songItems.length > 0) {
              tracklist = songItems.map((s: any, idx: number) => {
                const ms = s.trackTimeMillis;
                const duration = ms
                  ? `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`
                  : undefined;
                return {
                  number: s.trackNumber ?? idx + 1,
                  title: s.trackName,
                  duration,
                  previewUrl: s.previewUrl,
                };
              });
              trackCount = songItems.length;
            }
          }
        } catch {
          // Non-fatal
        }
      }

      clearTimeout(timer);
      return {
        title: entity === "song" ? item.trackName || item.collectionName : item.collectionName,
        artist: item.artistName,
        album: item.collectionName,
        releaseYear,
        coverUrl,
        tracklist,
        trackCount,
        score: bestPick?.score ?? 50,
      };
    }
    clearTimeout(timer);
  } catch {
    // Non-fatal
  }
  return null;
}

/**
 * Resolves Spotify oEmbed links (zero authentication required) and chains into iTunes for tracklist & year
 */
export async function resolveSpotifyUrl(
  url: string,
  options?: { fetchFn?: typeof fetch; timeoutMs?: number }
): Promise<ResolvedMusic | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 5000;
  const isTrack = /spotify\.com\/(?:intl-[a-z]+\/)?track\//i.test(url);
  const targetTypePath: ResolvedMusic["typePath"] = isTrack
    ? "/media/music/song"
    : "/media/music/album";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetchFn(oembedUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const rawTitle = String(data.title || "Unknown Album");
      // Parse "Album - Artist" or "Song - song and lyrics by Artist | Spotify"
      let title = rawTitle;
      let artist = String(data.author_name || "").trim();

      const byMatch = rawTitle.match(/^(.+?)\s*[-–—]\s*(?:song and lyrics by|album by|single by)\s+([^|]+)/i);
      if (byMatch) {
        title = byMatch[1].trim();
        if (!artist) artist = byMatch[2].trim();
      } else if (rawTitle.includes(" - ")) {
        const parts = rawTitle.split(/\s*[-–—]\s*/);
        title = parts[0].trim() || rawTitle;
        if (!artist && parts[1]) {
          artist = parts[1].replace(/\s*\|\s*Spotify.*$/i, "").trim();
        }
      }
      if (!artist) artist = "Unknown Artist";

      const itunesMeta = await fetchItunesMusicMetadata(title, {
        artistHint: artist !== "Unknown Artist" ? artist : undefined,
        subType: isTrack ? "song" : "album",
        fetchFn,
        timeoutMs: 3500,
      }).catch(() => null);

      const finalArtist =
        artist !== "Unknown Artist" ? artist : itunesMeta?.artist || "Unknown Artist";
      const coverUrl = itunesMeta?.coverUrl || data.thumbnail_url;
      const releaseYear = itunesMeta?.releaseYear;
      const spotifyId = url.split("?")[0].split("/").filter(Boolean).pop() || title;

      return {
        title: itunesMeta?.title || title,
        artist: finalArtist,
        releaseYear,
        coverUrl,
        summary: `${isTrack ? "Song" : "Album"} by ${finalArtist}${releaseYear ? ` (${releaseYear})` : ""}`,
        typePath: targetTypePath,
        coreType: "MEDIA",
        canonicalExternalId: `spotify:${isTrack ? "track" : "album"}:${spotifyId}`,
        canonicalUrl: url,
        priceCents: isTrack ? 129 : 2999,
        coreStructuredData: {
          artist: finalArtist,
          album: itunesMeta?.album || title,
          ...(releaseYear ? { releaseYear } : {}),
          rpm: "33",
          recordLabel: "Spotify",
          format: isTrack ? "song" : "album",
          ...(itunesMeta?.tracklist ? { tracklist: itunesMeta.tracklist } : {}),
          ...(itunesMeta?.trackCount ? { trackCount: itunesMeta.trackCount } : {}),
        },
      };
    }
  } catch {
    // Fall through
  }
  return null;
}

/**
 * Resolves music albums & songs from iTunes Search API (600x600 cover art) + MusicBrainz,
 * scoring both candidates to prevent cross-entity cover/tracklist stitching.
 */
export async function resolveMusicBrainz(
  query: string,
  options?: {
    fetchFn?: typeof fetch;
    timeoutMs?: number;
    subType?: "album" | "song";
    creatorHint?: string;
  }
): Promise<ResolvedMusic | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 6000;
  const isExplicitSong =
    options?.subType === "song" || /\b(?:song|track|single)\b/i.test(query);
  const isExplicitVinyl = /\b(?:vinyl|lp)\b/i.test(query);
  const targetTypePath: ResolvedMusic["typePath"] = isExplicitSong
    ? "/media/music/song"
    : isExplicitVinyl && !options?.subType
    ? "/media/music/vinyl"
    : "/media/music/album";

  const cleanQuery =
    query.replace(/\b(?:vinyl|album|record|lp|cd|song|track)\b/gi, "").trim() ||
    query.trim();

  // Fetch iTunes high-res cover art & MusicBrainz release candidates in parallel
  const [itunesMeta, mbRelease] = await Promise.all([
    fetchItunesMusicMetadata(cleanQuery, {
      artistHint: options?.creatorHint,
      subType: isExplicitSong ? "song" : "album",
      fetchFn,
      timeoutMs: Math.min(timeoutMs, 4500),
    }),
    (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const mbSearchQuery = options?.creatorHint
          ? `${cleanQuery} AND artist:${options.creatorHint}`
          : cleanQuery;
        const mbUrl = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(
          mbSearchQuery
        )}&fmt=json&limit=5`;
        const res = await fetchFn(mbUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "Curio/1.0 (https://curio.local; hello@curio.local)" },
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const releases: any[] = Array.isArray(data?.releases) ? data.releases : [];
          if (releases.length === 0) return null;

          let bestRel: any = null;
          let bestScore = -Infinity;
          for (let i = 0; i < releases.length; i++) {
            const rel = releases[i];
            const relTitle = rel.title || "";
            const relArtist = rel["artist-credit"]?.[0]?.artist?.name || "";
            const s =
              scoreMusicCandidate(relTitle, relArtist, cleanQuery, options?.creatorHint) +
              (releases.length - i) * 2;
            if (s > bestScore) {
              bestScore = s;
              bestRel = { ...rel, _score: s };
            }
          }
          return bestRel;
        }
      } catch {
        // Ignore MusicBrainz network error
      }
      return null;
    })(),
  ]);

  const mbScore = mbRelease?._score ?? -Infinity;
  const itunesScore = itunesMeta?.score ?? -Infinity;

  // Check whether iTunes and MusicBrainz resolved the SAME artist/album before merging
  const canMergeItunesAndMb = (() => {
    if (!mbRelease?.title || !itunesMeta?.title) return false;
    const mbArtist = normalizeEntityString(
      mbRelease["artist-credit"]?.[0]?.artist?.name || ""
    );
    const itArtist = normalizeEntityString(itunesMeta.artist || "");
    const mbTitle = normalizeEntityString(mbRelease.title);
    const itTitle = normalizeEntityString(itunesMeta.title);
    const titleMatches =
      mbTitle === itTitle || mbTitle.includes(itTitle) || itTitle.includes(mbTitle);
    const artistMatches =
      !mbArtist ||
      !itArtist ||
      mbArtist === itArtist ||
      mbArtist.includes(itArtist) ||
      itArtist.includes(mbArtist) ||
      mbArtist
        .split(/\s+/)
        .some((t) => t.length > 2 && itArtist.includes(t));
    return titleMatches && artistMatches;
  })();

  if (mbRelease && mbRelease.title && (mbScore >= itunesScore || canMergeItunesAndMb)) {
    const title = mbRelease.title;
    const artist =
      mbRelease["artist-credit"]?.[0]?.artist?.name ||
      (canMergeItunesAndMb ? itunesMeta?.artist : undefined) ||
      options?.creatorHint ||
      "Unknown Artist";
    const dateStr = mbRelease.date;
    const yearMatch = dateStr?.match(/\b(19\d\d|20\d\d)\b/);
    const releaseYear = yearMatch
      ? parseInt(yearMatch[1], 10)
      : canMergeItunesAndMb
      ? itunesMeta?.releaseYear
      : undefined;
    const label = mbRelease["label-info"]?.[0]?.label?.name || "Record Label";
    const mbid = mbRelease.id;

    const coverUrl =
      (canMergeItunesAndMb ? itunesMeta?.coverUrl : undefined) ||
      `https://coverartarchive.org/release/${mbid}/front-500`;

    return {
      title,
      artist,
      releaseYear,
      coverUrl,
      recordLabel: label,
      summary: `${isExplicitSong ? "Song" : "Album"} by ${artist}${
        releaseYear ? ` (${releaseYear})` : ""
      }`,
      typePath: targetTypePath,
      coreType: "MEDIA",
      canonicalExternalId: `musicbrainz:${mbid}`,
      canonicalUrl: `https://musicbrainz.org/release/${mbid}`,
      priceCents: isExplicitSong ? 129 : 2999,
      coreStructuredData: {
        artist,
        album: (canMergeItunesAndMb ? itunesMeta?.album : undefined) || title,
        releaseYear,
        rpm: "33",
        recordLabel: label,
        format: isExplicitSong ? "song" : "album",
        tracklist: canMergeItunesAndMb ? itunesMeta?.tracklist : undefined,
        trackCount: canMergeItunesAndMb ? itunesMeta?.trackCount : undefined,
      },
    };
  }

  if (itunesMeta && (itunesMeta.title || itunesMeta.coverUrl)) {
    const title = itunesMeta.title || cleanQuery;
    const artist = itunesMeta.artist || options?.creatorHint || "Unknown Artist";
    const releaseYear = itunesMeta.releaseYear;
    return {
      title,
      artist,
      releaseYear,
      coverUrl: itunesMeta.coverUrl,
      summary: `${isExplicitSong ? "Song" : "Album"} by ${artist}${
        releaseYear ? ` (${releaseYear})` : ""
      }`,
      typePath: targetTypePath,
      coreType: "MEDIA",
      canonicalExternalId: `itunes:${normalizeEntityString(`${artist} ${title}`).replace(/\s+/g, "-")}`,
      canonicalUrl: `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${title}`)}`,
      priceCents: isExplicitSong ? 129 : 2999,
      coreStructuredData: {
        artist,
        album: itunesMeta.album || title,
        releaseYear,
        rpm: "33",
        format: isExplicitSong ? "song" : "album",
        tracklist: itunesMeta.tracklist,
        trackCount: itunesMeta.trackCount,
      },
    };
  }

  // Graceful fallback for music queries
  const fallbackArtist = options?.creatorHint || "Various Artists";
  return {
    title: cleanQuery,
    artist: fallbackArtist,
    summary: `${isExplicitSong ? "Song" : "Album"}: ${cleanQuery}`,
    typePath: targetTypePath,
    coreType: "MEDIA",
    canonicalExternalId: `music:${cleanQuery.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    canonicalUrl: `https://open.spotify.com/search/${encodeURIComponent(cleanQuery)}`,
    priceCents: isExplicitSong ? 129 : 2999,
    coreStructuredData: {
      artist: fallbackArtist,
      album: cleanQuery,
      rpm: "33",
      format: isExplicitSong ? "song" : "album",
    },
  };
}
