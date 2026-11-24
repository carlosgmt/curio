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
import { eq, or, and, isNull, desc, asc } from "drizzle-orm";
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
  isUnenrichedStubEntity,
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
  previousSave?: {
    personalNotes: string | null;
    userCustomValues: Record<string, unknown>;
  };
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
  const [existing] = await db
    .select()
    .from(users)
    .orderBy(desc(users.isAdmin), asc(users.createdAt))
    .limit(1);
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

  const urlMatch = trimmed.match(/^(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    const cleanUrl = urlMatch[1];
    const domain = new URL(cleanUrl).hostname.replace("www.", "");
    return {
      primary: {
        title: cleanUrl,
        url: cleanUrl,
        snippet: `Captured resource from ${domain}`,
        coreType: detectedType || "PRODUCT",
      },
      runnerUps: [],
    };
  }

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
  creator?: string | null;
  year?: number | null;
  typePath?: string;
  badgeLabel?: string;
  heroImageUrl?: string | null;
  canonicalUrl?: string;
  conceptUri?: string | null;
  curioTypeId?: string | null;
}

const GENERIC_BOARD_TITLES = new Set([
  "all",
  "all my stuff",
  "wishlist",
  "favorites",
  "films",
  "movies",
  "cinema",
  "music",
  "vinyl",
  "books",
  "reading",
  "wardrobe",
  "closet",
  "outfits",
  "recipes",
  "places",
  "spots",
  "products",
  "shopping",
  "notes",
  "memos",
  "links",
]);

