import { db, userSaves, globalEntities } from "@/db";
import { eq } from "drizzle-orm";
import { resolveOrCreateCanonicalEntity } from "./resolution";
import { enrichCaptureInput, type TargetCandidateContext } from "../enrichment/dispatcher";
import { mapDescriptionToOntology } from "../enrichment/universalDiscovery";

export interface CandidateFallback {
  title: string;
  url: string;
  snippet: string;
  coreType: string;
  typePath?: string;
  badgeLabel?: string;
  creator?: string | null;
  year?: number | null;
  heroImageUrl?: string | null;
}

/**
 * FR-2.3: 1-Tap Candidate Disambiguation Swapper
 * Supports both pre-computed candidate_fallbacks and live search selections from "Wrong entity?".
 */
export async function swapCandidateFallback(
  saveId: string,
  targetUrl: string,
  newEntityId?: string,
  targetCandidate?: TargetCandidateContext
) {
  const [save] = await db.select().from(userSaves).where(eq(userSaves.id, saveId)).limit(1);
  if (!save) {
    throw new Error(`Save ${saveId} not found`);
  }

  const fallbacks = (save.candidateFallbacks || []) as CandidateFallback[];
  const selectedIndex = fallbacks.findIndex((c) => c.url === targetUrl);

  if (selectedIndex === -1 && !newEntityId && !targetCandidate) {
    throw new Error(`Candidate with url ${targetUrl} not found in fallbacks`);
  }

  const selectedCandidate: CandidateFallback | undefined =
    selectedIndex !== -1
      ? fallbacks[selectedIndex]
      : targetCandidate
      ? {
          title: targetCandidate.title,
          url: targetCandidate.canonicalUrl || targetUrl,
          snippet: targetCandidate.subtitle || "",
          coreType: targetCandidate.typePath?.includes("/book")
            ? "BOOK"
            : targetCandidate.typePath?.includes("/film") ||
              targetCandidate.typePath?.includes("/music")
            ? "MEDIA"
            : targetCandidate.typePath?.includes("/place")
            ? "PLACE"
            : "PRODUCT",
          typePath: targetCandidate.typePath,
          badgeLabel: targetCandidate.badgeLabel,
          creator: targetCandidate.creator,
          year: targetCandidate.year,
          heroImageUrl: targetCandidate.heroImageUrl,
        }
      : undefined;

  const remainingFallbacks =
    selectedIndex !== -1 ? fallbacks.filter((_, idx) => idx !== selectedIndex) : fallbacks;

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
        : selectedCandidate.coreType === "BOOK"
        ? "/product/book"
        : selectedCandidate.coreType === "MEDIA"
        ? "/media/film"
        : `/${selectedCandidate.coreType.toLowerCase()}`);

    const yearMatch = selectedCandidate.title.match(/\((19\d\d|20[0-2]\d)\)$/);
    const inlineYear = yearMatch ? parseInt(yearMatch[1], 10) : null;
    const cleanTitle = selectedCandidate.title
      .replace(/\s*\((?:19\d\d|20\d\d)\)$/, "")
      .trim();

    const candidateContext: TargetCandidateContext = {
      title: cleanTitle,
      subtitle: selectedCandidate.snippet,
      creator: selectedCandidate.creator ?? null,
      year: selectedCandidate.year ?? inlineYear,
      typePath: rawTypePath,
      badgeLabel: selectedCandidate.badgeLabel,
      heroImageUrl: selectedCandidate.heroImageUrl ?? null,
      canonicalUrl: selectedCandidate.url,
    };

    const specialistEnrichment = await enrichCaptureInput(cleanTitle, {
      forcedTypePath: rawTypePath,
      targetCandidate: candidateContext,
    }).catch(() => null);

    const canonicalUrl =
      selectedCandidate.url.includes("wikidata.org") ||
      selectedCandidate.url.includes("curio.local/suggest") ||
      !selectedCandidate.url
        ? specialistEnrichment?.canonicalUrl || selectedCandidate.url
        : selectedCandidate.url;
    const finalTitle = specialistEnrichment?.title || selectedCandidate.title;
    targetTypePath = specialistEnrichment?.typePath || rawTypePath;

    const [existing] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.canonicalUrl, canonicalUrl))
      .limit(1);

    if (existing) {
      targetEntityId = existing.id;
      targetTypePath = existing.typePath || targetTypePath;

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
        title: selectedCandidate.title || finalTitle,
        brandOrCreator: specialistEnrichment?.brandOrCreator || selectedCandidate.creator || undefined,
        typePath: targetTypePath,
        structuredAttributes: {
          summary: specialistEnrichment?.summary || selectedCandidate.snippet,
          heroImageUrl:
            specialistEnrichment?.heroImageUrl || selectedCandidate.heroImageUrl || null,
          brandOrCreator:
            specialistEnrichment?.brandOrCreator || selectedCandidate.creator || null,
          priceCents: specialistEnrichment?.priceCents ?? null,
          currency: specialistEnrichment?.currency || "USD",
          ...(specialistEnrichment?.coreStructuredData || {}),
        },
      });

      if (specialistEnrichment?.heroImageUrl || selectedCandidate.heroImageUrl) {
        await db
          .update(globalEntities)
          .set({
            heroImageUrl:
              specialistEnrichment?.heroImageUrl || selectedCandidate.heroImageUrl || null,
            summary: specialistEnrichment?.summary || selectedCandidate.snippet || null,
          })
          .where(eq(globalEntities.id, res.entity.id));
      }

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
