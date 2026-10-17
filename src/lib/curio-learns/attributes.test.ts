import { describe, expect, it } from "bun:test";
import { db, users, userSaves, globalEntities, curioTypes } from "@/db";
import { eq } from "drizzle-orm";
import {
  updateSaveCustomAttributes,
  evaluateAttributePromotion,
  registerCustomType,
} from "./attributes";

describe("Custom Attributes & Consensus Promotion Engine", () => {
  it("persists and updates custom key-value attributes on a user save", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `attr-user-${timestamp}@curio.local`,
        username: `attr_user_${timestamp}`,
        displayName: "Attribute User",
      })
      .returning();

    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        isPrivateMemo: false,
        personalNotes: "Test note",
        userCustomValues: { initialKey: "initialVal" },
      })
      .returning();

    const result = await updateSaveCustomAttributes(save.id, {
      elevation_masl: "1950m",
      process: "Washed",
      initialKey: null, // should delete initialKey
    });

    expect(result.save.userCustomValues).toEqual({
      elevation_masl: "1950m",
      process: "Washed",
    });

    const [fetched] = await db.select().from(userSaves).where(eq(userSaves.id, save.id));
    expect(fetched.userCustomValues).toEqual({
      elevation_masl: "1950m",
      process: "Washed",
    });
  });

  it("promotes attribute to global entity only when >= 2 distinct users reach consensus", async () => {
    const timestamp = Date.now();

    // Create 2 users
    const [user1] = await db
      .insert(users)
      .values({
        email: `consensus-1-${timestamp}@curio.local`,
        username: `consensus_1_${timestamp}`,
      })
      .returning();

    const [user2] = await db
      .insert(users)
      .values({
        email: `consensus-2-${timestamp}@curio.local`,
        username: `consensus_2_${timestamp}`,
      })
      .returning();

    // Create shared global entity
    const [entity] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/specialty-coffee-${timestamp}`,
        urlHash: `hash-coffee-${timestamp}`,
        entityKey: `key-coffee-${timestamp}`,
        coreType: "PRODUCT",
        typePath: "/product/beverage/coffee",
        title: "Gesha Village Lot 74",
        coreStructuredData: {},
        extendedAttributes: {},
      })
      .returning();

    // User 1 creates a save for this entity
    const [save1] = await db
      .insert(userSaves)
      .values({
        userId: user1.id,
        entityId: entity.id,
        isPrivateMemo: false,
        visibility: "PUBLIC",
      })
      .returning();

    // User 2 creates a save for the same entity
    const [save2] = await db
      .insert(userSaves)
      .values({
        userId: user2.id,
        entityId: entity.id,
        isPrivateMemo: false,
        visibility: "PUBLIC",
      })
      .returning();

    // Step 1: User 1 sets custom attribute 'elevation_masl' to '1900m'
    const res1 = await updateSaveCustomAttributes(save1.id, {
      elevation_masl: "1900m",
      personal_score: "94/100", // subjective field
    });

    // With only 1 user, promotion should NOT trigger
    expect(res1.promotedAttributes).toEqual({});
    const [entityCheck1] = await db.select().from(globalEntities).where(eq(globalEntities.id, entity.id));
    expect(entityCheck1.extendedAttributes).toEqual({});

    // Step 2: User 2 sets identical 'elevation_masl' to '1900m', but different personal_score
    const res2 = await updateSaveCustomAttributes(save2.id, {
      elevation_masl: "1900m",
      personal_score: "91/100",
    });

    // Elevation has consensus (2 users agree on 1900m), personal_score has disagreement (1 user 94, 1 user 91)
    expect(res2.promotedAttributes).toEqual({
      elevation_masl: "1900m",
    });

    // Check that global_entities.extended_attributes now contains elevation_masl
    const [entityCheck2] = await db.select().from(globalEntities).where(eq(globalEntities.id, entity.id));
    const extended = entityCheck2.extendedAttributes as Record<string, unknown>;
    expect(extended.elevation_masl).toBe("1900m");
    expect(extended.personal_score).toBeUndefined();
  });

  it("registers specialized custom subtype in curio_types", async () => {
    const timestamp = Date.now();
    const [creator] = await db
      .insert(users)
      .values({
        email: `creator-${timestamp}@curio.local`,
        username: `creator_${timestamp}`,
      })
      .returning();

    const customType = await registerCustomType(creator.id, {
      name: "Specialty Coffee",
      parentTypePath: "/product/beverage/wine",
      fields: [
        { key: "roast_level", label: "Roast Level", type: "select", options: ["Light", "Medium", "Dark"] },
        { key: "elevation_masl", label: "Elevation (m.a.s.l.)", type: "number" },
        { key: "processing_method", label: "Processing Method", type: "string" },
      ],
    });

    expect(customType.name).toBe("Specialty Coffee");
    expect(customType.typePath).toBe("/product/beverage/wine/specialty-coffee");
    expect(customType.publicFieldKeys).toEqual(["roast_level", "elevation_masl", "processing_method"]);

    const [dbType] = await db.select().from(curioTypes).where(eq(curioTypes.id, customType.id));
    expect(dbType).not.toBeNull();
    expect(dbType.userId).toBe(creator.id);
  });

  it("strictly isolates private saves and memos from consensus attribute promotion", async () => {
    const timestamp = Date.now();

    const [u1] = await db
      .insert(users)
      .values({
        email: `private-u1-${timestamp}@curio.local`,
        username: `priv_u1_${timestamp}`,
      })
      .returning();

    const [u2] = await db
      .insert(users)
      .values({
        email: `private-u2-${timestamp}@curio.local`,
        username: `priv_u2_${timestamp}`,
      })
      .returning();

    const [entity] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/secret-wine-${timestamp}`,
        urlHash: `hash-wine-${timestamp}`,
        entityKey: `key-wine-${timestamp}`,
        coreType: "PRODUCT",
        typePath: "/product/beverage/wine",
        title: "Secret Natural Wine",
        coreStructuredData: {},
        extendedAttributes: {},
      })
      .returning();

    // User 1 creates PRIVATE save
    const [privateSave1] = await db
      .insert(userSaves)
      .values({
        userId: u1.id,
        entityId: entity.id,
        isPrivateMemo: false,
        visibility: "PRIVATE",
      })
      .returning();

    // User 2 creates PRIVATE save
    const [privateSave2] = await db
      .insert(userSaves)
      .values({
        userId: u2.id,
        entityId: entity.id,
        isPrivateMemo: false,
        visibility: "PRIVATE",
      })
      .returning();

    // Both users set the same key and value on private saves
    await updateSaveCustomAttributes(privateSave1.id, {
      secret_tasting_note: "hints of truffle and wet stone",
    });

    const res2 = await updateSaveCustomAttributes(privateSave2.id, {
      secret_tasting_note: "hints of truffle and wet stone",
    });

    // Should NOT promote to global entity
    expect(res2.promotedAttributes).toEqual({});
    const [freshEntity] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, entity.id));
    expect(freshEntity.extendedAttributes).toEqual({});
  });
});
