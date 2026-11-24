import { describe, expect, it } from "bun:test";
import { eq, and } from "drizzle-orm";
import {
  db,
  entryConnections,
  globalEntities,
  listItems,
  smartLists,
  users,
  userSaves,
} from "@/db";
import { createList } from "@/lib/lists/service";
import {
  clearAdapterSyncCache,
  runSyncAdapter,
  type SyncAdapter,
  type SyncRecord,
} from "../engine";
import {
  getSyncAdapter,
  listSyncAdapters,
  registerSyncAdapter,
} from "../registry";
import "../closet";
import "../letterboxdRss";
import "../goodreadsRss";
import "../purchaseHub";

describe("Reusable Curio SyncEngine & Wishlist Promotion", () => {
  it("creates hierarchical boards with defaultLayout, promotes wishlist saves preserving notes & pairs, skips unchanged digests, and prunes removed items", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `engine-${ts}@curio.local`, username: `engine_${ts}` })
      .returning();

    // Seed pre-existing wishlist item (e.g. from Furnishing board) + a paired lamp save
    const [chairEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `wl-chair-${ts}`,
        entityKey: `manual:hay-chair-${ts}`,
        canonicalUrl: "https://hay.dk/palissade-chair",
        coreType: "PRODUCT",
        typePath: "/product/furniture",
        brandOrCreator: "HAY",
        title: "HAY Palissade Lounge Chair",
        priceCents: 84000,
        currency: "CHF",
        coreStructuredData: {},
        extendedAttributes: {},
      })
      .returning();

    const [chairSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: chairEntity.id,
        wishlist: true,
        typePath: "/product/furniture",
        personalNotes: "For south balcony corner with sage cushion",
        autoTags: ["balcony"],
      })
      .returning();

    const [lampEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `wl-lamp-${ts}`,
        entityKey: `manual:flos-lamp-${ts}`,
        canonicalUrl: `https://flos.com/lamp-${ts}`,
        coreType: "PRODUCT",
        typePath: "/product/furniture",
        brandOrCreator: "Flos",
        title: "Flos Mayday Lamp",
        coreStructuredData: {},
        extendedAttributes: {},
      })
      .returning();

    const [lampSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: lampEntity.id,
        wishlist: true,
        typePath: "/product/furniture",
      })
      .returning();

    const furnishingBoard = await createList(user.id, {
      title: `Furnishing-${ts}`,
      visibility: "PRIVATE",
    });
    await db.insert(listItems).values({
      listId: furnishingBoard.id,
      saveId: chairSave.id,
      positionIndex: 0,
    });

    await db.insert(entryConnections).values({
      userId: user.id,
      sourceSaveId: chairSave.id,
      targetSaveId: lampSave.id,
      connectionType: "PAIRED_WITH",
      contextNote: "Balcony reading setup",
      isBidirectional: true,
    });

    const boardRootSlug = `my-stuff-${ts}`;
    const boardSubSlug = `my-stuff-furniture-${ts}`;

    let currentRecords: SyncRecord[] = [
      {
        externalId: `prd_chair_${ts}`,
        entityKey: `test-hub:prd_chair_${ts}`,
        canonicalUrl: "https://hay.dk/palissade-chair?utm_source=gmail",
        coreType: "PRODUCT",
        typePath: "/product/furniture",
        title: "HAY Palissade Chair",
        brandOrCreator: "HAY",
        priceCents: 79000,
        currency: "CHF",
        tags: ["Outdoor", "owner:home"],
        boards: [
          {
            rootSlug: boardRootSlug,
            rootTitle: "My Stuff",
            rootDefaultLayout: "shelf",
            subSlug: boardSubSlug,
            subTitle: "Furniture",
            subDefaultLayout: "shelf",
            sectionHeader: "Living Room",
          },
        ],
      },
      {
        externalId: `prd_kettle_${ts}`,
        entityKey: `test-hub:prd_kettle_${ts}`,
        canonicalUrl: `https://fellowproducts.com/kettle-${ts}`,
        coreType: "PRODUCT",
        typePath: "/product",
        title: "Fellow Stagg EKG Pro",
        brandOrCreator: "Fellow",
        priceCents: 19500,
        currency: "CHF",
        tags: ["Espresso Setup"],
        boards: [
          {
            rootSlug: boardRootSlug,
            rootTitle: "My Stuff",
            rootDefaultLayout: "shelf",
            subSlug: `my-stuff-kitchen-${ts}`,
            subTitle: "Home & Kitchen",
            subDefaultLayout: "shelf",
            sectionHeader: "Espresso Setup",
          },
        ],
      },
    ];
    let currentDigest = `d1-${ts}`;

    const adapter: SyncAdapter = {
      sourceId: `test-hub-${ts}`,
      displayName: "Test Hub",
      supportsWishlistPromotion: true,
      supportsPruning: true,
      keyPrefix: `test-hub:`,
      async fetchSnapshot() {
        return { digest: currentDigest, records: currentRecords };
      },
    };

    registerSyncAdapter(adapter);
    expect(getSyncAdapter(adapter.sourceId)).toBe(adapter);
    expect(listSyncAdapters().some((a) => a.sourceId === adapter.sourceId)).toBe(true);

    // 1. First sync: promotes chairSave via normalized URL, creates kettleSave & hierarchical boards
    const r1 = await runSyncAdapter(user.id, adapter, { force: true });
    expect(r1.synced).toBe(true);
    expect(r1.promotedFromWishlist).toBe(1);
    expect(r1.createdSaves).toBe(1);
    expect(r1.boardsCreated).toBe(3); // root + 2 category sub-boards

    const [promotedChair] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.id, chairSave.id));
    expect(promotedChair.wishlist).toBe(false);
    expect(promotedChair.hasConvertedPurchase).toBe(true);
    expect(promotedChair.personalNotes).toBe("For south balcony corner with sage cushion");
    expect(promotedChair.autoTags).toContain("balcony");
    expect(promotedChair.autoTags).toContain("Outdoor");

    // Verify original board & synaptic pair are preserved
    const chairBoards = await db
      .select({ slug: smartLists.slug, parentId: smartLists.parentId, defaultLayout: smartLists.defaultLayout })
      .from(listItems)
      .innerJoin(smartLists, eq(listItems.listId, smartLists.id))
      .where(eq(listItems.saveId, chairSave.id));
    expect(chairBoards.some((b) => b.slug === furnishingBoard.slug)).toBe(true);
    const syncedSub = chairBoards.find((b) => b.slug === boardSubSlug);
    expect(syncedSub?.defaultLayout).toBe("shelf");
    expect(syncedSub?.parentId).toBeTruthy();

    const conns = await db
      .select()
      .from(entryConnections)
      .where(eq(entryConnections.sourceSaveId, chairSave.id));
    expect(conns.length).toBe(1);

    // 2. Same digest skips cleanly
    const r2 = await runSyncAdapter(user.id, adapter);
    expect(r2.synced).toBe(false);
    expect(r2.skippedReason).toBe("unchanged_digest");

    // 3. Removing kettle upstream prunes only the orphaned synced save (not chairSave or private memos)
    currentRecords = [currentRecords[0]];
    currentDigest = `d2-${ts}`;
    const r3 = await runSyncAdapter(user.id, adapter, { force: true });
    expect(r3.synced).toBe(true);
    expect(r3.prunedSaves).toBe(1);

    const remainingSaves = await db
      .select()
      .from(userSaves)
      .where(and(eq(userSaves.userId, user.id)));
    expect(remainingSaves.some((s) => s.id === chairSave.id)).toBe(true);

    clearAdapterSyncCache(adapter.sourceId, user.id);
  });

  it("registers all four built-in adapters in the shared registry", () => {
    const ids = new Set(listSyncAdapters().map((a) => a.sourceId));
    expect(ids.has("purchase-hub")).toBe(true);
    expect(ids.has("closet")).toBe(true);
    expect(ids.has("letterboxd")).toBe(true);
    expect(ids.has("goodreads")).toBe(true);
  });
});
