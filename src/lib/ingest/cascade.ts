import { createHash } from "crypto";
import {
  db,
  users,
  globalEntities,
  userSaves,
  entitySources,
  curioTypes,
  smartLists,
  type User,
  type GlobalEntity,
  type UserSave,
} from "@/db";
import { eq, or, and, isNull } from "drizzle-orm";
import { classifyPrivacyAndModality, type PrivacyClassificationResult } from "../router/privacy";
import { classifyOmniboxIntent } from "../router/intent";
import { classifyEntityType } from "../curio-learns/ontology";
import { extractStructuredCardData } from "../enrichment/extraction";
import { updateSaveDetails } from "../saves/service";
import { addItemToList } from "../lists/service";
import type { CandidateFallback } from "./disambiguation";
import { enrichCaptureInput } from "../enrichment/dispatcher";
import { detectAndParseCommercialSku } from "../enrichment/providers/commercial";
import { recordPriceSnapshot } from "../commerce/pricing";
import { parseQuoteInput } from "@/lib/types/catalog";
import {
  lookupLocalEntityCache,
  lookupByCanonicalIdentity,
  recordAliasOnEntity,
} from "./cacheLookup";
import { computeIdentityFingerprint } from "./resolution";

export interface IngestionResult {
  status: "created" | "existing" | "edited";
  is_private_memo: boolean;
  entity_id: string | null;
  save: UserSave;
  entity: GlobalEntity | null;
  candidate_fallbacks?: CandidateFallback[];
  action?: string;
  editDetails?: any;
}

export function generateEntityKey(canonicalUrl: string, slug?: string): { urlHash: string; entityKey: string } {
  const normalizedUrl = canonicalUrl.toLowerCase().trim().replace(/\/+$/, "");
  const urlHash = createHash("sha256").update(normalizedUrl).digest("hex");
  const cleanSlug = (slug || normalizedUrl.split("/").pop() || "item")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .slice(0, 48);
  return {
    urlHash,
    entityKey: `${urlHash.slice(0, 16)}_${cleanSlug}`,
  };
}

export async function getOrCreateDefaultUser(): Promise<User> {
  const [existing] = await db.select().from(users).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({
      email: "guest@curio.local",
      username: "guest",
      displayName: "Guest",
      isPro: false,
      aiCreditsRemaining: 25,
    })
    .returning();
  return created;
}

/**
 * Step 2: Search Discovery & Candidate Buffer Generator
 */
