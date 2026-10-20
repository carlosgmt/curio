import { db, userSaves, globalEntities } from "@/db";
import { eq } from "drizzle-orm";
import { resolveOrCreateCanonicalEntity } from "./resolution";

export interface CandidateFallback {
  title: string;
  url: string;
  snippet: string;
  coreType: string;
}

/**
 * FR-2.3: 1-Tap Candidate Disambiguation Swapper
 * When the user selects a runner-up candidate from candidate_fallbacks,
 * this function updates the user_save record with the new entity or fallback details.
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
  const remainingFallbacks = selectedIndex !== -1
    ? fallbacks.filter((_, idx) => idx !== selectedIndex)
    : fallbacks;

  // If there was an existing entity, we can push it into fallbacks
  let updatedFallbacks = remainingFallbacks;
  if (save.entityId) {
    const [existingEntity] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, save.entityId))
      .limit(1);

    if (existingEntity) {
      updatedFallbacks = [
        ...remainingFallbacks,
        {
          title: existingEntity.title,
          url: existingEntity.canonicalUrl,
          snippet: existingEntity.summary || "",
          coreType: existingEntity.coreType,
        },
      ];
    }
  }

  let targetEntityId = newEntityId;
  let targetTypePath = save.typePath;

  if (!targetEntityId && selectedCandidate) {
    // Check if an entity with this canonicalUrl already exists
    const [existing] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.canonicalUrl, selectedCandidate.url))
      .limit(1);

    if (existing) {
      targetEntityId = existing.id;
      if (existing.typePath) {
        targetTypePath = existing.typePath;
      }
    } else {
      const typePath = selectedCandidate.coreType.startsWith("/")
        ? selectedCandidate.coreType
        : `/${selectedCandidate.coreType.toLowerCase()}`;

      const res = await resolveOrCreateCanonicalEntity({
        url: selectedCandidate.url,
        title: selectedCandidate.title,
        typePath,
        structuredAttributes: { summary: selectedCandidate.snippet },
      });
      targetEntityId = res.entity.id;
      targetTypePath = res.entity.typePath || typePath;
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
