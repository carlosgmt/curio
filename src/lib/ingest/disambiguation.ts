import { db, userSaves, globalEntities } from "@/db";
import { eq } from "drizzle-orm";

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

  const selectedCandidate = fallbacks[selectedIndex];
  const remainingFallbacks = fallbacks.filter((_, idx) => idx !== selectedIndex);

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

  const [updatedSave] = await db
    .update(userSaves)
    .set({
      entityId: newEntityId || save.entityId,
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
