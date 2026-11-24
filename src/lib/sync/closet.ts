import crypto from "node:crypto";
import path from "node:path";
import {
  db,
  globalEntities,
  entitySources,
  entityPriceHistory,
  userSaves,
  smartLists,
  listItems,
  entryConnections,
} from "@/db";
import { and, eq, or } from "drizzle-orm";
import { createList } from "@/lib/lists/service";

export interface ClosetGarmentPayload {
  id: number;
  name?: string | null;
  type?: string | null;
  subtype?: string | null;
  color?: string | null;
  pattern?: string | null;
  material?: string | null;
  brand?: string | null;
  style?: string | null;
  season?: string | null;
  size?: string | null;
  is_waterproof?: number | boolean | null;
  purchase_date?: string | null;
  price?: number | null;
  currency?: string | null;
  source_url?: string | null;
  notes?: string | null;
  is_favorite?: number | boolean | null;
  is_retired?: number | boolean | null;
  in_laundry?: number | boolean | null;
  wear_count?: number | null;
  times_worn?: number | null;
  last_worn?: string | null;
  cost_per_wear?: number | null;
  image?: string | null;
  cutout?: string | null;
  photo_path?: string | null;
  cutout_path?: string | null;
  updated_at?: string | null;
}

export interface ClosetOutfitItemPayload {
  id: number;
  name?: string | null;
  type?: string | null;
  subtype?: string | null;
  color?: string | null;
  brand?: string | null;
  image?: string | null;
  cutout?: string | null;
  image_url?: string | null;
  cutout_url?: string | null;
}

export interface ClosetOutfitPayload {
  id: number;
  date?: string | null;
  name?: string | null;
  kind?: string | null;
  occasion?: string | null;
  weather?: string | null;
  temp_c?: number | null;
  location?: string | null;
  notes?: string | null;
  cover_path?: string | null;
  photo_path?: string | null;
  items?: ClosetOutfitItemPayload[] | null;
}

export interface ClosetSyncResult {
  synced: boolean;
  skippedReason?: string;
  garmentsSynced: number;
  outfitsSynced: number;
  prunedSaves: number;
  prunedEntities: number;
  connectionsSynced: number;
  syncedAt: string;
  digest: string;
}

interface UserSyncCacheEntry {
  digest: string;
  syncedAtMs: number;
  lastResult: ClosetSyncResult;
}

const syncStateByUser = new Map<string, UserSyncCacheEntry>();

export function getClosetApiBaseUrl(): string {
  return (process.env.CLOSET_API_URL || "http://127.0.0.1:8710").replace(/\/+$/, "");
}

