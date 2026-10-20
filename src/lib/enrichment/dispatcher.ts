import { fetchAndExtractMetadata, type ExtractedMetadata } from "./opengraph";
import { resolveBook, type ResolvedBook } from "./providers/books";
import { resolveFilm, type ResolvedFilm } from "./providers/cinema";
import { resolveMusicBrainz, resolveSpotifyUrl, type ResolvedMusic } from "./providers/music";
import { resolveBarcode, resolveWineQuery, type ResolvedProduct } from "./providers/products";
import {
  discoverUniversalEntities,
  type DiscoveredCandidate,
  type CandidateFallback,
} from "./universalDiscovery";
import {
  detectAndParseCommercialSku,
  resolveCommercialProduct,
} from "./providers/commercial";
import { resolvePlace, type ResolvedPlace } from "./providers/places";
import { resolveCreator, type ResolvedCreator } from "./providers/creators";
import { parseTransitPass, type ParsedTransitPass } from "./providers/travel";
import { lookupByCanonicalIdentity } from "../ingest/cacheLookup";

export interface EnrichmentPayload {
  title: string;
  summary?: string | null;
  heroImageUrl?: string | null;
  coreType: string;
  typePath: string;
  canonicalExternalId?: string | null;
  canonicalUrl: string;
  brandOrCreator?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  coreStructuredData: Record<string, any>;
  primarySource?: {
    sellerName: string;
    sourceUrl: string;
    priceCents?: number | null;
    currency?: string | null;
  };
  runnerUpCandidates?: CandidateFallback[];
  cachedEntityId?: string | null;
}

export interface EnrichCaptureOptions {
  detectedType?: string;
  forcedTypePath?: string;
  universalCandidates?: DiscoveredCandidate[];
  fetchFn?: typeof fetch;
  skipCache?: boolean;
}

/**
 * Hydrates full specialist metadata for the winning ontology typePath
 */
