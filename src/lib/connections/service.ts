import { db, entryConnections, userSaves, globalEntities } from "@/db";
import { eq, or, and, inArray } from "drizzle-orm";

export const CONNECTION_TYPES = [
  // Sensory & Culinary
  "PAIRED_WITH",
  "SOUNDTRACK_TO",
  "WORN_ON",
  "CONSUMED_AT",
  // Aesthetic & Artistic
  "INFLUENCED_BY",
  "CONTEMPORARY_WITH",
  "COUNTERPOINT_TO",
  "AESTHETIC_SIBLING",
  "DERIVATION_OF",
  "INSPIRED_BY",
  // Structural & Physical
  "MATERIAL_VARIANT",
  "EVOLUTION_OF",
  "SAME_CREATOR",
  "COMPLEMENTARY_TO",
] as const;

export type ConnectionType = (typeof CONNECTION_TYPES)[number];

export interface ConnectedItem {
  connectionId: string;
  connectionType: ConnectionType;
  contextNote?: string | null;
  direction: "outgoing" | "incoming";
  saveId: string;
  title: string;
  heroImageUrl?: string | null;
  coreType: string;
  typePath?: string | null;
  weight?: number;
  confidence?: number;
  isBidirectional?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a synaptic connection edge between two user saves
 */
export async function createConnection(params: {
  userId: string;
  sourceSaveId: string;
  targetSaveId: string;
  connectionType: ConnectionType;
  contextNote?: string;
  weight?: number;
  confidence?: number;
  isBidirectional?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const {
    userId,
    sourceSaveId,
    targetSaveId,
    connectionType,
    contextNote,
    weight = 1.0,
    confidence = 1.0,
    isBidirectional = true,
    metadata = {},
  } = params;

  if (sourceSaveId === targetSaveId) {
    throw new Error("Cannot connect an item to itself.");
  }

  // Enforce tenant isolation: both saves must exist and belong to the authenticated userId
  const endpointSaves = await db
    .select({ id: userSaves.id, userId: userSaves.userId })
    .from(userSaves)
    .where(inArray(userSaves.id, [sourceSaveId, targetSaveId]));

  if (endpointSaves.length < 2) {
    throw new Error("NOT_FOUND: Source or target save does not exist.");
  }
  if (endpointSaves.some((s) => s.userId !== userId)) {
    throw new Error("FORBIDDEN: Cannot connect saves owned by another user.");
  }

  // Check if connection already exists
  const [existing] = await db
    .select()
    .from(entryConnections)
    .where(
      and(
        eq(entryConnections.userId, userId),
        or(
          and(
            eq(entryConnections.sourceSaveId, sourceSaveId),
            eq(entryConnections.targetSaveId, targetSaveId)
          ),
          and(
            eq(entryConnections.sourceSaveId, targetSaveId),
            eq(entryConnections.targetSaveId, sourceSaveId)
          )
        )
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [connection] = await db
    .insert(entryConnections)
    .values({
      userId,
      sourceSaveId,
      targetSaveId,
      connectionType,
      contextNote,
      weight,
      confidence,
      isBidirectional,
      metadata,
    })
    .returning();

  return connection;
}

/**
 * Deletes a connection edge
 */
export async function deleteConnection(connectionId: string, userId: string) {
  const [deleted] = await db
    .delete(entryConnections)
    .where(
      and(
        eq(entryConnections.id, connectionId),
        eq(entryConnections.userId, userId)
      )
    )
    .returning();

  return deleted;
}

/**
 * Retrieves all connected items for a given save (bidirectional)
 */
export async function getConnectedSaves(saveId: string): Promise<ConnectedItem[]> {
  const [anchorSave] = await db
    .select({ userId: userSaves.userId })
    .from(userSaves)
    .where(eq(userSaves.id, saveId))
    .limit(1);

  if (!anchorSave) {
    return [];
  }

  const connections = await db
    .select()
    .from(entryConnections)
    .where(
      and(
        eq(entryConnections.userId, anchorSave.userId),
        or(
          eq(entryConnections.sourceSaveId, saveId),
          eq(entryConnections.targetSaveId, saveId)
        )
      )
    );

  const results: ConnectedItem[] = [];

  for (const conn of connections) {
    const isOutgoing = conn.sourceSaveId === saveId;
    const otherSaveId = isOutgoing ? conn.targetSaveId : conn.sourceSaveId;

    const [saveRecord] = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(
        and(
          eq(userSaves.id, otherSaveId),
          eq(userSaves.userId, anchorSave.userId)
        )
      )
      .limit(1);

    if (saveRecord) {
      results.push({
        connectionId: conn.id,
        connectionType: conn.connectionType as ConnectionType,
        contextNote: conn.contextNote,
        direction: isOutgoing ? "outgoing" : "incoming",
        saveId: otherSaveId,
        title:
          saveRecord.save.privateTitle ||
          saveRecord.entity?.title ||
          "Untitled Element",
        heroImageUrl: saveRecord.entity?.heroImageUrl || null,
        coreType: saveRecord.entity?.coreType || "UNKNOWN",
        typePath: saveRecord.save.typePath || saveRecord.entity?.typePath || null,
        weight: conn.weight,
        confidence: conn.confidence,
        isBidirectional: conn.isBidirectional,
        metadata: conn.metadata || {},
      });
    }
  }

  return results;
}

/**
 * Batch-fetches connected saves for an array of saveIds in O(1) queries.
 * Every requested saveId is guaranteed an entry (defaulting to `[]`).
 */
export async function getConnectedSavesMap(
  saveIds: string[],
  options?: { sanitizeForPublic?: boolean }
): Promise<Map<string, ConnectedItem[]>> {
  const uniqueIds = Array.from(new Set(saveIds.filter(Boolean)));
  const resultMap = new Map<string, ConnectedItem[]>();
  for (const id of uniqueIds) {
    resultMap.set(id, []);
  }
  if (uniqueIds.length === 0) {
    return resultMap;
  }

  const CHUNK_SIZE = 400;
  const ownerBySaveId = new Map<string, string>();
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
    const anchors = await db
      .select({ id: userSaves.id, userId: userSaves.userId })
      .from(userSaves)
      .where(inArray(userSaves.id, chunk));
    for (const anchor of anchors) {
      ownerBySaveId.set(anchor.id, anchor.userId);
    }
  }

  if (ownerBySaveId.size === 0) {
    return resultMap;
  }

  const connById = new Map<string, typeof entryConnections.$inferSelect>();

  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
    const rows = await db
      .select()
      .from(entryConnections)
      .where(
        or(
          inArray(entryConnections.sourceSaveId, chunk),
          inArray(entryConnections.targetSaveId, chunk)
        )
      );
    for (const row of rows) {
      connById.set(row.id, row);
    }
  }

  if (connById.size === 0) {
    return resultMap;
  }

  const counterpartIds = new Set<string>();
  for (const conn of connById.values()) {
    if (resultMap.has(conn.sourceSaveId) && ownerBySaveId.get(conn.sourceSaveId) === conn.userId) {
      counterpartIds.add(conn.targetSaveId);
    }
    if (resultMap.has(conn.targetSaveId) && ownerBySaveId.get(conn.targetSaveId) === conn.userId) {
      counterpartIds.add(conn.sourceSaveId);
    }
  }

  if (counterpartIds.size === 0) {
    return resultMap;
  }

  const counterpartList = Array.from(counterpartIds);
  const saveRecordsById = new Map<
    string,
    { save: typeof userSaves.$inferSelect; entity: typeof globalEntities.$inferSelect | null }
  >();

  for (let i = 0; i < counterpartList.length; i += CHUNK_SIZE) {
    const chunk = counterpartList.slice(i, i + CHUNK_SIZE);
    const records = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(inArray(userSaves.id, chunk));
    for (const rec of records) {
      saveRecordsById.set(rec.save.id, rec);
    }
  }

  const sanitize = Boolean(options?.sanitizeForPublic);

  const buildItem = (
    conn: typeof entryConnections.$inferSelect,
    anchorSaveId: string,
    otherSaveId: string,
    direction: "outgoing" | "incoming"
  ): ConnectedItem | null => {
    const ownerId = ownerBySaveId.get(anchorSaveId);
    if (!ownerId || conn.userId !== ownerId) return null;
    const saveRecord = saveRecordsById.get(otherSaveId);
    if (!saveRecord || saveRecord.save.userId !== ownerId) return null;
    if (sanitize && (saveRecord.save.isPrivateMemo || !saveRecord.entity)) {
      return null;
    }
    const title = sanitize
      ? saveRecord.entity?.title || "Untitled Element"
      : saveRecord.save.privateTitle || saveRecord.entity?.title || "Untitled Element";

    return {
      connectionId: conn.id,
      connectionType: conn.connectionType as ConnectionType,
      contextNote: sanitize ? null : conn.contextNote,
      direction,
      saveId: otherSaveId,
      title,
      heroImageUrl: saveRecord.entity?.heroImageUrl || null,
      coreType: saveRecord.entity?.coreType || "UNKNOWN",
      typePath: saveRecord.save.typePath || saveRecord.entity?.typePath || null,
      weight: conn.weight,
      confidence: conn.confidence,
      isBidirectional: conn.isBidirectional,
      metadata: sanitize ? {} : conn.metadata || {},
    };
  };

  for (const conn of connById.values()) {
    if (resultMap.has(conn.sourceSaveId)) {
      const item = buildItem(conn, conn.sourceSaveId, conn.targetSaveId, "outgoing");
      if (item) {
        resultMap.get(conn.sourceSaveId)!.push(item);
      }
    }
    if (resultMap.has(conn.targetSaveId)) {
      const item = buildItem(conn, conn.targetSaveId, conn.sourceSaveId, "incoming");
      if (item) {
        resultMap.get(conn.targetSaveId)!.push(item);
      }
    }
  }

  return resultMap;
}
