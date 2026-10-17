import { describe, it, expect } from "bun:test";
import { generateEntityJsonLd, generateListJsonLd } from "./jsonld";

describe("Schema.org / JSON-LD Structured Data Engine", () => {
  it("generates Schema.org/Book metadata correctly", () => {
    const bookEntity = {
      title: "Dune",
      summary: "Epic science fiction novel by Frank Herbert",
      heroImageUrl: "https://example.com/dune.jpg",
      canonicalUrl: "https://example.com/books/dune",
      coreType: "PRODUCT",
      typePath: "/product/book",
      brandOrCreator: "Frank Herbert",
      coreStructuredData: {
        author: "Frank Herbert",
        isbn: "9780441172719",
        publisher: "Chilton Books",
        inLanguage: "en",
        pageCount: 412,
      },
    };

    const jsonld = generateEntityJsonLd(bookEntity);
    expect(jsonld).not.toBeNull();
    expect(jsonld?.["@context"]).toBe("https://schema.org");
    expect(jsonld?.["@type"]).toBe("Book");
    expect(jsonld?.name).toBe("Dune");
    expect(jsonld?.author?.name).toBe("Frank Herbert");
    expect(jsonld?.isbn).toBe("9780441172719");
    expect(jsonld?.publisher?.name).toBe("Chilton Books");
    expect(jsonld?.inLanguage).toBe("en");
    expect(jsonld?.numberOfPages).toBe(412);
  });

  it("generates Schema.org/Movie metadata with director, runtime, and aggregate rating", () => {
    const movieEntity = {
      title: "Blade Runner 2049",
      summary: "Young Blade Runner K uncovers a long-buried secret.",
      heroImageUrl: "https://example.com/br2049.jpg",
      canonicalUrl: "https://example.com/films/br2049",
      coreType: "MEDIA",
      typePath: "/media/film",
      coreStructuredData: {
        director: "Denis Villeneuve",
        releaseYear: 2017,
        runtimeMinutes: 164,
        rating: 8.0,
      },
    };

    const jsonld = generateEntityJsonLd(movieEntity);
    expect(jsonld).not.toBeNull();
    expect(jsonld?.["@type"]).toBe("Movie");
    expect(jsonld?.name).toBe("Blade Runner 2049");
    expect(jsonld?.director?.name).toBe("Denis Villeneuve");
    expect(jsonld?.dateCreated).toBe("2017");
    expect(jsonld?.duration).toBe("PT164M");
    expect(jsonld?.aggregateRating?.ratingValue).toBe(8.0);
  });

  it("generates Schema.org/MusicAlbum for Vinyl archetype", () => {
    const vinylEntity = {
      title: "Kind of Blue",
      summary: "Miles Davis iconic jazz masterpiece.",
      canonicalUrl: "https://example.com/vinyl/kind-of-blue",
      coreType: "MEDIA",
      typePath: "/media/music/vinyl",
      coreStructuredData: {
        artist: "Miles Davis",
        album: "Kind of Blue",
        releaseYear: 1959,
        track: ["So What", "Freddie Freeloader", "Blue in Green", "All Blues", "Flamenco Sketches"],
      },
    };

    const jsonld = generateEntityJsonLd(vinylEntity);
    expect(jsonld).not.toBeNull();
    expect(jsonld?.["@type"]).toBe("MusicAlbum");
    expect(jsonld?.name).toBe("Kind of Blue");
    expect(jsonld?.byArtist?.name).toBe("Miles Davis");
    expect(jsonld?.albumReleaseType).toBe("https://schema.org/AlbumRelease");
    expect(Array.isArray(jsonld?.track)).toBe(true);
    expect(jsonld?.track?.length).toBe(5);
    expect(jsonld?.track?.[0]?.name).toBe("So What");
  });

  it("generates Schema.org/Recipe with structured ingredients and instructions", () => {
    const recipeEntity = {
      title: "Traditional Cacio e Pepe",
      summary: "Classic Roman pasta with pecorino and crushed black pepper.",
      canonicalUrl: "https://example.com/recipes/cacio-e-pepe",
      coreType: "CULINARY",
      typePath: "/culinary/recipe",
      coreStructuredData: {
        cuisine: "Italian",
        prepTimeMinutes: 10,
        cookTimeMinutes: 15,
        yieldServings: 2,
        ingredients: [
          { item: "Spaghetti", amount: 200, unit: "g" },
          { item: "Pecorino Romano", amount: 100, unit: "g" },
          { item: "Black peppercorns", amount: 1, unit: "tbsp" },
        ],
        directions: [
          "Toast cracked black pepper in a dry skillet.",
          "Boil pasta until al dente.",
          "Emulsify grated pecorino with starchy pasta water.",
        ],
      },
    };

    const jsonld = generateEntityJsonLd(recipeEntity);
    expect(jsonld).not.toBeNull();
    expect(jsonld?.["@type"]).toBe("Recipe");
    expect(jsonld?.name).toBe("Traditional Cacio e Pepe");
    expect(jsonld?.prepTime).toBe("PT10M");
    expect(jsonld?.cookTime).toBe("PT15M");
    expect(jsonld?.recipeYield).toBe("2 servings");
    expect(jsonld?.recipeIngredient).toEqual([
      "200 g Spaghetti",
      "100 g Pecorino Romano",
      "1 tbsp Black peppercorns",
    ]);
    expect(jsonld?.recipeInstructions?.[0]?.text).toBe("Toast cracked black pepper in a dry skillet.");
  });

  it("generates Schema.org/Place for Transit & Trail Pass archetype", () => {
    const placeEntity = {
      title: "Kumano Kodo Nakahechi Route",
      canonicalUrl: "https://example.com/places/kumano-kodo",
      coreType: "PLACE",
      typePath: "/place/transit_trail",
      coreStructuredData: {
        location: "Wakayama Prefecture, Japan",
        coordinates: "33.7431, 135.7744",
      },
    };

    const jsonld = generateEntityJsonLd(placeEntity);
    expect(jsonld).not.toBeNull();
    expect(jsonld?.["@type"]).toBe("Place");
    expect(jsonld?.name).toBe("Kumano Kodo Nakahechi Route");
    expect(jsonld?.address?.streetAddress).toBe("Wakayama Prefecture, Japan");
    expect(jsonld?.geo?.latitude).toBeCloseTo(33.7431);
    expect(jsonld?.geo?.longitude).toBeCloseTo(135.7744);
  });

  it("generates Schema.org/Product for Wine with merchant offers", () => {
    const wineEntity = {
      title: "Domaine de la Romanée-Conti 2018",
      canonicalUrl: "https://example.com/wine/drc-2018",
      coreType: "PRODUCT",
      typePath: "/product/beverage/wine",
      priceCents: 245000,
      currency: "USD",
      coreStructuredData: {
        producer: "DRC",
        vintage: "2018",
        appellation: "Vosne-Romanée",
      },
    };

    const primarySource = {
      sellerName: "Berry Bros & Rudd",
      sourceUrl: "https://bbr.com/drc-2018",
      priceCents: 245000,
      currency: "USD",
      inStock: true,
    };

    const jsonld = generateEntityJsonLd(wineEntity, primarySource);
    expect(jsonld).not.toBeNull();
    expect(jsonld?.["@type"]).toBe("Product");
    expect(jsonld?.category).toBe("/product/beverage/wine");
    expect(jsonld?.brand?.name).toBe("DRC");
    expect(jsonld?.offers?.price).toBe("2450.00");
    expect(jsonld?.offers?.priceCurrency).toBe("USD");
    expect(jsonld?.offers?.seller?.name).toBe("Berry Bros & Rudd");
    expect(jsonld?.offers?.availability).toBe("https://schema.org/InStock");
  });

  it("strictly returns null for PrivateMemo entities (never exposed)", () => {
    const memoEntity = {
      title: "Private Seed Round Strategy",
      coreType: "PRIVATE_MEMO",
      typePath: "/private_memo",
      isPrivateMemo: true,
      coreStructuredData: {
        personalNotes: "Do not disclose valuation before term sheet.",
      },
    };

    const jsonld = generateEntityJsonLd(memoEntity);
    expect(jsonld).toBeNull();
  });

  it("generates Schema.org/ItemList for public lists with ordered elements and skips private memos", () => {
    const list = {
      id: "list-1",
      title: "Essential Summer Reads",
      slug: "summer-reads",
      description: "My favorite books for warm afternoons",
    };

    const owner = {
      id: "user-1",
      username: "alice",
      displayName: "Alice Curator",
    };

    const items = [
      {
        save: { id: "save-1", isPrivateMemo: false },
        entity: {
          title: "The Great Gatsby",
          typePath: "/product/book",
          coreStructuredData: { author: "F. Scott Fitzgerald", isbn: "9780743273565" },
        },
      },
      {
        save: { id: "save-memo", isPrivateMemo: true, privateTitle: "Confidential Note" },
        entity: {
          title: "Confidential Note",
          coreType: "PRIVATE_MEMO",
          isPrivateMemo: true,
        },
      },
      {
        save: { id: "save-2", isPrivateMemo: false },
        entity: {
          title: "Norwegian Wood",
          typePath: "/product/book",
          coreStructuredData: { author: "Haruki Murakami" },
        },
      },
    ];

    const jsonld = generateListJsonLd(list, items, owner, "https://curio.app");
    expect(jsonld).not.toBeNull();
    expect(jsonld?.["@type"]).toBe("ItemList");
    expect(jsonld?.name).toBe("Essential Summer Reads");
    expect(jsonld?.numberOfItems).toBe(2); // Private memo was filtered out!
    expect(jsonld?.author?.name).toBe("Alice Curator");
    expect(jsonld?.itemListElement).toHaveLength(2);
    expect(jsonld?.itemListElement[0].position).toBe(1);
    expect(jsonld?.itemListElement[0].name).toBe("The Great Gatsby");
    expect(jsonld?.itemListElement[0].item?.["@type"]).toBe("Book");
    expect(jsonld?.itemListElement[1].position).toBe(2);
    expect(jsonld?.itemListElement[1].name).toBe("Norwegian Wood");
  });
});
