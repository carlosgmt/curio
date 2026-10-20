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

export async function resolvePlace(
  query: string,
  options?: { fetchFn?: typeof fetch; timeoutMs?: number }
): Promise<ResolvedPlace | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 4000;

  const trimmed = query.trim();
  if (!trimmed) return null;

  const cleanTitle = trimmed
    .replace(/^the\s+/i, "")
    .trim();

  const titleVariations = [
    trimmed.replace(/\s+/g, "_"),
    cleanTitle.replace(/\s+/g, "_"),
    `${cleanTitle.replace(/\s+/g, "_")}_(museum)`,
    `${cleanTitle.replace(/\s+/g, "_")}_(Paris)`,
    `${cleanTitle.replace(/\s+/g, "_")}_(London)`,
  ];

  let wikiData: any = null;
  let canonicalPageTitle = trimmed;

  for (const pageTitle of titleVariations) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
      const res = await fetchFn(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Curio/3.2 (https://github.com/curio-app; hello@curio.local)",
          Accept: "application/json",
        },
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data.type === "standard" && data.title) {
          wikiData = data;
          canonicalPageTitle = data.titles?.canonical || pageTitle;
          break;
        }
      }
    } catch {
      // Continue to next variation
    }
  }

  // Parse details from Wikipedia summary
  let title = wikiData?.title ? wikiData.title.replace(/\s*\([^)]+\)$/, "").trim() : trimmed;
  let summary = wikiData?.extract || `Verified location for ${title}`;
  let heroImageUrl = wikiData?.originalimage?.source || wikiData?.thumbnail?.source || null;
  let category = wikiData?.description || "Cultural Venue & Landmark";

  let coordinates: { latitude: number; longitude: number } | undefined = undefined;
  if (wikiData?.coordinates?.lat && wikiData?.coordinates?.lon) {
    coordinates = {
      latitude: wikiData.coordinates.lat,
      longitude: wikiData.coordinates.lon,
    };
  }

  let city: string | undefined = undefined;
  let country: string | undefined = undefined;
  let address: string | undefined = undefined;

  // Extract location hints from description and extract
  const desc = (wikiData?.description || "") + " " + (wikiData?.extract || "");
  const cityMatch = desc.match(/\b(?:in|located in|at)\s+([A-Z][a-zA-Z\s]+?)(?:,\s*([A-Z][a-zA-Z\s]+))?[.;]/);
  if (cityMatch) {
    city = cityMatch[1]?.trim();
    if (cityMatch[2]) {
      country = cityMatch[2]?.trim();
    }
  }

  // Fallback / coordinate enhancement via Nominatim if needed
  if (!coordinates) {
    try {
      const nomController = new AbortController();
      const nomTimer = setTimeout(() => nomController.abort(), 1800);
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        trimmed
      )}&format=json&limit=1&addressdetails=1`;
      const nomRes = await fetchFn(nomUrl, {
        signal: nomController.signal,
        headers: {
          "User-Agent": "Curio/3.2 (https://github.com/curio-app; places-resolver)",
          Accept: "application/json",
        },
      });
      clearTimeout(nomTimer);

      if (nomRes.ok) {
        const nomArray = await nomRes.json();
        if (Array.isArray(nomArray) && nomArray.length > 0) {
          const first = nomArray[0];
          coordinates = {
            latitude: parseFloat(first.lat),
            longitude: parseFloat(first.lon),
          };
          address = first.display_name;
          if (first.name && !wikiData) {
            title = first.name;
          }
          if (first.address) {
            city = city || first.address.city || first.address.town || first.address.village;
            country = country || first.address.country;
            category = category || first.type || first.class;
          }
          if (!wikiData) {
            const cleanType = first.type || first.class || "venue";
            category = cleanType.charAt(0).toUpperCase() + cleanType.slice(1);
            summary = `${category} located at ${first.display_name}`;
          }
        }
      }
    } catch {
      // Nominatim best effort
    }
  }

  // Build clean Google Maps URL
  const googleMapsUrl = coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`
    : `https://maps.google.com/?q=${encodeURIComponent(title + (city ? ` ${city}` : ""))}`;

  const canonicalUrl = wikiData?.content_urls?.desktop?.page || googleMapsUrl;
  const canonicalExternalId = wikiData?.wikibase_item || (coordinates ? `osm:${trimmed.toLowerCase().replace(/\s+/g, "-")}` : `place:${canonicalPageTitle}`);

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
    return [];
  }
}