async function discoverCandidates(
  query: string,
  detectedType?: string,
  options?: { skipNetwork?: boolean }
): Promise<{ primary: CandidateFallback; runnerUps: CandidateFallback[] }> {
  const trimmed = query.trim();

  // If Tavily API Key is available and network is allowed, use live search
  if (process.env.TAVILY_API_KEY && !options?.skipNetwork) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: trimmed,
          max_results: 3,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const results = (data.results || []) as Array<{ title: string; url: string; content: string }>;
        if (results.length > 0) {
          const candidates: CandidateFallback[] = results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.content || "",
            coreType: detectedType || "PRODUCT",
          }));
          return {
            primary: candidates[0],
            runnerUps: candidates.slice(1, 3),
          };
        }
      }
    } catch {
      // Fall through to deterministic heuristics
    }
  }

  const isUrl = /^https?:\/\//i.test(trimmed);

  if (isUrl) {
    const domain = new URL(trimmed).hostname.replace("www.", "");
    return {
      primary: {
        title: trimmed,
        url: trimmed,
        snippet: `Captured resource from ${domain}`,
        coreType: detectedType || "PRODUCT",
      },
      runnerUps: [],
    };
  }

  // Dynamic candidate synthesis based on query and detected coreType
  const coreType = detectedType || "PRODUCT";
  const encoded = encodeURIComponent(trimmed);
  const title = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  let primary: CandidateFallback;
  let runnerUps: CandidateFallback[] = [];

  if (coreType === "BOOK") {
    primary = {
      title,
      url: `https://openlibrary.org/search?q=${encoded}`,
      snippet: `Book record for ${trimmed}`,
      coreType: "BOOK",
    };
    runnerUps = [
      {
        title: `${trimmed} — Goodreads`,
        url: `https://www.goodreads.com/search?q=${encoded}`,
        snippet: "Reader ratings, reviews, and literary editions",
        coreType: "BOOK",
      },
      {
        title: `${trimmed} — Open Library`,
        url: `https://openlibrary.org/search?q=${encoded}`,
        snippet: "Open Library catalog & digital editions",
        coreType: "BOOK",
      },
    ];
  } else if (coreType === "MEDIA") {
    primary = {
      title,
      url: `https://letterboxd.com/search/${encoded}/`,
      snippet: `Film and cinema entry for ${trimmed}`,
      coreType: "MEDIA",
    };
    runnerUps = [
      {
        title: `${trimmed} — IMDb`,
        url: `https://www.imdb.com/find/?q=${encoded}`,
        snippet: "Cast, credits, reviews, and specs",
        coreType: "MEDIA",
      },
      {
        title: `${trimmed} — Discogs`,
        url: `https://www.discogs.com/search/?q=${encoded}`,
        snippet: "Discography, release pressings, and vinyl records",
        coreType: "MEDIA",
      },
    ];
  } else if (coreType === "PLACE") {
    primary = {
      title: trimmed,
      url: `https://maps.google.com/?q=${encoded}`,
      snippet: `Verified location for ${trimmed}`,
      coreType: "PLACE",
    };
    runnerUps = [
      {
        title: `${trimmed} — Foursquare City Guide`,
        url: `https://foursquare.com/search?q=${encoded}`,
        snippet: `Visitor reviews, top menu items, and opening hours for ${trimmed}`,
        coreType: "PLACE",
      },
    ];
  } else {
    primary = {
      title,
      url: `https://duckduckgo.com/?q=${encoded}`,
      snippet: `Objective catalog entry for ${trimmed}`,
      coreType,
    };
    runnerUps = [
      {
        title: `${trimmed} on Amazon`,
        url: `https://www.amazon.com/s?k=${encoded}`,
        snippet: `Commercial pricing and merchant availability`,
        coreType: "PRODUCT",
      },
      {
        title: `${trimmed} Discussion — Reddit`,
        url: `https://www.reddit.com/search/?q=${encoded}`,
        snippet: `Community recommendations and long-term user reviews`,
        coreType: "PRODUCT",
      },
    ];
  }

  return { primary, runnerUps };
}

/**
 * Deterministic Ingestion Cascade
 */
export async function ingestCapture(input: string, user?: User | { id: string }) {
  return executeIngestionCascade({ input, userId: user?.id });
}

export interface CandidateTargetPayload {
  title: string;
  subtitle?: string;
  typePath?: string;
  badgeLabel?: string;
  heroImageUrl?: string | null;
  canonicalUrl?: string;
  curioTypeId?: string | null;
}

