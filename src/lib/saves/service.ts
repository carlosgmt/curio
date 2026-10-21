import { db, userSaves, globalEntities, curioTypes, listItems, smartLists, entitySources, entryConnections, users } from "@/db";
import { eq, or } from "drizzle-orm";
import { getConnectedSaves, type ConnectedItem } from "@/lib/connections/service";
import { evaluateAttributePromotion } from "@/lib/curio-learns/attributes";
import type { UserAffiliateTags } from "@/lib/commerce/affiliate";

export interface UpdateSaveDetailsInput {
  privateTitle?: string | null;
  personalNotes?: string | null;
  typePath?: string | null;
  userCustomValues?: Record<string, unknown>;
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
  if (updates.userCustomValues !== undefined) patch.userCustomValues = updates.userCustomValues;
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
