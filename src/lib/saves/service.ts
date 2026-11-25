import { db, userSaves, globalEntities, curioTypes, listItems, smartLists, entitySources, entryConnections, users } from "@/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { getConnectedSaves, getConnectedSavesMap, type ConnectedItem } from "@/lib/connections/service";
import { matchesAutoRules } from "@/lib/lists/service";
import { evaluateAttributePromotion } from "@/lib/curio-learns/attributes";
import type { UserAffiliateTags } from "@/lib/commerce/affiliate";
import { readingStatusToShelf, type ReadingStatus } from "@/lib/books/library";

export interface UpdateSaveDetailsInput {
  privateTitle?: string | null;
  personalNotes?: string | null;
  typePath?: string | null;
  userCustomValues?: Record<string, unknown>;
  autoTags?: string[];
  isPrivateMemo?: boolean;
  wishlist?: boolean;
  title?: string | null;
  brandOrCreator?: string | null;
  summary?: string | null;
  heroImageUrl?: string | null;
}

export interface SaveDetails {
  save: typeof userSaves.$inferSelect;
  entity: typeof globalEntities.$inferSelect | null;
  curioType: typeof curioTypes.$inferSelect | null;
  connections: ConnectedItem[];
  lists: Array<typeof smartLists.$inferSelect & { listItem: typeof listItems.$inferSelect }>;
  sources: Array<typeof entitySources.$inferSelect>;
  owner?: {
    id: string;
    username: string;
    displayName: string | null;
    affiliateTags?: UserAffiliateTags | null;
  } | null;
}

/**
 * Retrieves deep save details including entity, curio type, connections, list memberships, and merchant sources.
 */
export async function getSaveDetails(saveId: string): Promise<SaveDetails | null> {
  const [record] = await db
    .select({
      save: userSaves,
      entity: globalEntities,
      curioType: curioTypes,
    })
    .from(userSaves)
    .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
    .leftJoin(curioTypes, eq(userSaves.typeId, curioTypes.id))
    .where(eq(userSaves.id, saveId))
    .limit(1);

  if (!record) return null;

  const connections = await getConnectedSaves(saveId);

  const listRecords = await db
    .select({
      listItem: listItems,
      list: smartLists,
    })
    .from(listItems)
    .innerJoin(smartLists, eq(listItems.listId, smartLists.id))
    .where(eq(listItems.saveId, saveId));

  const lists = listRecords.map((r) => ({
    ...r.list,
    listItem: r.listItem,
  }));

  let sources: Array<typeof entitySources.$inferSelect> = [];
  if (record.entity?.id) {
    sources = await db
      .select()
      .from(entitySources)
      .where(eq(entitySources.entityId, record.entity.id));
  }

  const [owner] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      affiliateTags: users.affiliateTags,
    })
    .from(users)
    .where(eq(users.id, record.save.userId))
    .limit(1);

  return {
    save: record.save,
    entity: record.entity,
    curioType: record.curioType,
    connections,
    lists,
    sources,
    owner: owner || null,
  };
}

export type SaveViewerAccessResult =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; details: SaveDetails; isOwner: boolean };

/**
 * Retrieves save details gated and sanitized for the requesting viewer (e.g. `/card/[id]` SSR).
 * Owners receive full unsanitized details; non-owners only receive non-memo saves that are
 * standalone PUBLIC/UNLISTED or appear on a non-paywalled PUBLIC/UNLISTED board, with private
 * notes, private titles, non-public custom fields, and private connection metadata stripped.
 */
