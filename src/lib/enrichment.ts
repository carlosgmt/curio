export interface EnrichedMetadata {
  coverUrl?: string;
  artworkUrl?: string;
  posterUrl?: string;
  author?: string;
  year?: number;
  lat?: string;
  lon?: string;
  mapUrl?: string;
  displayName?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  favicon?: string;
  domain?: string;
}

/**
 * Fetch book metadata and cover image from Open Library.
 */
export async function enrichBook(query: string): Promise<EnrichedMetadata | null> {
  const clean = query.replace(/^(?:read|book|reading|finish|bought)\s+/i, "").trim();
  if (!clean) return null;

  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(clean)}&limit=1`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data?.docs?.[0];
    if (!doc) return null;

    const coverId = doc.cover_i;
    const coverUrl = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : undefined;

    return {
      coverUrl,
      author: doc.author_name?.[0],
      year: doc.first_publish_year,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch movie or music artwork from iTunes Search API.
 */
export async function enrichMedia(query: string): Promise<EnrichedMetadata | null> {
  const clean = query.replace(/^(?:watch|movie|film|listen to|album|song)\s+/i, "").trim();
  if (!clean) return null;

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&limit=1`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.results?.[0];
    if (!item || !item.artworkUrl100) return null;

    // Upgrade thumbnail to 600x600 high-res
    const artworkUrl = item.artworkUrl100.replace("100x100bb.jpg", "600x600bb.jpg");

    return {
      artworkUrl,
      posterUrl: artworkUrl,
      author: item.artistName,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch geographic coordinates and map view from OpenStreetMap Nominatim.
 */
export async function enrichPlace(query: string): Promise<EnrichedMetadata | null> {
  const clean = query
    .replace(/^(?:visit|travel to|trip to|flight to|fly to|hotel in|in|at)\s+/i, "")
    .trim();
  if (!clean) return null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean)}&format=json&limit=1`,
      {
        headers: { "User-Agent": "BrainSpace/1.0 (https://brainspace.local)" },
        signal: AbortSignal.timeout(3500),
      }
    );
    if (!res.ok) return null;
    const list = await res.json();
    const place = list?.[0];
    if (!place || !place.lat || !place.lon) return null;

    const lat = place.lat;
    const lon = place.lon;
    const mapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;

    return {
      lat,
      lon,
      mapUrl,
      displayName: place.display_name,
    };
  } catch {
    return null;
  }
}

/**
 * Parse OpenGraph tags from any webpage link.
 */
export async function enrichLink(url: string): Promise<EnrichedMetadata | null> {
  try {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BrainSpaceBot/1.0)" },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return { domain, favicon };

    const html = await res.text();
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);

    return {
      domain,
      favicon,
      ogImage: ogImageMatch ? ogImageMatch[1] : undefined,
      ogTitle: ogTitleMatch ? ogTitleMatch[1] : titleTagMatch ? titleTagMatch[1] : undefined,
      ogDescription: ogDescMatch ? ogDescMatch[1] : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Automatically determine the appropriate enrichment strategy based on intent and content.
 */
export async function autoEnrich(
  intent: string,
  title: string,
  text: string
): Promise<EnrichedMetadata | null> {
  const combined = `${title} ${text}`.trim();

  // 1. Link / URL check
  const urlMatch = combined.match(/https?:\/\/[^\s]+/i);
  if (intent === "link" || urlMatch) {
    if (urlMatch) {
      const linkData = await enrichLink(urlMatch[0]);
      if (linkData) return linkData;
    }
  }

  // 2. Book
  if (intent === "book" || /\b(book|novel|reading|read)\b/i.test(title)) {
    const bookData = await enrichBook(title);
    if (bookData) return bookData;
  }

  // 3. Movies / Shows / Music
  if (intent === "movie" || intent === "music" || /\b(movie|film|album|album art|track)\b/i.test(title)) {
    const mediaData = await enrichMedia(title);
    if (mediaData) return mediaData;
  }

  // 4. Place / Travel
  if (intent === "travel" || intent === "place" || /\b(trip|flight|visit|travel)\b/i.test(title)) {
    const placeData = await enrichPlace(title);
    if (placeData) return placeData;
  }

  return null;
}
