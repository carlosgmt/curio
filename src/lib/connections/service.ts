import { db, entryConnections, userSaves, globalEntities } from "@/db";
import { eq, or, and } from "drizzle-orm";

export type ConnectionType =
  // Sensory & Culinary
  | "PAIRED_WITH"
  | "SOUNDTRACK_TO"
  | "WORN_ON"
  | "CONSUMED_AT"
  // Aesthetic & Artistic
  | "INFLUENCED_BY"
  | "CONTEMPORARY_WITH"
  | "COUNTERPOINT_TO"
  | "AESTHETIC_SIBLING"
  | "DERIVATION_OF"
  | "INSPIRED_BY"
  // Structural & Physical
  | "MATERIAL_VARIANT"
  | "EVOLUTION_OF"
  | "SAME_CREATOR"
  | "COMPLEMENTARY_TO";

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
    const isOutgoing = conn.sourceSaveId === saveId;
    const otherSaveId = isOutgoing ? conn.targetSaveId : conn.sourceSaveId;

    const [saveRecord] = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.id, otherSaveId))
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
