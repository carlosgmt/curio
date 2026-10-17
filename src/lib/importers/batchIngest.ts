import { db, globalEntities, userSaves } from "@/db";
import { eq } from "drizzle-orm";
import { generateEntityKey, getOrCreateDefaultUser } from "../ingest/cascade";
import type { ImportedFilm } from "./letterboxd";
import type { ImportedBook } from "./goodreads";

export async function ingestImportedItems(
  items: Array<ImportedFilm | ImportedBook>
): Promise<{ insertedCount: number; errors: string[] }> {
  const user = await getOrCreateDefaultUser();
  let insertedCount = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const canonicalUrl =
        "letterboxdUri" in item && item.letterboxdUri
          ? item.letterboxdUri
          : `https://openlibrary.org/search?q=${encodeURIComponent(item.title)}`;

      const { urlHash, entityKey } = generateEntityKey(canonicalUrl, item.title);

      let [entity] = await db
        .select()
        .from(globalEntities)
        .where(eq(globalEntities.entityKey, entityKey))
        .limit(1);

      if (!entity) {
        [entity] = await db
          .insert(globalEntities)
          .values({
            urlHash,
            entityKey,
            canonicalUrl,
            coreType: item.coreType,
            typePath: item.typePath,
            canonicalExternalId: item.canonicalExternalId,
            title: item.title,
            summary: "author" in item ? `By ${item.author}` : "releaseYear" in item ? `Released ${item.releaseYear}` : "",
            coreStructuredData: item.coreStructuredData,
            priceCents: item.coreType === "BOOK" ? 1899 : 399,
            currency: "USD",
          })
          .returning();
      }

      await db.insert(userSaves).values({
        userId: user.id,
        entityId: entity.id,
        typePath: item.typePath,
        isPrivateMemo: false,
        autoTags: [item.coreType.toLowerCase(), item.typePath.split("/").pop() || ""],
        enrichmentStatus: "ENRICHED",
        visibility: "PRIVATE",
      });

      insertedCount++;
    } catch (err: any) {
      errors.push(`Failed to ingest ${item.title}: ${err.message}`);
    }
  }

  return { insertedCount, errors };
}