export async function getSaveDetailsForViewer(
  saveId: string,
  viewerUserId?: string | null
): Promise<SaveViewerAccessResult> {
  const details = await getSaveDetails(saveId);
  if (!details) {
    return { status: "not_found" };
  }

  const isOwner = Boolean(viewerUserId && viewerUserId === details.save.userId);
  if (isOwner) {
    return { status: "ok", details, isOwner: true };
  }

  if (details.save.isPrivateMemo || !details.entity) {
    return { status: "forbidden" };
  }

  let isPubliclyAccessible =
    details.save.visibility === "PUBLIC" || details.save.visibility === "UNLISTED";

  if (!isPubliclyAccessible) {
    isPubliclyAccessible = details.lists.some(
      (list) =>
        (list.visibility === "PUBLIC" || list.visibility === "UNLISTED") && !list.isPaywalled
    );
  }

  if (!isPubliclyAccessible) {
    const publicOwnerBoards = await db
      .select()
      .from(smartLists)
      .where(
        and(
          eq(smartLists.userId, details.save.userId),
          inArray(smartLists.visibility, ["PUBLIC", "UNLISTED"]),
          eq(smartLists.isPaywalled, false)
        )
      );

    for (const board of publicOwnerBoards) {
      if (!board.autoRules && board.slug !== "films" && board.slug !== "music") {
        continue;
      }
      if (matchesAutoRules(board.autoRules, { save: details.save, entity: details.entity }, board.slug)) {
        isPubliclyAccessible = true;
        break;
      }
    }
  }

  if (!isPubliclyAccessible) {
    return { status: "forbidden" };
  }

  let allowedKeys: Set<string> | null = null;
  if (details.curioType?.publicFieldKeys) {
    allowedKeys = new Set(details.curioType.publicFieldKeys);
  } else if (details.save.customTypeId) {
    const [customCt] = await db
      .select({ publicFieldKeys: curioTypes.publicFieldKeys })
      .from(curioTypes)
      .where(eq(curioTypes.id, details.save.customTypeId))
      .limit(1);
    if (customCt?.publicFieldKeys) {
      allowedKeys = new Set(customCt.publicFieldKeys);
    }
  } else if (details.save.typePath) {
    const [pathCt] = await db
      .select({ publicFieldKeys: curioTypes.publicFieldKeys })
      .from(curioTypes)
      .where(eq(curioTypes.typePath, details.save.typePath))
      .limit(1);
    if (pathCt?.publicFieldKeys) {
      allowedKeys = new Set(pathCt.publicFieldKeys);
    }
  }

  const rawCustom = details.save.userCustomValues;
  const sanitizedCustom: Record<string, unknown> = {};
  if (allowedKeys && rawCustom && typeof rawCustom === "object") {
    for (const [k, v] of Object.entries(rawCustom as Record<string, unknown>)) {
      if (allowedKeys.has(k)) {
        sanitizedCustom[k] = v;
      }
    }
  }

  const sanitizedConnMap = await getConnectedSavesMap([saveId], { sanitizeForPublic: true });
  const sanitizedConnections = sanitizedConnMap.get(saveId) ?? [];
  const publicLists = details.lists.filter(
    (list) => list.visibility === "PUBLIC" && !list.isPaywalled
  );

  return {
    status: "ok",
    isOwner: false,
    details: {
      ...details,
      save: {
        ...details.save,
        personalNotes: null,
        privateTitle: null,
        userCustomValues: sanitizedCustom,
      },
      connections: sanitizedConnections,
      lists: publicLists,
    },
  };
}

/**
 * Updates a user save (title, personal notes, archetype typePath, custom values)
 * and optionally updates the linked GlobalEntity's title, creator, summary, or heroImageUrl.
 */