async function hydrateSpecialist(
  targetTitle: string,
  typePath: string,
  winningCandidate: DiscoveredCandidate | null,
  fetchFn: typeof fetch,
  runnerUpCandidates: CandidateFallback[]
): Promise<EnrichmentPayload> {
  // Cinema & Film
  if (typePath === "/media/film") {
    const filmRes = await resolveFilm(targetTitle, { fetchFn });
    if (filmRes) {
      return {
        title: filmRes.title,
        summary: filmRes.summary,
        heroImageUrl: filmRes.posterUrl,
        coreType: "MEDIA",
        typePath: "/media/film",
        canonicalExternalId: filmRes.canonicalExternalId || winningCandidate?.conceptUri,
        canonicalUrl:
          filmRes.canonicalUrl ||
          winningCandidate?.url ||
          `https://en.wikipedia.org/wiki/${encodeURIComponent(filmRes.title)}`,
        brandOrCreator: filmRes.director || winningCandidate?.creator,
        priceCents: filmRes.priceCents,
        coreStructuredData: {
          ...filmRes.coreStructuredData,
          wikidataUri: winningCandidate?.conceptUri,
        },
        primarySource: {
          sellerName: "MUBI",
          sourceUrl: `https://mubi.com/search?query=${encodeURIComponent(filmRes.title)}`,
          priceCents: filmRes.priceCents,
        },
        runnerUpCandidates,
      };
    }

    return {
      title: winningCandidate?.title || targetTitle,
      summary: winningCandidate?.snippet || `Film: ${targetTitle}`,
      heroImageUrl: winningCandidate?.thumbnailUrl || null,
      coreType: "MEDIA",
      typePath: "/media/film",
      canonicalExternalId: winningCandidate?.conceptUri,
      canonicalUrl: winningCandidate?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(targetTitle)}`,
      brandOrCreator: winningCandidate?.creator,
      priceCents: 1499,
      currency: "USD",
      coreStructuredData: {
        wikidataUri: winningCandidate?.conceptUri,
        releaseYear: winningCandidate?.year,
        director: winningCandidate?.creator,
      },
      primarySource: {
        sellerName: "MUBI",
        sourceUrl: `https://mubi.com/search?query=${encodeURIComponent(targetTitle)}`,
        priceCents: 1499,
      },
      runnerUpCandidates,
    };
  }

  // Books
  if (typePath === "/product/book") {
    const bookRes = await resolveBook(targetTitle, { fetchFn });
    if (bookRes) {
      return {
        title: bookRes.title,
        summary: bookRes.summary,
        heroImageUrl: bookRes.coverUrl,
        coreType: "BOOK",
        typePath: "/product/book",
        canonicalExternalId: bookRes.canonicalExternalId || winningCandidate?.conceptUri,
        canonicalUrl:
          bookRes.canonicalUrl ||
          winningCandidate?.url ||
          `https://openlibrary.org/search?q=${encodeURIComponent(bookRes.title)}`,
        brandOrCreator: bookRes.author || winningCandidate?.creator,
        priceCents: bookRes.priceCents,
        coreStructuredData: {
          ...bookRes.coreStructuredData,
          wikidataUri: winningCandidate?.conceptUri,
        },
        primarySource: {
          sellerName: "Bookshop.org",
          sourceUrl: `https://bookshop.org/search?keywords=${encodeURIComponent(bookRes.title)}`,
          priceCents: bookRes.priceCents,
        },
        runnerUpCandidates,
      };
    }

    return {
      title: winningCandidate?.title || targetTitle,
      summary: winningCandidate?.snippet || `Book: ${targetTitle}`,
      heroImageUrl: winningCandidate?.thumbnailUrl || null,
      coreType: "BOOK",
      typePath: "/product/book",
      canonicalExternalId: winningCandidate?.conceptUri,
      canonicalUrl: winningCandidate?.url || `https://openlibrary.org/search?q=${encodeURIComponent(targetTitle)}`,
      brandOrCreator: winningCandidate?.creator,
      priceCents: 2200,
      currency: "USD",
      coreStructuredData: {
        wikidataUri: winningCandidate?.conceptUri,
        publicationYear: winningCandidate?.year,
        author: winningCandidate?.creator,
      },
      primarySource: {
        sellerName: "Bookshop.org",
        sourceUrl: `https://bookshop.org/search?keywords=${encodeURIComponent(targetTitle)}`,
        priceCents: 2200,
      },
      runnerUpCandidates,
    };
  }

  // Music: Album, Song & Vinyl
  if (typePath === "/media/music/vinyl" || typePath.startsWith("/media/music")) {
    const isSong = typePath === "/media/music/song";
    const musicRes = await resolveMusicBrainz(targetTitle, {
      fetchFn,
      subType: isSong ? "song" : "album",
      creatorHint: winningCandidate?.creator || undefined,
    });
    const effectiveMusicTypePath =
      typePath === "/media/music/song"
        ? "/media/music/song"
        : typePath === "/media/music/album"
        ? "/media/music/album"
        : musicRes?.typePath || "/media/music/album";

    if (musicRes) {
      return {
        title: musicRes.title,
        summary: musicRes.summary,
        heroImageUrl: musicRes.coverUrl || winningCandidate?.thumbnailUrl || null,
        coreType: "MEDIA",
        typePath: effectiveMusicTypePath,
        canonicalExternalId: musicRes.canonicalExternalId || winningCandidate?.conceptUri,
        canonicalUrl:
          musicRes.canonicalUrl ||
          winningCandidate?.url ||
          `https://www.discogs.com/search/?q=${encodeURIComponent(musicRes.title)}`,
        brandOrCreator: musicRes.artist || winningCandidate?.creator,
        priceCents: musicRes.priceCents,
        coreStructuredData: {
          ...musicRes.coreStructuredData,
          wikidataUri: winningCandidate?.conceptUri,
        },
        primarySource: {
          sellerName: "Discogs",
          sourceUrl: `https://www.discogs.com/search/?q=${encodeURIComponent(musicRes.title)}&type=release`,
          priceCents: musicRes.priceCents,
        },
        runnerUpCandidates,
      };
    }

    return {
      title: winningCandidate?.title || targetTitle,
      summary: winningCandidate?.snippet || `${isSong ? "Song" : "Album"}: ${targetTitle}`,
      heroImageUrl: winningCandidate?.thumbnailUrl || null,
      coreType: "MEDIA",
      typePath: effectiveMusicTypePath,
      canonicalExternalId: winningCandidate?.conceptUri,
      canonicalUrl: winningCandidate?.url || `https://www.discogs.com/search/?q=${encodeURIComponent(targetTitle)}`,
      brandOrCreator: winningCandidate?.creator,
      priceCents: isSong ? 129 : 2999,
      currency: "USD",
      coreStructuredData: {
        wikidataUri: winningCandidate?.conceptUri,
        artist: winningCandidate?.creator,
        year: winningCandidate?.year,
      },
      primarySource: {
        sellerName: "Discogs",
        sourceUrl: `https://www.discogs.com/search/?q=${encodeURIComponent(targetTitle)}&type=release`,
        priceCents: isSong ? 129 : 2999,
      },
      runnerUpCandidates,
    };
  }

  // Wine & Beverages
  if (typePath === "/product/beverage/wine" || typePath.includes("wine")) {
    const wineRes = resolveWineQuery(targetTitle);
    return {
      title: wineRes.title,
      summary: wineRes.summary,
      heroImageUrl:
        winningCandidate?.thumbnailUrl ||
        "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80",
      coreType: "PRODUCT",
      typePath: "/product/beverage/wine",
      canonicalExternalId: wineRes.canonicalExternalId || winningCandidate?.conceptUri,
      canonicalUrl: winningCandidate?.url || wineRes.canonicalUrl,
      brandOrCreator: wineRes.brandOrProducer,
      priceCents: wineRes.priceCents,
      coreStructuredData: {
        ...wineRes.coreStructuredData,
        wikidataUri: winningCandidate?.conceptUri,
      },
      primarySource: {
        sellerName: "Wine.com",
        sourceUrl: `https://www.wine.com/search/${encodeURIComponent(wineRes.title)}`,
        priceCents: wineRes.priceCents,
      },
      runnerUpCandidates,
    };
  }

  // Places & Venues
  if (typePath === "/place" || typePath.startsWith("/place")) {
    const placeRes = await resolvePlace(targetTitle, { fetchFn });
    if (placeRes) {
      return {
        title: placeRes.title || winningCandidate?.title || targetTitle,
        summary: placeRes.summary || winningCandidate?.snippet || `Verified location for ${targetTitle}`,
        heroImageUrl: placeRes.heroImageUrl || winningCandidate?.thumbnailUrl || null,
        coreType: "PLACE",
        typePath: "/place",
        canonicalExternalId: placeRes.canonicalExternalId || winningCandidate?.conceptUri,
        canonicalUrl: placeRes.canonicalUrl || winningCandidate?.url || placeRes.googleMapsUrl,
        brandOrCreator: placeRes.city ? `${placeRes.city}${placeRes.country ? `, ${placeRes.country}` : ""}` : null,
        priceCents: null,
        coreStructuredData: {
          ...placeRes.coreStructuredData,
          wikidataUri: winningCandidate?.conceptUri,
        },
        primarySource: {
          sellerName: "Google Maps",
          sourceUrl: placeRes.googleMapsUrl,
        },
        runnerUpCandidates,
      };
    }

    return {
      title: winningCandidate?.title || targetTitle,
      summary: winningCandidate?.snippet || `Verified location for ${targetTitle}`,
      heroImageUrl: winningCandidate?.thumbnailUrl || null,
      coreType: "PLACE",
      typePath: "/place",
      canonicalExternalId: winningCandidate?.conceptUri,
      canonicalUrl: winningCandidate?.url || `https://maps.google.com/?q=${encodeURIComponent(targetTitle)}`,
      brandOrCreator: null,
      priceCents: null,
      coreStructuredData: {
        wikidataUri: winningCandidate?.conceptUri,
        locationName: targetTitle,
      },
      primarySource: {
        sellerName: "Google Maps",
        sourceUrl: `https://maps.google.com/?q=${encodeURIComponent(targetTitle)}`,
      },
      runnerUpCandidates,
    };
  }

  // Creators & People
  if (typePath.startsWith("/person")) {
    const creatorRes = await resolveCreator(targetTitle, { fetchFn });
    if (creatorRes) {
      return {
        title: creatorRes.name || winningCandidate?.title || targetTitle,
        summary: creatorRes.summary || winningCandidate?.snippet || `Biographical profile of ${targetTitle}`,
        heroImageUrl: creatorRes.portraitUrl || winningCandidate?.thumbnailUrl || null,
        coreType: "CREATOR",
        typePath: creatorRes.typePath || typePath,
        canonicalExternalId: creatorRes.canonicalExternalId || winningCandidate?.conceptUri,
        canonicalUrl:
          creatorRes.canonicalUrl ||
          winningCandidate?.url ||
          `https://en.wikipedia.org/wiki/${encodeURIComponent(targetTitle)}`,
        brandOrCreator: creatorRes.nationality
          ? `${creatorRes.nationality} ${creatorRes.role}`
          : creatorRes.role,
        priceCents: null,
        coreStructuredData: {
          ...creatorRes.coreStructuredData,
          wikidataUri: winningCandidate?.conceptUri,
        },
        primarySource: {
          sellerName: "Wikipedia",
          sourceUrl: creatorRes.canonicalUrl,
        },
        runnerUpCandidates,
      };
    }

    return {
      title: winningCandidate?.title || targetTitle,
      summary: winningCandidate?.snippet || `Biographical profile for ${targetTitle}`,
      heroImageUrl: winningCandidate?.thumbnailUrl || null,
      coreType: "CREATOR",
      typePath,
      canonicalExternalId: winningCandidate?.conceptUri,
      canonicalUrl: winningCandidate?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(targetTitle)}`,
      brandOrCreator: winningCandidate?.creator || "Creator",
      priceCents: null,
      coreStructuredData: {
        wikidataUri: winningCandidate?.conceptUri,
        name: targetTitle,
      },
      primarySource: {
        sellerName: "Wikipedia",
        sourceUrl: winningCandidate?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(targetTitle)}`,
      },
      runnerUpCandidates,
    };
  }

  // Video Games
  if (typePath === "/media/videogame") {
    return {
      title: winningCandidate?.title || targetTitle,
      summary: winningCandidate?.snippet || `Video game: ${targetTitle}`,
      heroImageUrl: winningCandidate?.thumbnailUrl || null,
      coreType: "VIDEOGAME",
      typePath: "/media/videogame",
      canonicalExternalId: winningCandidate?.conceptUri,
      canonicalUrl:
        winningCandidate?.url ||
        `https://store.steampowered.com/search/?term=${encodeURIComponent(targetTitle)}`,
      brandOrCreator: winningCandidate?.creator,
      priceCents: 5999,
      coreStructuredData: {
        wikidataUri: winningCandidate?.conceptUri,
        developer: winningCandidate?.creator,
        releaseYear: winningCandidate?.year,
      },
      primarySource: {
        sellerName: "Steam",
        sourceUrl: `https://store.steampowered.com/search/?term=${encodeURIComponent(targetTitle)}`,
        priceCents: 5999,
      },
      runnerUpCandidates,
    };
  }

  // Art & Paintings
  if (typePath === "/product/art") {
    return {
      title: winningCandidate?.title || targetTitle,
      summary: winningCandidate?.snippet || `Artwork: ${targetTitle}`,
      heroImageUrl: winningCandidate?.thumbnailUrl || null,
      coreType: "PRODUCT",
      typePath: "/product/art",
      canonicalExternalId: winningCandidate?.conceptUri,
      canonicalUrl: winningCandidate?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(targetTitle)}`,
      brandOrCreator: winningCandidate?.creator,
      priceCents: null,
      coreStructuredData: {
        wikidataUri: winningCandidate?.conceptUri,
        artist: winningCandidate?.creator,
        year: winningCandidate?.year,
      },
      primarySource: {
        sellerName: "WikiArt",
        sourceUrl: `https://www.wikiart.org/en/Search/${encodeURIComponent(targetTitle)}`,
      },
      runnerUpCandidates,
    };
  }

  // Culinary & Recipes
  if (typePath === "/article/recipe") {
    return {
      title: winningCandidate?.title || targetTitle,
      summary: winningCandidate?.snippet || `Recipe: ${targetTitle}`,
      heroImageUrl: winningCandidate?.thumbnailUrl || null,
      coreType: "CULINARY",
      typePath: "/article/recipe",
      canonicalExternalId: winningCandidate?.conceptUri,
      canonicalUrl:
        winningCandidate?.url || `https://duckduckgo.com/?q=${encodeURIComponent(targetTitle + " recipe")}`,
      brandOrCreator: winningCandidate?.creator,
      priceCents: null,
      coreStructuredData: {
        wikidataUri: winningCandidate?.conceptUri,
        recipeName: targetTitle,
      },
      primarySource: {
        sellerName: "Recipe Index",
        sourceUrl: `https://duckduckgo.com/?q=${encodeURIComponent(targetTitle + " recipe")}`,
      },
      runnerUpCandidates,
    };
  }

  // Fallback Product / Watch / Generic
  const finalTitle = winningCandidate?.title || targetTitle.charAt(0).toUpperCase() + targetTitle.slice(1);
  let heroImageUrl = winningCandidate?.thumbnailUrl || null;
  let summary = winningCandidate?.snippet || null;

  if (!heroImageUrl) {
    try {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        finalTitle.replace(/\s+/g, "_")
      )}`;
      const sumRes = await fetchFn(summaryUrl, {
        headers: { Accept: "application/json" },
      });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        if (sumData?.thumbnail?.source) {
          heroImageUrl = sumData.thumbnail.source;
        }
        if (sumData?.extract) {
          summary = sumData.extract;
        }
      }
    } catch {
      // Non-fatal
    }
  }

  const effectiveTypePath =
    typePath && typePath !== "/product/generic"
      ? typePath
      : winningCandidate?.typePath || "/product/generic";
  const isWatch = effectiveTypePath === "/product/watch";

  return {
    title: finalTitle,
    summary: summary || `Curated item: ${targetTitle}`,
    heroImageUrl,
    coreType: winningCandidate?.coreType || "PRODUCT",
    typePath: effectiveTypePath,
    canonicalExternalId: winningCandidate?.conceptUri || null,
    canonicalUrl:
      winningCandidate?.url ||
      (isWatch
        ? `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(finalTitle)}`
        : `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(finalTitle)}`),
    brandOrCreator: winningCandidate?.creator || finalTitle,
    coreStructuredData: {
      query: targetTitle,
      brand: winningCandidate?.creator || finalTitle,
      category: isWatch ? "Watch" : "Product",
      wikidataUri: winningCandidate?.conceptUri,
    },
    priceCents: isWatch ? 650000 : 2900,
    primarySource: isWatch
      ? {
          sellerName: "Chrono24",
          sourceUrl: `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(finalTitle)}`,
          priceCents: 650000,
        }
      : {
          sellerName: "Google Shopping",
          sourceUrl: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(finalTitle)}`,
          priceCents: 2900,
        },
    runnerUpCandidates,
  };
}

