import { db, globalEntities, entitySources, type GlobalEntity } from "@/db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import { cosineSimilarity, generateDeterministicEmbedding } from "@/lib/search/vector";

export interface CanonicalResolutionInput {
  url?: string;
  externalId?: string; // e.g. isbn:978..., tmdb:..., ean:...
  title: string;
  brandOrCreator?: string;
  typePath?: string;
  structuredAttributes?: Record<string, unknown>;
  sellerName?: string;
  priceCents?: number;
  currency?: string;
}

export interface CanonicalResolutionResult {
  entity: GlobalEntity;
  resolvedStage: 1 | 2 | 3 | 4 | "NEW";
  sourceAdded: boolean;
}

export function computeUrlHash(url: string): string {
  const normalized = url.toLowerCase().trim().replace(/\/+$/, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export function computeIdentityFingerprint(
  typePath: string,
  title: string,
  brandOrCreator?: string,
  attributes?: Record<string, unknown>
): string {
  const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normBrand = (brandOrCreator || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const vintage = attributes?.vintage ? String(attributes.vintage) : "";
  const base = `${typePath}|${normBrand}|${normTitle}|${vintage}`;
  return createHash("sha256").update(base).digest("hex");
}

/**
 * 4-Stage URL-Agnostic Canonical Entity Resolution
 */
export async function resolveOrCreateCanonicalEntity(
  input: CanonicalResolutionInput
): Promise<CanonicalResolutionResult> {
  const typePath = input.typePath || "/product/generic";
  const urlHash = input.url ? computeUrlHash(input.url) : null;
  const fingerprint = computeIdentityFingerprint(
    typePath,
    input.title,
    input.brandOrCreator,
    input.structuredAttributes
  );

  // Helper to ensure entitySource exists for this seller/URL
  async function attachSourceIfNew(entityId: string): Promise<boolean> {
    if (!input.url || !urlHash || !input.sellerName) return false;
    const [existingSource] = await db
      .select()
      .from(entitySources)
      .where(eq(entitySources.urlHash, urlHash))
      .limit(1);

    if (!existingSource) {
      await db.insert(entitySources).values({
        entityId,
        sellerName: input.sellerName,
        sourceUrl: input.url,
        urlHash,
        priceCents: input.priceCents,
        currency: input.currency || "USD",
        inStock: true,
      });
      return true;
    }
    return false;
  }

  // STAGE 1: Exact URL Hash Match against entity_sources or global_entities
  if (urlHash) {
    // Check entity_sources first
    const [sourceMatch] = await db
      .select()
      .from(entitySources)
      .where(eq(entitySources.urlHash, urlHash))
      .limit(1);

    if (sourceMatch) {
      const [matchedEntity] = await db
        .select()
        .from(globalEntities)
        .where(eq(globalEntities.id, sourceMatch.entityId))
        .limit(1);

      if (matchedEntity) {
        return { entity: matchedEntity, resolvedStage: 1, sourceAdded: false };
      }
    }

    // Check global_entities canonical url_hash
    const [entityUrlMatch] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.urlHash, urlHash))
      .limit(1);

    if (entityUrlMatch) {
      const added = await attachSourceIfNew(entityUrlMatch.id);
      return { entity: entityUrlMatch, resolvedStage: 1, sourceAdded: added };
    }
  }

  // STAGE 2: Hard External Identifier Match (ISBN, EAN, TMDB, Spotify)
  if (input.externalId) {
    const [extMatch] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.canonicalExternalId, input.externalId))
      .limit(1);

    if (extMatch) {
      const added = await attachSourceIfNew(extMatch.id);
      return { entity: extMatch, resolvedStage: 2, sourceAdded: added };
    }
  }

  // STAGE 3: Type-Scoped Deterministic Identity Fingerprint
  const [fpMatch] = await db
    .select()
    .from(globalEntities)
    .where(eq(globalEntities.identityFingerprint, fingerprint))
    .limit(1);

  if (fpMatch) {
    const added = await attachSourceIfNew(fpMatch.id);
    return { entity: fpMatch, resolvedStage: 3, sourceAdded: added };
  }

  // STAGE 4: Type-Scoped Vector Blocking + Distinguisher Guard
  const queryVec = generateDeterministicEmbedding(`${input.title} ${input.brandOrCreator || ""}`, 768);
  const candidates = await db
    .select()
    .from(globalEntities)
    .where(eq(globalEntities.typePath, typePath))
    .limit(50);

  for (const cand of candidates) {
    const candText = `${cand.title} ${cand.brandOrCreator || ""}`;
    const candVec = generateDeterministicEmbedding(candText, 768);
    const sim = cosineSimilarity(queryVec, candVec);

    if (sim > 0.94) {
      // Distinguisher guard: verify no conflicting vintage or external ID
      const candExt = cand.extendedAttributes as Record<string, unknown> | null;
      const candVintage = candExt?.vintage;
      const inputVintage = input.structuredAttributes?.vintage;

      if (!candVintage || !inputVintage || candVintage === inputVintage) {
        const added = await attachSourceIfNew(cand.id);
        return { entity: cand, resolvedStage: 4, sourceAdded: added };
      }
    }
  }

  // CACHE MISS: Create new canonical entity
  const effectiveUrl = input.url || `https://curio.local/item/${fingerprint.slice(0, 16)}`;
  const effectiveUrlHash = urlHash || computeUrlHash(effectiveUrl);
  const entityKey = `${effectiveUrlHash.slice(0, 16)}_${input.title.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 32)}`;

  const [newEntity] = await db
    .insert(globalEntities)
    .values({
      urlHash: effectiveUrlHash,
      entityKey,
      canonicalUrl: effectiveUrl,
      coreType: typePath.includes("/film") ? "MEDIA" : typePath.includes("/book") ? "BOOK" : "PRODUCT",
      typePath,
      canonicalExternalId: input.externalId || null,
      identityFingerprint: fingerprint,
      brandOrCreator: input.brandOrCreator || null,
      title: input.title,
      coreStructuredData: input.structuredAttributes || {},
      extendedAttributes: input.structuredAttributes || {},
      priceCents: input.priceCents || null,
      currency: input.currency || "USD",
      embedding: queryVec,
    })
    .returning();

  let sourceAdded = false;
  if (input.url && input.sellerName) {
    sourceAdded = await attachSourceIfNew(newEntity.id);
  }

  return {
    entity: newEntity,
    resolvedStage: "NEW",
    sourceAdded,
  };
}
