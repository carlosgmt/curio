import { safeFetch } from "../network/safeFetch";

export interface ExtractedMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
  type?: string;
  price?: number;
  currency?: string;
  authorOrCreator?: string;
  structuredType?: "BOOK" | "MEDIA" | "PRODUCT" | "CULINARY" | "PLACE" | "ARTICLE" | "UNKNOWN";
  typePath?: string;
  jsonLd?: any;
}

/**
 * Pure function parsing HTML string for OpenGraph, Twitter Cards, and JSON-LD
 */
export function parseHtmlMetadata(html: string, baseUrl?: string): ExtractedMetadata {
  const result: ExtractedMetadata = {};

  // 1. Helper to extract meta tag content
  const extractMeta = (propertyOrName: string): string | undefined => {
    // Matches property="..." content="..." OR name="..." content="..."
    const regex1 = new RegExp(
      `<meta[^>]*(?:property|name)=["']${propertyOrName}["'][^>]*content=["']([^"']*)["']`,
      "i"
    );
    const match1 = html.match(regex1);
    if (match1?.[1]) return decodeHtmlEntities(match1[1].trim());

    // Matches content="..." property="..." OR content="..." name="..."
    const regex2 = new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${propertyOrName}["']`,
      "i"
    );
    const match2 = html.match(regex2);
    if (match2?.[1]) return decodeHtmlEntities(match2[1].trim());

    return undefined;
  };

  // 2. Extract standard HTML title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const htmlTitle = titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1].trim()) : undefined;

  // 3. Extract OpenGraph & Twitter tags
  const ogTitle = extractMeta("og:title");
  const twitterTitle = extractMeta("twitter:title");
  result.title = ogTitle || twitterTitle || htmlTitle;

  const ogDesc = extractMeta("og:description");
  const twitterDesc = extractMeta("twitter:description");
  const metaDesc = extractMeta("description");
  result.description = ogDesc || twitterDesc || metaDesc;

  const ogImage = extractMeta("og:image") || extractMeta("og:image:secure_url");
  const twitterImage = extractMeta("twitter:image");
  result.image = resolveUrl(ogImage || twitterImage, baseUrl);

  result.siteName = extractMeta("og:site_name");
  result.type = extractMeta("og:type");
  result.url = extractMeta("og:url") || baseUrl;

  // 4. Extract and parse JSON-LD scripts (<script type="application/ld+json">)
  const jsonLdScripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const scriptMatch of jsonLdScripts) {
    try {
      const rawText = scriptMatch[1].trim();
      const parsed = JSON.parse(rawText);
      const objects = Array.isArray(parsed)
        ? parsed
        : parsed["@graph"] && Array.isArray(parsed["@graph"])
        ? parsed["@graph"]
        : [parsed];

      for (const obj of objects) {
        if (!obj || typeof obj !== "object") continue;
        const schemaType = String(obj["@type"] || "").toLowerCase();

        result.jsonLd = obj;

        if (schemaType.includes("book")) {
          result.structuredType = "BOOK";
          result.typePath = "/product/book";
          if (obj.name && !result.title) result.title = obj.name;
          if (obj.author) {
            result.authorOrCreator = extractEntityName(obj.author);
          }
          if (obj.image && !result.image) {
            result.image = resolveUrl(extractEntityImage(obj.image), baseUrl);
          }
          break;
        } else if (schemaType.includes("movie") || schemaType.includes("film")) {
          result.structuredType = "MEDIA";
          result.typePath = "/media/film";
          if (obj.name && !result.title) result.title = obj.name;
          if (obj.director) {
            result.authorOrCreator = extractEntityName(obj.director);
          }
          if (obj.image && !result.image) {
            result.image = resolveUrl(extractEntityImage(obj.image), baseUrl);
          }
          break;
        } else if (schemaType.includes("recipe")) {
          result.structuredType = "CULINARY";
          result.typePath = "/culinary/recipe";
          if (obj.name && !result.title) result.title = obj.name;
          if (obj.image && !result.image) {
            result.image = resolveUrl(extractEntityImage(obj.image), baseUrl);
          }
          break;
        } else if (schemaType.includes("musicalbum") || schemaType.includes("musicrecording")) {
          result.structuredType = "MEDIA";
          result.typePath = "/media/music/vinyl";
          if (obj.byArtist) {
            result.authorOrCreator = extractEntityName(obj.byArtist);
          }
          break;
        } else if (schemaType.includes("product")) {
          result.structuredType = "PRODUCT";
          result.typePath = "/product/generic";
          if (obj.name && !result.title) result.title = obj.name;
          if (obj.brand) {
            result.authorOrCreator = extractEntityName(obj.brand);
          }
          if (obj.offers) {
            const offer = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
            if (offer && offer.price) {
              const numericPrice = parseFloat(String(offer.price).replace(/[^0-9.]/g, ""));
              if (!isNaN(numericPrice)) {
                result.price = Math.round(numericPrice * 100);
              }
              if (offer.priceCurrency) {
                result.currency = offer.priceCurrency;
              }
            }
          }
          break;
        }
      }
    } catch {
      // Ignore malformed JSON-LD scripts
    }
  }

  // 5. Fallback type inference from og:type
  if (!result.structuredType && result.type) {
    const t = result.type.toLowerCase();
    if (t.includes("book")) {
      result.structuredType = "BOOK";
      result.typePath = "/product/book";
    } else if (t.includes("video") || t.includes("movie")) {
      result.structuredType = "MEDIA";
      result.typePath = "/media/film";
    } else if (t.includes("music")) {
      result.structuredType = "MEDIA";
      result.typePath = "/media/music/vinyl";
    } else if (t.includes("article")) {
      result.structuredType = "ARTICLE";
      result.typePath = "/article/editorial";
    }
  }

  return result;
}

export const extractOpenGraph = fetchAndExtractMetadata;

/**
 * Fetches target URL and extracts rich metadata
 */
export async function fetchAndExtractMetadata(
  url: string,
  options?: { fetchFn?: typeof fetch; timeoutMs?: number; dnsLookup?: any }
): Promise<ExtractedMetadata> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 7000;

  try {
    const response = await safeFetch(url, {
      fetchFn,
      timeoutMs,
      dnsLookup: options?.dnsLookup,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return { url };
    }

    const html = await response.text();
    return parseHtmlMetadata(html, url);
  } catch (error) {
    return { url };
  }
}

function extractEntityName(entity: any): string | undefined {
  if (typeof entity === "string") return entity;
  if (Array.isArray(entity)) return extractEntityName(entity[0]);
  if (entity && typeof entity === "object") return entity.name || entity.legalName;
  return undefined;
}

function extractEntityImage(image: any): string | undefined {
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return extractEntityImage(image[0]);
  if (image && typeof image === "object") return image.url || image.contentUrl;
  return undefined;
}

function resolveUrl(relativeOrAbsolute?: string, baseUrl?: string): string | undefined {
  if (!relativeOrAbsolute) return undefined;
  if (!baseUrl || relativeOrAbsolute.startsWith("http://") || relativeOrAbsolute.startsWith("https://")) {
    return relativeOrAbsolute;
  }
  try {
    return new URL(relativeOrAbsolute, baseUrl).toString();
  } catch {
    return relativeOrAbsolute;
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

export async function extractOpenGraphHead(url: string): Promise<{ title?: string; imageUrl?: string; priceCents?: number }> {
  try {
    const meta = await fetchAndExtractMetadata(url);
    return {
      title: meta.title,
      imageUrl: meta.image,
      priceCents: meta.price ? Math.round(meta.price * 100) : undefined,
    };
  } catch {
    return {};
  }
}
