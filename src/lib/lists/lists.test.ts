import { describe, expect, it } from "bun:test";
import { db, users, userSaves, globalEntities, smartLists, listItems } from "@/db";
import {
  createList,
  getUserLists,
  addItemToList,
  removeItemFromList,
  toggleSaveInLists,
  reorderListItems,
  getListBySlugWithItems,
} from "./service";

describe("Smart Lists, Curated Boards & Editorial Sections Engine", () => {
  it("creates a list with auto-generated unique slug", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `curator-${timestamp}@curio.local`,
        username: `curator_${timestamp}`,
        displayName: "Chef Curator",
      })
      .returning();

    const title = `Dinner Party ${timestamp}`;
    const list1 = await createList(user.id, {
      title,
      description: "An evening of natural wine and slow listening",
      visibility: "PUBLIC",
    });

    expect(list1.title).toBe(title);
    expect(list1.slug).toBe(`dinner-party-${timestamp}`);

    // Creating another list with the same title generates unique slug
    const list2 = await createList(user.id, {
      title,
    });

    expect(list2.slug).toBe(`dinner-party-${timestamp}-2`);
  });

  it("adds items with section headers, curator notes, and pinning", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `user-sections-${timestamp}@curio.local`,
        username: `user_sec_${timestamp}`,
      })
      .returning();

    const list = await createList(user.id, {
      title: "Tokyo Weekend Guide",
      visibility: "PUBLIC",
    });

    // Create 3 saves with entities
    const [ent1] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/bar-trench-${timestamp}`,
        urlHash: `hash-trench-${timestamp}`,
        entityKey: `key-trench-${timestamp}`,
        coreType: "PLACE",
        title: "Bar Trench (Ebisu)",
        coreStructuredData: {},
      })
      .returning();

    const [save1] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: ent1.id,
        isPrivateMemo: false,
      })
      .returning();

    const [ent2] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/fuglen-${timestamp}`,
        urlHash: `hash-fuglen-${timestamp}`,
        entityKey: `key-fuglen-${timestamp}`,
        coreType: "PLACE",
        title: "Fuglen Tokyo (Tomigaya)",
        coreStructuredData: {},
      })
      .returning();

    const [save2] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: ent2.id,
        isPrivateMemo: false,
      })
      .returning();

    // Add save1 to "Nightcap" section
    await addItemToList(list.id, save1.id, {
      sectionHeader: "Nightlife",
      curatorNote: "Order the absinthe drip cocktail.",
      isPinned: false,
      positionIndex: 1,
    });

    // Add save2 to "Morning" section, pinned
    await addItemToList(list.id, save2.id, {
      sectionHeader: "Cafes",
      curatorNote: "Best Nordic roast in Shibuya.",
      isPinned: true,
      positionIndex: 0,
    });

    const result = await getListBySlugWithItems(list.slug, user.id);
    expect(result).not.toBeNull();
    expect(result?.itemCount).toBe(2);

    // Verify sections
    const sectionNames = result?.sections.map((s) => s.name);
    expect(sectionNames).toContain("Cafes");
    expect(sectionNames).toContain("Nightlife");

    const cafeSection = result?.sections.find((s) => s.name === "Cafes");
    expect(cafeSection?.items[0].entity?.title).toBe("Fuglen Tokyo (Tomigaya)");
    expect(cafeSection?.items[0].listItem?.curatorNote).toBe("Best Nordic roast in Shibuya.");
    expect(cafeSection?.items[0].listItem?.isPinned).toBe(true);
  });

  it("reorders list items and moves between sections", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `reorder-${timestamp}@curio.local`,
        username: `reorder_${timestamp}`,
      })
      .returning();

    const list = await createList(user.id, { title: "Criterion Picks" });

    const [ent] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/yi-yi-${timestamp}`,
        urlHash: `hash-yiyi-${timestamp}`,
        entityKey: `key-yiyi-${timestamp}`,
        coreType: "MEDIA",
        title: "Yi Yi (Edward Yang)",
        coreStructuredData: {},
      })
      .returning();

    const [save] = await db
      .insert(userSaves)
      .values({ userId: user.id, entityId: ent.id, isPrivateMemo: false })
      .returning();

    await addItemToList(list.id, save.id, { positionIndex: 5, sectionHeader: "Drama" });

    await reorderListItems(list.id, [
      { saveId: save.id, positionIndex: 0, sectionHeader: "Masterpieces" },
    ]);

    const result = await getListBySlugWithItems(list.slug, user.id);
    const item = result?.sections[0]?.items[0];
    expect(item?.listItem?.positionIndex).toBe(0);
    expect(item?.listItem?.sectionHeader).toBe("Masterpieces");
  });

  it("auto-populates saves dynamically based on autoRules", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `autorule-${timestamp}@curio.local`,
        username: `autorule_${timestamp}`,
      })
      .returning();

    // Create a smart list with auto rule: coreType == "MEDIA" and tagsInclude "vinyl"
    const list = await createList(user.id, {
      title: "Vinyl Collection Smart List",
      autoRules: {
        coreType: "MEDIA",
        tagsInclude: ["vinyl"],
      },
    });

    // Save 1: matches rule
    const [ent1] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/blue-train-${timestamp}`,
        urlHash: `hash-bluetrain-${timestamp}`,
        entityKey: `key-bluetrain-${timestamp}`,
        coreType: "MEDIA",
        title: "Blue Train (John Coltrane)",
        coreStructuredData: {},
      })
      .returning();

    await db.insert(userSaves).values({
      userId: user.id,
      entityId: ent1.id,
      autoTags: ["jazz", "vinyl"],
      isPrivateMemo: false,
    });

    // Save 2: Book (does NOT match coreType)
    const [ent2] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/book-${timestamp}`,
        urlHash: `hash-book-${timestamp}`,
        entityKey: `key-book-${timestamp}`,
        coreType: "BOOK",
        title: "Norwegian Wood",
        coreStructuredData: {},
      })
      .returning();

    await db.insert(userSaves).values({
      userId: user.id,
      entityId: ent2.id,
      autoTags: ["vinyl"], // has tag but wrong coreType
      isPrivateMemo: false,
    });

    const result = await getListBySlugWithItems(list.slug, user.id);
    expect(result?.itemCount).toBe(1);
    expect(result?.sections[0].items[0].entity?.title).toBe("Blue Train (John Coltrane)");
  });

  it("enforces privacy rules for private lists", async () => {
    const timestamp = Date.now();
    const [owner] = await db
      .insert(users)
      .values({
        email: `owner-${timestamp}@curio.local`,
        username: `owner_${timestamp}`,
      })
      .returning();

    const [stranger] = await db
      .insert(users)
      .values({
        email: `stranger-${timestamp}@curio.local`,
        username: `stranger_${timestamp}`,
      })
      .returning();

    const privateList = await createList(owner.id, {
      title: "Secret Gifting Ideas",
      visibility: "PRIVATE",
    });

    // Owner can access
    const ownerView = await getListBySlugWithItems(privateList.slug, owner.id);
    expect(ownerView).not.toBeNull();
    expect(ownerView?.list.title).toBe("Secret Gifting Ideas");

    // Stranger is forbidden
    expect(async () => {
      await getListBySlugWithItems(privateList.slug, stranger.id);
    }).toThrow("FORBIDDEN: Private list");
  });
});
