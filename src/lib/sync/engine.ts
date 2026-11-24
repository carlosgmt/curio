import crypto from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  entityPriceHistory,
  entitySources,
  entryConnections,
  globalEntities,
  listItems,
  smartLists,
  userSaves,
  type GlobalEntity,
  type SmartList,
  type UserSave,
} from "@/db";
import {
  createList,
  type AutoRulesConfig,
  type SmartListLayoutMode,
} from "@/lib/lists/service";

export type SyncSourceId =
  | "closet"
  | "purchase-hub"
  | "letterboxd"
  | "goodreads"
  | (string & {});

export type SyncFetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface SyncBoardTarget {
  rootSlug: string;
  rootTitle: string;
  rootDescription?: string;
  rootDefaultLayout?: SmartListLayoutMode | null;
  subSlug?: string | null;
  subTitle?: string | null;
  subDescription?: string | null;
  subDefaultLayout?: SmartListLayoutMode | null;
  sectionHeader?: string | null;
  autoRules?: AutoRulesConfig | null;
}

export interface SyncRecord {
  externalId: string;
  entityKey: string;
  canonicalExternalId?: string | null;
  canonicalUrl: string;
  coreType: string;
  typePath: string;
  title: string;
  brandOrCreator?: string | null;
  modelNumber?: string | null;
  summary?: string | null;
  heroImageUrl?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  wishlist?: boolean;
  tags?: string[];
  personalNotes?: string | null;
  coreStructuredData?: Record<string, unknown>;
  extendedAttributes?: Record<string, unknown>;
  sourceLink?: {
    sellerName: string;
    sourceUrl: string;
    priceCents?: number | null;
    currency?: string | null;
  } | null;
  boards: SyncBoardTarget[];
}

export interface SyncRelation {
  sourceEntityKey: string;
  targetEntityKey: string;
  connectionType: string;
  contextNote?: string | null;
  isBidirectional?: boolean;
}

export interface SyncSnapshot {
  digest: string;
  records: SyncRecord[];
  relations?: SyncRelation[];
  meta?: Record<string, unknown>;
}

export interface SyncRunResult {
  sourceId: SyncSourceId;
  synced: boolean;
  skippedReason?: string;
  recordsProcessed: number;
  createdSaves: number;
  updatedSaves: number;
  promotedFromWishlist: number;
  prunedSaves: number;
  prunedEntities: number;
  connectionsSynced: number;
  boardsCreated: number;
  digest: string;
  syncedAt: string;
  meta?: Record<string, unknown>;
}

export interface SyncOptions {
  force?: boolean;
  ifStaleMs?: number;
  fetchFn?: SyncFetchFn;
  [key: string]: unknown;
}

export interface SyncAdapter<TOptions extends SyncOptions = SyncOptions> {
  readonly sourceId: SyncSourceId;
  readonly displayName: string;
  readonly supportsWishlistPromotion?: boolean;
  readonly supportsPruning?: boolean;
  readonly keyPrefix?: string;
  getStatus?: (userId: string) => Promise<Record<string, unknown>> | Record<string, unknown>;
  fetchSnapshot?: (userId: string, options?: TOptions) => Promise<SyncSnapshot>;
  run?: (userId: string, options?: TOptions) => Promise<SyncRunResult>;
}

interface CacheEntry {
  digest: string;
  syncedAtMs: number;
  lastResult: SyncRunResult;
}

const adapterSyncCache = new Map<string, CacheEntry>();

function cacheKey(sourceId: string, userId: string): string {
  return `${sourceId}:${userId}`;
}

export function clearAdapterSyncCache(sourceId?: string, userId?: string): void {
  if (!sourceId) {
    adapterSyncCache.clear();
    return;
  }
  if (userId) {
    adapterSyncCache.delete(cacheKey(sourceId, userId));
    return;
  }
  for (const key of adapterSyncCache.keys()) {
    if (key.startsWith(`${sourceId}:`)) {
      adapterSyncCache.delete(key);
    }
  }
}

