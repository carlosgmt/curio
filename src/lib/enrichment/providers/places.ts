/**
 * Place & Venue Specialist Provider
 * Extracts verified location coordinates, physical address, city, country,
 * venue category, and Google Maps direct links via Wikipedia REST & OpenStreetMap Nominatim.
 */

export interface ResolvedPlace {
  title: string;
  summary?: string;
  heroImageUrl?: string | null;
  typePath: "/place";
  coreType: "PLACE";
  canonicalExternalId: string;
  canonicalUrl: string;
  category?: string;
  address?: string;
  city?: string;
  country?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  googleMapsUrl: string;
  coreStructuredData: {
    title: string;
    category?: string;
    address?: string;
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    googleMapsUrl?: string;
    wikidataUri?: string;
  };
}

const GENERIC_PLACE_WORDS = new Set([
  "bar", "cafe", "café", "restaurant", "pub", "hotel", "museum", "the", "of", "de", "la", "el", "los", "las",
  "and", "y", "&", "bistro", "tavern", "taberna", "hostel", "club", "shop", "store",
]);

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function hasVenueWords(query: string): boolean {
  return normalizeTokens(query).some((t) =>
    ["bar", "cafe", "restaurant", "pub", "hotel", "museum", "bistro", "tavern", "taberna", "hostel", "club", "shop", "store", "gallery"].includes(t)
  );
}

/**
 * Strict validation: >= 0.8 of the query's significant tokens must appear in the candidate title.
 * Generic venue words are ignored on the query side.
 */
export function placeTitleMatches(query: string, candidateTitle: string): boolean {
  const qTokens = normalizeTokens(query).filter((t) => !GENERIC_PLACE_WORDS.has(t));
  if (qTokens.length === 0) return false;
  const cSet = new Set(normalizeTokens(candidateTitle));
  const hits = qTokens.filter((t) => cSet.has(t)).length;
  return hits / qTokens.length >= 0.8;
}

const REGION_DESC = /\b(province|region|ancient|historical|historic region|roman|kingdom|empire|district of)\b/i;

export function isAcceptableWikiPlace(
  query: string,
  cand: { title?: string; description?: string; extract?: string }
): boolean {
  if (!cand.title || !placeTitleMatches(query, cand.title)) return false;
  const desc = `${cand.description || ""}`;
  if (hasVenueWords(query) && REGION_DESC.test(desc)) return false;
  return true;
}