/**
 * Unified Live Enrichment Dispatcher
 * Routes URL or query to the optimal external metadata provider
 */
export async function enrichCaptureInput(
  input: string,
  options?: EnrichCaptureOptions
): Promise<EnrichmentPayload> {
  const trimmed = input.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);
  const fetchFn = options?.fetchFn ?? fetch;

  // 1. URL Path
  if (isUrl) {
    // 1a. Spotify URL
    if (trimmed.includes("spotify.com/")) {
      const spotifyRes = await resolveSpotifyUrl(trimmed, { fetchFn });
      if (spotifyRes) {
        return {
          title: spotifyRes.title,
          summary: spotifyRes.summary,
          heroImageUrl: spotifyRes.coverUrl,
          coreType: "MEDIA",
          typePath: "/media/music/vinyl",
          canonicalExternalId: spotifyRes.canonicalExternalId,
          canonicalUrl: spotifyRes.canonicalUrl,
          brandOrCreator: spotifyRes.artist,
          priceCents: spotifyRes.priceCents,
          coreStructuredData: spotifyRes.coreStructuredData,
          primarySource: {
            sellerName: "Spotify",
            sourceUrl: trimmed,
            priceCents: 0,
          },
          runnerUpCandidates: [],
        };
      }
    }

    // 1b. General Webpage OpenGraph + JSON-LD Extraction
    const og = await fetchAndExtractMetadata(trimmed, { fetchFn });
    const parsedUrl = new URL(trimmed);
    const domain = parsedUrl.hostname.replace("www.", "");
    const title = og.title || trimmed;
    const coreType = og.structuredType || "LINK";
    const typePath = options?.forcedTypePath || og.typePath || (coreType === "BOOK" ? "/product/book" : "/link");

    return {
      title,
      summary: og.description || `Captured from ${domain}`,
      heroImageUrl: og.image || null,
      coreType,
      typePath,
      canonicalUrl: og.url || trimmed,
      brandOrCreator: og.authorOrCreator || og.siteName || domain,
      priceCents: og.price,
      currency: og.currency || "USD",
      coreStructuredData: {
        rawUrl: trimmed,
        siteName: og.siteName,
        domain,
        jsonLd: og.jsonLd,
        readingTimeMinutes: og.description ? Math.max(1, Math.round(og.description.length / 250)) : 3,
      },
      primarySource: {
        sellerName: og.siteName || domain,
        sourceUrl: trimmed,
        priceCents: og.price,
        currency: og.currency,
      },
      runnerUpCandidates: [],
    };
  }

  // 1.5 Travel & Transit Pass
  const transitPass = parseTransitPass(trimmed);
  if (
    options?.forcedTypePath?.startsWith("/travel") ||
    (transitPass && (transitPass.operator || trimmed.match(/\b(flight|train|ave|tgv|ice|eurostar|ib\d|ba\d|lh\d|af\d|seat|gate)\b/i)))
  ) {
    const pass = transitPass || {
      code: "PASS",
      origin: "ORIGIN",
      destination: "DEST",
      departureTime: "08:30",
      arrivalTime: "10:15",
      date: new Date().toISOString().split("T")[0],
      seat: "12A",
      gate: "B22",
      terminal: "T4",
      bookingRef: "CR789K",
      status: "ON TIME",
      mode: "flight" as const,
    };
    return {
      title: `${pass.code}: ${pass.origin} ✈ ${pass.destination}`,
      summary: `${pass.operator || "Transit"} ${pass.code} from ${pass.origin} to ${pass.destination}. Date: ${pass.date}, Seat: ${pass.seat}, Gate: ${pass.gate}`,
      heroImageUrl: null,
      coreType: "TRAVEL",
      typePath: "/travel/transit",
      canonicalExternalId: `transit:${pass.code}:${pass.date}`,
      canonicalUrl: `https://www.flightradar24.com/data/flights/${encodeURIComponent(pass.code.replace(/\s+/g, ""))}`,
      brandOrCreator: pass.operator || "Transit Operator",
      priceCents: null,
      coreStructuredData: {
        operator: pass.operator,
        code: pass.code,
        origin: pass.origin,
        destination: pass.destination,
        departureTime: pass.departureTime,
        arrivalTime: pass.arrivalTime,
        date: pass.date,
        seat: pass.seat,
        gate: pass.gate,
        terminal: pass.terminal,
        bookingRef: pass.bookingRef,
        status: pass.status,
        mode: pass.mode,
      },
      primarySource: {
        sellerName: pass.operator || "Transit Carrier",
        sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(pass.code + " status")}`,
      },
      runnerUpCandidates: [],
    };
  }

  // 1.6 Checklist / Structured List (/memo/list)
  if (
    options?.forcedTypePath === "/memo/list" ||
    trimmed.startsWith("- [ ]") ||
    trimmed.startsWith("[ ]") ||
    trimmed.startsWith("TODO:") ||
    trimmed.startsWith("Todo:")
  ) {
    const rawLines = trimmed.split("\n").filter((l) => l.trim().length > 0);
    const titleLine = rawLines[0].replace(/^(?:TODO|Todo|List):\s*/i, "").replace(/^[-*]\s*\[[ xX]\]\s*/, "").trim();
    const items = rawLines.map((line, idx) => {
      const isCompleted = /^[-*]?\s*\[[xX]\]/.test(line);
      const text = line.replace(/^[-*]?\s*\[[ xX]\]\s*/, "").replace(/^[-*]\s*/, "").trim();
      return {
        id: `item-${idx + 1}`,
        text: text || `Item ${idx + 1}`,
        completed: isCompleted,
      };
    });

    return {
      title: titleLine || "Checklist",
      summary: `${items.filter((i) => i.completed).length} of ${items.length} completed`,
      heroImageUrl: null,
      coreType: "NOTE",
      typePath: "/memo/list",
      canonicalExternalId: `list:${Date.now()}`,
      canonicalUrl: "",
      brandOrCreator: null,
      priceCents: null,
      coreStructuredData: {
        title: titleLine || "Checklist",
        items,
      },
      runnerUpCandidates: [],
    };
  }

  // 2. Barcode (EAN / UPC)
  if (/^\d{8,14}$/.test(trimmed)) {
    const barcodeRes = await resolveBarcode(trimmed, { fetchFn });
    if (barcodeRes) {
      return {
        title: barcodeRes.title,
        summary: barcodeRes.summary,
        heroImageUrl: barcodeRes.imageUrl,
        coreType: barcodeRes.coreType,
        typePath: barcodeRes.typePath,
        canonicalExternalId: barcodeRes.canonicalExternalId,
        canonicalUrl: barcodeRes.canonicalUrl,
        brandOrCreator: barcodeRes.brandOrProducer,
        priceCents: barcodeRes.priceCents,
        coreStructuredData: barcodeRes.coreStructuredData,
        runnerUpCandidates: [],
      };
    }
  }

  // 3. Forced typePath (e.g. from Disambiguation Swap)
  if (options?.forcedTypePath) {
    return hydrateSpecialist(trimmed, options.forcedTypePath, null, fetchFn, []);
  }

  // 4. LAYER 1A: Commercial SKU Detector (Garments, Watches/Luxury, Electronics, Cosmetics)
  const skuAnalysis = detectAndParseCommercialSku(trimmed);
  if (skuAnalysis) {
    // For garments and cosmetics, resolve deterministically without encyclopedic Wikipedia noise
    if (skuAnalysis.category === "garment" || skuAnalysis.category === "cosmetics") {
      return resolveCommercialProduct(trimmed, skuAnalysis, { fetchFn });
    }

    // For watches, luxury & electronics, optionally pull product-line imagery & history from Universal Graph
    const lineCandidates =
      options?.universalCandidates ??
      (await discoverUniversalEntities(skuAnalysis.productLineQuery, { fetchFn, limit: 3 }).catch(() => []));
    const wikiCandidate = lineCandidates[0] || null;
    const lineRunnerUps: CandidateFallback[] = lineCandidates.slice(1).map((c) => ({
      title: c.year ? `${c.title} (${c.year})` : c.title,
      url: c.url,
      snippet: c.snippet,
      coreType: c.coreType,
      typePath: c.typePath,
      badgeLabel: c.badgeLabel,
    }));

    return resolveCommercialProduct(trimmed, skuAnalysis, {
      fetchFn,
      wikiCandidate,
      runnerUpCandidates: lineRunnerUps,
    });
  }

  // 5. LAYER 1B: Universal Knowledge Graph Discovery (Single-call Wikidata + Wikipedia)
  const candidates =
    options?.universalCandidates ??
    (await discoverUniversalEntities(trimmed, { fetchFn }).catch(() => []));

  if (candidates.length > 0) {
    const winning = candidates[0];
    const runnerUpCandidates: CandidateFallback[] = candidates.slice(1).map((c) => ({
      title: c.year ? `${c.title} (${c.year})` : c.title,
      url: c.url,
      snippet: c.snippet,
      coreType: c.coreType,
      typePath: c.typePath,
      badgeLabel: c.badgeLabel,
    }));

    // LAYER 1.5: Second Local Cache Gate (Canonical ID / Wikidata Q-ID Deduplication)
    // E.g. "Mi vida sin mi" -> Wikidata Q83630 -> hits existing "My Life Without Me" entity,
    // registers "Mi vida sin mi" as an alias, and skips deep specialist hydration (TMDB/OpenLibrary)!
    if (!options?.skipCache) {
      const cachedByCanonical = await lookupByCanonicalIdentity({
        canonicalExternalId: winning.conceptUri,
        wikidataUri: winning.conceptUri,
        canonicalUrl: winning.url,
        queryToRegisterAsAlias: trimmed,
        distinguisherQuery: trimmed,
      }).catch(() => null);

      if (cachedByCanonical) {
        const coreData = (cachedByCanonical.coreStructuredData as Record<string, any>) || {};
        return {
          title: cachedByCanonical.title,
          summary: cachedByCanonical.summary,
          heroImageUrl: cachedByCanonical.heroImageUrl,
          coreType: cachedByCanonical.coreType,
          typePath: cachedByCanonical.typePath || winning.typePath,
          canonicalExternalId: cachedByCanonical.canonicalExternalId || winning.conceptUri,
          canonicalUrl: cachedByCanonical.canonicalUrl,
          brandOrCreator: cachedByCanonical.brandOrCreator,
          priceCents: cachedByCanonical.priceCents,
          currency: cachedByCanonical.currency || "USD",
          coreStructuredData: coreData,
          runnerUpCandidates,
          cachedEntityId: cachedByCanonical.id,
        };
      }
    }

    // LAYER 2: Deep Specialist Hydration (Only on True Cache Miss)
    return hydrateSpecialist(winning.title, winning.typePath, winning, fetchFn, runnerUpCandidates);
  }

  // 5. Secondary Keyword Heuristics (when universal discovery returned 0 candidates)
  const lower = trimmed.toLowerCase();

  // Books
  if (options?.detectedType === "BOOK" || /\b(?:book|novel|memoir|author)\b/i.test(lower)) {
    const bookRes = await resolveBook(trimmed, { fetchFn });
    if (bookRes) {
      return {
        title: bookRes.title,
        summary: bookRes.summary,
        heroImageUrl: bookRes.coverUrl,
        coreType: "BOOK",
        typePath: "/product/book",
        canonicalExternalId: bookRes.canonicalExternalId,
        canonicalUrl: bookRes.canonicalUrl,
        brandOrCreator: bookRes.author,
        priceCents: bookRes.priceCents,
        coreStructuredData: bookRes.coreStructuredData,
        primarySource: {
          sellerName: "Bookshop.org",
          sourceUrl: `https://bookshop.org/search?keywords=${encodeURIComponent(bookRes.title)}`,
          priceCents: bookRes.priceCents,
        },
        runnerUpCandidates: [],
      };
    }
  }

  // Music & Vinyl
  if (/\b(?:vinyl|album|record|lp|song|artist)\b/i.test(lower)) {
    const musicRes = await resolveMusicBrainz(trimmed, { fetchFn });
    if (musicRes) {
      return {
        title: musicRes.title,
        summary: musicRes.summary,
        heroImageUrl: musicRes.coverUrl,
        coreType: "MEDIA",
        typePath: "/media/music/vinyl",
        canonicalExternalId: musicRes.canonicalExternalId,
        canonicalUrl: musicRes.canonicalUrl,
        brandOrCreator: musicRes.artist,
        priceCents: musicRes.priceCents,
        coreStructuredData: musicRes.coreStructuredData,
        primarySource: {
          sellerName: "Discogs",
          sourceUrl: `https://www.discogs.com/search/?q=${encodeURIComponent(musicRes.title)}&type=release`,
          priceCents: musicRes.priceCents,
        },
        runnerUpCandidates: [],
      };
    }
  }

  // Cinema & Film
  if (options?.detectedType === "MEDIA" || /\b(?:movie|film|cinema|criterion|director)\b/i.test(lower)) {
    const filmRes = await resolveFilm(trimmed, { fetchFn });
    if (filmRes) {
      return {
        title: filmRes.title,
        summary: filmRes.summary,
        heroImageUrl: filmRes.posterUrl,
        coreType: "MEDIA",
        typePath: "/media/film",
        canonicalExternalId: filmRes.canonicalExternalId,
        canonicalUrl: filmRes.canonicalUrl,
        brandOrCreator: filmRes.director,
        priceCents: filmRes.priceCents,
        coreStructuredData: filmRes.coreStructuredData,
        primarySource: {
          sellerName: "MUBI",
          sourceUrl: `https://mubi.com/search?query=${encodeURIComponent(filmRes.title)}`,
          priceCents: filmRes.priceCents,
        },
        runnerUpCandidates: [],
      };
    }
  }

  // Wine & Beverages
  if (/\b(?:wine|cuvée|domaine|chateau|château|pinot|cabernet|syrah|chardonnay)\b/i.test(lower)) {
    const wineRes = resolveWineQuery(trimmed);
    return {
      title: wineRes.title,
      summary: wineRes.summary,
      heroImageUrl:
        "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80",
      coreType: "PRODUCT",
      typePath: "/product/beverage/wine",
      canonicalExternalId: wineRes.canonicalExternalId,
      canonicalUrl: wineRes.canonicalUrl,
      brandOrCreator: wineRes.brandOrProducer,
      priceCents: wineRes.priceCents,
      coreStructuredData: wineRes.coreStructuredData,
      primarySource: {
        sellerName: "Wine.com",
        sourceUrl: `https://www.wine.com/search/${encodeURIComponent(wineRes.title)}`,
        priceCents: wineRes.priceCents,
      },
      runnerUpCandidates: [],
    };
  }

  // 6. General Fallback
  return {
    title: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    summary: `Curated item: ${trimmed}`,
    coreType: options?.detectedType || "PRODUCT",
    typePath: "/product/generic",
    canonicalUrl: `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`,
    coreStructuredData: { query: trimmed },
    priceCents: 2900,
    runnerUpCandidates: [],
  };
}