export async function executeIngestionCascade(params: {
  input: string;
  userId?: string;
  customSchemaId?: string;
  curioTypeId?: string;
  forcedTypePath?: string;
  targetCandidate?: CandidateTargetPayload;
  isPrivateMemo?: boolean;
  skipLocalLlm?: boolean;
  forceNew?: boolean;
  fetchFn?: typeof fetch;
}): Promise<IngestionResult> {
  const { input } = params;
  const user = params.userId
    ? (await db.select().from(users).where(eq(users.id, params.userId)).limit(1))[0]
    : await getOrCreateDefaultUser();

  if (!user) {
    throw new Error("Unable to identify or create user profile");
  }

  // Explicit text note capture (Shift+Enter or isPrivateMemo)
  if (params.isPrivateMemo) {
    const title = input.length > 60 ? input.slice(0, 57) + "..." : input;
    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: null,
        isPrivateMemo: true,
        privateTitle: title,
        personalNotes: input,
        typePath: "/memo/personal",
        candidateFallbacks: [],
        autoTags: ["memo", "personal"],
        enrichmentStatus: "LOCAL_ONLY",
        visibility: "PRIVATE",
      })
      .returning();

    return {
      status: "created",
      is_private_memo: true,
      entity_id: null,
      save,
      entity: null,
      candidate_fallbacks: [],
    };
  }

  // STEP -0.5: Omnibox Intent Routing & Active Save Mutator (PRD v3.2 Journey 6)
  if (!params.forceNew && !params.targetCandidate && !params.forcedTypePath) {
    const intentResult = await classifyOmniboxIntent(input, user.id, {
      skipLocalLlm: params.skipLocalLlm,
    });

  if (intentResult.intent === "EDIT_SAVE" && intentResult.targetSave) {
    const [existingSave] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.id, intentResult.targetSave.saveId))
      .limit(1);

    if (existingSave) {
      let linkedEntity: GlobalEntity | null = null;
      if (existingSave.entityId) {
        const [ent] = await db
          .select()
          .from(globalEntities)
          .where(eq(globalEntities.id, existingSave.entityId))
          .limit(1);
        linkedEntity = ent || null;
      }

      let updatedSaveRecord = existingSave;

      if (intentResult.action === "RATING" && intentResult.editDetails?.rating !== undefined) {
        const currentVals = (existingSave.userCustomValues as Record<string, unknown>) || {};
        const details = await updateSaveDetails(existingSave.id, {
          userCustomValues: {
            ...currentVals,
            rating: intentResult.editDetails.rating,
          },
        });
        if (details?.save) updatedSaveRecord = details.save;
      } else if (intentResult.action === "NOTE") {
        const noteToAdd = intentResult.editDetails?.note || input;
        const currentNotes = existingSave.personalNotes;
        const mergedNotes = currentNotes ? `${currentNotes}\n${noteToAdd}` : noteToAdd;
        const details = await updateSaveDetails(existingSave.id, {
          personalNotes: mergedNotes,
        });
        if (details?.save) updatedSaveRecord = details.save;
      } else if (intentResult.action === "STATUS") {
        const currentVals = (existingSave.userCustomValues as Record<string, unknown>) || {};
        const statusVal = intentResult.editDetails?.status || "finished";
        const details = await updateSaveDetails(existingSave.id, {
          userCustomValues: {
            ...currentVals,
            status: statusVal,
          },
          personalNotes: existingSave.personalNotes
            ? `${existingSave.personalNotes}\n${input}`
            : input,
        });
        if (details?.save) updatedSaveRecord = details.save;
      } else if (intentResult.action === "LIST_MOVE" && intentResult.editDetails?.targetList) {
        const listName = intentResult.editDetails.targetList;
        const [matchedList] = await db
          .select()
          .from(smartLists)
          .where(
            and(
              eq(smartLists.userId, user.id),
              or(
                eq(smartLists.title, listName),
                eq(smartLists.slug, listName.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))
              )
            )
          )
          .limit(1);

        if (matchedList) {
          await addItemToList(matchedList.id, existingSave.id);
        }
      }

      return {
        status: "edited",
        action: "edited",
        is_private_memo: existingSave.isPrivateMemo,
        entity_id: existingSave.entityId,
        save: updatedSaveRecord,
        entity: linkedEntity,
        editDetails: intentResult.editDetails,
      };
    }
  }
}

  const effectiveTitle = params.targetCandidate?.title?.trim() || input.trim();
  let effectiveForcedType = params.forcedTypePath || params.targetCandidate?.typePath;
  let effectiveCurioTypeId = params.curioTypeId || params.targetCandidate?.curioTypeId || params.customSchemaId;

  // STEP 0: Privacy & Modality Router
  let privacy: PrivacyClassificationResult;
  if (params.targetCandidate || params.forcedTypePath) {
    privacy = {
      intent: "PUBLIC_ENTITY",
      isPrivate: false,
      reasoning: "Explicit entity candidate capture",
      suggestedTitle: effectiveTitle,
      extractedQuery: effectiveTitle,
      detectedType: effectiveForcedType?.includes("/book")
        ? "BOOK"
        : effectiveForcedType?.includes("/film") || effectiveForcedType?.includes("/music")
        ? "MEDIA"
        : effectiveForcedType?.includes("/place")
        ? "PLACE"
        : "PRODUCT",
      confidence: 1.0,
    };
  } else {
    privacy = await classifyPrivacyAndModality(input, {
      skipLocalLlm: params.skipLocalLlm,
    });
  }

  // PRIVACY GATE: If private memo, bypass external search and global cache completely
  if (privacy.intent === "PRIVATE_MEMO") {
    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: null,
        isPrivateMemo: true,
        privateTitle: privacy.suggestedTitle,
        personalNotes: input,
        typePath: "/memo/personal",
        candidateFallbacks: [],
        autoTags: ["memo", "private"],
        enrichmentStatus: "LOCAL_ONLY",
        visibility: "PRIVATE",
      })
      .returning();

    return {
      status: "created",
      is_private_memo: true,
      entity_id: null,
      save,
      entity: null,
      candidate_fallbacks: [],
    };
  }

  const query = effectiveTitle;

  // Resolve custom schema if provided
  let targetType: typeof curioTypes.$inferSelect | null = null;
  if (effectiveCurioTypeId) {
    const [customType] = await db
      .select()
      .from(curioTypes)
      .where(or(eq(curioTypes.id, effectiveCurioTypeId), eq(curioTypes.typePath, effectiveCurioTypeId)))
      .limit(1);
    targetType = customType || null;
  }
  if (!targetType && effectiveForcedType) {
    const [matchedType] = await db
      .select()
      .from(curioTypes)
      .where(eq(curioTypes.typePath, effectiveForcedType))
      .limit(1);
    targetType = matchedType || null;
  }

  // Resolve quote type if input matches quotation pattern and user has active /quote type
  const parsedQuote = parseQuoteInput(input);
  if (parsedQuote && !effectiveForcedType) {
    const [activeQuoteType] = await db
      .select()
      .from(curioTypes)
      .where(
        and(
          eq(curioTypes.typePath, "/quote"),
          or(isNull(curioTypes.userId), eq(curioTypes.userId, user.id))
        )
      )
      .limit(1);

    if (activeQuoteType) {
      effectiveForcedType = "/quote";
      effectiveCurioTypeId = activeQuoteType.id;
      targetType = activeQuoteType;
    }
  }

  // =========================================================================
  // LAYER 0: Pre-Network Local Global Cache Lookup (<2ms, $0.00, 0 network calls)
  // =========================================================================
  const localCacheHit = await lookupLocalEntityCache(query, {
    forcedTypePath: effectiveForcedType || targetType?.typePath,
    detectedType: privacy.detectedType,
  });

  if (localCacheHit.primary) {
    const hitEntity = localCacheHit.primary;
    const skuCheck = detectAndParseCommercialSku(query);
    if (
      skuCheck &&
      skuCheck.typePath !== "/product" &&
      (hitEntity.typePath === "/product" || hitEntity.typePath === "/product/generic")
    ) {
      await db
        .update(globalEntities)
        .set({ typePath: skuCheck.typePath })
        .where(eq(globalEntities.id, hitEntity.id));
      hitEntity.typePath = skuCheck.typePath;
    }

    if (!targetType && hitEntity.typePath) {
      const [matchedType] = await db
        .select()
        .from(curioTypes)
        .where(eq(curioTypes.typePath, hitEntity.typePath))
        .limit(1);
      if (matchedType) targetType = matchedType;
    }

    const hitCoreData = (hitEntity.coreStructuredData as Record<string, any>) || {};
    const extractedCardData = extractStructuredCardData({
      input,
      rawMetadata: hitCoreData,
      typePath: hitEntity.typePath || "/product/generic",
      effectiveSchema: (targetType?.effectiveJsonSchema as any) || (targetType?.jsonSchema as any),
      uiFieldConfig: (targetType?.uiFieldConfig as any) || [],
    });

    if ((hitEntity.typePath === "/quote" || targetType?.typePath === "/quote") && parsedQuote) {
      extractedCardData.subjectiveValues = {
        ...extractedCardData.subjectiveValues,
        text: parsedQuote.text,
        author: parsedQuote.author,
        ...(parsedQuote.date ? { date: parsedQuote.date } : {}),
        ...(parsedQuote.work ? { work: parsedQuote.work } : {}),
      };
    }

    let hitFallbacks = localCacheHit.siblings;
    if (!hitFallbacks || hitFallbacks.length === 0) {
      const { runnerUps: localRunnerUps } = await discoverCandidates(query, hitEntity.coreType, {
        skipNetwork: true,
      });
      hitFallbacks = localRunnerUps;
    }

    const [insertedSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: hitEntity.id,
        customTypeId: targetType?.id || null,
        typeId: targetType?.id || null,
        typePath: targetType?.typePath || hitEntity.typePath,
        isPrivateMemo: false,
        candidateFallbacks: hitFallbacks,
        autoTags: [...new Set([hitEntity.coreType.toLowerCase(), ...extractedCardData.tags])],
        userCustomValues: extractedCardData.subjectiveValues || {},
        personalNotes: extractedCardData.personalNotes || null,
        enrichmentStatus: "ENRICHED",
        visibility: "PRIVATE",
      })
      .returning();

    return {
      status: "created",
      is_private_memo: false,
      entity_id: hitEntity.id,
      save: insertedSave,
      entity: hitEntity,
      candidate_fallbacks: hitFallbacks,
    };
  }

  // =========================================================================
  // LAYER 1 & LAYER 2: Commercial SKU Router / Universal Graph + Specialist
  // =========================================================================
  let enrichment;
  try {
    enrichment = await enrichCaptureInput(query, {
      detectedType: privacy.detectedType,
      fetchFn: params.fetchFn,
    });
  } catch {
    enrichment = null;
  }

  // Dynamic entity classification via ontology service (with enriched entity context) if not resolved by customSchemaId
  let dynamicClassification = null;
  if (!targetType) {
    dynamicClassification = await classifyEntityType(query, user.id, {
      typePath: enrichment?.typePath,
      title: enrichment?.title,
      summary: enrichment?.summary,
      brandOrCreator: enrichment?.brandOrCreator,
      category: enrichment?.coreStructuredData?.category,
    });
    if (dynamicClassification && dynamicClassification.typePath !== "/product/generic") {
      const [typeMatch] = await db
        .select()
        .from(curioTypes)
        .where(eq(curioTypes.typePath, dynamicClassification.typePath))
        .limit(1);
      targetType = typeMatch || null;
    }
  }

  // Discover candidate fallbacks for disambiguation bar (FR-2.3)
  const { primary: fallbackPrimary, runnerUps: defaultRunnerUps } = await discoverCandidates(
    query,
    privacy.detectedType,
    { skipNetwork: Boolean(params.fetchFn) }
  );
  const runnerUps: CandidateFallback[] =
    enrichment?.runnerUpCandidates && enrichment.runnerUpCandidates.length > 0
      ? enrichment.runnerUpCandidates
      : defaultRunnerUps;

  const finalSummary = enrichment?.summary || fallbackPrimary.snippet;
  const finalCoreType =
    enrichment?.coreType ||
    (targetType?.typePath?.includes("/book") ? "BOOK" : null) ||
    (targetType?.typePath?.includes("/film") ? "MEDIA" : null) ||
    (fallbackPrimary.coreType !== "PRODUCT" ? fallbackPrimary.coreType : null) ||
    targetType?.rootArchetype ||
    fallbackPrimary.coreType;

  // Prefer the more specific subtype path when both enrichment and targetType exist
  const enrichPath =
    enrichment?.typePath && enrichment.typePath !== "/product/generic"
      ? enrichment.typePath
      : null;
  const targetPath =
    targetType?.typePath && targetType.typePath !== "/product/generic"
      ? targetType.typePath
      : null;
  const dynPath =
    dynamicClassification?.typePath && dynamicClassification.typePath !== "/product/generic"
      ? dynamicClassification.typePath
      : null;

  let finalTypePath: string;
  if (effectiveForcedType) {
    finalTypePath = effectiveForcedType;
  } else if (params.customSchemaId && targetPath) {
    finalTypePath = targetPath;
  } else if (enrichPath && targetPath) {
    // If one is a more specific child of the other (e.g. /product/watch vs /product), pick the deeper path
    finalTypePath =
      enrichPath.startsWith(targetPath + "/") || enrichPath.split("/").length > targetPath.split("/").length
        ? enrichPath
        : targetPath;
  } else {
    finalTypePath =
      enrichPath ||
      targetPath ||
      dynPath ||
      (finalCoreType === "BOOK" ? "/product/book" : "/product/generic");
  }

  // Ensure targetType matches finalTypePath if a curio_types record exists for finalTypePath
  if (!targetType || targetType.typePath !== finalTypePath) {
    const [exactType] = await db
      .select()
      .from(curioTypes)
      .where(eq(curioTypes.typePath, finalTypePath))
      .limit(1);
    if (exactType) {
      targetType = exactType;
    }
  }

  const finalTitle = parsedQuote && finalTypePath === "/quote"
    ? parsedQuote.text
    : (params.targetCandidate?.title || enrichment?.title || fallbackPrimary.title);
  let finalCanonicalUrl = enrichment?.canonicalUrl;
  if (!finalCanonicalUrl) {
    if (parsedQuote && finalTypePath === "/quote") {
      finalCanonicalUrl = `https://en.wikiquote.org/wiki/Special:Search?search=${encodeURIComponent(parsedQuote.author)}`;
    } else if (params.targetCandidate?.canonicalUrl && !params.targetCandidate.canonicalUrl.includes("/search")) {
      finalCanonicalUrl = params.targetCandidate.canonicalUrl;
    } else {
      finalCanonicalUrl = fallbackPrimary.url;
    }
  }

  const finalHeroImage = params.targetCandidate?.heroImageUrl || enrichment?.heroImageUrl || null;
  const finalPriceCents = enrichment?.priceCents ?? null;
  const finalExternalId = enrichment?.canonicalExternalId || null;
  const finalCreator = parsedQuote && finalTypePath === "/quote"
    ? parsedQuote.author
    : (enrichment?.brandOrCreator || null);

  // Schema-directed extraction
  const extractedCardData = extractStructuredCardData({
    input,
    rawMetadata: enrichment?.coreStructuredData,
    typePath: finalTypePath,
    effectiveSchema: (targetType?.effectiveJsonSchema as any) || (targetType?.jsonSchema as any),
    uiFieldConfig: (targetType?.uiFieldConfig as any) || [],
  });

  if (finalTypePath === "/quote" && parsedQuote) {
    extractedCardData.subjectiveValues = {
      ...extractedCardData.subjectiveValues,
      text: parsedQuote.text,
      author: parsedQuote.author,
      ...(parsedQuote.date ? { date: parsedQuote.date } : {}),
      ...(parsedQuote.work ? { work: parsedQuote.work } : {}),
    };
    extractedCardData.objectiveAttributes = {
      ...extractedCardData.objectiveAttributes,
      text: parsedQuote.text,
      author: parsedQuote.author,
      ...(parsedQuote.date ? { date: parsedQuote.date } : {}),
      ...(parsedQuote.work ? { work: parsedQuote.work } : {}),
    };
  }

  // Compute canonical identity keys and deterministic identityFingerprint
  const { urlHash, entityKey } = generateEntityKey(finalCanonicalUrl, finalTitle);
  const identityFingerprint = computeIdentityFingerprint(
    finalTypePath,
    finalTitle,
    finalCreator || undefined,
    {
      ...(enrichment?.coreStructuredData || {}),
      ...(extractedCardData.objectiveAttributes || {}),
    }
  );

  // =========================================================================
  // LAYER 1.5: Canonical Identity Cache Check (with Distinguisher Guard)
  // =========================================================================
  let cachedEntity: GlobalEntity | null = null;
  if (enrichment?.cachedEntityId) {
    const [found] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, enrichment.cachedEntityId))
      .limit(1);
    cachedEntity = found || null;
  }

  if (!cachedEntity) {
    cachedEntity = await lookupByCanonicalIdentity({
      canonicalExternalId: finalExternalId,
      wikidataUri: enrichment?.coreStructuredData?.wikidataUri || null,
      identityFingerprint,
      canonicalUrl: finalCanonicalUrl,
      queryToRegisterAsAlias: query,
      distinguisherQuery: query,
    });
  } else {
    await recordAliasOnEntity(cachedEntity, query);
  }

  if (cachedEntity) {
    const save = db.transaction((tx) => {
      // If cached entity was a generic product but live enrichment discovered a specific cultural type
      const currentExtended = (cachedEntity.extendedAttributes as Record<string, unknown>) || {};
      const mergedExtended = {
        ...currentExtended,
        ...extractedCardData.objectiveAttributes,
      };

      if (
        (cachedEntity.coreType === "PRODUCT" && finalCoreType !== "PRODUCT") ||
        ((cachedEntity.typePath === "/product/generic" || cachedEntity.typePath === "/product") &&
          finalTypePath !== "/product/generic" &&
          finalTypePath !== "/product") ||
        Object.keys(extractedCardData.objectiveAttributes).length > 0
      ) {
        tx.update(globalEntities)
          .set({
            coreType: finalCoreType,
            typePath: finalTypePath,
            brandOrCreator: finalCreator || cachedEntity.brandOrCreator,
            canonicalExternalId: finalExternalId || cachedEntity.canonicalExternalId,
            identityFingerprint: cachedEntity.identityFingerprint || identityFingerprint,
            heroImageUrl: finalHeroImage || cachedEntity.heroImageUrl,
            summary: finalSummary || cachedEntity.summary,
            extendedAttributes: mergedExtended,
          })
          .where(eq(globalEntities.id, cachedEntity.id))
          .run();

        cachedEntity.coreType = finalCoreType;
        cachedEntity.typePath = finalTypePath;
        cachedEntity.extendedAttributes = mergedExtended;
        if (finalCreator) cachedEntity.brandOrCreator = finalCreator;
      }

      // Cache HIT! Link save at $0.00 compute atomically
      const [insertedSave] = tx
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: cachedEntity.id,
          customTypeId: targetType?.id || effectiveCurioTypeId || null,
          typeId: targetType?.id || effectiveCurioTypeId || null,
          typePath: cachedEntity.typePath,
          isPrivateMemo: false,
          candidateFallbacks: runnerUps,
          autoTags: [...new Set([cachedEntity.coreType.toLowerCase(), ...extractedCardData.tags])],
          userCustomValues: extractedCardData.subjectiveValues || {},
          personalNotes: extractedCardData.personalNotes || null,
          enrichmentStatus: "ENRICHED",
          visibility: "PRIVATE",
        })
        .returning()
        .all();

      return insertedSave;
    });

    return {
      status: "created",
      is_private_memo: false,
      entity_id: cachedEntity.id,
      save,
      entity: cachedEntity,
      candidate_fallbacks: runnerUps,
    };
  }

  // =========================================================================
  // LAYER 3: CACHE MISS — Insert new global entity with fingerprint & aliases
  // =========================================================================
  const effectivePriceCents = extractedCardData.price?.cents ?? finalPriceCents;
  const effectiveCurrency = extractedCardData.price?.currency ?? (enrichment?.currency || "USD");

  const { newEntity, save } = db.transaction((tx) => {
    const [insertedEntity] = tx
      .insert(globalEntities)
      .values({
        urlHash,
        entityKey,
        canonicalUrl: finalCanonicalUrl,
        coreType: finalCoreType,
        typePath: finalTypePath,
        canonicalExternalId: finalExternalId,
        identityFingerprint,
        brandOrCreator: finalCreator,
        title: finalTitle,
        summary: finalSummary,
        heroImageUrl: finalHeroImage,
        coreStructuredData: {
          rawQuery: input,
          aliases: [query],
          runnerUpCandidates: runnerUps,
          extractedAt: new Date().toISOString(),
          provenance: finalCanonicalUrl,
          ...(enrichment?.coreStructuredData || {}),
        },
        extendedAttributes: extractedCardData.objectiveAttributes || {},
        priceCents: effectivePriceCents,
        currency: effectiveCurrency,
        priceVerifiedAt: effectivePriceCents ? new Date().toISOString() : null,
      })
      .returning()
      .all();

    let preferredSourceId: string | null = null;
    if (enrichment?.primarySource) {
      const { urlHash: sourceHash } = generateEntityKey(enrichment.primarySource.sourceUrl);
      const [source] = tx
        .insert(entitySources)
        .values({
          entityId: insertedEntity.id,
          sellerName: enrichment.primarySource.sellerName,
          sourceUrl: enrichment.primarySource.sourceUrl,
          urlHash: sourceHash,
          priceCents: enrichment.primarySource.priceCents,
          currency: enrichment.primarySource.currency || "USD",
          inStock: true,
        })
        .returning()
        .all();
      preferredSourceId = source.id;

      if (enrichment.primarySource.priceCents != null) {
        recordPriceSnapshot(
          {
            entityId: insertedEntity.id,
            sourceId: source.id,
            sellerName: enrichment.primarySource.sellerName,
            priceCents: enrichment.primarySource.priceCents,
            currency: enrichment.primarySource.currency || "USD",
            inStock: true,
          },
          tx
        );
      }
    } else if (effectivePriceCents != null) {
      recordPriceSnapshot(
        {
          entityId: insertedEntity.id,
          sellerName: "Direct",
          priceCents: effectivePriceCents,
          currency: effectiveCurrency,
          inStock: true,
        },
        tx
      );
    }

    const [insertedSave] = tx
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: insertedEntity.id,
        customTypeId: targetType?.id || effectiveCurioTypeId || null,
        typeId: targetType?.id || effectiveCurioTypeId || null,
        typePath: finalTypePath,
        preferredSourceId,
        isPrivateMemo: false,
        candidateFallbacks: runnerUps,
        autoTags: [
          ...new Set([
            insertedEntity.coreType.toLowerCase(),
            finalTypePath.split("/").pop() || "captured",
            ...extractedCardData.tags,
          ]),
        ],
        userCustomValues: extractedCardData.subjectiveValues || {},
        personalNotes: extractedCardData.personalNotes || null,
        enrichmentStatus: "ENRICHED",
        visibility: "PRIVATE",
      })
      .returning()
      .all();

    return { newEntity: insertedEntity, save: insertedSave };
  });

  return {
    status: "created",
    is_private_memo: false,
    entity_id: newEntity.id,
    save,
    entity: newEntity,
    candidate_fallbacks: runnerUps,
  };
}

