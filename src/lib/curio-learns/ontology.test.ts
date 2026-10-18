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

    // 9. Video Game
    const game = await classifyEntityType("Videojuego");
    expect(game.typePath).toBe("/media/videogame");
    expect(game.similarity).toBeGreaterThan(0.92);
    expect(game.isSynonymConvergence).toBe(true);

    // 10. Place / Venue / Hospitality
    const place = await classifyEntityType("Lugar / Restaurante / Café");
    expect(place.typePath).toBe("/place");
    expect(place.similarity).toBeGreaterThan(0.92);
    expect(place.isSynonymConvergence).toBe(true);

    // 11. General Product
    const product = await classifyEntityType("Producto / Compra");
    expect(product.typePath).toBe("/product");
    expect(product.similarity).toBeGreaterThan(0.92);
    expect(product.isSynonymConvergence).toBe(true);

    // 12. Garment / Apparel
    const garment = await classifyEntityType("Ropa / Prenda");
    expect(garment.typePath).toBe("/product/garment");
    expect(garment.similarity).toBeGreaterThan(0.92);
    expect(garment.isSynonymConvergence).toBe(true);

    // 13. Cosmetics & Beauty
    const cosmetics = await classifyEntityType("Cosmética / Belleza");
    expect(cosmetics.typePath).toBe("/product/cosmetics");
    expect(cosmetics.similarity).toBeGreaterThan(0.92);
    expect(cosmetics.isSynonymConvergence).toBe(true);

    // 14. Consumer Electronics
    const electronics = await classifyEntityType("Electrónica / Tecnología");
    expect(electronics.typePath).toBe("/product/electronics");
    expect(electronics.similarity).toBeGreaterThan(0.92);
    expect(electronics.isSynonymConvergence).toBe(true);
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
