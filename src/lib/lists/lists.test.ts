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
  getBoardAncestors,
  getBoardTree,
  updateBoard,
  reorderBoards,
  deleteBoard,
  getSaveBoardMemberships,
} from "./service";
import { registerUser } from "@/lib/auth/service";

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

  it("sanitizes private titles, notes, and custom fields on public lists when viewed by strangers", async () => {
    const timestamp = Date.now();
    const [owner] = await db
      .insert(users)
      .values({
        email: `vitrine-owner-${timestamp}@curio.local`,
        username: `vitrine_owner_${timestamp}`,
      })
      .returning();

    const [stranger] = await db
      .insert(users)
      .values({
        email: `vitrine-stranger-${timestamp}@curio.local`,
        username: `vitrine_stranger_${timestamp}`,
      })
      .returning();

    const list = await createList(owner.id, {
      title: "Public Wine Vitrine",
      visibility: "PUBLIC",
    });

    const [entity] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/jurawine-${timestamp}`,
        urlHash: `hash-jura-${timestamp}`,
        entityKey: `key-jura-${timestamp}`,
        coreType: "PRODUCT",
        typePath: "/product/beverage/wine",
        title: "Overnoy Houillon Poulsard",
        coreStructuredData: {},
      })
      .returning();

    const [save] = await db
      .insert(userSaves)
      .values({
        userId: owner.id,
        entityId: entity.id,
        typePath: "/product/beverage/wine",
        privateTitle: "Private Secret Bottle",
        personalNotes: "Purchased under the table in Arbois for 80 EUR. Do not share.",
        userCustomValues: {
          producer: "Overnoy", // valid publicFieldKey in wine schema
          secretMerchantContact: "+33 6 12 34 56 78", // private non-public key
        },
        isPrivateMemo: false,
        visibility: "PUBLIC",
      })
      .returning();

    await addItemToList(list.id, save.id);

    // 1. Owner view: retains privateTitle, personalNotes, and private custom values
    const ownerView = await getListBySlugWithItems(list.slug, owner.id);
    const ownerItem = ownerView?.sections[0].items[0];
    expect(ownerItem?.save.privateTitle).toBe("Private Secret Bottle");
    expect(ownerItem?.save.personalNotes).toContain("Purchased under the table");
    expect((ownerItem?.save.userCustomValues as any)?.secretMerchantContact).toBe("+33 6 12 34 56 78");
    expect((ownerItem?.save.userCustomValues as any)?.producer).toBe("Overnoy");

    // 2. Stranger view: sanitized
    const strangerView = await getListBySlugWithItems(list.slug, stranger.id);
    const strangerItem = strangerView?.sections[0].items[0];
    expect(strangerItem?.save.privateTitle).toBeNull();
    expect(strangerItem?.save.personalNotes).toBeNull();
    expect((strangerItem?.save.userCustomValues as any)?.secretMerchantContact).toBeUndefined();
    expect((strangerItem?.save.userCustomValues as any)?.producer).toBe("Overnoy");

    // 3. Unauthenticated view (no viewerUserId): also sanitized
    const unauthView = await getListBySlugWithItems(list.slug);
    const unauthItem = unauthView?.sections[0].items[0];
    expect(unauthItem?.save.privateTitle).toBeNull();
    expect(unauthItem?.save.personalNotes).toBeNull();
    expect((unauthItem?.save.userCustomValues as any)?.secretMerchantContact).toBeUndefined();
    expect((unauthItem?.save.userCustomValues as any)?.producer).toBe("Overnoy");
  });

  it("auto-populates films list with /media/film saves correctly", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `films-${timestamp}@curio.local`,
        username: `films_${timestamp}`,
      })
      .returning();

    // Create a list with slug "films"
    const list = await createList(user.id, {
      title: "Films",
      slug: "films",
      autoRules: {
        coreType: "MEDIA",
      },
    });

    // Save with typePath /media/film and coreType "PRODUCT" or "MEDIA"
    const [ent] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/film-${timestamp}`,
        urlHash: `hash-film-${timestamp}`,
        entityKey: `key-film-${timestamp}`,
        coreType: "MEDIA",
        typePath: "/media/film",
        title: "Past Lives",
        coreStructuredData: {},
      })
      .returning();

    await db.insert(userSaves).values({
      userId: user.id,
      entityId: ent.id,
      typePath: "/media/film",
      isPrivateMemo: false,
    });

    const result = await getListBySlugWithItems("films", user.id);
    expect(result?.itemCount).toBe(1);
    expect(result?.sections[0].items[0].entity?.title).toBe("Past Lives");
  });

  it("creates nested child boards with parentId and computes ancestor breadcrumbs", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `hierarchy-${timestamp}@curio.local`,
        username: `hierarchy_${timestamp}`,
      })
      .returning();

    // 1. Root board
    const travel = await createList(user.id, {
      title: "Travel",
      visibility: "PUBLIC",
    });
    expect(travel.parentId).toBeNull();

    // 2. Child board under Travel
    const japan = await createList(user.id, {
      title: "Japan 2026",
      parentId: travel.id,
      visibility: "PUBLIC",
    });
    expect(japan.parentId).toBe(travel.id);

    // 3. Grandchild board under Japan 2026
    const tokyo = await createList(user.id, {
      title: "Tokyo",
      parentId: japan.id,
      visibility: "PUBLIC",
    });
    expect(tokyo.parentId).toBe(japan.id);

    // Test ancestors for Tokyo
    const tokyoAncestors = await getBoardAncestors(tokyo.id);
    expect(tokyoAncestors).toHaveLength(2);
    expect(tokyoAncestors[0].id).toBe(travel.id);
    expect(tokyoAncestors[0].title).toBe("Travel");
    expect(tokyoAncestors[1].id).toBe(japan.id);
    expect(tokyoAncestors[1].title).toBe("Japan 2026");

    // Test ancestors for Japan
    const japanAncestors = await getBoardAncestors(japan.id);
    expect(japanAncestors).toHaveLength(1);
    expect(japanAncestors[0].id).toBe(travel.id);

    // Test ancestors for Travel (root)
    const travelAncestors = await getBoardAncestors(travel.id);
    expect(travelAncestors).toHaveLength(0);
  });

  it("supports Many-to-Many memberships: single card assigned to root board and multiple nested sub-boards across different branches", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `m2m-${timestamp}@curio.local`,
        username: `m2m_${timestamp}`,
      })
      .returning();

    // Branch 1: Favorites (root)
    const favorites = await createList(user.id, { title: "Favorites" });

    // Branch 2: Travel > Japan > Tokyo
    const travel = await createList(user.id, { title: "Travel" });
    const japan = await createList(user.id, { title: "Japan", parentId: travel.id });
    const tokyo = await createList(user.id, { title: "Tokyo", parentId: japan.id });

    // Branch 3: Food > Ramen
    const food = await createList(user.id, { title: "Food" });
    const ramen = await createList(user.id, { title: "Ramen Spots", parentId: food.id });

    // Create a restaurant card
    const [ent] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/ramen-${timestamp}`,
        urlHash: `hash-ramen-${timestamp}`,
        entityKey: `key-ramen-${timestamp}`,
        coreType: "PLACE",
        title: "Ramen Yashichi",
        coreStructuredData: {},
      })
      .returning();

    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: ent.id,
        isPrivateMemo: false,
      })
      .returning();

    // Assign the single card to favorites, tokyo, and ramen simultaneously
    const syncRes = await toggleSaveInLists(
      save.id,
      [favorites.id, tokyo.id, ramen.id],
      user.id
    );
    expect(syncRes.added).toHaveLength(3);
    expect(syncRes.added).toContain(favorites.id);
    expect(syncRes.added).toContain(tokyo.id);
    expect(syncRes.added).toContain(ramen.id);

    // Verify card exists in Favorites
    const favBoard = await getListBySlugWithItems(favorites.slug, user.id);
    expect(favBoard?.itemCount).toBe(1);
    expect(favBoard?.sections[0].items[0].entity?.title).toBe("Ramen Yashichi");

    // Verify card exists in Tokyo (nested 2 levels)
    const tokyoBoard = await getListBySlugWithItems(tokyo.slug, user.id);
    expect(tokyoBoard?.itemCount).toBe(1);
    expect(tokyoBoard?.sections[0].items[0].entity?.title).toBe("Ramen Yashichi");

    // Verify card exists in Ramen (nested 1 level in different branch)
    const ramenBoard = await getListBySlugWithItems(ramen.slug, user.id);
    expect(ramenBoard?.itemCount).toBe(1);
    expect(ramenBoard?.sections[0].items[0].entity?.title).toBe("Ramen Yashichi");

    // Remove from ramen while retaining in favorites and tokyo
    await toggleSaveInLists(save.id, [favorites.id, tokyo.id], user.id);

    const favBoardAfter = await getListBySlugWithItems(favorites.slug, user.id);
    expect(favBoardAfter?.itemCount).toBe(1);

    const tokyoBoardAfter = await getListBySlugWithItems(tokyo.slug, user.id);
    expect(tokyoBoardAfter?.itemCount).toBe(1);

    const ramenBoardAfter = await getListBySlugWithItems(ramen.slug, user.id);
    expect(ramenBoardAfter?.itemCount).toBe(0);
  });

  it("prevents cycles when updating parentId", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `cycles-${timestamp}@curio.local`,
        username: `cycles_${timestamp}`,
      })
      .returning();

    const boardA = await createList(user.id, { title: "Board A" });
    const boardB = await createList(user.id, { title: "Board B", parentId: boardA.id });
    const boardC = await createList(user.id, { title: "Board C", parentId: boardB.id });

    // 1. Setting board as its own parent throws error
    expect(async () => {
      await updateBoard(boardA.id, { parentId: boardA.id });
    }).toThrow("cycle detected");

    // 2. Setting board A's parent to board B (which is direct child of A) throws error
    expect(async () => {
      await updateBoard(boardA.id, { parentId: boardB.id });
    }).toThrow("cycle detected");

    // 3. Setting board A's parent to board C (which is grandchild of A) throws error
    expect(async () => {
      await updateBoard(boardA.id, { parentId: boardC.id });
    }).toThrow("cycle detected");

    // 4. Moving board C to top-level (parentId: null) succeeds
    const updatedC = await updateBoard(boardC.id, { parentId: null });
    expect(updatedC.parentId).toBeNull();
  });

  it("reorders sibling boards under common parent", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `reorder-b-${timestamp}@curio.local`,
        username: `reorder_b_${timestamp}`,
      })
      .returning();

    const parent = await createList(user.id, { title: "Design Systems" });
    const child1 = await createList(user.id, { title: "Typography", parentId: parent.id, positionIndex: 0 });
    const child2 = await createList(user.id, { title: "Colors", parentId: parent.id, positionIndex: 1 });
    const child3 = await createList(user.id, { title: "Icons", parentId: parent.id, positionIndex: 2 });

    // Reorder to: Icons (child3), Typography (child1), Colors (child2)
    await reorderBoards(parent.id, [child3.id, child1.id, child2.id]);

    const siblings = await getUserLists(user.id, { parentId: parent.id });
    expect(siblings[0].id).toBe(child3.id);
    expect(siblings[0].positionIndex).toBe(0);
    expect(siblings[1].id).toBe(child1.id);
    expect(siblings[1].positionIndex).toBe(1);
    expect(siblings[2].id).toBe(child2.id);
    expect(siblings[2].positionIndex).toBe(2);
  });

  it("builds N-level hierarchy board tree with getBoardTree", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `tree-${timestamp}@curio.local`,
        username: `tree_${timestamp}`,
      })
      .returning();

    // Build tree:
    // Root 1
    //  ├─ Child 1.1
    //  │   └─ Grandchild 1.1.1
    //  └─ Child 1.2
    // Root 2
    const root1 = await createList(user.id, { title: "Root 1", positionIndex: 0 });
    const child11 = await createList(user.id, { title: "Child 1.1", parentId: root1.id, positionIndex: 0 });
    const grandchild111 = await createList(user.id, { title: "Grandchild 1.1.1", parentId: child11.id, positionIndex: 0 });
    const child12 = await createList(user.id, { title: "Child 1.2", parentId: root1.id, positionIndex: 1 });
    const root2 = await createList(user.id, { title: "Root 2", positionIndex: 1 });

    const tree = await getBoardTree(user.id);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe(root1.id);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].id).toBe(child11.id);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe(grandchild111.id);
    expect(tree[0].children[1].id).toBe(child12.id);
    expect(tree[1].id).toBe(root2.id);
    expect(tree[1].children).toHaveLength(0);
  });

  it("resolves children boards with items and counts in getListBySlugWithItems", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `children-${timestamp}@curio.local`,
        username: `children_${timestamp}`,
      })
      .returning();

    const parent = await createList(user.id, { title: "Music Library" });
    const jazz = await createList(user.id, { title: "Jazz", parentId: parent.id });

    // Add a card to Jazz child board
    const [ent] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/miles-${timestamp}`,
        urlHash: `hash-miles-${timestamp}`,
        entityKey: `key-miles-${timestamp}`,
        coreType: "MEDIA",
        title: "Kind of Blue",
        coreStructuredData: {},
      })
      .returning();

    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: ent.id,
        isPrivateMemo: false,
      })
      .returning();

    await addItemToList(jazz.id, save.id);

    const parentDetails = await getListBySlugWithItems(parent.slug, user.id);
    expect(parentDetails?.children).toHaveLength(1);
    expect(parentDetails?.children[0].id).toBe(jazz.id);
    expect(parentDetails?.children[0].title).toBe("Jazz");
    expect(parentDetails?.children[0].itemCount).toBe(1);
    expect(parentDetails?.children[0].sections?.[0].items[0].entity?.title).toBe("Kind of Blue");
  });

  it("enforces ownership in reorderBoards & updateBoard, isolates Films from Music via typePathPrefix, computes O(1) memberships, and deletes boards safely", async () => {
    const timestamp = Date.now();
    const [owner] = await db
      .insert(users)
      .values({
        email: `sec-owner-${timestamp}@curio.local`,
        username: `sec_owner_${timestamp}`,
      })
      .returning();

    const [attacker] = await db
      .insert(users)
      .values({
        email: `sec-attacker-${timestamp}@curio.local`,
        username: `sec_attacker_${timestamp}`,
      })
      .returning();

    const board1 = await createList(owner.id, { title: "Owner Board 1", positionIndex: 0 });
    const board2 = await createList(owner.id, { title: "Owner Board 2", positionIndex: 1 });

    // 1. Cross-tenant reorderBoards cannot mutate owner's board order
    await reorderBoards(null, [board2.id, board1.id], attacker.id);
    const ownerBoardsAfterAttack = await getUserLists(owner.id);
    expect(ownerBoardsAfterAttack.find((b) => b.id === board1.id)?.positionIndex).toBe(0);
    expect(ownerBoardsAfterAttack.find((b) => b.id === board2.id)?.positionIndex).toBe(1);

    // Cross-tenant parentId reorder throws FORBIDDEN
    expect(async () => {
      await reorderBoards(board1.id, [board2.id], attacker.id);
    }).toThrow("FORBIDDEN");

    // Cross-tenant updateBoard throws FORBIDDEN
    expect(async () => {
      await updateBoard(board1.id, { title: "Hijacked" }, attacker.id);
    }).toThrow("FORBIDDEN");

    // 2. Films board with typePathPrefix '/media/film' includes films and strictly excludes music albums
    const filmsBoard = await createList(owner.id, {
      title: "Cinema Only",
      autoRules: { typePathPrefix: "/media/film" },
    });

    const [filmEntity] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/anatomy-${timestamp}`,
        urlHash: `hash-anatomy-${timestamp}`,
        entityKey: `key-anatomy-${timestamp}`,
        coreType: "MEDIA",
        typePath: "/media/film",
        title: "Anatomy of a Fall",
        coreStructuredData: {},
      })
      .returning();

    const [musicEntity] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/omega-${timestamp}`,
        urlHash: `hash-omega-${timestamp}`,
        entityKey: `key-omega-${timestamp}`,
        coreType: "MEDIA",
        typePath: "/media/music/album",
        title: "Omega",
        coreStructuredData: {},
      })
      .returning();

    const [filmSave] = await db
      .insert(userSaves)
      .values({
        userId: owner.id,
        entityId: filmEntity.id,
        typePath: "/media/film",
        isPrivateMemo: false,
      })
      .returning();

    const [musicSave] = await db
      .insert(userSaves)
      .values({
        userId: owner.id,
        entityId: musicEntity.id,
        typePath: "/media/music/album",
        isPrivateMemo: false,
      })
      .returning();

    const filmsView = await getListBySlugWithItems(filmsBoard.slug, owner.id);
    expect(filmsView?.itemCount).toBe(1);
    expect(filmsView?.sections[0]?.items[0]?.entity?.title).toBe("Anatomy of a Fall");

    // 3. Single-pass getSaveBoardMemberships reports manual vs auto membership accurately
    await addItemToList(board1.id, filmSave.id);
    const membershipsForFilm = await getSaveBoardMemberships(owner.id, filmSave.id);
    const b1Mem = membershipsForFilm.find((m) => m.id === board1.id);
    const filmMem = membershipsForFilm.find((m) => m.id === filmsBoard.id);
    expect(b1Mem?.isMember).toBe(true);
    expect(b1Mem?.isAutoMatched).toBe(false);
    expect(filmMem?.isMember).toBe(false);
    expect(filmMem?.isAutoMatched).toBe(true);

    const membershipsForMusic = await getSaveBoardMemberships(owner.id, musicSave.id);
    expect(membershipsForMusic.find((m) => m.id === filmsBoard.id)?.isAutoMatched).toBe(false);

    // 4. deleteBoard removes board + child sub-boards + list_items while preserving user_saves
    const childSubBoard = await createList(owner.id, {
      title: "Sub Board",
      parentId: board1.id,
    });
    await addItemToList(childSubBoard.id, musicSave.id);

    expect(async () => {
      await deleteBoard(board1.id, attacker.id);
    }).toThrow("FORBIDDEN");

    const deleted = await deleteBoard(board1.id, owner.id);
    expect(deleted).toBe(true);
    expect(await getListBySlugWithItems(board1.slug, owner.id)).toBeNull();
    expect(await getListBySlugWithItems(childSubBoard.slug, owner.id)).toBeNull();

    // Underlying saves remain intact
    const remainingSaves = await db
      .select()
      .from(userSaves)
      .where(
        // verify filmSave and musicSave still exist
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (await import("drizzle-orm")).eq(userSaves.userId, owner.id)
      );
    expect(remainingSaves.length).toBe(2);
  });

  it("builds typePathPrefix autoRules for hierarchical typePath prompts instead of coarse coreType", async () => {
    const { extractTypeInfo, buildNewTypeAutoRules } = await import("./promptRules");

    // 1. Hierarchical entity typePath (/product/beverage/wine) with coarse coreType="PRODUCT"
    const winePrompt = extractTypeInfo({
      save: { isPrivateMemo: false, typePath: "/product/beverage/wine" },
      entity: { typePath: "/product/beverage/wine", coreType: "PRODUCT" },
    });
    expect(winePrompt).not.toBeNull();
    expect(winePrompt!.key).toBe("/product/beverage/wine");
    expect(winePrompt!.name).toBe("Wine");
    expect(buildNewTypeAutoRules(winePrompt!)).toEqual({
      typePathPrefix: "/product/beverage/wine",
    });

    // 2. Save-level typePath takes precedence even when entity.typePath is null
    const watchPrompt = extractTypeInfo({
      save: { isPrivateMemo: false, typePath: "/product/watch/" },
      entity: { typePath: null, coreType: "PRODUCT" },
    });
    expect(watchPrompt).not.toBeNull();
    expect(watchPrompt!.key).toBe("/product/watch");
    expect(buildNewTypeAutoRules(watchPrompt!)).toEqual({
      typePathPrefix: "/product/watch",
    });

    // 3. Fallback to coreType ONLY when neither save nor entity has a typePath
    const placePrompt = extractTypeInfo({
      save: { isPrivateMemo: false, typePath: null },
      entity: { typePath: null, coreType: "PLACE" },
    });
    expect(placePrompt).not.toBeNull();
    expect(placePrompt!.key).toBe("place");
    expect(buildNewTypeAutoRules(placePrompt!)).toEqual({
      coreType: "PLACE",
    });

    // 4. Private memo never prompts smart-list creation
    expect(
      extractTypeInfo({
        save: { isPrivateMemo: true, typePath: "/memo/personal" },
        entity: null,
      })
    ).toBeNull();

    // 5. End-to-end: board created from buildNewTypeAutoRules(winePrompt) matches ONLY wine, not watches/garments
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `prompt-rule-${ts}@curio.local`,
        username: `promptrule_${ts}`,
      })
      .returning();

    const [wineEnt] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/wine-${ts}`,
        urlHash: `hash-wine-${ts}`,
        entityKey: `key-wine-${ts}`,
        coreType: "PRODUCT",
        typePath: "/product/beverage/wine",
        title: "Domaine Takahiko Pinot Noir",
        coreStructuredData: {},
      })
      .returning();
    const [watchEnt] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/watch-${ts}`,
        urlHash: `hash-watch-${ts}`,
        entityKey: `key-watch-${ts}`,
        coreType: "PRODUCT",
        typePath: "/product/watch",
        title: "Grand Seiko SBGW231",
        coreStructuredData: {},
      })
      .returning();

    await db.insert(userSaves).values([
      { userId: user.id, entityId: wineEnt.id, typePath: "/product/beverage/wine", isPrivateMemo: false },
      { userId: user.id, entityId: watchEnt.id, typePath: "/product/watch", isPrivateMemo: false },
    ]);

    const winesBoard = await createList(user.id, {
      title: `${winePrompt!.name}s`,
      visibility: "PUBLIC",
      autoRules: buildNewTypeAutoRules(winePrompt!),
    });

    const boardDetails = await getListBySlugWithItems(winesBoard.slug, user.id);
    expect(boardDetails?.itemCount).toBe(1);
    expect(boardDetails?.sections[0]?.items[0]?.entity?.title).toBe("Domaine Takahiko Pinot Noir");
  });

  it("batch-hydrates connections in getListBySlugWithItems and sanitizes private counterpart data for non-owners", async () => {
    const { createConnection } = await import("@/lib/connections/service");
    const ts = Date.now();
    const [owner] = await db
      .insert(users)
      .values({
        email: `board-conn-${ts}@curio.local`,
        username: `brdconn_${ts}`,
      })
      .returning();

    const [dishEnt] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/dish-${ts}`,
        urlHash: `hash-dish-${ts}`,
        entityKey: `key-dish-${ts}`,
        coreType: "CULINARY",
        typePath: "/culinary/recipe",
        title: "Tortilla Sacromonte",
        coreStructuredData: {},
      })
      .returning();
    const [wineEnt] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/vino-${ts}`,
        urlHash: `hash-vino-${ts}`,
        entityKey: `key-vino-${ts}`,
        coreType: "PRODUCT",
        typePath: "/product/beverage/wine",
        title: "Barranco Oscuro Brut Nature",
        coreStructuredData: {},
      })
      .returning();
    const [soloEnt] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/solo-${ts}`,
        urlHash: `hash-solo-${ts}`,
        entityKey: `key-solo-${ts}`,
        coreType: "PLACE",
        typePath: "/place",
        title: "Bodega Castañeda",
        coreStructuredData: {},
      })
      .returning();

    const [dishSave] = await db
      .insert(userSaves)
      .values({
        userId: owner.id,
        entityId: dishEnt.id,
        typePath: "/culinary/recipe",
        isPrivateMemo: false,
      })
      .returning();
    const [wineSave] = await db
      .insert(userSaves)
      .values({
        userId: owner.id,
        entityId: wineEnt.id,
        typePath: "/product/beverage/wine",
        privateTitle: "Secret Cellar Bottle Title",
        isPrivateMemo: false,
      })
      .returning();
    const [memoSave] = await db
      .insert(userSaves)
      .values({
        userId: owner.id,
        entityId: null,
        privateTitle: "Strictly Private Diary Entry",
        isPrivateMemo: true,
      })
      .returning();
    const [soloSave] = await db
      .insert(userSaves)
      .values({
        userId: owner.id,
        entityId: soloEnt.id,
        typePath: "/place",
        isPrivateMemo: false,
      })
      .returning();

    await createConnection({
      userId: owner.id,
      sourceSaveId: dishSave.id,
      targetSaveId: wineSave.id,
      connectionType: "PAIRED_WITH",
      contextNote: "Private cellar note",
    });
    await createConnection({
      userId: owner.id,
      sourceSaveId: dishSave.id,
      targetSaveId: memoSave.id,
      connectionType: "INSPIRED_BY",
      contextNote: "Secret diary link",
    });

    const board = await createList(owner.id, {
      title: `Granada Table ${ts}`,
      visibility: "PUBLIC",
    });
    await addItemToList(board.id, dishSave.id, { positionIndex: 0 });
    await addItemToList(board.id, soloSave.id, { positionIndex: 1 });

    // Owner view: sees both connections on dishSave (including privateTitle & memo) and [] on soloSave
    const ownerView = await getListBySlugWithItems(board.slug, owner.id);
    const ownerItems = ownerView!.sections.flatMap((s) => s.items);
    const ownerDish = ownerItems.find((i) => i.save.id === dishSave.id)!;
    const ownerSolo = ownerItems.find((i) => i.save.id === soloSave.id)!;
    expect(Array.isArray(ownerSolo.connections)).toBe(true);
    expect(ownerSolo.connections!.length).toBe(0);
    expect(ownerDish.connections!.length).toBe(2);
    expect(ownerDish.connections!.some((c) => c.title === "Secret Cellar Bottle Title")).toBe(true);
    expect(ownerDish.connections!.some((c) => c.title === "Strictly Private Diary Entry")).toBe(true);

    // Public anonymous view: private memo connection is stripped, privateTitle & contextNote are sanitized
    const publicView = await getListBySlugWithItems(board.slug, undefined);
    const publicItems = publicView!.sections.flatMap((s) => s.items);
    const pubDish = publicItems.find((i) => i.save.id === dishSave.id)!;
    const pubSolo = publicItems.find((i) => i.save.id === soloSave.id)!;
    expect(Array.isArray(pubSolo.connections)).toBe(true);
    expect(pubSolo.connections!.length).toBe(0);
    expect(pubDish.connections!.length).toBe(1);
    expect(pubDish.connections![0].title).toBe("Barranco Oscuro Brut Nature");
    expect(pubDish.connections![0].contextNote).toBeNull();
  });

  it("blocks cross-tenant IDOR in connections, accepts all 13 ConnectionTypes, and excludes memos from graph suggestions", async () => {
    const { NextRequest } = await import("next/server");
    const { POST: postConnection } = await import("@/app/api/v1/connections/route");
    const { GET: getSuggestions } = await import("@/app/api/v1/graph/suggestions/route");
    const { getConnectedSaves, getConnectedSavesMap } = await import("@/lib/connections/service");
    const { entryConnections } = await import("@/db");

    const ts = Date.now();
    const { user: userA, token: tokenA } = await registerUser({
      email: `tenant-a-${ts}@curio.local`,
      username: `tenanta_${ts}`,
      password: "Password123!",
    });
    const { user: userB, token: tokenB } = await registerUser({
      email: `tenant-b-${ts}@curio.local`,
      username: `tenantb_${ts}`,
      password: "Password123!",
    });

    const [entA] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/idor-a-${ts}`,
        urlHash: `hash-idor-a-${ts}`,
        entityKey: `key-idor-a-${ts}`,
        coreType: "PRODUCT",
        typePath: "/product/beverage/wine",
        title: "Tenant A Wine",
        coreStructuredData: {},
      })
      .returning();
    const [entA2] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/idor-a2-${ts}`,
        urlHash: `hash-idor-a2-${ts}`,
        entityKey: `key-idor-a2-${ts}`,
        coreType: "MEDIA",
        typePath: "/media/film",
        title: "Tenant A Film",
        coreStructuredData: {},
      })
      .returning();
    const [entB] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/idor-b-${ts}`,
        urlHash: `hash-idor-b-${ts}`,
        entityKey: `key-idor-b-${ts}`,
        coreType: "PLACE",
        typePath: "/place",
        title: "Tenant B Cafe",
        coreStructuredData: {},
      })
      .returning();

    const [saveA1] = await db
      .insert(userSaves)
      .values({
        userId: userA.id,
        entityId: entA.id,
        typePath: "/product/beverage/wine",
        privateTitle: "Top Secret Tenant A Bottle",
        isPrivateMemo: false,
      })
      .returning();
    const [saveA2] = await db
      .insert(userSaves)
      .values({
        userId: userA.id,
        entityId: entA2.id,
        typePath: "/media/film",
        isPrivateMemo: false,
      })
      .returning();
    const [memoA] = await db
      .insert(userSaves)
      .values({
        userId: userA.id,
        entityId: null,
        privateTitle: "Secret Tenant A Memo",
        isPrivateMemo: true,
      })
      .returning();
    const [saveB] = await db
      .insert(userSaves)
      .values({
        userId: userB.id,
        entityId: entB.id,
        typePath: "/place",
        isPrivateMemo: false,
      })
      .returning();

    // 1. Cross-tenant POST /api/v1/connections must fail with 403 Forbidden
    const crossReq = new NextRequest("http://localhost:3000/api/v1/connections", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceSaveId: saveB.id,
        targetSaveId: saveA1.id,
        connectionType: "PAIRED_WITH",
      }),
    });
    const crossRes = await postConnection(crossReq);
    expect(crossRes.status).toBe(403);

    // 2. Even if a legacy cross-tenant row existed in entry_connections, getConnectedSaves & getConnectedSavesMap isolate tenants
    await db.insert(entryConnections).values({
      userId: userB.id,
      sourceSaveId: saveB.id,
      targetSaveId: saveA1.id,
      connectionType: "PAIRED_WITH",
    });
    expect(await getConnectedSaves(saveA1.id)).toEqual([]);
    expect(await getConnectedSaves(saveB.id)).toEqual([]);
    const mapIso = await getConnectedSavesMap([saveA1.id, saveB.id]);
    expect(mapIso.get(saveA1.id)).toEqual([]);
    expect(mapIso.get(saveB.id)).toEqual([]);

    // 3. Same-owner POST /api/v1/connections accepts extended ConnectionType ("AESTHETIC_SIBLING")
    const validReq = new NextRequest("http://localhost:3000/api/v1/connections", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceSaveId: saveA1.id,
        targetSaveId: saveA2.id,
        connectionType: "AESTHETIC_SIBLING",
      }),
    });
    const validRes = await postConnection(validReq);
    expect(validRes.status).toBe(201);

    // 4. GET /api/v1/graph/suggestions never suggests private memos
    const sugReq = new NextRequest(
      `http://localhost:3000/api/v1/graph/suggestions?saveId=${encodeURIComponent(saveA1.id)}&limit=10`,
      { headers: { Authorization: `Bearer ${tokenA}` } }
    );
    const sugRes = await getSuggestions(sugReq);
    expect(sugRes.status).toBe(200);
    const sugData = await sugRes.json();
    expect(sugData.suggestions.some((s: any) => s.targetSaveId === memoA.id)).toBe(false);
  });

  it("gates and sanitizes /card/[id] save details via getSaveDetailsForViewer and refines smart-list prompt rules", async () => {
    const { getSaveDetailsForViewer } = await import("@/lib/saves/service");
    const { createConnection } = await import("@/lib/connections/service");
    const {
      extractTypeInfo,
      pluralizeTypeName,
      isTypeCoveredByBoards,
    } = await import("@/lib/lists/promptRules");

    const ts = Date.now();
    const { user: owner } = await registerUser({
      email: `card-gate-${ts}@curio.local`,
      username: `cardgate_${ts}`,
      password: "Password123!",
    });

    const [entPubBoard] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/cg-board-${ts}`,
        urlHash: `hash-cg-board-${ts}`,
        entityKey: `key-cg-board-${ts}`,
        coreType: "PRODUCT",
        typePath: "/product/watch",
        title: "Grand Seiko SBGW231",
        coreStructuredData: {},
      })
      .returning();

    const [boardMemberSave] = await db
      .insert(userSaves)
      .values({
        userId: owner.id,
        entityId: entPubBoard.id,
        typePath: "/product/watch",
        privateTitle: "My Private Watch Nickname",
        personalNotes: "Confidential purchase receipt note",
        userCustomValues: { serial_no: "SECRET-999" },
        visibility: "PRIVATE",
        isPrivateMemo: false,
      })
      .returning();

    const [privateOnlySave] = await db
      .insert(userSaves)
      .values({
        userId: owner.id,
        entityId: entPubBoard.id,
        typePath: "/product/watch",
        privateTitle: "Vault-Only Watch",
        personalNotes: "Do not share",
        visibility: "PRIVATE",
        isPrivateMemo: false,
      })
      .returning();

    const [memoSave] = await db
      .insert(userSaves)
      .values({
        userId: owner.id,
        entityId: null,
        privateTitle: "Private Diary Entry",
        personalNotes: "Strictly local",
        visibility: "PUBLIC",
        isPrivateMemo: true,
      })
      .returning();

    await createConnection({
      userId: owner.id,
      sourceSaveId: boardMemberSave.id,
      targetSaveId: memoSave.id,
      connectionType: "INSPIRED_BY",
      contextNote: "Secret memo link",
    });

    const pubWatchBoard = await createList(owner.id, {
      title: `Horology ${ts}`,
      visibility: "PUBLIC",
    });
    await addItemToList(pubWatchBoard.id, boardMemberSave.id);

    // Non-existent save -> not_found
    expect((await getSaveDetailsForViewer("non-existent-id", null)).status).toBe("not_found");

    // Private save not on any public board -> forbidden for anonymous, ok for owner
    expect((await getSaveDetailsForViewer(privateOnlySave.id, null)).status).toBe("forbidden");
    const ownerAccess = await getSaveDetailsForViewer(privateOnlySave.id, owner.id);
    expect(ownerAccess.status).toBe("ok");
    if (ownerAccess.status === "ok") {
      expect(ownerAccess.isOwner).toBe(true);
      expect(ownerAccess.details.save.privateTitle).toBe("Vault-Only Watch");
    }

    // Private memo -> forbidden for non-owner even if visibility === "PUBLIC"
    expect((await getSaveDetailsForViewer(memoSave.id, null)).status).toBe("forbidden");

    // Save on a PUBLIC board -> ok (isOwner: false) with private fields & memo connections stripped
    const pubAccess = await getSaveDetailsForViewer(boardMemberSave.id, null);
    expect(pubAccess.status).toBe("ok");
    if (pubAccess.status === "ok") {
      expect(pubAccess.isOwner).toBe(false);
      expect(pubAccess.details.save.privateTitle).toBeNull();
      expect(pubAccess.details.save.personalNotes).toBeNull();
      expect(pubAccess.details.save.userCustomValues).toEqual({});
      expect(pubAccess.details.connections).toEqual([]);
    }

    // Smart-list prompt rules edge cases
    expect(
      extractTypeInfo({
        save: { isPrivateMemo: false, typePath: "/product/generic" },
        entity: { typePath: "/product/generic", coreType: "PRODUCT" },
      })
    ).toBeNull();
    expect(
      extractTypeInfo({
        save: { isPrivateMemo: false, typePath: "/memo/list" },
        entity: { typePath: "/memo/list", coreType: "NOTE" },
      })
    ).toBeNull();

    const cosmeticsInfo = extractTypeInfo({
      save: { isPrivateMemo: false, typePath: "/product/cosmetics" },
      entity: { typePath: "/product/cosmetics", coreType: "PRODUCT" },
    })!;
    expect(cosmeticsInfo.listTitle).toBe("Cosmetics");
    expect(pluralizeTypeName("Cinema")).toBe("Cinema");
    expect(pluralizeTypeName("Watch")).toBe("Watches");
    expect(pluralizeTypeName("Winery")).toBe("Wineries");

    const trailInfo = extractTypeInfo({
      save: { isPrivateMemo: false, typePath: "/place/transit_trail" },
      entity: { typePath: "/place/transit_trail", coreType: "PLACE" },
    })!;
    expect(trailInfo.name).toBe("Transit Trail");
    expect(trailInfo.listTitle).toBe("Transit Trails");

    const albumInfo = extractTypeInfo({
      save: { isPrivateMemo: false, typePath: "/media/music/album" },
      entity: { typePath: "/media/music/album", coreType: "MEDIA" },
    })!;
    expect(
      isTypeCoveredByBoards(albumInfo, [
        { title: "Music", autoRules: { typePathPrefix: "/media/music" } },
      ])
    ).toBe(true);
  });
});
