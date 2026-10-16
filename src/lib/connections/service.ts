import { db, entryConnections, userSaves, globalEntities } from "@/db";
import { eq, or, and } from "drizzle-orm";

export type ConnectionType =
  | "PAIRED_WITH"
  | "SOUNDTRACK_TO"
  | "WORN_ON"
  | "INSPIRED_BY"
  | "CONSUMED_AT";

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
}) {
  const { userId, sourceSaveId, targetSaveId, connectionType, contextNote } = params;

  if (sourceSaveId === targetSaveId) {
    throw new Error("Cannot connect an item to itself.");
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
  const connections = await db
    .select()
    .from(entryConnections)
    .where(
      or(
        eq(entryConnections.sourceSaveId, saveId),
        eq(entryConnections.targetSaveId, saveId)
      )
    );

  const results: ConnectedItem[] = [];

  for (const conn of connections) {
    const isSource = conn.sourceSaveId === saveId;
    const otherSaveId = isSource ? conn.targetSaveId : conn.sourceSaveId;

    const [otherSave] = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.id, otherSaveId))
      .limit(1);

    if (otherSave) {
      const title = otherSave.save.privateTitle || otherSave.entity?.title || "Untitled Card";
      results.push({
        connectionId: conn.id,
        connectionType: conn.connectionType as ConnectionType,
        contextNote: conn.contextNote,
        direction: isSource ? "outgoing" : "incoming",
        saveId: otherSaveId,
        title,
        heroImageUrl: otherSave.entity?.heroImageUrl || null,
        coreType: otherSave.entity?.coreType || "NOTE",
        typePath: otherSave.save.typePath || otherSave.entity?.typePath || null,
      });
    }
  }

  return results;
}
