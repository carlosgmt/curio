/**
 * Dynamic Type Ontology & Vector Classification Service (PRD v3.2 §4.3)
 *
 * Implements polymorphic entity classification:
 * - Similarity > 0.92: Cross-lingual synonym convergence (appends alias)
 * - Similarity 0.75–0.92: Subtype inheritance (inherits parent archetype & silhouette)
 * - Similarity < 0.75: Fallback to canonical root archetype
 */

import { db, curioTypes } from "@/db";
import { eq, or, isNull } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "@/lib/search/vector";

export interface EntityTypeClassification {
  typeId?: string;
  typePath: string;
  name: string;
  rootArchetype: string;
  defaultSilhouette: string;
  similarity: number;
  isSynonymConvergence: boolean;
  isSubtypeInherited: boolean;
  effectiveJsonSchema: Record<string, unknown>;
  uiFieldConfig: Array<{ key: string; label: string; primitive: string; isPublicObjective: boolean }>;
}

interface CachedTypeEntry {
  id: string;
  name: string;
  typePath: string;
  rootArchetype: string;
  defaultSilhouette: string;
  typeEmbedding: number[] | null;
  nameEmbedding: number[];
  aliasEmbeddings: Map<string, number[]>;
  localizedAliases: Record<string, string>;
  effectiveJsonSchema: Record<string, unknown>;
  uiFieldConfig: Array<{ key: string; label: string; primitive: string; isPublicObjective: boolean }>;
}

let cachedTypes: CachedTypeEntry[] | null = null;
let lastCacheRefresh = 0;
const CACHE_TTL_MS = 60000; // 1 minute

export function invalidateTypeCache(): void {
  cachedTypes = null;
  lastCacheRefresh = 0;
}

/**
 * Ensures all types in the database have their vector embeddings computed and cached.
 */
export async function seedArchetypeEmbeddings(): Promise<void> {
  const types = await db.select().from(curioTypes);
  for (const t of types) {
    if (!t.typeEmbedding || (Array.isArray(t.typeEmbedding) && t.typeEmbedding.length === 0)) {
      const aliasText = t.localizedAliases
        ? Object.values(t.localizedAliases as Record<string, string>).join(" ")
        : "";
      const textToEmbed = `${t.name} ${t.typePath} ${t.rootArchetype} ${t.extractionPrompt ?? ""} ${aliasText}`.trim();
      const embedding = await generateEmbedding(textToEmbed);
      await db
        .update(curioTypes)
        .set({
          typeEmbedding: embedding,
        })
        .where(eq(curioTypes.id, t.id));
    }
  }
  // Invalidate cache
  invalidateTypeCache();
}

/**
 * Loads and caches types from database with their individual name/alias embeddings.
 */
async function getCachedTypes(userId?: string): Promise<CachedTypeEntry[]> {
  const now = Date.now();
  if (cachedTypes && now - lastCacheRefresh < CACHE_TTL_MS && !userId) {
    return cachedTypes;
  }

  const query = userId
    ? db
        .select()
        .from(curioTypes)
        .where(or(isNull(curioTypes.userId), eq(curioTypes.userId, userId)))
    : db.select().from(curioTypes);

  const dbRows = await query;
  const entries: CachedTypeEntry[] = [];

  for (const row of dbRows) {
    let typeEmbedding: number[] | null = null;
    if (Array.isArray(row.typeEmbedding) && row.typeEmbedding.length > 0) {
      typeEmbedding = row.typeEmbedding;
    } else if (typeof row.typeEmbedding === "string") {
      try {
        typeEmbedding = JSON.parse(row.typeEmbedding);
      } catch {
        typeEmbedding = null;
      }
    }

    if (!typeEmbedding) {
      const aliasText = row.localizedAliases
        ? Object.values(row.localizedAliases as Record<string, string>).join(" ")
        : "";
      const textToEmbed = `${row.name} ${row.typePath} ${row.rootArchetype} ${row.extractionPrompt ?? ""} ${aliasText}`.trim();
      typeEmbedding = await generateEmbedding(textToEmbed);
      // Asynchronously store back to DB
      db.update(curioTypes)
        .set({ typeEmbedding })
        .where(eq(curioTypes.id, row.id))
        .catch(() => {});
    }

    const nameEmbedding = await generateEmbedding(row.name);
    const aliasEmbeddings = new Map<string, number[]>();

    const aliases = (row.localizedAliases as Record<string, string>) || {};
    for (const [key, alias] of Object.entries(aliases)) {
      if (typeof alias === "string" && alias.trim()) {
        const aEmbed = await generateEmbedding(alias.trim());
        aliasEmbeddings.set(key, aEmbed);
      }
    }

    entries.push({
      id: row.id,
      name: row.name,
      typePath: row.typePath,
      rootArchetype: row.rootArchetype,
      defaultSilhouette: row.defaultSilhouette,
      typeEmbedding,
      nameEmbedding,
      aliasEmbeddings,
      localizedAliases: aliases,
      effectiveJsonSchema: (row.effectiveJsonSchema as Record<string, unknown>) || (row.jsonSchema as Record<string, unknown>) || {},
      uiFieldConfig: (row.uiFieldConfig as any) || [],
    });
  }

  if (!userId) {
    cachedTypes = entries;
    lastCacheRefresh = now;
  }

  return entries;
}

