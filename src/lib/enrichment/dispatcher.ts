import { fetchAndExtractMetadata, type ExtractedMetadata } from "./opengraph";
import { resolveBook, type ResolvedBook } from "./providers/books";
import { resolveFilm, type ResolvedFilm } from "./providers/cinema";
import { resolveMusicBrainz, resolveSpotifyUrl, type ResolvedMusic } from "./providers/music";
import { resolveBarcode, resolveWineQuery, type ResolvedProduct } from "./providers/products";

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
}

/**
 * Unified Live Enrichment Dispatcher
 * Routes URL or query to the optimal external metadata provider
 */
export async function enrichCaptureInput(
  input: string,
  options?: {
    detectedType?: string;
    fetchFn?: typeof fetch;
  }
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
        };
      }
    }

    // 1b. General Webpage OpenGraph + JSON-LD Extraction
    const og = await fetchAndExtractMetadata(trimmed, { fetchFn });
    const parsedUrl = new URL(trimmed);
    const domain = parsedUrl.hostname.replace("www.", "");
    const title = og.title || trimmed;
    const coreType = og.structuredType || "PRODUCT";
    const typePath = og.typePath || (coreType === "BOOK" ? "/product/book" : "/product/generic");

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
        jsonLd: og.jsonLd,
      },
      primarySource: {
        sellerName: og.siteName || domain,
        sourceUrl: trimmed,
        priceCents: og.price,
        currency: og.currency,
      },
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
      };
    }
  }

  // 3. Books
  const lower = trimmed.toLowerCase();
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
      };
    }
  }

  // 4. Music & Vinyl
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
      };
    }
  }

  // 5. Cinema & Film
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
      };
    }
  }

  // 6. Wine & Beverages
  if (/\b(?:wine|cuvée|domaine|chateau|château|pinot|cabernet|syrah|chardonnay)\b/i.test(lower)) {
    const wineRes = resolveWineQuery(trimmed);
    return {
      title: wineRes.title,
      summary: wineRes.summary,
      heroImageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80",
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
    };
  }

  // 7. General Fallback
  return {
    title: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    summary: `Curated item: ${trimmed}`,
    coreType: options?.detectedType || "PRODUCT",
    typePath: "/product/generic",
    canonicalUrl: `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`,
    coreStructuredData: { query: trimmed },
    priceCents: 2900,
  };
}
