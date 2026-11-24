import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  silhouetteRegistry,
  type CanonicalArchetypeId,
  type SilhouetteDensity,
} from "../registry";

describe("SilhouetteRegistry & Dynamic Component Resolver (FR-2.0 / FR-2.1)", () => {
  it("resolves all 14 canonical archetypes from typePath or privateMemo status", () => {
    const testCases: Array<{
      typePath?: string;
      isPrivateMemo?: boolean;
      expected: CanonicalArchetypeId;
    }> = [
      { isPrivateMemo: true, expected: "private_memo" },
      { typePath: "/memo/personal", expected: "private_memo" },
      { typePath: "/media/music/vinyl/jazz", expected: "vinyl" },
      { typePath: "/media/film/noir", expected: "cinema" },
      { typePath: "/media/videogame/rpg", expected: "videogame" },
      { typePath: "/book/literature", expected: "book" },
      { typePath: "/product/beverage/wine/red", expected: "wine" },
      { typePath: "/art/sculpture", expected: "art" },
      { typePath: "/culinary/recipe/baking", expected: "recipe" },
      { typePath: "/place/guide/paris", expected: "place" },
      { typePath: "/place/spot/restaurant", expected: "place_spot" },
      { typePath: "/product/garment/outerwear", expected: "garment" },
      { typePath: "/product/cosmetics/skincare", expected: "cosmetics" },
      { typePath: "/product/electronics/audio", expected: "electronics" },
      { typePath: "/quote", expected: "quote" },
      { typePath: "/culture/quote", expected: "quote" },
      { typePath: "/product/generic", expected: "product" },
    ];

    for (const { typePath, isPrivateMemo, expected } of testCases) {
      const resolved = silhouetteRegistry.resolveArchetypeFromTypePath(typePath, isPrivateMemo);
      expect(resolved).toBe(expected);

      // Verify that the resolved archetype maps to a valid registered React component
      const component = silhouetteRegistry.resolve(resolved, "standard");
      expect(component).toBeDefined();
      expect(typeof component).toBe("function");
    }
  });

  it("verifies formal silhouette density fallback shells architecture", () => {
    const densities: SilhouetteDensity[] = [
      "micro",
      "compact",
      "standard",
      "expanded",
      "cinematic",
      "canvasNode",
    ];

    const mockProps = {
      save: { id: "test-save", isPrivateMemo: false, createdAt: new Date() },
      entity: {
        id: "test-entity",
        title: "Test Archetype Item",
        coreType: "PRODUCT",
        canonicalUrl: "https://curio.local/item",
      },
    };

    for (const density of densities) {
      const ShellComponent = silhouetteRegistry.resolve("product", density);
      expect(ShellComponent).toBeDefined();

      const html = renderToStaticMarkup(React.createElement(ShellComponent, mockProps));
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);

      // Verify designated density test IDs
      if (density === "micro") {
        expect(html).toContain('data-testid="micro-shell"');
      } else if (density === "compact") {
        expect(html).toContain('data-testid="compact-shell"');
      } else if (density === "expanded") {
        expect(html).toContain('data-testid="expanded-shell"');
      } else if (density === "cinematic") {
        expect(html).toContain('data-testid="cinematic-shell"');
      } else if (density === "canvasNode") {
        expect(html).toContain('data-testid="canvas-node-shell"');
      }
    }
  });

  it("Regression U3 & C4: routes /style/outfit and /place/wishlist accurately (never misrouting items[] to ChecklistCard) and renders optimistic badge", async () => {
    expect(silhouetteRegistry.resolveArchetypeFromTypePath("/style/outfit", false)).toBe("outfit");
    expect(silhouetteRegistry.resolveArchetypeFromTypePath("/place/wishlist", false)).toBe("place");
    expect(silhouetteRegistry.resolveArchetypeFromTypePath("/memo/checklist", false)).toBe("checklist");

    const { PolymorphicCard } = await import("../PolymorphicCard");

    // Outfit save with coreStructuredData.items array MUST render OutfitCard, NOT ChecklistCard
    const outfitHtml = renderToStaticMarkup(
      React.createElement(PolymorphicCard, {
        item: {
          save: {
            id: "outfit-save-1",
            typePath: "/style/outfit",
            isPrivateMemo: false,
            enrichmentStatus: "ENRICHED",
            createdAt: "2026-10-14T12:00:00Z",
          },
          entity: {
            id: "outfit-ent-1",
            title: "Autumn Linen Look",
            coreType: "PRODUCT",
            typePath: "/style/outfit",
            canonicalUrl: "https://mini.orca-banjo.ts.net/closet/#outfit-1",
            heroImageUrl: "/curio/api/v1/media/closet/covers/outfit_1.png",
            coreStructuredData: {
              occasion: "Weekend",
              season: "Autumn",
              items: [
                { name: "Olive Linen Overshirt", category: "Outerwear" },
                { name: "Ecru Selvedge Denim", category: "Trousers" },
              ],
            },
          },
        },
      })
    );
    expect(outfitHtml).toContain('data-testid="outfit-card"');
    expect(outfitHtml).not.toContain('data-testid="checklist-card"');

    // Optimistic card renders enriching badge
    const optimisticHtml = renderToStaticMarkup(
      React.createElement(PolymorphicCard, {
        item: {
          save: {
            id: "optimistic-1",
            typePath: "/product",
            isPrivateMemo: false,
            enrichmentStatus: "OPTIMISTIC",
            createdAt: "2026-10-14T12:00:00Z",
          },
          entity: {
            id: "optimistic-ent-1",
            title: "Capturing Mimar Granada",
            coreType: "PLACE",
            typePath: "/place/spot",
            canonicalUrl: "https://maps.google.com/?q=Mimar+Granada",
          },
        },
      })
    );
    expect(optimisticHtml).toContain('data-testid="optimistic-enriching-badge"');
  });
});
