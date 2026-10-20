import { db, userSaves, globalEntities } from "@/db";
import { eq } from "drizzle-orm";
import { resolveOrCreateCanonicalEntity } from "./resolution";
import { enrichCaptureInput } from "../enrichment/dispatcher";
import { mapDescriptionToOntology } from "../enrichment/universalDiscovery";

export interface CandidateFallback {
  title: string;
  url: string;
  snippet: string;
  coreType: string;
  typePath?: string;
  badgeLabel?: string;
}

/**
 * FR-2.3: 1-Tap Candidate Disambiguation Swapper
 * When the user selects a runner-up candidate from candidate_fallbacks,
 * this function hydrates specialist metadata for the newly selected candidate's typePath
 * and atomically updates the user_save and global_entities records.
 */
export async function swapCandidateFallback(
  saveId: string,
  targetUrl: string,
  newEntityId?: string
) {
  const [save] = await db.select().from(userSaves).where(eq(userSaves.id, saveId)).limit(1);
  if (!save) {
    throw new Error(`Save ${saveId} not found`);
  }

  const fallbacks = (save.candidateFallbacks || []) as CandidateFallback[];
  const selectedIndex = fallbacks.findIndex((c) => c.url === targetUrl);

  if (selectedIndex === -1 && !newEntityId) {
    throw new Error(`Candidate with url ${targetUrl} not found in fallbacks`);
  }

  const selectedCandidate = selectedIndex !== -1 ? fallbacks[selectedIndex] : undefined;
  const remainingFallbacks =
    selectedIndex !== -1 ? fallbacks.filter((_, idx) => idx !== selectedIndex) : fallbacks;

  // Push existing entity into fallbacks if available
  let updatedFallbacks = remainingFallbacks;
  if (save.entityId) {
    const [existingEntity] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, save.entityId))
      .limit(1);

    if (existingEntity) {
      const ontology = mapDescriptionToOntology(existingEntity.summary || "", existingEntity.title);
      updatedFallbacks = [
        ...remainingFallbacks,
        {
          title: existingEntity.title,
          url: existingEntity.canonicalUrl,
          snippet: existingEntity.summary || "",
          coreType: existingEntity.coreType,
          typePath: existingEntity.typePath || ontology.typePath,
          badgeLabel: ontology.badgeLabel,
        },
      ];
    }
  }

  let targetEntityId = newEntityId;
  let targetTypePath = save.typePath;

  if (!targetEntityId && selectedCandidate) {
    const rawTypePath =
      selectedCandidate.typePath ||
      (selectedCandidate.coreType.startsWith("/")
        ? selectedCandidate.coreType
        : `/${selectedCandidate.coreType.toLowerCase()}`);

    // Clean title (e.g. remove trailing year like "Norwegian Wood (1965)")
    const cleanTitle = selectedCandidate.title
      .replace(/\s*\((?:19\d\d|20\d\d)\)$/, "")
      .trim();

    // Trigger full specialist hydration for the target typePath
    const specialistEnrichment = await enrichCaptureInput(cleanTitle, {
      forcedTypePath: rawTypePath,
    }).catch(() => null);

    const canonicalUrl = selectedCandidate.url.includes("wikidata.org")
      ? specialistEnrichment?.canonicalUrl || selectedCandidate.url
      : selectedCandidate.url;
    const finalTitle = selectedCandidate.title;
    targetTypePath = specialistEnrichment?.typePath || rawTypePath;

    // Check if an entity with this canonicalUrl or title+typePath already exists
    const [existing] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.canonicalUrl, canonicalUrl))
      .limit(1);

    if (existing) {
      targetEntityId = existing.id;
      targetTypePath = existing.typePath || targetTypePath;

      // Augment existing entity if it was a stub
      if (
        (!existing.heroImageUrl && specialistEnrichment?.heroImageUrl) ||
        (!existing.brandOrCreator && specialistEnrichment?.brandOrCreator)
      ) {
        await db
          .update(globalEntities)
          .set({
            heroImageUrl: existing.heroImageUrl || specialistEnrichment?.heroImageUrl,
            brandOrCreator: existing.brandOrCreator || specialistEnrichment?.brandOrCreator,
            coreStructuredData: {
              ...(existing.coreStructuredData as Record<string, unknown>),
              ...(specialistEnrichment?.coreStructuredData || {}),
            },
          })
          .where(eq(globalEntities.id, existing.id));
      }
    } else {
      const res = await resolveOrCreateCanonicalEntity({
        url: canonicalUrl,
        title: finalTitle,
        typePath: targetTypePath,
        structuredAttributes: {
          summary: specialistEnrichment?.summary || selectedCandidate.snippet,
          heroImageUrl: specialistEnrichment?.heroImageUrl || null,
          brandOrCreator: specialistEnrichment?.brandOrCreator || null,
          priceCents: specialistEnrichment?.priceCents ?? null,
          currency: specialistEnrichment?.currency || "USD",
          ...(specialistEnrichment?.coreStructuredData || {}),
        },
      });
      targetEntityId = res.entity.id;
      targetTypePath = res.entity.typePath || targetTypePath;
    }
  }

  const [updatedSave] = await db
    .update(userSaves)
    .set({
      entityId: targetEntityId || save.entityId,
      typePath: targetTypePath,
      candidateFallbacks: updatedFallbacks,
      enrichmentStatus: "ENRICHED",
    })
    .where(eq(userSaves.id, saveId))
    .returning();

  return {
    success: true,
    save: updatedSave,
    selectedCandidate,
  };
}
