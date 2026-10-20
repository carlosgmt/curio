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
  };
}

/**
 * Fetches high-resolution 600x600 album/song cover artwork and metadata from the free iTunes Search API.
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
    const res = await fetchFn(itunesUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const item = data?.results?.[0];
      if (item) {
        const rawArt: string | undefined = item.artworkUrl100 || item.artworkUrl60;
        const coverUrl = rawArt
          ? rawArt.replace(/\d+x\d+bb/, "600x600bb")
          : undefined;
        const dateStr: string | undefined = item.releaseDate;
        const yearMatch = dateStr?.match(/\b(19\d\d|20\d\d)\b/);
        const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
        return {
          title: entity === "song" ? item.trackName || item.collectionName : item.collectionName,
          artist: item.artistName,
          album: item.collectionName,
          releaseYear,
          coverUrl,
        };
      }
    }
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

