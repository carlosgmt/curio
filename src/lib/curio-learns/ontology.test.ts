import { describe, expect, it, beforeAll } from "bun:test";
import { seedCanonicalArchetypes } from "@/db/seed";
import { classifyEntityType, seedArchetypeEmbeddings } from "./ontology";

describe("Dynamic Type Ontology & Vector Classification Service", () => {
  beforeAll(async () => {
    await seedCanonicalArchetypes();
    await seedArchetypeEmbeddings();
  });

  it("classifies all 8 canonical archetypes with synonym convergence (>0.92)", async () => {
    // 1. Vinyl Album
    const vinyl = await classifyEntityType("Disco de Vinilo");
    expect(vinyl.typePath).toBe("/media/music/vinyl");
    expect(vinyl.similarity).toBeGreaterThan(0.92);
    expect(vinyl.isSynonymConvergence).toBe(true);

    // 2. Film / Cinema
    const film = await classifyEntityType("Película / Cine");
    expect(film.typePath).toBe("/media/film");
    expect(film.similarity).toBeGreaterThan(0.92);
    expect(film.isSynonymConvergence).toBe(true);

    // 3. Book / Publication
    const book = await classifyEntityType("Libro / Publicación");
    expect(book.typePath).toBe("/product/book");
    expect(book.similarity).toBeGreaterThan(0.92);
    expect(book.isSynonymConvergence).toBe(true);

    // 4. Estate Wine ("Vinos Naturales")
    const wine = await classifyEntityType("Vinos Naturales");
    expect(wine.typePath).toBe("/product/beverage/wine");
    expect(wine.similarity).toBeGreaterThan(0.92);
    expect(wine.isSynonymConvergence).toBe(true);

    // 5. Fine Art & Print
    const art = await classifyEntityType("Arte y Grabados");
    expect(art.typePath).toBe("/product/art");
    expect(art.similarity).toBeGreaterThan(0.92);
    expect(art.isSynonymConvergence).toBe(true);

    // 6. Culinary Recipe
    const recipe = await classifyEntityType("Receta Culinaria");
    expect(recipe.typePath).toBe("/culinary/recipe");
    expect(recipe.similarity).toBeGreaterThan(0.92);
    expect(recipe.isSynonymConvergence).toBe(true);

    // 7. Transit & Trail Pass
    const transit = await classifyEntityType("Pase de Tránsito o Sendero");
    expect(transit.typePath).toBe("/place/transit_trail");
    expect(transit.similarity).toBeGreaterThan(0.92);
    expect(transit.isSynonymConvergence).toBe(true);

    // 8. Private Vault Memo
    const memo = await classifyEntityType("Nota Privada");
    expect(memo.typePath).toBe("/private_memo");
    expect(memo.similarity).toBeGreaterThan(0.92);
    expect(memo.isSynonymConvergence).toBe(true);
  });

  it("handles subtype inheritance (similarity 0.75 - 0.92)", async () => {
    const subtype = await classifyEntityType("biodynamic orange wine");
    expect(subtype.rootArchetype).toBe("PRODUCT");
    expect(subtype.defaultSilhouette).toBe("landscape_label");
    expect(subtype.similarity).toBeGreaterThanOrEqual(0.75);
    expect(subtype.isSubtypeInherited).toBe(true);
  });

  it("falls back to generic product for low similarity (<0.75)", async () => {
    const unknown = await classifyEntityType("zzzzxxxx9999 totally random gizmo object");
    expect(unknown.typePath).toBe("/product/generic");
    expect(unknown.similarity).toBeLessThan(0.75);
    expect(unknown.isSynonymConvergence).toBe(false);
    expect(unknown.isSubtypeInherited).toBe(false);
  });
});