export async function updateSaveDetails(
  saveId: string,
  updates: UpdateSaveDetailsInput
): Promise<SaveDetails | null> {
  const [existing] = await db
    .select()
    .from(userSaves)
    .where(eq(userSaves.id, saveId))
    .limit(1);

  if (!existing) {
    throw new Error(`Save ${saveId} not found`);
  }

  const patch: Record<string, unknown> = {};
  if (updates.privateTitle !== undefined) patch.privateTitle = updates.privateTitle;
  else if (updates.title !== undefined && existing.isPrivateMemo) patch.privateTitle = updates.title;
  if (updates.personalNotes !== undefined) patch.personalNotes = updates.personalNotes;

  const entityPatch: Record<string, unknown> = {};
  if (updates.title !== undefined && updates.title !== null && updates.title.trim()) {
    entityPatch.title = updates.title.trim();
  }
  if (updates.brandOrCreator !== undefined) {
    entityPatch.brandOrCreator = updates.brandOrCreator;
  }
  if (updates.summary !== undefined) {
    entityPatch.summary = updates.summary;
  }
  if (updates.heroImageUrl !== undefined) {
    entityPatch.heroImageUrl = updates.heroImageUrl;
  }

  if (updates.typePath !== undefined) {
    patch.typePath = updates.typePath;
    if (updates.typePath) {
      const [matchedType] = await db
        .select()
        .from(curioTypes)
        .where(eq(curioTypes.typePath, updates.typePath))
        .limit(1);
      if (matchedType) {
        patch.typeId = matchedType.id;
        patch.customTypeId = matchedType.userId ? matchedType.id : null;
      }
      if (existing.entityId) {
        entityPatch.typePath = updates.typePath;
      }
    }
  }
  if (updates.userCustomValues !== undefined) {
    const nextCv = { ...updates.userCustomValues };
    if (typeof nextCv.readingStatus === "string") {
      const rs = nextCv.readingStatus.trim().toUpperCase();
      if (rs === "FINISHED" || rs === "READING" || rs === "WANT_TO_READ") {
        nextCv.readingStatus = rs;
        nextCv.shelf = readingStatusToShelf(rs as ReadingStatus);
      }
    }
    patch.userCustomValues = nextCv;
  }
  if (updates.autoTags !== undefined) {
    const seen = new Map<string, string>();
    for (const rawTag of updates.autoTags) {
      const clean = String(rawTag || "").trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) seen.set(key, clean);
    }
    patch.autoTags = [...seen.values()];
  }
  if (updates.isPrivateMemo !== undefined) patch.isPrivateMemo = updates.isPrivateMemo;
  if (updates.wishlist !== undefined) patch.wishlist = updates.wishlist;

  if (Object.keys(patch).length > 0) {
    await db
      .update(userSaves)
      .set(patch)
      .where(eq(userSaves.id, saveId));
  }

  if (existing.entityId && Object.keys(entityPatch).length > 0) {
    const [ent] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, existing.entityId))
      .limit(1);
    if (ent) {
      const coreData = { ...((ent.coreStructuredData as Record<string, any>) || {}) };
      if (entityPatch.title) coreData.title = entityPatch.title;
      if (entityPatch.brandOrCreator !== undefined) {
        if ((ent.typePath || "").includes("/film")) coreData.director = entityPatch.brandOrCreator;
        else if ((ent.typePath || "").includes("/book")) coreData.author = entityPatch.brandOrCreator;
        else if ((ent.typePath || "").includes("/music")) coreData.artist = entityPatch.brandOrCreator;
      }
      entityPatch.coreStructuredData = coreData;
    }

    await db
      .update(globalEntities)
      .set(entityPatch)
      .where(eq(globalEntities.id, existing.entityId));
  }

  if (updates.userCustomValues && existing.entityId) {
    await evaluateAttributePromotion(existing.entityId);
  }

  return getSaveDetails(saveId);
}

/**
 * Deletes a save and cascades removal from lists and synaptic connections atomically.
 */
export async function deleteSave(saveId: string): Promise<boolean> {
  return db.transaction((tx) => {
    tx.delete(listItems).where(eq(listItems.saveId, saveId)).run();

    tx.delete(entryConnections)
      .where(or(eq(entryConnections.sourceSaveId, saveId), eq(entryConnections.targetSaveId, saveId)))
      .run();

    const res = tx.delete(userSaves).where(eq(userSaves.id, saveId)).returning().all();

    return res.length > 0;
  });
}
