import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db, globalEntities, listItems, smartLists, users, userSaves } from "@/db";
import { clearAdapterSyncCache } from "../engine";
import {
  syncChefWithCurio,
  syncCurioSaveEditToChef,
  type ChefExportRecipe,
} from "../chef";

describe("ChefAdapter (/culinary/recipe live sync)", () => {
  it("updates existing recipe:<slug> saves in-place, routes stubs to Keep Ideas, preserves unrelated /culinary/recipe saves, and promotes stub->complete cleanly", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `chef-${ts}@curio.local`, username: `chef_${ts}` })
      .returning();

    // Pre-existing legacy recipe save imported with entityKey = recipe:<slug>
    const legacySlug = `gazpacho-andaluz-${ts}`;
    const [legacyEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `legacy-gazpacho-${ts}`,
        entityKey: `recipe:${legacySlug}`,
        canonicalUrl: `https://mini.orca-banjo.ts.net/chef/?recipe=${legacySlug}`,
        coreType: "CULINARY",
        typePath: "/culinary/recipe",
        title: "Gazpacho Andaluz Legacy",
        coreStructuredData: { title: "Gazpacho Andaluz Legacy" },
        extendedAttributes: {},
      })
      .returning();

    const [legacySave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: legacyEntity.id,
        typePath: "/culinary/recipe",
        wishlist: false,
        personalNotes: "Keep my custom Curio family note",
      })
      .returning();

    // Unrelated web-clipped recipe that must NEVER be touched/pruned by chefAdapter
    const [webEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `web-flan-${ts}`,
        entityKey: `web_flan_${ts}`,
        canonicalUrl: `https://example.com/flan-${ts}`,
        coreType: "CULINARY",
        typePath: "/culinary/recipe",
        title: "Random Web Flan",
        coreStructuredData: {},
        extendedAttributes: {},
      })
      .returning();

    const [webSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: webEntity.id,
        typePath: "/culinary/recipe",
        wishlist: false,
      })
      .returning();

    const ideaSlug = `pisto-keep-${ts}`;
    const initialRecipes: ChefExportRecipe[] = [
      {
        id: 1,
        slug: legacySlug,
        title: "Gazpacho Andaluz",
        description: "Sopa fría clásica",
        status: "complete",
        servings: 4,
        cuisine: "spanish",
        meal_types: ["lunch", "dinner"],
        active_prep_min: 10,
        passive_cook_min: 0,
        total_time_min: 15,
        effort_tier: "express",
        carb_load: "low",
        health_tier: "light_clean",
        thermal_profile: "cold_refreshing",
        primary_protein: "none",
        kid_friendly: 2,
        times_cooked: 3,
        keep_prior_count: 65,
        peak_seasons: ["summer"],
        free_tags: ["verano"],
        chef_notes: "Servir bien frío",
        steps: ["Triturar todo", "Colar y enfriar"],
        ingredients: [
          {
            raw_text: "1 kg **Tomates**",
            name: "Tomates",
            amount_min: 1,
            unit: "kg",
          },
        ],
      },
      {
        id: 2,
        slug: ideaSlug,
        title: "Pisto Manchego",
        description: "Idea de Google Keep",
        status: "stub",
        source_type: "keep_comiditas",
        cuisine: "spanish",
        effort_tier: "weeknight",
        carb_load: "low",
        keep_prior_count: 7,
        ingredients: [{ raw_text: "Calabacín", name: "Calabacín" }],
        steps: [],
      },
    ];

    const res1 = await syncChefWithCurio(user.id, {
      force: true,
      fetchFn: async () =>
        new Response(
          JSON.stringify({ digest: `chef-d1-${ts}`, recipes: initialRecipes }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
    });

    expect(res1.synced).toBe(true);
    expect(res1.recordsProcessed).toBe(2);
    expect(res1.updatedSaves).toBe(1);
    expect(res1.createdSaves).toBe(1);
    expect(res1.prunedSaves).toBe(0);

    // Existing legacy entity updated in-place, preserving personalNotes
    const [updatedLegacyEntity] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, legacyEntity.id));
    expect(updatedLegacyEntity.title).toBe("Gazpacho Andaluz");
    expect((updatedLegacyEntity.coreStructuredData as any).timesCooked).toBe(3);
    expect((updatedLegacyEntity.coreStructuredData as any).directions).toEqual([
      "Triturar todo",
      "Colar y enfriar",
    ]);

    const [updatedLegacySave] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.id, legacySave.id));
    expect(updatedLegacySave.personalNotes).toBe("Keep my custom Curio family note");

    // Unrelated web recipe save still exists untouched
    const [preservedWebSave] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.id, webSave.id));
    expect(preservedWebSave).toBeTruthy();

    // Check board memberships: complete -> Recipes, stub -> Keep Ideas
    const ideaBoardRows = await db
      .select({ slug: smartLists.slug })
      .from(listItems)
      .innerJoin(userSaves, eq(listItems.saveId, userSaves.id))
      .innerJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .innerJoin(smartLists, eq(listItems.listId, smartLists.id))
      .where(and(eq(userSaves.userId, user.id), eq(globalEntities.entityKey, `recipe:${ideaSlug}`)));
    expect(ideaBoardRows.map((b) => b.slug)).toEqual(["recipes-ideas"]);

    // Promote stub -> complete cleanly: should move from recipes-ideas -> recipes
    const promotedRecipes: ChefExportRecipe[] = [
      initialRecipes[0],
      {
        ...initialRecipes[1],
        status: "complete",
        steps: ["Pochar verduras", "Añadir tomate frito"],
      },
    ];
    const res2 = await syncChefWithCurio(user.id, {
      force: true,
      fetchFn: async () =>
        new Response(
          JSON.stringify({ digest: `chef-d2-${ts}`, recipes: promotedRecipes }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
    });
    expect(res2.promotedFromWishlist).toBe(1);

    const promotedBoardRows = await db
      .select({ slug: smartLists.slug })
      .from(listItems)
      .innerJoin(userSaves, eq(listItems.saveId, userSaves.id))
      .innerJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .innerJoin(smartLists, eq(listItems.listId, smartLists.id))
      .where(and(eq(userSaves.userId, user.id), eq(globalEntities.entityKey, `recipe:${ideaSlug}`)));
    expect(promotedBoardRows.map((b) => b.slug)).toEqual(["recipes"]);

    clearAdapterSyncCache("chef", user.id);
  });

  it("writes Curio title/notes/tags edits back to chef-ui PUT /api/recipes/:slug", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedBody: Record<string, any> = {};

    const ok = await syncCurioSaveEditToChef(
      "recipe:pollo-ajo-miel-limon",
      {
        title: "Pollo con Ajo, Miel y Limón",
        personalNotes: "Añadir ralladura extra al emplatar",
        autoTags: ["recipe", "favorito"],
      },
      {
        chefApiUrl: "http://mock-chef:8720",
        fetchFn: async (input, init) => {
          capturedUrl = String(input);
          capturedMethod = init?.method || "GET";
          capturedBody = JSON.parse(String(init?.body || "{}"));
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
      }
    );

    expect(ok).toBe(true);
    expect(capturedUrl).toBe("http://mock-chef:8720/api/recipes/pollo-ajo-miel-limon");
    expect(capturedMethod).toBe("PUT");
    expect(capturedBody).toEqual({
      title: "Pollo con Ajo, Miel y Limón",
      chef_notes: "Añadir ralladura extra al emplatar",
      classification: { free_tags: ["recipe", "favorito"] },
    });

    // Ignores non-recipe entity keys
    const skipped = await syncCurioSaveEditToChef("manual:some-save", {
      title: "Ignored",
    });
    expect(skipped).toBe(false);
  });
});