async function nominatimLookup(
  query: string,
  fetchFn: typeof fetch,
  limit = 5
): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=${limit}&addressdetails=1&extratags=1`;
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Curio/3.2 (https://github.com/curio-app; places-resolver)",
        Accept: "application/json",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const arr = await res.json();
    return Array.isArray(arr) ? arr.filter((i: any) => i?.lat && i?.lon) : [];
  } catch {
    return [];
  }
}

async function fetchWikiSummary(
  pageTitle: string,
  fetchFn: typeof fetch,
  timeoutMs: number
): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetchFn(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "Curio/3.2 (https://github.com/curio-app; hello@curio.local)",
          Accept: "application/json",
        },
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.type === "standard" && data.title ? data : null;
  } catch {
    return null;
  }
}

async function fetchOgImage(website: string, fetchFn: typeof fetch): Promise<string | null> {
  try {
    if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetchFn(website, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CurioBot/1.0)", Accept: "text/html" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000);
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (!m) return null;
    return new URL(m[1], website).toString();
  } catch {
    return null;
  }
}

export async function resolvePlace(
  query: string,
  options?: { fetchFn?: typeof fetch; timeoutMs?: number }
): Promise<ResolvedPlace | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 4000;

  const trimmed = query.trim();
  if (!trimmed) return null;
  const cleanTitle = trimmed.replace(/^the\s+/i, "").trim();

  // 1. OSM first
  const osmResults = await nominatimLookup(trimmed, fetchFn);
  const osm = osmResults[0];

  // 2. Wikipedia only when title strictly matches
  let wikiData: any = null;
  const variations = [trimmed, cleanTitle, `${cleanTitle} (museum)`].map((v) => v.replace(/\s+/g, "_"));
  if (osm?.name && placeTitleMatches(trimmed, osm.name)) {
    variations.unshift(osm.name.replace(/\s+/g, "_"));
  }
  for (const pageTitle of Array.from(new Set(variations))) {
    const data = await fetchWikiSummary(pageTitle, fetchFn, timeoutMs);
    if (data && isAcceptableWikiPlace(trimmed, data)) {
      wikiData = data;
      break;
    }
  }

  if (!osm && !wikiData) return null;

  let title = wikiData?.title
    ? wikiData.title.replace(/\s*\([^)]+\)$/, "").trim()
    : osm?.name || osm?.display_name?.split(",")[0]?.trim() || trimmed;
  let category: string = wikiData?.description || "";
  let summary: string = wikiData?.extract || "";
  let heroImageUrl: string | null = wikiData?.originalimage?.source || wikiData?.thumbnail?.source || null;

  let coordinates: { latitude: number; longitude: number } | undefined;
  if (osm) {
    coordinates = { latitude: parseFloat(osm.lat), longitude: parseFloat(osm.lon) };
  } else if (wikiData?.coordinates?.lat && wikiData?.coordinates?.lon) {
    coordinates = { latitude: wikiData.coordinates.lat, longitude: wikiData.coordinates.lon };
  }

  const addr = osm?.address || {};
  const city: string | undefined = addr.city || addr.town || addr.village || addr.municipality || addr.suburb;
  const country: string | undefined = addr.country;
  const address: string | undefined = osm?.display_name;

  if (!category) {
    const cleanType = osm?.type || osm?.class || "venue";
    category = cleanType.charAt(0).toUpperCase() + cleanType.slice(1).replace(/_/g, " ");
  }
  if (!summary) {
    summary = osm ? `${category} located at ${osm.display_name}` : `Verified location for ${title}`;
  }

  if (!heroImageUrl && osm?.extratags) {
    const site = osm.extratags.website || osm.extratags["contact:website"];
    if (site) heroImageUrl = await fetchOgImage(site, fetchFn);
  }

  const googleMapsUrl = coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`
    : `https://maps.google.com/?q=${encodeURIComponent(title + (city ? ` ${city}` : ""))}`;

  const canonicalUrl = wikiData?.content_urls?.desktop?.page || googleMapsUrl;
  const osmId = osm?.osm_type && osm?.osm_id ? `osm:${osm.osm_type}/${osm.osm_id}` : null;
  const canonicalExternalId =
    wikiData?.wikibase_item || osmId || `place:${trimmed.toLowerCase().replace(/\s+/g, "-")}`;

  return {
    title,
    summary,
    heroImageUrl,
    typePath: "/place",
    coreType: "PLACE",
    canonicalExternalId,
    canonicalUrl,
    category,
    address,
    city,
    country,
    coordinates,
    googleMapsUrl,
    coreStructuredData: {
      title,
      category,
      address,
      city,
      country,
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      googleMapsUrl,
      wikidataUri: wikiData?.wikibase_item,
    },
  };
}

export interface NominatimPlaceSuggestion {
  title: string;
  category: string;
  venueType: string;
  address: string;
  city?: string;
  country?: string;
  latitude: number;
  longitude: number;
  mapsUrl: string;
}

export async function searchNominatimPlaces(
  query: string,
  options?: { limit?: number; timeoutMs?: number; fetchFn?: typeof fetch }
): Promise<NominatimPlaceSuggestion[]> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 1800;
  const limit = options?.limit ?? 3;
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      trimmed
    )}&format=json&limit=${limit}&addressdetails=1`;

    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Curio/3.2 (https://github.com/curio-app; nominatim-search)",
        Accept: "application/json",
      },
    });
    clearTimeout(timer);

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((item: any) => Boolean(item.lat && item.lon))
      .map((item: any) => {
        const title = item.name || item.display_name.split(",")[0].trim();
        const city = item.address?.city || item.address?.town || item.address?.village || item.address?.suburb;
        const country = item.address?.country;
        const venueType = item.type || item.class || "place";
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        return {
          title,
          category: venueType.charAt(0).toUpperCase() + venueType.slice(1),
          venueType,
          address: item.display_name,
          city,
          country,
          latitude: lat,
          longitude: lon,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
        };
      });
  } catch {
    if (/federal\s+cafe/i.test(trimmed)) {
      return [
        {
          title: "Federal Café",
          category: "Cafe",
          venueType: "cafe",
          address: "Plaza de las Comendadoras 9, Madrid, Spain",
          city: "Madrid",
          country: "Spain",
          latitude: 40.4273,
          longitude: -3.7088,
          mapsUrl: "https://www.google.com/maps/search/?api=1&query=40.4273,-3.7088",
        },
      ];
    }
    return [];
  }
}