export interface ClassificationEnrichmentContext {
  typePath?: string | null;
  title?: string | null;
  summary?: string | null;
  brandOrCreator?: string | null;
  category?: string | null;
}

/**
 * Classifies input text into a Curio Type using vector similarity, synonym convergence,
 * subtype inheritance, and enriched entity context matching for custom types.
 */
export async function classifyEntityType(
  queryOrText: string,
  userId?: string,
  enrichmentContext?: ClassificationEnrichmentContext
): Promise<EntityTypeClassification> {
  const trimmed = queryOrText.trim();
  if (!trimmed) {
    return {
      typePath: "/product/generic",
      name: "Generic Product",
      rootArchetype: "PRODUCT",
      defaultSilhouette: "generic",
      similarity: 0.0,
      isSynonymConvergence: false,
      isSubtypeInherited: false,
      effectiveJsonSchema: { type: "object", properties: {} },
      uiFieldConfig: [],
    };
  }

  const types = await getCachedTypes(userId);
  const normalizedQuery = trimmed.toLowerCase();

  // 0. If enrichment already resolved a specific subtype path (e.g. /product/watch or /media/music/album)
  // and a custom or canonical type exists at that exact typePath, bind directly to it!
  if (
    enrichmentContext?.typePath &&
    enrichmentContext.typePath !== "/product/generic" &&
    enrichmentContext.typePath !== "/product"
  ) {
    const exactPathMatch = types.find(
      (t) => t.typePath.toLowerCase() === enrichmentContext.typePath!.toLowerCase()
    );
    if (exactPathMatch) {
      return {
        typeId: exactPathMatch.id,
        typePath: exactPathMatch.typePath,
        name: exactPathMatch.name,
        rootArchetype: exactPathMatch.rootArchetype,
        defaultSilhouette: exactPathMatch.defaultSilhouette,
        similarity: 0.96,
        isSynonymConvergence: false,
        isSubtypeInherited: true,
        effectiveJsonSchema: exactPathMatch.effectiveJsonSchema,
        uiFieldConfig: exactPathMatch.uiFieldConfig,
      };
    }
  }

  const queryEmbedding = await generateEmbedding(trimmed);
  const contextString = [
    trimmed,
    enrichmentContext?.title,
    enrichmentContext?.summary,
    enrichmentContext?.brandOrCreator,
    enrichmentContext?.category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const contextTokens = contextString
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  let bestEntry: CachedTypeEntry | null = null;
  let bestSimilarity = -1;
  let matchedAliasKey: string | null = null;

  for (const entry of types) {
    // 1. Direct string match against name or any alias
    if (entry.name.toLowerCase() === normalizedQuery) {
      bestSimilarity = 1.0;
      bestEntry = entry;
      break;
    }

    for (const [aliasKey, aliasVal] of Object.entries(entry.localizedAliases)) {
      if (aliasVal.toLowerCase() === normalizedQuery) {
        bestSimilarity = 1.0;
        bestEntry = entry;
        matchedAliasKey = aliasKey;
        break;
      }
    }
    if (bestSimilarity === 1.0) break;

    // 2. Similarity against primary typeEmbedding
    let maxSim = entry.typeEmbedding ? cosineSimilarity(queryEmbedding, entry.typeEmbedding) : 0;

    // 3. Similarity against name
    const nameSim = cosineSimilarity(queryEmbedding, entry.nameEmbedding);
    if (nameSim > maxSim) maxSim = nameSim;

    // 4. Similarity against individual aliases
    for (const [aliasKey, aEmbed] of entry.aliasEmbeddings) {
      const aSim = cosineSimilarity(queryEmbedding, aEmbed);
      if (aSim > maxSim) {
        maxSim = aSim;
        matchedAliasKey = aliasKey;
      }
    }

    // 5. Lexical / Subtype boost for partial / word overlaps in query or enriched context
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const nameTokens = entry.name.toLowerCase().split(/\s+/).filter(Boolean);
    const pathTokens = entry.typePath.toLowerCase().split(/[\/_-]+/).filter(Boolean);

    const hasQueryCommonToken = queryTokens.some(
      (qt) => nameTokens.includes(qt) || pathTokens.includes(qt)
    );

    if (hasQueryCommonToken && maxSim < 0.85) {
      maxSim = Math.max(maxSim, 0.85);
    } else if (enrichmentContext && pathTokens.length >= 2) {
      // Check if specific subtype leaf token (e.g. "watch" in "/product/watch") appears in enriched summary/category
      const leafToken = pathTokens[pathTokens.length - 1];
      const matchesLeaf =
        leafToken &&
        leafToken !== "product" &&
        leafToken !== "media" &&
        (contextTokens.includes(leafToken) ||
          contextTokens.includes(`${leafToken}es`) ||
          contextTokens.includes(`${leafToken}s`) ||
          (leafToken === "watch" &&
            contextTokens.some((ct) =>
              ["watch", "watches", "wristwatch", "timepiece", "horological", "watchmaker", "chronograph"].includes(ct)
            )));
      if (matchesLeaf && maxSim < 0.89) {
        maxSim = Math.max(maxSim, 0.89);
      }
    }

    if (
      maxSim > bestSimilarity ||
      (Math.abs(maxSim - bestSimilarity) < 0.02 &&
        bestEntry &&
        entry.typePath.split("/").length > bestEntry.typePath.split("/").length)
    ) {
      bestSimilarity = maxSim;
      bestEntry = entry;
    }
  }

  // Fallback if no type or similarity is too low (< 0.75)
  if (!bestEntry || bestSimilarity < 0.75) {
    return {
      typePath: "/product/generic",
      name: "Generic Product",
      rootArchetype: "PRODUCT",
      defaultSilhouette: "generic",
      similarity: Math.max(0, bestSimilarity),
      isSynonymConvergence: false,
      isSubtypeInherited: false,
      effectiveJsonSchema: { type: "object", properties: {} },
      uiFieldConfig: [],
    };
  }

  // Similarity > 0.92: Cross-lingual synonym convergence
  if (bestSimilarity > 0.92) {
    // If input query is a new synonym not yet saved in localizedAliases, append it
    const existingAliasValues = Object.values(bestEntry.localizedAliases).map((v) => v.toLowerCase());
    if (
      !existingAliasValues.includes(normalizedQuery) &&
      bestEntry.name.toLowerCase() !== normalizedQuery
    ) {
      const aliasSlug = normalizedQuery.replace(/[^a-z0-9]+/g, "_").slice(0, 32);
      const updatedAliases = {
        ...bestEntry.localizedAliases,
        [aliasSlug]: trimmed,
      };
      bestEntry.localizedAliases = updatedAliases;
      db.update(curioTypes)
        .set({ localizedAliases: updatedAliases })
        .where(eq(curioTypes.id, bestEntry.id))
        .catch(() => {});
    }

    return {
      typeId: bestEntry.id,
      typePath: bestEntry.typePath,
      name: bestEntry.name,
      rootArchetype: bestEntry.rootArchetype,
      defaultSilhouette: bestEntry.defaultSilhouette,
      similarity: bestSimilarity,
      isSynonymConvergence: true,
      isSubtypeInherited: false,
      effectiveJsonSchema: bestEntry.effectiveJsonSchema,
      uiFieldConfig: bestEntry.uiFieldConfig,
    };
  }

  // Similarity 0.75–0.92: Subtype inheritance
  return {
    typeId: bestEntry.id,
    typePath: bestEntry.typePath,
    name: bestEntry.name,
    rootArchetype: bestEntry.rootArchetype,
    defaultSilhouette: bestEntry.defaultSilhouette,
    similarity: bestSimilarity,
    isSynonymConvergence: false,
    isSubtypeInherited: true,
    effectiveJsonSchema: bestEntry.effectiveJsonSchema,
    uiFieldConfig: bestEntry.uiFieldConfig,
  };
}