function sha256(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function cleanClosetGarmentName(raw?: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const looksLikeFilename =
    /\.(?:png|jpe?g|webp|heic|avif)$/i.test(trimmed) ||
    /^(?:img|dsc|pxl|photo|image)[_-]?\d+/i.test(trimmed) ||
    (trimmed.includes("_") && !trimmed.includes(" "));
  if (!looksLikeFilename) return trimmed;
  const cleaned = trimmed
    .replace(/\.(?:png|jpe?g|webp|heic|avif)$/i, "")
    .replace(/^(?:img|dsc|pxl|photo|image)[_-]?\d+[_-]*/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

function toCurioClosetMediaUrl(
  bucket: "garments" | "cutouts" | "outfits" | "covers",
  rawFile?: string | null
): string | null {
  if (!rawFile || typeof rawFile !== "string") return null;
  const clean = path.basename(rawFile.trim());
  if (!clean || clean === "." || clean === "..") return null;
  return `/curio/api/v1/media/closet/${bucket}/${encodeURIComponent(clean)}`;
}

function computeUpstreamDigest(
  garments: ClosetGarmentPayload[],
  outfits: ClosetOutfitPayload[]
): string {
  const gSig = garments
    .map(
      (g) =>
        `${g.id}:${g.name || ""}:${g.brand || ""}:${g.type || ""}:${g.subtype || ""}:${g.color || ""}:${g.size || ""}:${g.price ?? ""}:${g.notes || ""}:${g.cutout || g.cutout_path || ""}:${g.image || g.photo_path || ""}:${g.wear_count ?? g.times_worn ?? 0}:${g.in_laundry ?? 0}:${g.is_retired ?? 0}:${g.updated_at || ""}`
    )
    .join("|");
  const oSig = outfits
    .map(
      (o) =>
        `${o.id}:${o.name || ""}:${o.date || ""}:${o.kind || ""}:${o.occasion || ""}:${o.weather || ""}:${o.temp_c ?? ""}:${o.location || ""}:${o.notes || ""}:${o.cover_path || ""}:${o.photo_path || ""}:${(o.items || []).map((i) => i.id).join(",")}`
    )
    .join("|");
  return sha256(`${gSig}##${oSig}`).slice(0, 16);
}

export function getClosetSyncStatus(userId: string): {
  configuredUrl: string;
  lastSyncedAt: string | null;
  lastDigest: string | null;
  lastResult: ClosetSyncResult | null;
} {
  const cached = syncStateByUser.get(userId);
  return {
    configuredUrl: getClosetApiBaseUrl(),
    lastSyncedAt: cached ? new Date(cached.syncedAtMs).toISOString() : null,
    lastDigest: cached?.digest || null,
    lastResult: cached?.lastResult || null,
  };
}

/**
 * Pulls live normalized garments (with Apple Vision cutouts) and deduplicated outfits
 * from `closet-ui` (:8710) and reconciles Curio's vault, boards, and graph edges.
 */
export async function syncClosetWithCurio(
  userId: string,
  options?: {
    force?: boolean;
    ifStaleMs?: number;
    fetchFn?: typeof fetch;
    closetApiUrl?: string;
    timeoutMs?: number;
  }
): Promise<ClosetSyncResult> {
  const fetchFn = options?.fetchFn ?? fetch;
  const baseUrl = (options?.closetApiUrl || getClosetApiBaseUrl()).replace(/\/+$/, "");
  const timeoutMs = options?.timeoutMs ?? 6000;
  const nowMs = Date.now();

  const cached = syncStateByUser.get(userId);
  if (!options?.force && options?.ifStaleMs && cached && nowMs - cached.syncedAtMs < options.ifStaleMs) {
    return {
      ...cached.lastResult,
      synced: false,
      skippedReason: "fresh_within_ttl",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let garmentsRaw: unknown;
  let outfitsRaw: unknown;
  try {
    const [gRes, oRes] = await Promise.all([
      fetchFn(`${baseUrl}/api/garments?limit=500`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }),
      fetchFn(`${baseUrl}/api/outfits?limit=500&kind=all`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }),
    ]);
    clearTimeout(timer);

    if (!gRes.ok || !oRes.ok) {
      throw new Error(`Closet API returned HTTP ${gRes.status}/${oRes.status}`);
    }

    garmentsRaw = await gRes.json();
    outfitsRaw = await oRes.json();
  } catch (err: any) {
    clearTimeout(timer);
    throw new Error(`Closet service unreachable (${baseUrl}): ${err.message || err}`);
  }

  const garments: ClosetGarmentPayload[] = Array.isArray(garmentsRaw)
    ? garmentsRaw
    : Array.isArray((garmentsRaw as any)?.items)
    ? (garmentsRaw as any).items
    : [];

  const outfits: ClosetOutfitPayload[] = Array.isArray(outfitsRaw)
    ? outfitsRaw
    : Array.isArray((outfitsRaw as any)?.items)
    ? (outfitsRaw as any).items
    : [];

  const digest = computeUpstreamDigest(garments, outfits);
  if (!options?.force && cached && cached.digest === digest) {
    cached.syncedAtMs = nowMs;
    return {
      ...cached.lastResult,
      synced: false,
      skippedReason: "unchanged_digest",
      syncedAt: new Date(nowMs).toISOString(),
    };
  }

  // Ensure Wardrobe & Outfits smart boards exist with strict typePathPrefix autoRules
  const ensureClosetBoard = async (
    slug: string,
    title: string,
    description: string,
    typePathPrefix: string
  ) => {
    const [existingBoard] = await db
      .select()
      .from(smartLists)
      .where(and(eq(smartLists.userId, userId), eq(smartLists.slug, slug)))
      .limit(1);

    if (!existingBoard) {
      return createList(userId, {
        title,
        slug,
        description,
        visibility: "PRIVATE",
        autoRules: { typePathPrefix },
      });
    }

    if (!existingBoard.autoRules?.typePathPrefix) {
      await db
        .update(smartLists)
        .set({
          autoRules: {
            ...(existingBoard.autoRules || {}),
            typePathPrefix,
          },
        })
        .where(eq(smartLists.id, existingBoard.id));
    }
    return existingBoard;
  };

  const wardrobeBoard = await ensureClosetBoard(
    "wardrobe",
    "Wardrobe",
    "Personal garment archive synced live with Closet UI",
    "/product/garment"
  );
  const outfitsBoard = await ensureClosetBoard(
    "outfits",
    "Outfits",
    "Styled looks & outfit logs synced live with Closet UI",
    "/style/outfit"
  );

  // Run reconciliation inside a single fast SQLite transaction
  const txStats = db.transaction((tx) => {
    const garmentSaveByClosetId = new Map<number, { saveId: string; heroUrl: string | null }>();
    const liveGarmentKeys = new Set<string>();
    const liveOutfitKeys = new Set<string>();

    // Preload user's existing saves joined to globalEntities for fast O(1) lookup
    const existingRows = tx
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.userId, userId))
      .all();

    const saveByEntityId = new Map<string, typeof userSaves.$inferSelect>();
    for (const r of existingRows) {
      if (r.save.entityId) {
        saveByEntityId.set(r.save.entityId, r.save);
      }
    }

    const existingListMembers = new Set(
      tx
        .select({ listId: listItems.listId, saveId: listItems.saveId })
        .from(listItems)
        .where(or(eq(listItems.listId, wardrobeBoard.id), eq(listItems.listId, outfitsBoard.id)))
        .all()
        .map((r) => `${r.listId}:${r.saveId}`)
    );

    let nextWardrobePos = existingListMembers.size;
    let nextOutfitsPos = existingListMembers.size;

    // 1. Upsert Garments
    for (const g of garments) {
      if (!g || typeof g.id !== "number") continue;
      const entityKey = `garment:${g.id}`;
      liveGarmentKeys.add(entityKey);

      const cutoutUrl = toCurioClosetMediaUrl("cutouts", g.cutout || g.cutout_path);
      const photoUrl = toCurioClosetMediaUrl("garments", g.image || g.photo_path);
      const heroImageUrl = cutoutUrl || photoUrl || null;

      const title =
        cleanClosetGarmentName(g.name) ||
        [g.brand, g.color, g.subtype || g.type].filter(Boolean).join(" ").trim() ||
        `Garment #${g.id}`;

      const canonicalUrl =
        g.source_url && /^https?:\/\//i.test(g.source_url.trim())
          ? g.source_url.trim()
          : `https://mini.orca-banjo.ts.net/closet/#garment-${g.id}`;
      const urlHash = sha256(canonicalUrl);
      const wearCount = Number(g.wear_count ?? g.times_worn ?? 0);
      const priceCents =
        typeof g.price === "number" && g.price > 0 ? Math.round(g.price * 100) : null;
      const currency = (g.currency || "CHF").toUpperCase();

      const summaryParts = [
        g.brand,
        g.subtype || g.type,
        g.color ? `in ${g.color}` : null,
        g.material ? `(${g.material})` : null,
        g.season ? `• ${g.season}` : null,
      ].filter(Boolean);
      const summary = summaryParts.join(" ");

      const closetGarmentNotes = g.notes?.trim() || null;
      const structuredData = {
        closetId: g.id,
        closetUrl: `/closet/#garment-${g.id}`,
        brand: g.brand || undefined,
        category: g.type || g.subtype || "Apparel",
        garmentType: g.type || undefined,
        subtype: g.subtype || undefined,
        color: g.color || undefined,
        pattern: g.pattern || undefined,
        material: g.material || undefined,
        composition: g.material || "Natural Blend",
        fit: g.style || "Regular Fit",
        season: g.season || undefined,
        size: g.size || undefined,
        isWaterproof: Boolean(g.is_waterproof),
        isFavorite: Boolean(g.is_favorite),
        isRetired: Boolean(g.is_retired),
        inLaundry: Boolean(g.in_laundry),
        timesWorn: wearCount,
        lastWorn: g.last_worn || null,
        costPerWear: g.cost_per_wear ?? null,
        purchaseDate: g.purchase_date || null,
        sourceUrl: g.source_url || null,
        cutoutUrl,
        photoUrl,
        hasCutout: Boolean(cutoutUrl),
        lastSyncedClosetNotes: closetGarmentNotes,
      };

      const [existingEntity] = tx
        .select()
        .from(globalEntities)
        .where(eq(globalEntities.entityKey, entityKey))
        .all();

      const prevSyncedGarmentNotes =
        (existingEntity?.coreStructuredData as Record<string, unknown> | null)
          ?.lastSyncedClosetNotes ?? null;

      let entityId: string;
      if (existingEntity) {
        entityId = existingEntity.id;
        tx.update(globalEntities)
          .set({
            title,
            summary,
            brandOrCreator: g.brand || null,
            canonicalUrl,
            urlHash,
            coreType: "PRODUCT",
            typePath: "/product/garment",
            heroImageUrl,
            priceCents,
            currency,
            coreStructuredData: structuredData,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(globalEntities.id, entityId))
          .run();
      } else {
        const [inserted] = tx
          .insert(globalEntities)
          .values({
            entityKey,
            urlHash,
            canonicalUrl,
            coreType: "PRODUCT",
            typePath: "/product/garment",
            title,
            summary,
            brandOrCreator: g.brand || null,
            heroImageUrl,
            priceCents,
            currency,
            coreStructuredData: structuredData,
          })
          .returning()
          .all();
        entityId = inserted.id;
      }

      const tags = [
        "closet",
        "garment",
        g.type?.toLowerCase(),
        g.subtype?.toLowerCase(),
        g.color?.toLowerCase(),
        g.season?.toLowerCase(),
      ].filter((t): t is string => Boolean(t));

      const existingSave = saveByEntityId.get(entityId);
      let saveId: string;
      if (existingSave) {
        saveId = existingSave.id;
        const currNotes = existingSave.personalNotes?.trim() || null;
        const shouldAdoptClosetNotes =
          !currNotes || currNotes === prevSyncedGarmentNotes;
        const nextNotes = shouldAdoptClosetNotes ? closetGarmentNotes : existingSave.personalNotes;
        tx.update(userSaves)
          .set({
            typePath: "/product/garment",
            autoTags: [...new Set([...(existingSave.autoTags || []), ...tags])],
            personalNotes: nextNotes,
            userCustomValues: {
              ...((existingSave.userCustomValues as Record<string, unknown>) || {}),
              ...(g.size ? { size: g.size } : {}),
              timesWorn: wearCount,
              ...(g.last_worn ? { lastWorn: g.last_worn } : {}),
              inLaundry: Boolean(g.in_laundry),
            },
          })
          .where(eq(userSaves.id, saveId))
          .run();
      } else {
        const [createdSave] = tx
          .insert(userSaves)
          .values({
            userId,
            entityId,
            typePath: "/product/garment",
            isPrivateMemo: false,
            personalNotes: closetGarmentNotes,
            autoTags: [...new Set(tags)],
            userCustomValues: {
              ...(g.size ? { size: g.size } : {}),
              timesWorn: wearCount,
              ...(g.last_worn ? { lastWorn: g.last_worn } : {}),
              inLaundry: Boolean(g.in_laundry),
            },
            enrichmentStatus: "ENRICHED",
            visibility: "PRIVATE",
          })
          .returning()
          .all();
        saveId = createdSave.id;
        saveByEntityId.set(entityId, createdSave);
      }

      if (!existingListMembers.has(`${wardrobeBoard.id}:${saveId}`)) {
        tx.insert(listItems)
          .values({
            listId: wardrobeBoard.id,
            saveId,
            positionIndex: nextWardrobePos++,
            sectionHeader: g.type || "Apparel",
          })
          .run();
        existingListMembers.add(`${wardrobeBoard.id}:${saveId}`);
      }

      garmentSaveByClosetId.set(g.id, { saveId, heroUrl: heroImageUrl });
    }

    // 2. Upsert Outfits
    const outfitLinksToSync: Array<{
      outfitSaveId: string;
      garmentSaveIds: string[];
      occasionLabel: string;
    }> = [];

    for (const o of outfits) {
      if (!o || typeof o.id !== "number") continue;
      const entityKey = `outfit:${o.id}`;
      liveOutfitKeys.add(entityKey);

      const coverUrl = toCurioClosetMediaUrl("covers", o.cover_path);
      const outfitPhotoUrl = toCurioClosetMediaUrl("outfits", o.photo_path);

      const rawItems = Array.isArray(o.items) ? o.items.filter((i) => i && typeof i.id === "number") : [];
      const mappedItems = rawItems.map((item) => {
        const itemCutout = toCurioClosetMediaUrl("cutouts", item.cutout || item.cutout_url);
        const itemPhoto = toCurioClosetMediaUrl("garments", item.image || item.image_url);
        const syncedGarment = garmentSaveByClosetId.get(item.id);
        const cleanedItemTitle =
          cleanClosetGarmentName(item.name) ||
          [item.brand, item.color, item.subtype || item.type].filter(Boolean).join(" ").trim() ||
          `Piece #${item.id}`;
        const resolvedPhoto = itemCutout || itemPhoto || syncedGarment?.heroUrl || null;
        return {
          id: item.id,
          title: cleanedItemTitle,
          name: cleanedItemTitle,
          brand: item.brand || "Wardrobe",
          category: item.type || item.subtype || undefined,
          color: item.color || undefined,
          type: item.type || undefined,
          subtype: item.subtype || undefined,
          photoUrl: resolvedPhoto,
          imageUrl: resolvedPhoto || undefined,
          saveId: syncedGarment?.saveId || undefined,
          hasCutout: Boolean(itemCutout),
        };
      });

      const heroImageUrl =
        coverUrl ||
        outfitPhotoUrl ||
        mappedItems.find((i) => i.photoUrl)?.photoUrl ||
        null;

      const cleanName = (o.name || "").trim();
      const title =
        cleanName ||
        (o.occasion
          ? `${o.occasion} Look${o.date ? ` (${o.date})` : ""}`
          : `Outfit #${o.id}${o.date ? ` (${o.date})` : ""}`);

      const canonicalUrl = `https://mini.orca-banjo.ts.net/closet/#outfit-${o.id}`;
      const urlHash = sha256(canonicalUrl);
      const summary = mappedItems.length
        ? `Styled look featuring: ${mappedItems.map((i) => i.title).join(", ")}`
        : o.notes || "Curated outfit look";

      const closetOutfitNotes = o.notes?.trim() || null;
      const structuredData = {
        closetId: o.id,
        closetUrl: `/closet/#outfit-${o.id}`,
        date: o.date || null,
        datesWorn: o.date ? [o.date] : [],
        timesWorn: 1,
        kind: o.kind || "worn",
        occasion: o.occasion || "Everyday",
        weather: o.weather || null,
        weatherCondition: o.weather
          ? o.temp_c != null
            ? `${o.weather} (${o.temp_c}°C)`
            : o.weather
          : o.temp_c != null
          ? `${o.temp_c}°C`
          : null,
        temperature: o.temp_c ?? null,
        location: o.location || null,
        notes: closetOutfitNotes,
        lastSyncedClosetNotes: closetOutfitNotes,
        coverUrl,
        outfitPhotoUrl,
        itemCount: mappedItems.length,
        items: mappedItems,
      };

      const [existingEntity] = tx
        .select()
        .from(globalEntities)
        .where(eq(globalEntities.entityKey, entityKey))
        .all();

      const prevSyncedOutfitNotes =
        (existingEntity?.coreStructuredData as Record<string, unknown> | null)
          ?.lastSyncedClosetNotes ?? null;

      let entityId: string;
      if (existingEntity) {
        entityId = existingEntity.id;
        tx.update(globalEntities)
          .set({
            title,
            summary,
            canonicalUrl,
            urlHash,
            coreType: "PRODUCT",
            typePath: "/style/outfit",
            heroImageUrl,
            coreStructuredData: structuredData,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(globalEntities.id, entityId))
          .run();
      } else {
        const [inserted] = tx
          .insert(globalEntities)
          .values({
            entityKey,
            urlHash,
            canonicalUrl,
            coreType: "PRODUCT",
            typePath: "/style/outfit",
            title,
            summary,
            heroImageUrl,
            coreStructuredData: structuredData,
          })
          .returning()
          .all();
        entityId = inserted.id;
      }

      const tags = [
        "outfit",
        "lookbook",
        o.kind?.toLowerCase(),
        o.occasion?.toLowerCase(),
        o.weather?.toLowerCase(),
      ].filter((t): t is string => Boolean(t));

      const existingSave = saveByEntityId.get(entityId);
      let outfitSaveId: string;
      if (existingSave) {
        outfitSaveId = existingSave.id;
        const currNotes = existingSave.personalNotes?.trim() || null;
        const shouldAdoptClosetNotes =
          !currNotes || currNotes === prevSyncedOutfitNotes;
        const nextNotes = shouldAdoptClosetNotes ? closetOutfitNotes : existingSave.personalNotes;
        tx.update(userSaves)
          .set({
            typePath: "/style/outfit",
            autoTags: [...new Set([...(existingSave.autoTags || []), ...tags])],
            personalNotes: nextNotes,
          })
          .where(eq(userSaves.id, outfitSaveId))
          .run();
      } else {
        const [createdSave] = tx
          .insert(userSaves)
          .values({
            userId,
            entityId,
            typePath: "/style/outfit",
            isPrivateMemo: false,
            personalNotes: closetOutfitNotes,
            autoTags: [...new Set(tags)],
            enrichmentStatus: "ENRICHED",
            visibility: "PRIVATE",
            ...(o.date ? { createdAt: `${o.date} 12:00:00` } : {}),
          })
          .returning()
          .all();
        outfitSaveId = createdSave.id;
        saveByEntityId.set(entityId, createdSave);
      }

      if (!existingListMembers.has(`${outfitsBoard.id}:${outfitSaveId}`)) {
        tx.insert(listItems)
          .values({
            listId: outfitsBoard.id,
            saveId: outfitSaveId,
            positionIndex: nextOutfitsPos++,
            sectionHeader: o.occasion || "Everyday",
          })
          .run();
        existingListMembers.add(`${outfitsBoard.id}:${outfitSaveId}`);
      }

      const garmentSaveIds = rawItems
        .map((i) => garmentSaveByClosetId.get(i.id)?.saveId)
        .filter((id): id is string => Boolean(id));

      outfitLinksToSync.push({
        outfitSaveId,
        garmentSaveIds,
        occasionLabel: `Worn in ${title}`,
      });
    }

    // 3. Prune deduplicated/deleted Closet saves & orphan entities (e.g. 93 -> 79 deduplicated outfits)
    let prunedSaves = 0;
    let prunedEntities = 0;

    for (const r of existingRows) {
      const eKey = r.entity?.entityKey || "";
      const isStaleGarment =
        garments.length > 0 && /^(?:closet:)?garment:/.test(eKey) && !liveGarmentKeys.has(eKey.replace(/^closet:/, ""));
      const isStaleOutfit =
        outfits.length > 0 && /^(?:closet:)?outfit:/.test(eKey) && !liveOutfitKeys.has(eKey.replace(/^closet:/, ""));

      if (isStaleGarment || isStaleOutfit) {
        tx.delete(entryConnections)
          .where(
            or(
              eq(entryConnections.sourceSaveId, r.save.id),
              eq(entryConnections.targetSaveId, r.save.id)
            )
          )
          .run();
        tx.delete(listItems).where(eq(listItems.saveId, r.save.id)).run();
        tx.update(userSaves)
          .set({ preferredSourceId: null })
          .where(eq(userSaves.id, r.save.id))
          .run();
        tx.delete(userSaves).where(eq(userSaves.id, r.save.id)).run();
        prunedSaves++;

        if (r.entity) {
          const [remainingSave] = tx
            .select({ id: userSaves.id })
            .from(userSaves)
            .where(eq(userSaves.entityId, r.entity.id))
            .all();
          if (!remainingSave) {
            tx.delete(entityPriceHistory)
              .where(eq(entityPriceHistory.entityId, r.entity.id))
              .run();
            tx.delete(entitySources)
              .where(eq(entitySources.entityId, r.entity.id))
              .run();
            tx.delete(globalEntities).where(eq(globalEntities.id, r.entity.id)).run();
            prunedEntities++;
          }
        }
      }
    }

    // 4. Reconcile WORN_ON & PAIRED_WITH graph connections idempotently
    const currentConnections = tx
      .select({
        sourceSaveId: entryConnections.sourceSaveId,
        targetSaveId: entryConnections.targetSaveId,
        connectionType: entryConnections.connectionType,
      })
      .from(entryConnections)
      .where(eq(entryConnections.userId, userId))
      .all();

    const edgeSet = new Set<string>(
      currentConnections.map(
        (c) => `${c.sourceSaveId}:${c.targetSaveId}:${c.connectionType}`
      )
    );

    let connectionsSynced = 0;
    for (const link of outfitLinksToSync) {
      for (const gSaveId of link.garmentSaveIds) {
        const wornKey = `${gSaveId}:${link.outfitSaveId}:WORN_ON`;
        if (!edgeSet.has(wornKey)) {
          tx.insert(entryConnections)
            .values({
              userId,
              sourceSaveId: gSaveId,
              targetSaveId: link.outfitSaveId,
              connectionType: "WORN_ON",
              contextNote: link.occasionLabel,
              isBidirectional: true,
            })
            .run();
          edgeSet.add(wornKey);
          connectionsSynced++;
        }
      }

      for (let i = 0; i < link.garmentSaveIds.length; i++) {
        for (let j = i + 1; j < link.garmentSaveIds.length; j++) {
          const a = link.garmentSaveIds[i];
          const b = link.garmentSaveIds[j];
          if (a === b) continue;
          const pairAB = `${a}:${b}:PAIRED_WITH`;
          const pairBA = `${b}:${a}:PAIRED_WITH`;
          if (!edgeSet.has(pairAB) && !edgeSet.has(pairBA)) {
            tx.insert(entryConnections)
              .values({
                userId,
                sourceSaveId: a,
                targetSaveId: b,
                connectionType: "PAIRED_WITH",
                contextNote: link.occasionLabel,
                isBidirectional: true,
              })
              .run();
            edgeSet.add(pairAB);
            connectionsSynced++;
          }
        }
      }
    }

    return { prunedSaves, prunedEntities, connectionsSynced };
  });

  const syncedAt = new Date(nowMs).toISOString();
  const result: ClosetSyncResult = {
    synced: true,
    garmentsSynced: garments.length,
    outfitsSynced: outfits.length,
    prunedSaves: txStats.prunedSaves,
    prunedEntities: txStats.prunedEntities,
    connectionsSynced: txStats.connectionsSynced,
    syncedAt,
    digest,
  };

  syncStateByUser.set(userId, {
    digest,
    syncedAtMs: nowMs,
    lastResult: result,
  });

  return result;
}

/**
 * Best-effort Curio -> Closet UI write-through when a synced garment/outfit is edited in Curio.
 */
export async function syncCurioSaveEditToCloset(
  entityKey: string | null | undefined,
  updates: {
    title?: string | null;
    brandOrCreator?: string | null;
    personalNotes?: string | null;
    size?: string | null;
    inLaundry?: boolean;
  },
  options?: { fetchFn?: typeof fetch; closetApiUrl?: string }
): Promise<boolean> {
  if (!entityKey) return false;
  const fetchFn = options?.fetchFn ?? fetch;
  const baseUrl = (options?.closetApiUrl || getClosetApiBaseUrl()).replace(/\/+$/, "");

  const garmentMatch = entityKey.match(/^(?:closet:)?garment:(\d+)$/);
  const outfitMatch = entityKey.match(/^(?:closet:)?outfit:(\d+)$/);
  if (!garmentMatch && !outfitMatch) return false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);

    if (garmentMatch) {
      const id = garmentMatch[1];
      const payload: Record<string, unknown> = {};
      if (updates.title !== undefined && updates.title !== null) payload.name = updates.title;
      if (updates.brandOrCreator !== undefined && updates.brandOrCreator !== null) {
        payload.brand = updates.brandOrCreator;
      }
      if (updates.personalNotes !== undefined) {
        payload.notes = updates.personalNotes ?? "";
      }
      if (updates.size !== undefined && updates.size !== null) {
        payload.size = updates.size;
      }
      if (updates.inLaundry !== undefined) {
        payload.in_laundry = updates.inLaundry ? 1 : 0;
      }
      if (Object.keys(payload).length === 0) {
        clearTimeout(timer);
        return false;
      }
      const res = await fetchFn(`${baseUrl}/api/garments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res.ok;
    }

    if (outfitMatch) {
      const id = outfitMatch[1];
      const payload: Record<string, unknown> = {};
      if (updates.title !== undefined && updates.title !== null) payload.name = updates.title;
      if (updates.personalNotes !== undefined) {
        payload.notes = updates.personalNotes ?? "";
      }
      if (Object.keys(payload).length === 0) {
        clearTimeout(timer);
        return false;
      }
      const res = await fetchFn(`${baseUrl}/api/outfits/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res.ok;
    }
  } catch {
    // Non-fatal if Closet UI is asleep
  }
  return false;
}
