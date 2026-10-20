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
 * Fetches high-resolution 600x600 album/song cover artwork and metadata from the free iTunes Search API,
 * including real tracklist resolution for albums.
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
    )}&entity=${entity}&limit=3`;
    let res = await fetchFn(itunesUrl, { signal: controller.signal });
    let item: any = null;

    if (res.ok) {
      const data = await res.json();
      item = data?.results?.[0];
    }

    // Regional fallback (e.g., Spanish music often indexed under country=ES)
    if (!item) {
      try {
        const esRes = await fetchFn(`${itunesUrl}&country=ES`, { signal: controller.signal });
        if (esRes.ok) {
          const esData = await esRes.json();
          item = esData?.results?.[0];
        }
      } catch {
        // Non-fatal
      }
    }

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
          const countryParam = item.country ? `&country=${item.country.slice(0, 2).toLowerCase()}` : "";
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

      return {
        title: entity === "song" ? item.trackName || item.collectionName : item.collectionName,
        artist: item.artistName,
        album: item.collectionName,
        releaseYear,
        coverUrl,
        tracklist,
        trackCount,
      };
    }
    clearTimeout(timer);
  } catch {
    // Non-fatal
  }
  return null;
}

/**
 * Resolves Spotify oEmbed links (zero authentication required)
 */
export async function resolveSpotifyUrl(
  url: string,
  options?: { fetchFn?: typeof fetch; timeoutMs?: number }
): Promise<ResolvedMusic | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 5000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetchFn(oembedUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const rawTitle = data.title || "Unknown Album";
      const artist = data.author_name || "Unknown Artist";
      const coverUrl = data.thumbnail_url;

      // Extract album name from "Album - Artist" if applicable
      const title = rawTitle.replace(/\s*[-–—]\s*.*$/, "").trim() || rawTitle;

      return {
        title,
        artist,
        coverUrl,
        summary: `Album by ${artist}`,
        typePath: "/media/music/vinyl",
        coreType: "MEDIA",
        canonicalExternalId: `spotify:${url.split("/").pop()}`,
        canonicalUrl: url,
        priceCents: 2999,
        coreStructuredData: {
          artist,
          album: title,
          rpm: "33",
          recordLabel: "Spotify Streamable",
        },
      };
    }
  } catch {
    // Fall through
  }
  return null;
}

/**
 * Resolves music albums & songs from iTunes Search API (600x600 cover art) + MusicBrainz
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

  const cleanQuery = query.replace(/\b(?:vinyl|album|record|lp|cd|song|track)\b/gi, "").trim() || query.trim();

  // Fetch iTunes high-res cover art & MusicBrainz release info in parallel
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
        )}&fmt=json&limit=1`;
        const res = await fetchFn(mbUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "Curio/1.0 (https://curio.local; hello@curio.local)" },
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          return data.releases?.[0] || null;
        }
      } catch {
        // Ignore MusicBrainz network error
      }
      return null;
    })(),
  ]);

  if (mbRelease && mbRelease.title) {
    const title = mbRelease.title;
    const artist =
      mbRelease["artist-credit"]?.[0]?.artist?.name ||
      itunesMeta?.artist ||
      options?.creatorHint ||
      "Unknown Artist";
    const dateStr = mbRelease.date;
    const yearMatch = dateStr?.match(/\b(19\d\d|20\d\d)\b/);
    const releaseYear = yearMatch
      ? parseInt(yearMatch[1], 10)
      : itunesMeta?.releaseYear;
    const label = mbRelease["label-info"]?.[0]?.label?.name || "Record Label";
    const mbid = mbRelease.id;

    // Prefer verified iTunes 600x600 cover art over unverified CoverArtArchive release ID
    const coverUrl =
      itunesMeta?.coverUrl || `https://coverartarchive.org/release/${mbid}/front-500`;

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
        album: itunesMeta?.album || title,
        releaseYear,
        rpm: "33",
        recordLabel: label,
        format: isExplicitSong ? "song" : "album",
        tracklist: itunesMeta?.tracklist,
        trackCount: itunesMeta?.trackCount,
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
      canonicalExternalId: `itunes:${cleanQuery.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
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