export function getAdapterSyncCacheEntry(
  sourceId: string,
  userId: string
): { digest: string | null; lastSyncedAt: string | null; lastResult: SyncRunResult | null } {
  const entry = adapterSyncCache.get(cacheKey(sourceId, userId));
  return {
    digest: entry?.digest ?? null,
    lastSyncedAt: entry ? new Date(entry.syncedAtMs).toISOString() : null,
    lastResult: entry?.lastResult ?? null,
  };
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function normalizeUrlForMatch(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    const params = new URLSearchParams(u.search);
    for (const k of [...params.keys()]) {
      if (/^(?:utm_|fbclid|gclid|ref|tag|mc_)/i.test(k)) {
        params.delete(k);
      }
    }
    const qs = params.toString();
    const pathClean = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.hostname.replace(/^www\./i, "").toLowerCase()}${pathClean}${qs ? `?${qs}` : ""}`;
  } catch {
    return null;
  }
}

const MATCH_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "de",
  "la",
  "el",
  "en",
  "con",
  "para",
  "edition",
  "Edition",
]);

export function normalizeMatchText(raw?: string | null): string {
  if (!raw) return "";
  return String(raw)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function significantTokens(raw?: string | null): string[] {
  return normalizeMatchText(raw)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !MATCH_STOPWORDS.has(t));
}

export function computeTokenSimilarity(a?: string | null, b?: string | null): number {
  const normA = normalizeMatchText(a);
  const normB = normalizeMatchText(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const toksA = significantTokens(a);
  const toksB = significantTokens(b);
  if (toksA.length === 0 || toksB.length === 0) return 0;

  const setA = new Set(toksA);
  const setB = new Set(toksB);
  let overlap = 0;
  for (const t of setA) {
    if (setB.has(t)) overlap++;
  }
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union > 0 ? overlap / union : 0;
  const minContain = overlap / Math.min(setA.size, setB.size);

  if (Math.min(setA.size, setB.size) >= 2 && minContain === 1.0) {
    return Math.max(jaccard, 0.86);
  }
  return jaccard;
}

export interface WishlistCandidate {
  save: UserSave;
  entity: GlobalEntity | null;
  sourceUrls: string[];
}

export interface WishlistMatchResult {
  candidate: WishlistCandidate;
  reason: "url" | "brand_model" | "title";
  score: number;
}

export function findBestWishlistMatch(
  record: SyncRecord,
  candidates: WishlistCandidate[]
): WishlistMatchResult | null {
  if (candidates.length === 0) return null;

  const recUrls = new Set(
    [normalizeUrlForMatch(record.canonicalUrl), normalizeUrlForMatch(record.sourceLink?.sourceUrl)].filter(
      (u): u is string => Boolean(u)
    )
  );
  const recBrand = normalizeMatchText(record.brandOrCreator);
  const recModel = normalizeMatchText(record.modelNumber);
  const recTitleNorm = normalizeMatchText(record.title);

  let best: WishlistMatchResult | null = null;

  for (const cand of candidates) {
    if (!cand.save.wishlist) continue;

    // 1. Exact normalized URL match
    if (recUrls.size > 0) {
      const candUrls = [
        normalizeUrlForMatch(cand.entity?.canonicalUrl),
        ...cand.sourceUrls.map((s) => normalizeUrlForMatch(s)),
      ].filter((u): u is string => Boolean(u));
      if (candUrls.some((u) => recUrls.has(u))) {
        return { candidate: cand, reason: "url", score: 1.0 };
      }
    }

    // 2. Exact Brand + Model Number match
    const candBrand = normalizeMatchText(cand.entity?.brandOrCreator);
    const ext = (cand.entity?.extendedAttributes || {}) as Record<string, unknown>;
    const csd = (cand.entity?.coreStructuredData || {}) as Record<string, unknown>;
    const candModel = normalizeMatchText(
      String(ext.modelNumber || ext.model || csd.model || csd.sku || "")
    );
    const candTitleNorm = normalizeMatchText(cand.save.privateTitle || cand.entity?.title);

    if (
      recBrand &&
      recModel &&
      recModel.length >= 3 &&
      candBrand === recBrand &&
      (candModel === recModel || candTitleNorm.includes(recModel))
    ) {
      return { candidate: cand, reason: "brand_model", score: 0.96 };
    }

    // 3. Normalized Title similarity (higher tolerance if brand also matches)
    const candTitles = [cand.save.privateTitle, cand.entity?.title].filter(
      (t): t is string => Boolean(t && t.trim())
    );
    for (const ct of candTitles) {
      const ctNorm = normalizeMatchText(ct);
      let sim = computeTokenSimilarity(record.title, ct);
      const candWithoutBrand =
        candBrand && ctNorm.startsWith(`${candBrand} `)
          ? ctNorm.slice(candBrand.length).trim()
          : ctNorm;
      const recWithoutBrand =
        recBrand && recTitleNorm.startsWith(`${recBrand} `)
          ? recTitleNorm.slice(recBrand.length).trim()
          : recTitleNorm;
      if (candWithoutBrand && recWithoutBrand) {
        sim = Math.max(sim, computeTokenSimilarity(recWithoutBrand, candWithoutBrand));
      }

      const tokenCount = Math.min(
        significantTokens(record.title).length,
        significantTokens(ct).length
      );
      const threshold = recBrand && candBrand && recBrand === candBrand ? 0.72 : 0.82;
      const passes =
        ctNorm === recTitleNorm || (tokenCount >= 2 && sim >= threshold);
      if (passes && (!best || sim > best.score)) {
        best = { candidate: cand, reason: "title", score: sim };
      }
    }
  }

  return best;
}

async function ensureBoardNode(
  userId: string,
  params: {
    preferredSlug: string;
    title: string;
    description?: string;
    parentId?: string | null;
    defaultLayout?: SmartListLayoutMode | null;
    autoRules?: AutoRulesConfig | null;
  }
): Promise<{ board: SmartList; created: boolean }> {
  const cleanTitle = params.title.trim();
  const [bySlug] = await db
    .select()
    .from(smartLists)
    .where(and(eq(smartLists.userId, userId), eq(smartLists.slug, params.preferredSlug)))
    .limit(1);
  if (bySlug) {
    if (params.defaultLayout && !bySlug.defaultLayout) {
      await db
        .update(smartLists)
        .set({ defaultLayout: params.defaultLayout })
        .where(eq(smartLists.id, bySlug.id));
      bySlug.defaultLayout = params.defaultLayout;
    }
    return { board: bySlug, created: false };
  }

  const [byTitle] = await db
    .select()
    .from(smartLists)
    .where(
      and(
        eq(smartLists.userId, userId),
        params.parentId ? eq(smartLists.parentId, params.parentId) : isNull(smartLists.parentId),
        sql`LOWER(${smartLists.title}) = LOWER(${cleanTitle})`
      )
    )
    .limit(1);
  if (byTitle) {
    if (params.defaultLayout && !byTitle.defaultLayout) {
      await db
        .update(smartLists)
        .set({ defaultLayout: params.defaultLayout })
        .where(eq(smartLists.id, byTitle.id));
      byTitle.defaultLayout = params.defaultLayout;
    }
    return { board: byTitle, created: false };
  }

  const [slugTakenElsewhere] = await db
    .select({ id: smartLists.id })
    .from(smartLists)
    .where(eq(smartLists.slug, params.preferredSlug))
    .limit(1);

  const createdBoard = await createList(userId, {
    title: cleanTitle,
    slug: slugTakenElsewhere ? undefined : params.preferredSlug,
    description: params.description,
    parentId: params.parentId ?? null,
    visibility: "PRIVATE",
    autoRules: params.autoRules ?? undefined,
    defaultLayout: params.defaultLayout ?? undefined,
  });
  return { board: createdBoard, created: true };
}

export async function ensureHierarchicalBoard(
  userId: string,
  target: SyncBoardTarget
): Promise<{ listId: string; rootId: string; createdCount: number }> {
  let createdCount = 0;
  const rootRes = await ensureBoardNode(userId, {
    preferredSlug: target.rootSlug,
    title: target.rootTitle,
    description: target.rootDescription ?? undefined,
    parentId: null,
    defaultLayout: target.rootDefaultLayout,
    autoRules: target.subSlug ? null : target.autoRules,
  });
  if (rootRes.created) createdCount++;

  if (!target.subSlug || !target.subTitle) {
    return { listId: rootRes.board.id, rootId: rootRes.board.id, createdCount };
  }

  const subRes = await ensureBoardNode(userId, {
    preferredSlug: target.subSlug,
    title: target.subTitle,
    description: target.subDescription ?? undefined,
    parentId: rootRes.board.id,
    defaultLayout: target.subDefaultLayout ?? target.rootDefaultLayout ?? null,
    autoRules: target.autoRules ?? null,
  });
  if (subRes.created) createdCount++;

  return { listId: subRes.board.id, rootId: rootRes.board.id, createdCount };
}

function mergeTags(existing?: string[] | null, incoming?: string[] | null): string[] {
  const seen = new Map<string, string>();
  for (const t of [...(existing || []), ...(incoming || [])]) {
    const clean = String(t || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) seen.set(key, clean);
  }
  return [...seen.values()];
}

export async function runSyncAdapter<TOptions extends SyncOptions>(
  userId: string,
  adapter: SyncAdapter<TOptions>,
  options?: TOptions
): Promise<SyncRunResult> {
  if (adapter.run) {
    return adapter.run(userId, options);
  }
  if (!adapter.fetchSnapshot) {
    throw new Error(`SyncAdapter '${adapter.sourceId}' implements neither fetchSnapshot nor run`);
  }

  const nowMs = Date.now();
  const cKey = cacheKey(adapter.sourceId, userId);
  const cached = adapterSyncCache.get(cKey);

  if (!options?.force && options?.ifStaleMs && cached && nowMs - cached.syncedAtMs < options.ifStaleMs) {
    return {
      ...cached.lastResult,
      synced: false,
      skippedReason: "fresh_within_ttl",
    };
  }

  const snapshot = await adapter.fetchSnapshot(userId, options);
  if (!options?.force && cached && cached.digest === snapshot.digest) {
    cached.syncedAtMs = nowMs;
    return {
      ...cached.lastResult,
      synced: false,
      skippedReason: "unchanged_digest",
    };
  }

  // Ensure all destination hierarchical boards exist before transaction
  const boardIdByKey = new Map<string, string>();
  let boardsCreated = 0;
  for (const rec of snapshot.records) {
    for (const target of rec.boards) {
      const bKey = `${target.rootSlug}::${target.subSlug || ""}`;
      if (!boardIdByKey.has(bKey)) {
        const res = await ensureHierarchicalBoard(userId, target);
        boardIdByKey.set(bKey, res.listId);
        boardsCreated += res.createdCount;
      }
    }
  }

  const txStats = db.transaction((tx) => {
    const existingRows = tx
      .select({ save: userSaves, entity: globalEntities })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.userId, userId))
      .all();

    const entityIds = existingRows
      .map((r) => r.entity?.id)
      .filter((id): id is string => Boolean(id));
    const sourceUrlsByEntityId = new Map<string, string[]>();
    if (entityIds.length > 0) {
      const srcRows = tx
        .select({ entityId: entitySources.entityId, sourceUrl: entitySources.sourceUrl })
        .from(entitySources)
        .where(inArray(entitySources.entityId, entityIds))
        .all();
      for (const s of srcRows) {
        const arr = sourceUrlsByEntityId.get(s.entityId) || [];
        arr.push(s.sourceUrl);
        sourceUrlsByEntityId.set(s.entityId, arr);
      }
    }

    const saveByEntityId = new Map<string, UserSave>();
    const saveByEntityKey = new Map<string, { save: UserSave; entity: GlobalEntity }>();
    const wishlistPool: WishlistCandidate[] = [];

    for (const r of existingRows) {
      if (r.save.entityId) saveByEntityId.set(r.save.entityId, r.save);
      if (r.entity) {
        saveByEntityKey.set(r.entity.entityKey, { save: r.save, entity: r.entity });
        if (r.entity.canonicalExternalId) {
          saveByEntityKey.set(r.entity.canonicalExternalId, { save: r.save, entity: r.entity });
        }
      }
      if (r.save.wishlist) {
        wishlistPool.push({
          save: r.save,
          entity: r.entity,
          sourceUrls: r.entity ? sourceUrlsByEntityId.get(r.entity.id) || [] : [],
        });
      }
    }

    const targetListIds = [...new Set(boardIdByKey.values())];
    const listMembershipMap = new Map<string, { id: string; sectionHeader: string | null }>();
    const maxPosByListId = new Map<string, number>();
    if (targetListIds.length > 0) {
      const existingItems = tx
        .select()
        .from(listItems)
        .where(inArray(listItems.listId, targetListIds))
        .all();
      for (const li of existingItems) {
        listMembershipMap.set(`${li.listId}:${li.saveId}`, {
          id: li.id,
          sectionHeader: li.sectionHeader,
        });
        const curMax = maxPosByListId.get(li.listId) ?? -1;
        if (li.positionIndex > curMax) maxPosByListId.set(li.listId, li.positionIndex);
      }
    }

    const liveEntityKeys = new Set<string>();
    const saveIdByRecordKey = new Map<string, string>();
    let createdSaves = 0;
    let updatedSaves = 0;
    let promotedFromWishlist = 0;
    let prunedSaves = 0;
    let prunedEntities = 0;

    for (const rec of snapshot.records) {
      liveEntityKeys.add(rec.entityKey);
      const extKey = rec.canonicalExternalId || rec.entityKey;
      liveEntityKeys.add(extKey);

      const urlHash = sha256Hex(rec.canonicalUrl);
      const mergedStruct = rec.coreStructuredData || {};
      const mergedExtAttr = rec.extendedAttributes || {};

      let resolvedSaveId: string | null = null;
      let resolvedEntityId: string | null = null;

      // Check existing user save by entityKey or canonicalExternalId
      const existingMatch =
        saveByEntityKey.get(rec.entityKey) || saveByEntityKey.get(extKey);

      if (existingMatch) {
        const { save, entity } = existingMatch;
        resolvedSaveId = save.id;
        resolvedEntityId = entity.id;

        const existingExt =
          entity.extendedAttributes && typeof entity.extendedAttributes === "object"
            ? (entity.extendedAttributes as Record<string, unknown>)
            : {};
        const existingStruct =
          entity.coreStructuredData && typeof entity.coreStructuredData === "object"
            ? (entity.coreStructuredData as Record<string, unknown>)
            : {};

        tx.update(globalEntities)
          .set({
            title: rec.title,
            summary: rec.summary ?? entity.summary,
            heroImageUrl: rec.heroImageUrl || entity.heroImageUrl,
            brandOrCreator: rec.brandOrCreator ?? entity.brandOrCreator,
            coreType: rec.coreType,
            typePath: rec.typePath,
            priceCents: rec.priceCents ?? entity.priceCents,
            currency: rec.currency ?? entity.currency,
            canonicalExternalId: extKey,
            coreStructuredData: { ...existingStruct, ...mergedStruct },
            extendedAttributes: { ...existingExt, ...mergedExtAttr },
            updatedAt: new Date(nowMs).toISOString(),
          })
          .where(eq(globalEntities.id, entity.id))
          .run();

        const nextTags = mergeTags(save.autoTags, rec.tags);
        const promotedNow = Boolean(save.wishlist && !rec.wishlist);
        tx.update(userSaves)
          .set({
            typePath: rec.typePath,
            autoTags: nextTags,
            wishlist: promotedNow ? false : rec.wishlist ?? save.wishlist,
            hasConvertedPurchase: promotedNow ? true : save.hasConvertedPurchase,
            personalNotes:
              save.personalNotes && save.personalNotes.trim()
                ? save.personalNotes
                : rec.personalNotes ?? save.personalNotes,
          })
          .where(eq(userSaves.id, save.id))
          .run();

        if (promotedNow) promotedFromWishlist++;
        else updatedSaves++;
      } else {
        // Attempt Wishlist -> Owned match before creating a duplicate save
        const wlMatch =
          adapter.supportsWishlistPromotion && !rec.wishlist
            ? findBestWishlistMatch(rec, wishlistPool)
            : null;

        if (wlMatch) {
          const { save, entity } = wlMatch.candidate;
          const idx = wishlistPool.indexOf(wlMatch.candidate);
          if (idx >= 0) wishlistPool.splice(idx, 1);

          resolvedSaveId = save.id;
          resolvedEntityId = entity?.id ?? null;

          if (entity) {
            const existingExt =
              entity.extendedAttributes && typeof entity.extendedAttributes === "object"
                ? (entity.extendedAttributes as Record<string, unknown>)
                : {};
            const existingStruct =
              entity.coreStructuredData && typeof entity.coreStructuredData === "object"
                ? (entity.coreStructuredData as Record<string, unknown>)
                : {};
            tx.update(globalEntities)
              .set({
                canonicalExternalId: extKey,
                priceCents: rec.priceCents ?? entity.priceCents,
                currency: rec.currency ?? entity.currency,
                heroImageUrl: rec.heroImageUrl || entity.heroImageUrl,
                brandOrCreator: entity.brandOrCreator || rec.brandOrCreator || null,
                coreStructuredData: { ...existingStruct, ...mergedStruct },
                extendedAttributes: {
                  ...existingExt,
                  ...mergedExtAttr,
                  promotedFromWishlistReason: wlMatch.reason,
                },
                updatedAt: new Date(nowMs).toISOString(),
              })
              .where(eq(globalEntities.id, entity.id))
              .run();
          }

          tx.update(userSaves)
            .set({
              wishlist: false,
              hasConvertedPurchase: true,
              typePath: rec.typePath || save.typePath,
              autoTags: mergeTags(save.autoTags, rec.tags),
            })
            .where(eq(userSaves.id, save.id))
            .run();

          promotedFromWishlist++;
        } else {
          // Upsert global entity + new user save
          let [entity] = tx
            .select()
            .from(globalEntities)
            .where(eq(globalEntities.entityKey, rec.entityKey))
            .all();

          if (!entity) {
            [entity] = tx
              .insert(globalEntities)
              .values({
                urlHash,
                entityKey: rec.entityKey,
                canonicalExternalId: extKey,
                canonicalUrl: rec.canonicalUrl,
                coreType: rec.coreType,
                typePath: rec.typePath,
                title: rec.title,
                brandOrCreator: rec.brandOrCreator ?? null,
                summary: rec.summary ?? null,
                heroImageUrl: rec.heroImageUrl ?? null,
                priceCents: rec.priceCents ?? null,
                currency: rec.currency ?? "CHF",
                coreStructuredData: mergedStruct,
                extendedAttributes: mergedExtAttr,
              })
              .returning()
              .all();
          }
          resolvedEntityId = entity.id;

          let save = saveByEntityId.get(entity.id);
          if (!save) {
            [save] = tx
              .insert(userSaves)
              .values({
                userId,
                entityId: entity.id,
                typePath: rec.typePath,
                isPrivateMemo: false,
                wishlist: Boolean(rec.wishlist),
                hasConvertedPurchase: !rec.wishlist,
                personalNotes: rec.personalNotes ?? null,
                autoTags: mergeTags([], rec.tags),
                visibility: "PRIVATE",
                enrichmentStatus: "ENRICHED",
              })
              .returning()
              .all();
            saveByEntityId.set(entity.id, save);
            createdSaves++;
          } else {
            updatedSaves++;
          }
          resolvedSaveId = save.id;
          saveByEntityKey.set(rec.entityKey, { save, entity });
        }
      }

      if (resolvedEntityId && rec.sourceLink?.sourceUrl) {
        const srcHash = sha256Hex(rec.sourceLink.sourceUrl);
        const [existingSource] = tx
          .select({ id: entitySources.id })
          .from(entitySources)
          .where(
            and(
              eq(entitySources.entityId, resolvedEntityId),
              eq(entitySources.urlHash, srcHash)
            )
          )
          .all();
        if (!existingSource) {
          tx.insert(entitySources)
            .values({
              entityId: resolvedEntityId,
              sellerName: rec.sourceLink.sellerName,
              sourceUrl: rec.sourceLink.sourceUrl,
              urlHash: srcHash,
              priceCents: rec.sourceLink.priceCents ?? rec.priceCents ?? null,
              currency: rec.sourceLink.currency ?? rec.currency ?? "CHF",
            })
            .run();
        }
      }

      if (resolvedSaveId) {
        saveIdByRecordKey.set(rec.entityKey, resolvedSaveId);
        if (rec.canonicalExternalId) {
          saveIdByRecordKey.set(rec.canonicalExternalId, resolvedSaveId);
        }

        for (const target of rec.boards) {
          const listId = boardIdByKey.get(`${target.rootSlug}::${target.subSlug || ""}`);
          if (!listId) continue;
          const memKey = `${listId}:${resolvedSaveId}`;
          const existingMem = listMembershipMap.get(memKey);
          const nextSection = target.sectionHeader ?? null;
          if (existingMem) {
            if (existingMem.sectionHeader !== nextSection) {
              tx.update(listItems)
                .set({ sectionHeader: nextSection })
                .where(eq(listItems.id, existingMem.id))
                .run();
              existingMem.sectionHeader = nextSection;
            }
          } else {
            const nextPos = (maxPosByListId.get(listId) ?? -1) + 1;
            maxPosByListId.set(listId, nextPos);
            const [insertedLi] = tx
              .insert(listItems)
              .values({
                listId,
                saveId: resolvedSaveId,
                positionIndex: nextPos,
                sectionHeader: nextSection,
              })
              .returning()
              .all();
            listMembershipMap.set(memKey, {
              id: insertedLi.id,
              sectionHeader: nextSection,
            });
          }
        }
      }
    }

    // Prune saves owned by this adapter prefix that disappeared upstream
    if (adapter.supportsPruning && adapter.keyPrefix) {
      for (const r of existingRows) {
        if (!r.entity || r.save.isPrivateMemo) continue;
        const ek = r.entity.entityKey;
        const ext = r.entity.canonicalExternalId || "";
        const belongsToAdapter =
          ek.startsWith(adapter.keyPrefix) || ext.startsWith(adapter.keyPrefix);
        if (!belongsToAdapter) continue;
        if (liveEntityKeys.has(ek) || (ext && liveEntityKeys.has(ext))) continue;

        tx.delete(listItems).where(eq(listItems.saveId, r.save.id)).run();
        tx.delete(entryConnections)
          .where(
            and(
              eq(entryConnections.userId, userId),
              sql`(${entryConnections.sourceSaveId} = ${r.save.id} OR ${entryConnections.targetSaveId} = ${r.save.id})`
            )
          )
          .run();
        tx.delete(userSaves).where(eq(userSaves.id, r.save.id)).run();
        prunedSaves++;

        const [remaining] = tx
          .select({ id: userSaves.id })
          .from(userSaves)
          .where(eq(userSaves.entityId, r.entity.id))
          .all();
        if (!remaining) {
          tx.delete(entityPriceHistory).where(eq(entityPriceHistory.entityId, r.entity.id)).run();
          tx.delete(entitySources).where(eq(entitySources.entityId, r.entity.id)).run();
          tx.delete(globalEntities).where(eq(globalEntities.id, r.entity.id)).run();
          prunedEntities++;
        }
      }
    }

    // Reconcile relations idempotently
    let connectionsSynced = 0;
    if (snapshot.relations && snapshot.relations.length > 0) {
      const currentConnections = tx
        .select({
          sourceSaveId: entryConnections.sourceSaveId,
          targetSaveId: entryConnections.targetSaveId,
          connectionType: entryConnections.connectionType,
        })
        .from(entryConnections)
        .where(eq(entryConnections.userId, userId))
        .all();

      const edgeSet = new Set(
        currentConnections.map(
          (c) => `${c.sourceSaveId}:${c.targetSaveId}:${c.connectionType}`
        )
      );

      for (const rel of snapshot.relations) {
        const sId = saveIdByRecordKey.get(rel.sourceEntityKey);
        const tId = saveIdByRecordKey.get(rel.targetEntityKey);
        if (!sId || !tId || sId === tId) continue;
        const k1 = `${sId}:${tId}:${rel.connectionType}`;
        const k2 = `${tId}:${sId}:${rel.connectionType}`;
        if (edgeSet.has(k1) || edgeSet.has(k2)) continue;
        tx.insert(entryConnections)
          .values({
            userId,
            sourceSaveId: sId,
            targetSaveId: tId,
            connectionType: rel.connectionType,
            contextNote: rel.contextNote ?? null,
            isBidirectional: rel.isBidirectional ?? true,
          })
          .run();
        edgeSet.add(k1);
        connectionsSynced++;
      }
    }

    return {
      createdSaves,
      updatedSaves,
      promotedFromWishlist,
      prunedSaves,
      prunedEntities,
      connectionsSynced,
    };
  });

  const result: SyncRunResult = {
    sourceId: adapter.sourceId,
    synced: true,
    recordsProcessed: snapshot.records.length,
    createdSaves: txStats.createdSaves,
    updatedSaves: txStats.updatedSaves,
    promotedFromWishlist: txStats.promotedFromWishlist,
    prunedSaves: txStats.prunedSaves,
    prunedEntities: txStats.prunedEntities,
    connectionsSynced: txStats.connectionsSynced,
    boardsCreated,
    digest: snapshot.digest,
    syncedAt: new Date(nowMs).toISOString(),
    meta: snapshot.meta,
  };

  adapterSyncCache.set(cKey, {
    digest: snapshot.digest,
    syncedAtMs: nowMs,
    lastResult: result,
  });

  return result;
}
