export interface ResolvedMusic {
  title: string;
  artist: string;
  releaseYear?: number;
  coverUrl?: string;
  recordLabel?: string;
  summary?: string;
  typePath: "/media/music/vinyl";
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
  };
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
 * Resolves music releases from MusicBrainz & Cover Art Archive
 */
export async function resolveMusicBrainz(
  query: string,
  options?: { fetchFn?: typeof fetch; timeoutMs?: number }
): Promise<ResolvedMusic | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 6000;
  const cleanQuery = query.replace(/\b(?:vinyl|album|record|lp|cd)\b/gi, "").trim();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const mbUrl = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(cleanQuery)}&fmt=json&limit=1`;
    const res = await fetchFn(mbUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Curio/1.0 (https://curio.local; hello@curio.local)" },
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const release = data.releases?.[0];
      if (release && release.title) {
        const title = release.title;
        const artist = release["artist-credit"]?.[0]?.artist?.name || "Unknown Artist";
        const dateStr = release.date;
        const yearMatch = dateStr?.match(/\b(19\d\d|20\d\d)\b/);
        const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
        const label = release["label-info"]?.[0]?.label?.name || "Blue Note / Columbia";
        const mbid = release.id;

        // Cover Art Archive URL
        const coverUrl = `https://coverartarchive.org/release/${mbid}/front-500`;

        return {
          title,
          artist,
          releaseYear,
          coverUrl,
          recordLabel: label,
          summary: `${title} by ${artist}${releaseYear ? ` (${releaseYear})` : ""}`,
          typePath: "/media/music/vinyl",
          coreType: "MEDIA",
          canonicalExternalId: `musicbrainz:${mbid}`,
          canonicalUrl: `https://musicbrainz.org/release/${mbid}`,
          priceCents: 2999,
          coreStructuredData: {
            artist,
            album: title,
            releaseYear,
            rpm: "33",
            recordLabel: label,
          },
        };
      }
    }
  } catch {
    // Fall through
  }

  // Graceful fallback for music queries
  return {
    title: cleanQuery,
    artist: "Artist",
    summary: `Vinyl LP: ${cleanQuery}`,
    typePath: "/media/music/vinyl",
    coreType: "MEDIA",
    canonicalExternalId: `vinyl:${cleanQuery.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    canonicalUrl: `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery + " vinyl")}`,
    priceCents: 2999,
    coreStructuredData: {
      artist: "Various Artists",
      album: cleanQuery,
      rpm: "33",
    },
  };
}
