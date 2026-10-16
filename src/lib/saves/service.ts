import { db, userSaves, globalEntities, curioTypes, listItems, smartLists, entitySources, entryConnections } from "@/db";
import { eq, or } from "drizzle-orm";
import { getConnectedSaves, type ConnectedItem } from "@/lib/connections/service";
import { evaluateAttributePromotion } from "@/lib/curio-learns/attributes";

export interface UpdateSaveDetailsInput {
  privateTitle?: string | null;
  personalNotes?: string | null;
  typePath?: string | null;
  userCustomValues?: Record<string, unknown>;
}

export interface SaveDetails {
  save: typeof userSaves.$inferSelect;
  entity: typeof globalEntities.$inferSelect | null;
  curioType: typeof curioTypes.$inferSelect | null;
  connections: ConnectedItem[];
  lists: Array<typeof smartLists.$inferSelect & { listItem: typeof listItems.$inferSelect }>;
  sources: Array<typeof entitySources.$inferSelect>;
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

  // Retrieve synaptic connections
  const connections = await getConnectedSaves(saveId);

  // Retrieve lists containing this save
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

  // Retrieve multi-merchant sources
  let sources: Array<typeof entitySources.$inferSelect> = [];
  if (record.entity?.id) {
    sources = await db
      .select()
      .from(entitySources)
      .where(eq(entitySources.entityId, record.entity.id));
  }

  return {
    save: record.save,
    entity: record.entity,
    curioType: record.curioType,
    connections,
    lists,
    sources,
  };
}

/**
 * Updates a user save (title, personal notes, archetype typePath, custom values)
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
  if (updates.personalNotes !== undefined) patch.personalNotes = updates.personalNotes;
  if (updates.typePath !== undefined) patch.typePath = updates.typePath;
  if (updates.userCustomValues !== undefined) patch.userCustomValues = updates.userCustomValues;

  if (Object.keys(patch).length > 0) {
    await db
      .update(userSaves)
      .set(patch)
      .where(eq(userSaves.id, saveId));
  }

  if (updates.userCustomValues && existing.entityId) {
    await evaluateAttributePromotion(existing.entityId);
  }

  return getSaveDetails(saveId);
}

/**
 * Deletes a save and cascades removal from lists and synaptic connections.
 */
export async function deleteSave(saveId: string): Promise<boolean> {
  // Remove from lists
  await db.delete(listItems).where(eq(listItems.saveId, saveId));

  // Remove from connections
  await db
    .delete(entryConnections)
    .where(or(eq(entryConnections.sourceSaveId, saveId), eq(entryConnections.targetSaveId, saveId)));

  // Remove save
  const res = await db.delete(userSaves).where(eq(userSaves.id, saveId)).returning();

  return res.length > 0;
}
