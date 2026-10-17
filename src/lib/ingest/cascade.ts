import { createHash } from "crypto";
import { db, users, globalEntities, userSaves, entitySources, type User, type GlobalEntity, type UserSave } from "@/db";
import { eq, or } from "drizzle-orm";
import { classifyPrivacyAndModality, type PrivacyClassificationResult } from "../router/privacy";
import type { CandidateFallback } from "./disambiguation";
import { enrichCaptureInput } from "../enrichment/dispatcher";

export interface IngestionResult {
  status: "created" | "existing";
  is_private_memo: boolean;
  entity_id: string | null;
  save: UserSave;
  entity: GlobalEntity | null;
  candidate_fallbacks?: CandidateFallback[];
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
      email: "carlos@curio.local",
      username: "carlosgmt",
      displayName: "Carlos",
      isPro: true,
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
  detectedType?: string
): Promise<{ primary: CandidateFallback; runnerUps: CandidateFallback[] }> {
  const trimmed = query.trim();

  // If Tavily API Key is available, use live search
  if (process.env.TAVILY_API_KEY) {
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

export async function executeIngestionCascade(params: {
  input: string;
  userId?: string;
  customSchemaId?: string;
  skipLocalLlm?: boolean;
}): Promise<IngestionResult> {
  const { input } = params;
  const user = params.userId
    ? (await db.select().from(users).where(eq(users.id, params.userId)).limit(1))[0]
    : await getOrCreateDefaultUser();

  if (!user) {
    throw new Error("Unable to identify or create user profile");
  }

  // STEP 0: Privacy & Modality Router
  const privacy = await classifyPrivacyAndModality(input, {
    skipLocalLlm: params.skipLocalLlm,
  });

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

  // INVERTED CASCADE: Run live external metadata enrichment first
  const query = privacy.extractedQuery || input;
  let enrichment;
  try {
    enrichment = await enrichCaptureInput(query, {
      detectedType: privacy.detectedType,
    });
  } catch {
    enrichment = null;
  }

  // Discover candidate fallbacks for disambiguation bar (FR-2.3)
  const { primary: fallbackPrimary, runnerUps } = await discoverCandidates(query, privacy.detectedType);

  const finalTitle = enrichment?.title || fallbackPrimary.title;
  const finalCanonicalUrl = enrichment?.canonicalUrl || fallbackPrimary.url;
  const finalSummary = enrichment?.summary || fallbackPrimary.snippet;
  const finalCoreType = enrichment?.coreType || fallbackPrimary.coreType;
  const finalTypePath = enrichment?.typePath || (finalCoreType === "BOOK" ? "/product/book" : "/product/generic");
  const finalHeroImage = enrichment?.heroImageUrl || null;
  const finalPriceCents = enrichment?.priceCents ?? null;
  const finalExternalId = enrichment?.canonicalExternalId || null;
  const finalCreator = enrichment?.brandOrCreator || null;

  // Compute canonical identity keys from the real canonical URL and real title
  const { urlHash, entityKey } = generateEntityKey(finalCanonicalUrl, finalTitle);

  // STEP 1: Global Entity Cache Check
  const [cachedEntity] = await db
    .select()
    .from(globalEntities)
    .where(
      or(
        eq(globalEntities.canonicalUrl, finalCanonicalUrl),
        eq(globalEntities.urlHash, urlHash),
        finalExternalId
          ? eq(globalEntities.canonicalExternalId, finalExternalId)
          : eq(globalEntities.entityKey, entityKey)
      )
    )
    .limit(1);

  if (cachedEntity) {
    const save = db.transaction((tx) => {
      // If cached entity was a generic product but live enrichment discovered a specific cultural type
      if (
        (cachedEntity.coreType === "PRODUCT" && finalCoreType !== "PRODUCT") ||
        (cachedEntity.typePath === "/product/generic" && finalTypePath !== "/product/generic")
      ) {
        tx.update(globalEntities)
          .set({
            coreType: finalCoreType,
            typePath: finalTypePath,
            brandOrCreator: finalCreator || cachedEntity.brandOrCreator,
            canonicalExternalId: finalExternalId || cachedEntity.canonicalExternalId,
            heroImageUrl: finalHeroImage || cachedEntity.heroImageUrl,
            summary: finalSummary || cachedEntity.summary,
          })
          .where(eq(globalEntities.id, cachedEntity.id))
          .run();

        cachedEntity.coreType = finalCoreType;
        cachedEntity.typePath = finalTypePath;
        if (finalCreator) cachedEntity.brandOrCreator = finalCreator;
      }

      // Cache HIT! Link save at $0.00 compute atomically
      const [insertedSave] = tx
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: cachedEntity.id,
          typePath: cachedEntity.typePath,
          isPrivateMemo: false,
          candidateFallbacks: runnerUps,
          autoTags: [cachedEntity.coreType.toLowerCase()],
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

  // STEP 2: CACHE MISS — Insert new global entity, source, and save atomically
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
        brandOrCreator: finalCreator,
        title: finalTitle,
        summary: finalSummary,
        heroImageUrl: finalHeroImage,
        coreStructuredData: {
          rawQuery: input,
          extractedAt: new Date().toISOString(),
          provenance: finalCanonicalUrl,
          ...(enrichment?.coreStructuredData || {}),
        },
        extendedAttributes: {},
        priceCents: finalPriceCents,
        currency: enrichment?.currency || "USD",
        priceVerifiedAt: finalPriceCents ? new Date().toISOString() : null,
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
    }

    const [insertedSave] = tx
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: insertedEntity.id,
        typePath: finalTypePath,
        preferredSourceId,
        isPrivateMemo: false,
        candidateFallbacks: runnerUps,
        autoTags: [insertedEntity.coreType.toLowerCase(), finalTypePath.split("/").pop() || "captured"],
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
