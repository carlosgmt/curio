import { describe, expect, it, beforeAll } from "bun:test";
import { db, users, userSaves, globalEntities, smartLists, entitySources } from "@/db";
import { classifyOmniboxIntent } from "./intent";

describe("Omnibox Intent Routing & Active Save Disambiguation Engine", () => {
  let testUserId: string;
  let saveDune: any;
  let savePastLives: any;
  let saveBarolo: any;
  let saveInTheMood: any;
  let saveFerrante: any;

  beforeAll(async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `intent-tester-${timestamp}@curio.local`,
        username: `intent_tester_${timestamp}`,
      })
      .returning();
    testUserId = user.id;

    // Seed test entities and saves
    // 1. Dune
    const [entityDune] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/dune-${timestamp}`,
        urlHash: `hash-dune-${timestamp}`,
        entityKey: `key-dune-${timestamp}`,
        coreType: "BOOK",
        typePath: "/product/book",
        title: "Dune",
        brandOrCreator: "Frank Herbert",
        coreStructuredData: {},
      })
      .returning();

    [saveDune] = await db
      .insert(userSaves)
      .values({
        userId: testUserId,
        entityId: entityDune.id,
        typePath: "/product/book",
      })
      .returning();

    // 2. Past Lives
    const [entityPastLives] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/past-lives-${timestamp}`,
        urlHash: `hash-pastlives-${timestamp}`,
        entityKey: `key-pastlives-${timestamp}`,
        coreType: "MEDIA",
        typePath: "/media/film",
        title: "Past Lives",
        brandOrCreator: "Celine Song",
        coreStructuredData: {},
      })
      .returning();

    [savePastLives] = await db
      .insert(userSaves)
      .values({
        userId: testUserId,
        entityId: entityPastLives.id,
        typePath: "/media/film",
      })
      .returning();

    // 3. Barolo
    const [entityBarolo] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/barolo-${timestamp}`,
        urlHash: `hash-barolo-${timestamp}`,
        entityKey: `key-barolo-${timestamp}`,
        coreType: "PRODUCT",
        typePath: "/product/beverage/wine",
        title: "Barolo Monprivato 2018",
        brandOrCreator: "Giuseppe Mascarello",
        coreStructuredData: {},
      })
      .returning();

    [saveBarolo] = await db
      .insert(userSaves)
      .values({
        userId: testUserId,
        entityId: entityBarolo.id,
        privateTitle: "Barolo",
        typePath: "/product/beverage/wine",
      })
      .returning();

    // 4. In the Mood for Love
    const [entityInTheMood] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/in-the-mood-${timestamp}`,
        urlHash: `hash-mood-${timestamp}`,
        entityKey: `key-mood-${timestamp}`,
        coreType: "MEDIA",
        typePath: "/media/film",
        title: "In the Mood for Love",
        brandOrCreator: "Wong Kar-wai",
        coreStructuredData: {},
      })
      .returning();

    [saveInTheMood] = await db
      .insert(userSaves)
      .values({
        userId: testUserId,
        entityId: entityInTheMood.id,
        typePath: "/media/film",
      })
      .returning();

    // 5. Elena Ferrante
    const [entityFerrante] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/ferrante-${timestamp}`,
        urlHash: `hash-ferrante-${timestamp}`,
        entityKey: `key-ferrante-${timestamp}`,
        coreType: "BOOK",
        typePath: "/product/book",
        title: "My Brilliant Friend",
        brandOrCreator: "Elena Ferrante",
        coreStructuredData: {},
      })
      .returning();

    [saveFerrante] = await db
      .insert(userSaves)
      .values({
        userId: testUserId,
        entityId: entityFerrante.id,
        typePath: "/product/book",
      })
      .returning();

    // Seed user list "Favorites"
    await db.insert(smartLists).values({
      userId: testUserId,
      title: "Favorites",
      slug: "favorites",
    });
  });

  it("Pattern 1: routes sentiment note/reaction 'Loved the ending of Dune' to existing save", async () => {
    const result = await classifyOmniboxIntent("Loved the ending of Dune", testUserId);
    expect(result.intent).toBe("EDIT_SAVE");
    expect(result.action).toBe("NOTE");
    expect(result.targetSave).toBeDefined();
    expect(result.targetSave?.title).toContain("Dune");
    expect(result.confidence).toBeGreaterThanOrEqual(0.88);
  });

  it("Pattern 2: routes rating change 'Change rating to 5 stars for Past Lives'", async () => {
    const result = await classifyOmniboxIntent("Change rating to 5 stars for Past Lives", testUserId);
    expect(result.intent).toBe("EDIT_SAVE");
    expect(result.action).toBe("RATING");
    expect(result.targetSave?.title).toBe("Past Lives");
    expect(result.editDetails?.rating).toBe(5);
    expect(result.confidence).toBeGreaterThanOrEqual(0.88);
  });

  it("Pattern 3: routes notes append 'Add notes to Barolo: great with truffle pasta'", async () => {
    const result = await classifyOmniboxIntent(
      "Add notes to Barolo: great with truffle pasta",
      testUserId
    );
    expect(result.intent).toBe("EDIT_SAVE");
    expect(result.action).toBe("NOTE");
    expect(result.targetSave?.title).toBe("Barolo");
    expect(result.editDetails?.note).toBe("great with truffle pasta");
    expect(result.confidence).toBeGreaterThanOrEqual(0.88);
  });

  it("Pattern 4: routes list movement 'Move In the Mood for Love to Favorites'", async () => {
    const result = await classifyOmniboxIntent(
      "Move In the Mood for Love to Favorites",
      testUserId
    );
    expect(result.intent).toBe("EDIT_SAVE");
    expect(result.action).toBe("LIST_MOVE");
    expect(result.targetSave?.title).toBe("In the Mood for Love");
    expect(result.editDetails?.targetList).toBe("Favorites");
    expect(result.confidence).toBeGreaterThanOrEqual(0.88);
  });

  it("Pattern 5: routes status update 'Finished reading Ferrante'", async () => {
    const result = await classifyOmniboxIntent("Finished reading Ferrante", testUserId);
    expect(result.intent).toBe("EDIT_SAVE");
    expect(result.action).toBe("STATUS");
    expect(result.targetSave).toBeDefined();
    expect(result.targetSave?.brandOrCreator).toBe("Elena Ferrante");
    expect(result.editDetails?.status).toBe("finished");
    expect(result.confidence).toBeGreaterThanOrEqual(0.88);
  });

  it("disambiguates multiple matching candidates (e.g. Dune book vs Dune film)", async () => {
    const timestamp = Date.now();
    // Add second Dune save (film)
    const [filmEntity] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/dune-film-${timestamp}`,
        urlHash: `hash-dune-film-${timestamp}`,
        entityKey: `key-dune-film-${timestamp}`,
        coreType: "MEDIA",
        typePath: "/media/film",
        title: "Dune: Part One",
        brandOrCreator: "Denis Villeneuve",
        coreStructuredData: {},
      })
      .returning();

    await db.insert(userSaves).values({
      userId: testUserId,
      entityId: filmEntity.id,
      typePath: "/media/film",
    });

    const result = await classifyOmniboxIntent("Loved the ending of Dune", testUserId);
    expect(result.intent).toBe("EDIT_SAVE");
    expect(result.ambiguousCandidates).toBeDefined();
    expect(result.ambiguousCandidates?.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to ADD_ENTITY when editing an unsaved item", async () => {
    const result = await classifyOmniboxIntent(
      "Change rating to 4 stars for Nonexistent Book",
      testUserId
    );
    expect(result.intent).toBe("ADD_ENTITY");
    expect(result.suggestedTitle).toBe("Nonexistent Book");
    expect(result.editDetails?.rating).toBe(4);
  });

  it("handles Tier 0 prefixes: slash search, private memos, and external URLs", async () => {
    // 1. Search query
    const search = await classifyOmniboxIntent("/vintage watches", testUserId);
    expect(search.intent).toBe("SEARCH_QUERY");
    expect(search.tier).toBe(0);
    expect(search.extractedQuery).toBe("vintage watches");

    // 2. Private memo explicit
    const memo = await classifyOmniboxIntent("todo: review quarterly tax documents", testUserId);
    expect(memo.intent).toBe("PRIVATE_MEMO");
    expect(memo.tier).toBe(0);

    // 3. New external URL
    const url = await classifyOmniboxIntent("https://criterion.com/films/past-lives", testUserId);
    expect(url.intent).toBe("ADD_ENTITY");
    expect(url.tier).toBe(0);
  });

  it("resolves deterministically within latency benchmark (<15 ms)", async () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      await classifyOmniboxIntent("Move In the Mood for Love to Favorites", testUserId);
      times.push(performance.now() - t0);
    }
    const avgLatency = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgLatency).toBeLessThan(15); // Must be strictly < 15 ms
  });
});
