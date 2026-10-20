import { describe, expect, it } from "bun:test";
import { db, curioTypes, globalEntities, entitySources, userSaves, users } from "./index";
import { seedCanonicalArchetypes, CANONICAL_ARCHETYPES } from "./seed";
import { eq } from "drizzle-orm";

describe("Schema & Canonical Ontology Integrity", () => {
  it("has seeded all 8 canonical archetypes with valid silhouettes", async () => {
    await seedCanonicalArchetypes();

    const types = await db.select().from(curioTypes);
    expect(types.length).toBeGreaterThanOrEqual(8);

    for (const archetype of CANONICAL_ARCHETYPES) {
      const found = types.find((t) => t.typePath === archetype.typePath);
      expect(found).toBeDefined();
      expect(found?.defaultSilhouette).toBe(archetype.defaultSilhouette);
      expect(found?.rootArchetype).toBe(archetype.rootArchetype);
    }
  });

  it("supports multi-merchant entity_sources linking to global_entities", async () => {
    // 1. Create a test global entity
    const [entity] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: "https://example.com/test-vinyl",
        urlHash: "test-hash-vinyl-" + Date.now(),
        entityKey: "test-key-vinyl-" + Date.now(),
        coreType: "MEDIA",
        typePath: "/media/music/vinyl",
        title: "Kind of Blue (Vinyl Reissue)",
        summary: "Miles Davis iconic 1959 jazz masterpiece",
        coreStructuredData: { artist: "Miles Davis", releaseYear: 1959 },
      })
      .returning();

    expect(entity).toBeDefined();
    expect(entity.typePath).toBe("/media/music/vinyl");

    // 2. Add two retailer sources (e.g. Amazon vs Discogs)
    const [sourceAmazon] = await db
      .insert(entitySources)
      .values({
        entityId: entity.id,
        sellerName: "Amazon",
        sourceUrl: "https://amazon.com/dp/test1234",
        urlHash: "hash-amazon-" + Date.now(),
        priceCents: 2999,
        currency: "USD",
        affiliateTemplate: "https://amazon.com/dp/test1234?tag=curio-20",
        inStock: true,
      })
      .returning();

    const [sourceDiscogs] = await db
      .insert(entitySources)
      .values({
        entityId: entity.id,
        sellerName: "Discogs",
        sourceUrl: "https://discogs.com/release/test5678",
        urlHash: "hash-discogs-" + Date.now(),
        priceCents: 3450,
        currency: "USD",
        inStock: true,
      })
      .returning();

    expect(sourceAmazon.priceCents).toBe(2999);
    expect(sourceDiscogs.sellerName).toBe("Discogs");

    // 3. Verify querying sources for this entity
    const sources = await db
      .select()
      .from(entitySources)
      .where(eq(entitySources.entityId, entity.id));

    expect(sources.length).toBe(2);
  });

  it("handles float32Array(768) vector serialization and deserialization roundtrips without dimension loss", () => {
    const { float32Array } = require("./schema");
    const testVec = Array.from({ length: 768 }, (_, i) => Math.sin(i));

    // toDriver converts to Buffer
    const buffer = float32Array.toDriver(testVec);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBe(768 * 4); // 768 float32 values = 3072 bytes

    // fromDriver handles Node Buffer
    const restoredFromBuffer = float32Array.fromDriver(buffer);
    expect(restoredFromBuffer.length).toBe(768);
    for (let i = 0; i < 768; i++) {
      expect(Math.abs(restoredFromBuffer[i] - testVec[i])).toBeLessThan(1e-6);
    }

    // fromDriver handles Uint8Array with byteOffset
    const subArray = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const restoredFromUint8 = float32Array.fromDriver(subArray);
    expect(restoredFromUint8.length).toBe(768);
    for (let i = 0; i < 768; i++) {
      expect(Math.abs(restoredFromUint8[i] - testVec[i])).toBeLessThan(1e-6);
    }

    // fromDriver handles JSON string fallback
    const jsonStr = JSON.stringify(testVec);
    const restoredFromJson = float32Array.fromDriver(jsonStr);
    expect(restoredFromJson.length).toBe(768);

    // Empty/null fallback
    expect(float32Array.fromDriver(null)).toEqual([]);
    expect(float32Array.fromDriver(undefined)).toEqual([]);
  });
});