export interface BackgroundEnrichmentResult {
  entityId: string | null;
  typePath: string;
  extendedAttributes: Record<string, unknown>;
  candidateFallbacks: CandidateFallback[];
  autoTags: string[];
  save: UserSave;
  entity: GlobalEntity | null;
}

export async function executeBackgroundEnrichment(
  saveId: string,
  input: string,
  userId: string
): Promise<BackgroundEnrichmentResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const effectiveUser = user || (await getOrCreateDefaultUser());
  const res = await executeIngestionCascade({ input, userId: effectiveUser.id });

  let updatedSave: UserSave;
  if (res.entity) {
    const [patched] = await db
      .update(userSaves)
      .set({
        entityId: res.entity.id,
        typeId: res.save.typeId,
        customTypeId: res.save.customTypeId,
        typePath: res.save.typePath,
        preferredSourceId: res.save.preferredSourceId,
        candidateFallbacks: res.candidate_fallbacks || [],
        autoTags: res.save.autoTags,
        userCustomValues: res.save.userCustomValues,
        personalNotes: res.save.personalNotes,
        enrichmentStatus: "ENRICHED",
      })
      .where(eq(userSaves.id, saveId))
      .returning();

    // If ingestCaptureInput inserted a secondary save, remove it so saveId remains canonical
    if (res.save && res.save.id !== saveId) {
      await db.delete(userSaves).where(eq(userSaves.id, res.save.id));
    }
    updatedSave = patched || res.save;
  } else {
    const [patched] = await db
      .update(userSaves)
      .set({
        enrichmentStatus: "ENRICHED",
      })
      .where(eq(userSaves.id, saveId))
      .returning();
    updatedSave = patched || res.save;
  }

  return {
    entityId: res.entity?.id || null,
    typePath: updatedSave.typePath || "/product/generic",
    extendedAttributes: (res.entity?.extendedAttributes as Record<string, unknown>) || {},
    candidateFallbacks: res.candidate_fallbacks || [],
    autoTags: (updatedSave.autoTags as string[]) || [],
    save: updatedSave,
    entity: res.entity,
  };
}