export async function executeIngestionCascade(params: {
  input: string;
  userId?: string;
  customSchemaId?: string;
  curioTypeId?: string;
  forcedTypePath?: string;
  targetCandidate?: CandidateTargetPayload;
  listId?: string;
  queryContext?: string;
  boardContext?: {
    title?: string;
    slug?: string;
    coreType?: string;
    typePathPrefix?: string;
  };
  isPrivateMemo?: boolean;
  skipLocalLlm?: boolean;
  forceNew?: boolean;
  targetSaveId?: string;
  fetchFn?: typeof fetch;
}): Promise<IngestionResult> {
  const { input } = params;
  const user = params.userId
    ? (await db.select().from(users).where(eq(users.id, params.userId)).limit(1))[0]
    : await getOrCreateDefaultUser();

  if (!user) {
    throw new Error("Unable to identify or create user profile");
  }

  // Resolve optional board context (verifying ownership)
  let verifiedBoard: typeof smartLists.$inferSelect | null = null;
  if (params.listId) {
    const [board] = await db
      .select()
      .from(smartLists)
      .where(and(eq(smartLists.id, params.listId), eq(smartLists.userId, user.id)))
      .limit(1);
    verifiedBoard = board || null;
  }

  const attachToActiveBoardIfAny = async (saveId: string) => {
    if (verifiedBoard) {
      await addItemToList(verifiedBoard.id, saveId);
    }
  };

  // Explicit text note capture (Cmd/Alt+Enter or isPrivateMemo)
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

    await attachToActiveBoardIfAny(save.id);

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

    const resolvedTargetSaveId =
      params.targetSaveId ||
      (intentResult.intent === "EDIT_SAVE" ? intentResult.targetSave?.saveId : undefined);

    if ((intentResult.intent === "EDIT_SAVE" || Boolean(params.targetSaveId)) && resolvedTargetSaveId) {
      const [existingSave] = await db
        .select()
        .from(userSaves)
        .where(and(eq(userSaves.id, resolvedTargetSaveId), eq(userSaves.userId, user.id)))
        .limit(1);

      if (existingSave) {
        const previousSave = {
          personalNotes: existingSave.personalNotes ?? null,
          userCustomValues: {
            ...(((existingSave.userCustomValues as Record<string, unknown>) || {})),
          },
        };
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
        const effectiveAction = intentResult.action || "NOTE";

        if (effectiveAction === "RATING" && intentResult.editDetails?.rating !== undefined) {
          const currentVals = (existingSave.userCustomValues as Record<string, unknown>) || {};
          const details = await updateSaveDetails(existingSave.id, {
            userCustomValues: {
              ...currentVals,
              rating: intentResult.editDetails.rating,
            },
          });
          if (details?.save) updatedSaveRecord = details.save;
        } else if (effectiveAction === "NOTE") {
          const noteToAdd = intentResult.editDetails?.note || input;
          const currentNotes = existingSave.personalNotes;
          const mergedNotes = currentNotes ? `${currentNotes}\n${noteToAdd}` : noteToAdd;
          const details = await updateSaveDetails(existingSave.id, {
            personalNotes: mergedNotes,
          });
          if (details?.save) updatedSaveRecord = details.save;
        } else if (effectiveAction === "STATUS") {
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
        } else if (effectiveAction === "LIST_MOVE" && intentResult.editDetails?.targetList) {
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

        await attachToActiveBoardIfAny(updatedSaveRecord.id);

        return {
          status: "edited",
          action: "edited",
          is_private_memo: existingSave.isPrivateMemo,
          entity_id: existingSave.entityId,
          save: updatedSaveRecord,
          entity: linkedEntity,
          editDetails: intentResult.editDetails,
          previousSave,
        };
      }
    }
  }

  // Extract clean leading URL + optional trailing commentary (e.g., Chrome extension "${url} — ${notes}")
  const leadingUrlWithNotes = !params.targetCandidate
    ? input.trim().match(/^(https?:\/\/[^\s]+)(?:\s+(.*))?$/i)
    : null;
  const trailingUrlNote = leadingUrlWithNotes?.[2]
    ? leadingUrlWithNotes[2].replace(/^(?:—|--|-|\|)\s*/, "").trim()
    : "";

  const effectiveTitle =
    params.targetCandidate?.title?.trim() ||
    (leadingUrlWithNotes ? leadingUrlWithNotes[1] : input.trim());
  let effectiveForcedType = params.forcedTypePath || params.targetCandidate?.typePath;
  let effectiveCurioTypeId = params.curioTypeId || params.targetCandidate?.curioTypeId || params.customSchemaId;

  const rawBoardTitle = (params.boardContext?.title || verifiedBoard?.title || "").trim();
  const boardLocationHint =
    rawBoardTitle && !GENERIC_BOARD_TITLES.has(rawBoardTitle.toLowerCase())
      ? rawBoardTitle
      : null;
  const boardTypePathPrefix =
    params.boardContext?.typePathPrefix || verifiedBoard?.autoRules?.typePathPrefix || undefined;
  const boardCoreTypeHint =
    params.boardContext?.coreType || verifiedBoard?.autoRules?.coreType || undefined;

  // STEP 0: Privacy & Modality Router
  let privacy: PrivacyClassificationResult;
  if (params.targetCandidate || params.forcedTypePath || leadingUrlWithNotes) {
    privacy = {
      intent: "PUBLIC_ENTITY",
      isPrivate: false,
      reasoning: leadingUrlWithNotes ? "Explicit external URL capture" : "Explicit entity candidate capture",
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

    await attachToActiveBoardIfAny(save.id);

    return {
      status: "created",
      is_private_memo: true,
      entity_id: null,
      save,
      entity: null,
      candidate_fallbacks: [],
    };
  }

  // Apply board type context as default hint when user didn't pick an explicit type/candidate
  if (!effectiveForcedType && !params.targetCandidate && !leadingUrlWithNotes && boardTypePathPrefix) {
    if (boardTypePathPrefix.startsWith("/book") || boardTypePathPrefix.includes("/book")) {
      privacy.detectedType = "BOOK";
    } else if (boardTypePathPrefix.startsWith("/media")) {
      privacy.detectedType = "MEDIA";
    } else if (boardTypePathPrefix.startsWith("/place")) {
      privacy.detectedType = "PLACE";
    }
  } else if (!effectiveForcedType && !params.targetCandidate && !leadingUrlWithNotes && boardCoreTypeHint) {
    privacy.detectedType = boardCoreTypeHint.toUpperCase() as any;
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
    targetCandidate: params.targetCandidate,
  });

  if (localCacheHit.primary && !isUnenrichedStubEntity(localCacheHit.primary)) {
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

    const mergedHitNotes = [extractedCardData.personalNotes, trailingUrlNote]
      .filter(Boolean)
      .join("\n")
      .trim() || null;

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
        personalNotes: mergedHitNotes,
        enrichmentStatus: "ENRICHED",
        visibility: "PRIVATE",
      })
      .returning();

    await attachToActiveBoardIfAny(insertedSave.id);

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
      forcedTypePath: effectiveForcedType,
      targetCandidate: params.targetCandidate,
      locationHint: boardLocationHint,
      queryContext: params.queryContext,
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
    : (enrichment?.title || params.targetCandidate?.title || fallbackPrimary.title);
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

  const finalHeroImage = enrichment?.heroImageUrl || params.targetCandidate?.heroImageUrl || null;
  const finalPriceCents = enrichment?.priceCents ?? null;
  const finalExternalId = enrichment?.canonicalExternalId || null;
  const finalCreator = parsedQuote && finalTypePath === "/quote"
    ? parsedQuote.author
    : (enrichment?.brandOrCreator || params.targetCandidate?.creator || null);

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
  // LAYER 1.5: Canonical Identity Cache Check (or Self-Heal Stub from Layer 0)
  // =========================================================================
  let cachedEntity: GlobalEntity | null =
    localCacheHit.primary && isUnenrichedStubEntity(localCacheHit.primary)
      ? localCacheHit.primary
      : null;

  if (!cachedEntity && enrichment?.cachedEntityId) {
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
      const currentExtended = (cachedEntity.extendedAttributes as Record<string, unknown>) || {};
      const mergedExtended = {
        ...currentExtended,
        ...extractedCardData.objectiveAttributes,
      };
      const currentCoreData = (cachedEntity.coreStructuredData as Record<string, unknown>) || {};
      const mergedCoreData = {
        ...currentCoreData,
        ...(enrichment?.coreStructuredData || {}),
      };

      const wasStub = isUnenrichedStubEntity(cachedEntity);

      if (
        wasStub ||
        (cachedEntity.coreType === "PRODUCT" && finalCoreType !== "PRODUCT") ||
        ((cachedEntity.typePath === "/product/generic" || cachedEntity.typePath === "/product") &&
          finalTypePath !== "/product/generic" &&
          finalTypePath !== "/product") ||
        (!cachedEntity.heroImageUrl && finalHeroImage) ||
        Object.keys(extractedCardData.objectiveAttributes).length > 0
      ) {
        tx.update(globalEntities)
          .set({
            coreType: finalCoreType,
            typePath: finalTypePath,
            canonicalUrl: wasStub && finalCanonicalUrl ? finalCanonicalUrl : cachedEntity.canonicalUrl,
            brandOrCreator: finalCreator || cachedEntity.brandOrCreator,
            canonicalExternalId: finalExternalId || cachedEntity.canonicalExternalId,
            identityFingerprint: cachedEntity.identityFingerprint || identityFingerprint,
            heroImageUrl: finalHeroImage || cachedEntity.heroImageUrl,
            summary: finalSummary || cachedEntity.summary,
            coreStructuredData: mergedCoreData,
            extendedAttributes: mergedExtended,
          })
          .where(eq(globalEntities.id, cachedEntity.id))
          .run();

        cachedEntity.coreType = finalCoreType;
        cachedEntity.typePath = finalTypePath;
        cachedEntity.coreStructuredData = mergedCoreData;
        cachedEntity.extendedAttributes = mergedExtended;
        if (finalHeroImage && !cachedEntity.heroImageUrl) cachedEntity.heroImageUrl = finalHeroImage;
        if (finalCreator) cachedEntity.brandOrCreator = finalCreator;
      }

      const mergedCachedNotes = [extractedCardData.personalNotes, trailingUrlNote]
        .filter(Boolean)
        .join("\n")
        .trim() || null;

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
          personalNotes: mergedCachedNotes,
          enrichmentStatus: "ENRICHED",
          visibility: "PRIVATE",
        })
        .returning()
        .all();

      return insertedSave;
    });

    await attachToActiveBoardIfAny(save.id);

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

    const mergedNewNotes = [extractedCardData.personalNotes, trailingUrlNote]
      .filter(Boolean)
      .join("\n")
      .trim() || null;

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
        personalNotes: mergedNewNotes,
        enrichmentStatus: "ENRICHED",
        visibility: "PRIVATE",
      })
      .returning()
      .all();

    return { newEntity: insertedEntity, save: insertedSave };
  });

  await attachToActiveBoardIfAny(save.id);

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
