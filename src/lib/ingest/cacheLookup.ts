import { db, globalEntities, entitySources, type GlobalEntity } from "@/db";
import { eq, or } from "drizzle-orm";
import { computeUrlHash } from "./resolution";
import { normalizeEntityString, mapDescriptionToOntology, type CandidateFallback } from "../enrichment/universalDiscovery";

export const KNOWN_COLORWAYS = new Set([
  "mint",
  "sage",
  "ecru",
  "cream",
  "ivory",
  "navy",
  "olive",
  "burgundy",
  "maroon",
  "camel",
  "tan",
  "khaki",
  "sand",
  "taupe",
  "beige",
  "charcoal",
  "slate",
  "anthracite",
  "black",
  "noir",
  "white",
  "blanc",
  "grey",
  "gray",
  "heather",
  "silver",
  "gold",
  "rose",
  "blush",
  "pink",
  "coral",
  "terracotta",
  "rust",
  "orange",
  "amber",
  "yellow",
  "mustard",
  "ochre",
  "emerald",
  "forest",
  "green",
  "teal",
  "cyan",
  "cobalt",
  "indigo",
  "blue",
  "sky",
  "lavender",
  "lilac",
  "purple",
  "plum",
  "brown",
  "espresso",
  "chocolate",
]);

/**
 * Normalizes Roman numerals (II -> 2, III -> 3, IV -> 4, V -> 5) and strips punctuation
 * for canonical title matching across variants like "Explorer II" vs "Explorer 2".
 */
