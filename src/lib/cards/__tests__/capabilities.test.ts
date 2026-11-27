import { describe, expect, it } from "bun:test";
import {
  canMarkBought,
  canWishlist,
  resolveAuthenticFooterActions,
} from "../capabilities";
import { wishLabel } from "@/lib/wishlist";
import {
  resolveAutomaticBoardLayout,
  supportsMediaStageToggle,
} from "@/lib/layout/boardViews";

describe("Type-Scoped Card Capabilities & Domain Views", () => {
  it("restricts 'Bought it' only to unowned acquirable physical goods", () => {
    expect(
      canMarkBought({
        save: { id: "s-product", typePath: "/product/watch" },
        entity: { title: "Seiko 5", coreType: "PRODUCT", typePath: "/product/watch" },
      })
    ).toBe(true);

    expect(
      canMarkBought({
        save: { id: "s-book", typePath: "/product/book" },
        entity: { title: "Dune", coreType: "BOOK", typePath: "/product/book" },
      })
    ).toBe(true);

    // Non-purchasable / self-contained types must NEVER show Bought it
    expect(
      canMarkBought({
        save: { id: "s-recipe", typePath: "/culinary/recipe" },
        entity: { title: "Ramen", coreType: "CULINARY", typePath: "/culinary/recipe" },
      })
    ).toBe(false);

    expect(
      canMarkBought({
        save: { id: "s-place", typePath: "/place/cafe" },
        entity: { title: "Bar Brutal", coreType: "PLACE", typePath: "/place/cafe" },
      })
    ).toBe(false);

    expect(
      canMarkBought({
        save: { id: "s-film", typePath: "/media/film" },
        entity: { title: "Stalker", coreType: "MEDIA", typePath: "/media/film" },
      })
    ).toBe(false);

    expect(
      canMarkBought({
        save: { id: "s-quote", typePath: "/editorial/quote" },
        entity: { title: "Funes", coreType: "ARTICLE", typePath: "/editorial/quote" },
      })
    ).toBe(false);

    expect(
      canMarkBought({
        save: { id: "s-memo", isPrivateMemo: true, typePath: "/private/memo" },
        entity: { title: "Secret", coreType: "PRIVATE_MEMO", typePath: "/private/memo" },
      })
    ).toBe(false);

    expect(
      canMarkBought({
        save: { id: "s-outfit", typePath: "/style/outfit" },
        entity: { title: "Spring Fit", coreType: "ARTICLE", typePath: "/style/outfit" },
      })
    ).toBe(false);

    // Already-owned synced items cannot be marked bought again
    expect(
      canMarkBought({
        save: { id: "s-closet", typePath: "/product/garment" },
        entity: {
          title: "Navy Coat",
          coreType: "PRODUCT",
          coreStructuredData: { closetId: "cl-1" },
        },
      })
    ).toBe(false);

    expect(
      canMarkBought({
        save: { id: "s-ph", typePath: "/product" },
        entity: {
          title: "Leica Q2",
          coreType: "PRODUCT",
          extendedAttributes: { purchaseHubProductId: "ph-1" },
        },
      })
    ).toBe(false);
  });

  it("gates wishlist toggles cleanly and exposes Want to cook for recipes", () => {
    expect(wishLabel("/culinary/recipe", "CULINARY")).toBe("Want to cook");
    expect(wishLabel("/place/restaurant", "PLACE")).toBe("Want to visit");
    expect(wishLabel("/media/film", "MEDIA")).toBe("Want to watch");
    expect(wishLabel("/product/book", "BOOK")).toBe("Want to read");

    expect(
      canWishlist({
        save: { id: "q1", typePath: "/editorial/quote" },
        entity: { title: "Quote", typePath: "/editorial/quote" },
      })
    ).toBe(false);

    expect(
      canWishlist({
        save: { id: "c1", typePath: "/private/checklist" },
        entity: { title: "Checklist", typePath: "/private/checklist" },
      })
    ).toBe(false);

    expect(
      canWishlist({
        save: { id: "o1", typePath: "/style/outfit" },
        entity: { title: "Outfit", typePath: "/style/outfit" },
      })
    ).toBe(false);

    // Legacy wishlisted item stays toggleable so the user can remove it
    expect(
      canWishlist({
        save: { id: "q2", wishlist: true, typePath: "/editorial/quote" },
        entity: { title: "Old wish quote", typePath: "/editorial/quote" },
      })
    ).toBe(true);

    expect(
      canWishlist({
        save: { id: "r1", typePath: "/culinary/recipe" },
        entity: { title: "Gazpacho", coreType: "CULINARY", typePath: "/culinary/recipe" },
      })
    ).toBe(true);
  });

  it("resolves authentic footer actions without inventing generic search URLs", () => {
    expect(
      resolveAuthenticFooterActions({
        title: "Self-contained quote",
        typePath: "/editorial/quote",
      })
    ).toEqual([]);

    expect(
      resolveAuthenticFooterActions({
        title: "Unlinked Homemade Pasta",
        coreType: "CULINARY",
        typePath: "/culinary/recipe",
      })
    ).toEqual([]);

    const chefActions = resolveAuthenticFooterActions({
      title: "Tarta de Queso",
      coreType: "CULINARY",
      typePath: "/culinary/recipe",
      coreStructuredData: { chefSlug: "tarta-de-queso", source: "chef-ui" },
    });
    expect(chefActions.some((a) => a.label === "Open in Chef" && a.href === "/chef/#recipe-tarta-de-queso")).toBe(
      true
    );

    expect(
      resolveAuthenticFooterActions({
        title: "Unlinked Vintage Lamp",
        coreType: "PRODUCT",
        typePath: "/product",
      })
    ).toEqual([]);

    const linkedProduct = resolveAuthenticFooterActions({
      title: "Artemide Tolomeo",
      coreType: "PRODUCT",
      typePath: "/product",
      canonicalUrl: "https://www.artemide.com/en/subfamily/22354/tolomeo",
    });
    expect(linkedProduct).toHaveLength(1);
    expect(linkedProduct[0]?.href).toBe("https://www.artemide.com/en/subfamily/22354/tolomeo");
  });

  it("enforces deterministic domain layouts and never mounts recipes or my-stuff inside 3D bookshelf", () => {
    expect(supportsMediaStageToggle("books")).toBe(true);
    expect(supportsMediaStageToggle("films")).toBe(true);
    expect(supportsMediaStageToggle("music")).toBe(true);
    expect(supportsMediaStageToggle("recipes")).toBe(false);
    expect(supportsMediaStageToggle("my-stuff")).toBe(false);
    expect(supportsMediaStageToggle(null)).toBe(false);

    expect(resolveAutomaticBoardLayout({ slug: "books", preferredMediaView: "stage" })).toBe("shelf");
    expect(resolveAutomaticBoardLayout({ slug: "books", preferredMediaView: "grid" })).toBe("grid");
    expect(resolveAutomaticBoardLayout({ slug: "films", preferredMediaView: "stage" })).toBe("posters");
    expect(resolveAutomaticBoardLayout({ slug: "music", preferredMediaView: "stage" })).toBe("shelf");

    expect(
      resolveAutomaticBoardLayout({
        slug: "my-stuff",
        isMyStuffDescendant: true,
        preferredMediaView: "stage",
      })
    ).toBe("grid");
    expect(
      resolveAutomaticBoardLayout({
        slug: "recipes",
        preferredMediaView: "stage",
      })
    ).toBe("masonry");
    expect(
      resolveAutomaticBoardLayout({
        slug: "granada",
        wishOnly: true,
        preferredMediaView: "stage",
      })
    ).toBe("masonry");
  });
});
