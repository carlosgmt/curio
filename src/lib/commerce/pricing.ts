import { db, entityPriceHistory } from "@/db";
import { eq, desc } from "drizzle-orm";

export interface RecordPriceSnapshotParams {
  entityId: string;
  sourceId?: string | null;
  sellerName: string;
  priceCents: number;
  currency?: string;
  inStock?: boolean;
  recordedAt?: string;
}

/**
 * Inserts a time-series price snapshot into entity_price_history.
 * Supports executing inside an optional transaction or the global db client.
 */
export function recordPriceSnapshot(
  params: RecordPriceSnapshotParams,
  executor?: any
) {
  const client = executor || db;
  return client
    .insert(entityPriceHistory)
    .values({
      id: crypto.randomUUID(),
      entityId: params.entityId,
      sourceId: params.sourceId ?? null,
      sellerName: params.sellerName,
      priceCents: params.priceCents,
      currency: params.currency || "USD",
      inStock: params.inStock ?? true,
      recordedAt: params.recordedAt || new Date().toISOString(),
    })
    .run();
}

/**
 * Retrieves the time-series price history for a given entity, ordered by recordedAt descending.
 */
export async function getPriceHistoryForEntity(entityId: string, limit = 50) {
  return db
    .select()
    .from(entityPriceHistory)
    .where(eq(entityPriceHistory.entityId, entityId))
    .orderBy(desc(entityPriceHistory.recordedAt))
    .limit(limit);
}
