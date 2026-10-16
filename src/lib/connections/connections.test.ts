import { describe, expect, it } from "bun:test";
import { db, userSaves, globalEntities } from "@/db";
import { getOrCreateDefaultUser } from "../ingest/cascade";
import { createConnection, getConnectedSaves, deleteConnection } from "./service";

describe("Synaptic Connections & Pairings Engine", () => {
  it("creates bidirectional memory edge and retrieves connected items", async () => {
    const user = await getOrCreateDefaultUser();

    // 1. Create two saves (e.g. A natural wine save and a vinyl jazz record)
    const [wineEntity] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: "https://example.com/chateau-musar-2015",
        urlHash: "hash-wine-" + Date.now(),
        entityKey: "key-wine-" + Date.now(),
        coreType: "PRODUCT",
        typePath: "/product/beverage/wine",
        title: "Château Musar (2015)",
        summary: "Iconic Bekaa Valley natural vintage",
        coreStructuredData: {},
      })
      .returning();

    const [wineSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: wineEntity.id,
        typePath: "/product/beverage/wine",
        isPrivateMemo: false,
      })
      .returning();

    const [vinylEntity] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: "https://example.com/kind-of-blue-vinyl",
        urlHash: "hash-vinyl-" + Date.now(),
        entityKey: "key-vinyl-" + Date.now(),
        coreType: "MEDIA",
        typePath: "/media/music/vinyl",
        title: "Kind of Blue (Vinyl)",
        summary: "Miles Davis 1959 quintet",
        coreStructuredData: {},
      })
      .returning();

    const [vinylSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: vinylEntity.id,
        typePath: "/media/music/vinyl",
        isPrivateMemo: false,
      })
      .returning();

    // 2. Establish Synapse: Wine is paired with Jazz soundtrack
    const connection = await createConnection({
      userId: user.id,
      sourceSaveId: wineSave.id,
      targetSaveId: vinylSave.id,
      connectionType: "SOUNDTRACK_TO",
      contextNote: "Uncorking during evening listening session",
    });

    expect(connection).toBeDefined();
    expect(connection.connectionType).toBe("SOUNDTRACK_TO");

    // 3. Bidirectional Retrieval: Check from Wine perspective
    const wineConnections = await getConnectedSaves(wineSave.id);
    expect(wineConnections.length).toBe(1);
    expect(wineConnections[0].title).toBe("Kind of Blue (Vinyl)");
    expect(wineConnections[0].connectionType).toBe("SOUNDTRACK_TO");

    // 4. Bidirectional Retrieval: Check from Vinyl perspective
    const vinylConnections = await getConnectedSaves(vinylSave.id);
    expect(vinylConnections.length).toBe(1);
    expect(vinylConnections[0].title).toBe("Château Musar (2015)");

    // 5. Delete Edge
    const deleted = await deleteConnection(connection.id, user.id);
    expect(deleted).toBeDefined();

    const postDeleteWine = await getConnectedSaves(wineSave.id);
    expect(postDeleteWine.length).toBe(0);
  });

  it("prevents self-pairing", async () => {
    const user = await getOrCreateDefaultUser();
    expect(
      createConnection({
        userId: user.id,
        sourceSaveId: "same-id",
        targetSaveId: "same-id",
        connectionType: "PAIRED_WITH",
      })
    ).rejects.toThrow("Cannot connect an item to itself.");
  });
});