export function normalizeForCacheComparison(text: string): string {
  const base = normalizeEntityString(text);
  return base
    .replace(/\bii\b/g, "2")
    .replace(/\biii\b/g, "3")
    .replace(/\biv\b/g, "4")
    .replace(/\bvi\b/g, "6")
    .replace(/\bvii\b/g, "7")
    .replace(/\bviii\b/g, "8")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strips trailing generic media/category hint words (e.g. "Blade Runner movie" -> "Blade Runner")
 */
export function stripIntentSuffix(query: string): {
  cleanQuery: string;
  inferredTypeHint: string | null;
} {
  const trimmed = query.trim();
  let inferredTypeHint: string | null;
  inferredTypeHint = null;

  if (/\b(?:movie|film|cinema)\b/i.test(trimmed)) {
    inferredTypeHint = "/media/film";
  } else if (/\b(?:book|novel|memoir)\b/i.test(trimmed)) {
    inferredTypeHint = "/product/book";
  } else if (/\b(?:vinyl|album|song|lp)\b/i.test(trimmed)) {
    inferredTypeHint = "/media/music/vinyl";
  }

  const cleanQuery = trimmed
    .replace(/\b(?:movie|film|cinema|book|novel|memoir|vinyl|album|song)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    cleanQuery: cleanQuery || trimmed,
    inferredTypeHint,
  };
}

export interface ExtractedDistinguishers {
  referenceCodes: string[];
  colorways: string[];
  skuToken: string | null;
}

/**
 * Extracts distinguishing model/reference codes (e.g. "226570", "16570", "WH-1000XM5")
 * and colorways (e.g. "mint", "navy") from a query or entity record.
 */
export function extractDistinguishers(
  text: string,
  structuredData?: Record<string, any> | null,
  extendedData?: Record<string, any> | null
): ExtractedDistinguishers {
  const referenceCodes = new Set<string>();
  const colorways = new Set<string>();
  let skuToken: string | null = null;

  const tokens = text
    .trim()
    .replace(/[(),]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const rawToken of tokens) {
    const clean = rawToken.replace(/^ref\.?/i, "").trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();

    // Check colorway
    if (KNOWN_COLORWAYS.has(lower)) {
      colorways.add(lower);
      continue;
    }

    // Check reference/model code:
    // 1) Pure numeric code of 4+ digits that is NOT a standard calendar year (1900-2029)
    if (/^\d{4,10}$/.test(clean)) {
      const num = parseInt(clean, 10);
      if (clean.length >= 5 || num < 1900 || num > 2029) {
        referenceCodes.add(lower);
      }
      continue;
    }

    // 2) Alphanumeric model/reference token containing both letters and digits (e.g. WH-1000XM5, 126710BLRO, A7RV, Q3, M4)
    if (
      /^[a-z0-9][a-z0-9\-_.]{1,18}$/i.test(clean) &&
      /[a-z]/i.test(clean) &&
      /\d/.test(clean) &&
      !/^(?:mp3|mp4|4k|3d|2d|1st|2nd|3rd|\d+th|\d+ml|\d+oz|\d+g|\d+kg|\d+cm|\d+mm)$/i.test(clean)
    ) {
      referenceCodes.add(lower);
    }
  }

  if (structuredData) {
    if (typeof structuredData.referenceCode === "string" && structuredData.referenceCode.trim()) {
      referenceCodes.add(structuredData.referenceCode.trim().toLowerCase());
    }
    if (typeof structuredData.sku === "string" && structuredData.sku.trim()) {
      const s = structuredData.sku.trim().toLowerCase();
      skuToken = s;
      if (/\d/.test(s)) {
        referenceCodes.add(s);
      }
    }
    if (typeof structuredData.color === "string" && structuredData.color.trim()) {
      const c = structuredData.color.trim().toLowerCase();
      if (KNOWN_COLORWAYS.has(c)) {
        colorways.add(c);
      }
    }
  }

  if (extendedData) {
    if (typeof extendedData.referenceCode === "string" && extendedData.referenceCode.trim()) {
      referenceCodes.add(extendedData.referenceCode.trim().toLowerCase());
    }
    if (typeof extendedData.sku === "string" && extendedData.sku.trim()) {
      const s = extendedData.sku.trim().toLowerCase();
      if (!skuToken) skuToken = s;
      if (/\d/.test(s)) {
        referenceCodes.add(s);
      }
    }
    if (typeof extendedData.color === "string" && extendedData.color.trim()) {
      const c = extendedData.color.trim().toLowerCase();
      if (KNOWN_COLORWAYS.has(c)) {
        colorways.add(c);
      }
    }
  }

  return {
    referenceCodes: Array.from(referenceCodes),
    colorways: Array.from(colorways),
    skuToken,
  };
}

/**
 * Verifies that a cached GlobalEntity does not conflict with specific reference numbers,
 * SKUs, or colorways present in the incoming query.
 */
export function passesDistinguisherGuard(query: string, entity: GlobalEntity): boolean {
  const coreData = (entity.coreStructuredData as Record<string, any>) || {};
  const extData = (entity.extendedAttributes as Record<string, any>) || {};

  const queryDist = extractDistinguishers(query);
  const entityText = [
    entity.title,
    coreData.rawQuery || "",
    ...(Array.isArray(coreData.aliases) ? coreData.aliases : []),
  ].join(" ");
  const entityDist = extractDistinguishers(entityText, coreData, extData);

  if (queryDist.referenceCodes.length > 0) {
    for (const qRef of queryDist.referenceCodes) {
      const hasRef =
        entityDist.referenceCodes.includes(qRef) ||
        entityText.toLowerCase().includes(qRef);
      if (!hasRef) {
        return false;
      }
    }
  }

  if (entityDist.referenceCodes.length > 0 && queryDist.referenceCodes.length > 0) {
    for (const eRef of entityDist.referenceCodes) {
      if (!queryDist.referenceCodes.includes(eRef)) {
        return false;
      }
    }
  }

  const isProductArchetype =
    entity.coreType === "PRODUCT" ||
    (entity.typePath || "").startsWith("/product");

  if (isProductArchetype && queryDist.colorways.length > 0) {
    for (const qColor of queryDist.colorways) {
      const hasColor =
        entityDist.colorways.includes(qColor) ||
        entityText.toLowerCase().includes(qColor);
      if (!hasColor) {
        return false;
      }
    }
  }

  if (isProductArchetype && entityDist.skuToken) {
    const normQueryTokens = normalizeEntityString(query).split(/\s+/);
    const lastToken = normQueryTokens[normQueryTokens.length - 1];
    if (
      entityDist.skuToken !== lastToken &&
      !normQueryTokens.includes(entityDist.skuToken)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Detects whether a cached GlobalEntity is an unenriched search-engine fallback stub
 * (e.g. saved with a DuckDuckGo or Letterboxd search URL and no poster/creator).
 */
export function isUnenrichedStubEntity(entity: GlobalEntity): boolean {
  const url = (entity.canonicalUrl || "").toLowerCase();
  if (url.includes("duckduckgo.com")) {
    return true;
  }
  if (
    !entity.heroImageUrl &&
    (url.includes("letterboxd.com/search") ||
      url.includes("openlibrary.org/search") ||
      url.includes("discogs.com/search"))
  ) {
    return true;
  }
  return false;
}

/**
 * Converts a cached GlobalEntity into a CandidateFallback for the disambiguation bar
 */
function entityToFallback(entity: GlobalEntity): CandidateFallback {
  const ontology = mapDescriptionToOntology(entity.summary || "", entity.title);
  return {
    title: entity.title,
    url: entity.canonicalUrl,
    snippet: entity.summary || `Cached ${entity.coreType} in Curio`,
    coreType: entity.coreType,
    typePath: entity.typePath || ontology.typePath,
    badgeLabel: ontology.badgeLabel,
  };
}

/**
 * Appends a newly discovered query alias (e.g. "Mi vida sin mi") into an existing
 * GlobalEntity's coreStructuredData.aliases array so future captures hit Layer 0 in <2ms.
 */
export async function recordAliasOnEntity(entity: GlobalEntity, rawAlias: string): Promise<void> {
  const trimmed = rawAlias.trim();
  if (!trimmed) return;

  const coreData = (entity.coreStructuredData as Record<string, any>) || {};
  const existingAliases: string[] = Array.isArray(coreData.aliases) ? coreData.aliases : [];
  const normNew = normalizeForCacheComparison(trimmed);

  if (
    normalizeForCacheComparison(entity.title) === normNew ||
    (coreData.rawQuery && normalizeForCacheComparison(String(coreData.rawQuery)) === normNew) ||
    existingAliases.some((a) => normalizeForCacheComparison(String(a)) === normNew)
  ) {
    return;
  }

  const updatedCoreData = {
    ...coreData,
    aliases: [...existingAliases, trimmed],
  };

  await db
    .update(globalEntities)
    .set({ coreStructuredData: updatedCoreData })
    .where(eq(globalEntities.id, entity.id));

  entity.coreStructuredData = updatedCoreData;
}

/**
 * LAYER 0: Pre-Network Local Global Cache Lookup (<2ms, $0.00, 0 network calls)
 */
export async function lookupLocalEntityCache(
  query: string,
  options?: {
    forcedTypePath?: string;
    detectedType?: string;
    targetCandidate?: {
      title?: string;
      subtitle?: string;
      creator?: string | null;
      year?: number | null;
      canonicalUrl?: string | null;
      typePath?: string | null;
    };
  }
): Promise<{ primary: GlobalEntity | null; siblings: CandidateFallback[] }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { primary: null, siblings: [] };
  }

  const isUrl = /^https?:\/\//i.test(trimmed);

  // 1. Direct URL / URL Hash Lookup
  if (isUrl) {
    const urlHash = computeUrlHash(trimmed);
    const [directEntity] = await db
      .select()
      .from(globalEntities)
      .where(or(eq(globalEntities.urlHash, urlHash), eq(globalEntities.canonicalUrl, trimmed)))
      .limit(1);

    if (directEntity && !isUnenrichedStubEntity(directEntity)) {
      return { primary: directEntity, siblings: [] };
    }

    const [sourceHit] = await db
      .select()
      .from(entitySources)
      .where(eq(entitySources.urlHash, urlHash))
      .limit(1);

    if (sourceHit) {
      const [linkedEntity] = await db
        .select()
        .from(globalEntities)
        .where(eq(globalEntities.id, sourceHit.entityId))
        .limit(1);

      if (linkedEntity && !isUnenrichedStubEntity(linkedEntity)) {
        return { primary: linkedEntity, siblings: [] };
      }
    }

    return { primary: null, siblings: [] };
  }

  // 2. Text / Title / Alias / Fingerprint Lookup across local global_entities
  const normQuery = normalizeForCacheComparison(trimmed);
  const { cleanQuery, inferredTypeHint } = stripIntentSuffix(trimmed);
  const normCleanQuery = normalizeForCacheComparison(cleanQuery);
  const preferredTypePath =
    options?.forcedTypePath || options?.targetCandidate?.typePath || inferredTypeHint || null;

  const allEntities = await db.select().from(globalEntities);
  if (allEntities.length === 0) {
    return { primary: null, siblings: [] };
  }

  const matchedCandidates: Array<{ entity: GlobalEntity; score: number }> = [];

  for (const entity of allEntities) {
    const normTitle = normalizeForCacheComparison(entity.title);
    const coreData = (entity.coreStructuredData as Record<string, any>) || {};
    const rawQuery = typeof coreData.rawQuery === "string" ? coreData.rawQuery : "";
    const normRawQuery = rawQuery ? normalizeForCacheComparison(rawQuery) : "";
    const aliases: string[] = Array.isArray(coreData.aliases) ? coreData.aliases : [];

    let score = 0;

    if (normTitle === normQuery) {
      score = 100;
    } else if (normCleanQuery && normTitle === normCleanQuery) {
      score = 95;
    } else if (normRawQuery && (normRawQuery === normQuery || normRawQuery === normCleanQuery)) {
      score = 98;
    } else if (
      aliases.some((a) => {
        const na = normalizeForCacheComparison(String(a));
        return na === normQuery || (normCleanQuery && na === normCleanQuery);
      })
    ) {
      score = 96;
    } else {
      const creator = entity.brandOrCreator ? normalizeForCacheComparison(entity.brandOrCreator) : "";
      const year = coreData.releaseYear || coreData.publicationYear || coreData.year || "";
      if (creator && normCleanQuery === `${normTitle} by ${creator}`) {
        score = 95;
      } else if (creator && normCleanQuery === `${normTitle} ${creator}`) {
        score = 94;
      } else if (year && normCleanQuery === `${normTitle} ${year}`) {
        score = 95;
      }
    }

    if (score > 0) {
      if (!passesDistinguisherGuard(trimmed, entity)) {
        continue;
      }

      // If an explicit targetCandidate was selected from Omnibox, verify creator/URL alignment
      if (options?.targetCandidate) {
        const tc = options.targetCandidate;
        const candCreator = tc.creator || (tc.subtitle ? tc.subtitle.split("•")[0]?.trim() : "");
        if (
          candCreator &&
          entity.brandOrCreator &&
          ! /^In your saves/i.test(candCreator)
        ) {
          const normCandCreator = normalizeEntityString(candCreator);
          const normEntCreator = normalizeEntityString(entity.brandOrCreator);
          if (
            normCandCreator &&
            normEntCreator &&
            !normEntCreator.includes(normCandCreator) &&
            !normCandCreator.includes(normEntCreator)
          ) {
            continue;
          }
        }
      }

      if (preferredTypePath && entity.typePath === preferredTypePath) {
        score += 20;
      } else if (preferredTypePath && entity.typePath && entity.typePath !== preferredTypePath) {
        score -= 40;
      }

      matchedCandidates.push({ entity, score });
    }
  }

  matchedCandidates.sort((a, b) => b.score - a.score);

  if (matchedCandidates.length > 0 && matchedCandidates[0].score >= 85) {
    const primary = matchedCandidates[0].entity;
    const siblings = matchedCandidates
      .slice(1)
      .filter((c) => c.entity.id !== primary.id)
      .map((c) => entityToFallback(c.entity));

    const primaryCore = (primary.coreStructuredData as Record<string, any>) || {};
    const storedFallbacks = Array.isArray(primaryCore.runnerUpCandidates)
      ? (primaryCore.runnerUpCandidates as CandidateFallback[])
      : [];

    return {
      primary,
      siblings: siblings.length > 0 ? siblings : storedFallbacks,
    };
  }

  return { primary: null, siblings: [] };
}

/**
 * LAYER 1.5: Post-Discovery Canonical Identity Cache Lookup (<1ms, $0.00)
 */
export async function lookupByCanonicalIdentity(params: {
  canonicalExternalId?: string | null;
  wikidataUri?: string | null;
  identityFingerprint?: string | null;
  canonicalUrl?: string | null;
  queryToRegisterAsAlias?: string;
  distinguisherQuery?: string;
}): Promise<GlobalEntity | null> {
  const {
    canonicalExternalId,
    wikidataUri,
    identityFingerprint,
    canonicalUrl,
    queryToRegisterAsAlias,
    distinguisherQuery,
  } = params;

  const allEntities = await db.select().from(globalEntities);
  if (allEntities.length === 0) return null;

  const extractQid = (val?: string | null): string | null => {
    if (!val) return null;
    const m = val.match(/\b(Q\d+)\b/i);
    return m ? m[1].toUpperCase() : null;
  };

  const targetQid = extractQid(canonicalExternalId) || extractQid(wikidataUri);
  const targetUrlHash = canonicalUrl ? computeUrlHash(canonicalUrl) : null;

  for (const entity of allEntities) {
    const coreData = (entity.coreStructuredData as Record<string, any>) || {};
    let matched = false;

    if (canonicalExternalId && entity.canonicalExternalId === canonicalExternalId) {
      matched = true;
    }

    if (!matched && targetQid) {
      const entityQid =
        extractQid(entity.canonicalExternalId) ||
        extractQid(coreData.wikidataUri) ||
        extractQid(entity.canonicalUrl);
      if (entityQid && entityQid === targetQid) {
        matched = true;
      }
    }

    if (!matched && identityFingerprint && entity.identityFingerprint === identityFingerprint) {
      matched = true;
    }

    if (
      !matched &&
      canonicalUrl &&
      !canonicalUrl.includes("duckduckgo.com") &&
      (entity.canonicalUrl === canonicalUrl || (targetUrlHash && entity.urlHash === targetUrlHash))
    ) {
      matched = true;
    }

    if (matched) {
      if (distinguisherQuery && !passesDistinguisherGuard(distinguisherQuery, entity)) {
        continue;
      }

      if (queryToRegisterAsAlias) {
        await recordAliasOnEntity(entity, queryToRegisterAsAlias);
      }

      return entity;
    }
  }

  return null;
}
