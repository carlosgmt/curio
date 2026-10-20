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
});
