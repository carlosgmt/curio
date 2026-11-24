import { describe, it, expect } from "bun:test";
import type { CardData } from "@/components/cards/PolymorphicCard";
import {
  CURATED_CLOTH_PALETTES,
  formatSpineMeta,
  getArchetypeSpec,
  resolveSameOriginImageUrl,
} from "./archetypes";
import { clampPaletteForReadability, contrastRatio, hexToRgb } from "./palette";

function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    save: {
      id: "save-test-1",
      isPrivateMemo: false,
      createdAt: "2026-10-01T12:00:00Z",
      ...overrides.save,
    },
    entity: {
      id: "ent-test-1",
      title: "Sample Item",
      coreType: "PRODUCT",
      canonicalUrl: "https://example.com/item",
      ...overrides.entity,
    },
    ...overrides,
  };
}

describe("Curio Press Shelf engine", () => {
  it("maps Curio items to all 5 physical archetypes deterministically", () => {
    expect(getArchetypeSpec(makeCard({ entity: { id: "1", title: "Book", coreType: "BOOK", canonicalUrl: "u" } })).id).toBe("book_hardcover");
    expect(getArchetypeSpec(makeCard({ entity: { id: "2", title: "Film", coreType: "MEDIA", typePath: "/media/film", canonicalUrl: "u" } })).id).toBe("media_case");
    expect(getArchetypeSpec(makeCard({ entity: { id: "3", title: "Album", coreType: "MEDIA", typePath: "/media/music/album", canonicalUrl: "u" } })).id).toBe("vinyl_sleeve");
    expect(getArchetypeSpec(makeCard({ entity: { id: "4", title: "Coat", coreType: "PRODUCT", typePath: "/product/garment", canonicalUrl: "u" } })).id).toBe("archival_box");
    expect(getArchetypeSpec(makeCard({ entity: { id: "4b", title: "Lounge Chair", coreType: "PRODUCT", typePath: "/product/furniture", canonicalUrl: "u" } })).id).toBe("archival_box");
    expect(getArchetypeSpec(makeCard({ entity: { id: "5", title: "Focaccia", coreType: "CULINARY", typePath: "/culinary/recipe", canonicalUrl: "u" } })).id).toBe("linen_folio");

    const wishMeta = formatSpineMeta(
      makeCard({
        save: { id: "s-wl", isPrivateMemo: false, wishlist: true, createdAt: "2026-10-01T12:00:00Z" },
      })
    );
    expect(wishMeta.isWishlist).toBe(true);
  });

  it("wraps external HTTPS URLs through same-origin proxy and preserves internal media URLs", () => {
    expect(resolveSameOriginImageUrl("/curio/api/v1/media/garments/a.jpg")).toBe("/curio/api/v1/media/garments/a.jpg");
    expect(resolveSameOriginImageUrl("/api/v1/media/covers/b.png")).toBe("/curio/api/v1/media/covers/b.png");
    expect(resolveSameOriginImageUrl("https://covers.openlibrary.org/b/id/1-L.jpg")).toBe(
      "/curio/api/v1/media/proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F1-L.jpg"
    );
    expect(resolveSameOriginImageUrl("http://insecure.example.com/x.jpg")).toBeNull();
  });

  it("clamps extracted and curated palettes to >= 4.5:1 WCAG contrast", () => {
    const extremes: Array<[number, number, number]> = [
      [255, 255, 255],
      [0, 0, 0],
      [240, 220, 40],
      [40, 200, 190],
      [180, 30, 50],
    ];
    for (const rgb of extremes) {
      const clamped = clampPaletteForReadability(rgb, CURATED_CLOTH_PALETTES[0]);
      const bg = hexToRgb(clamped.surface);
      expect(contrastRatio(hexToRgb(clamped.ink), bg)).toBeGreaterThanOrEqual(7.0);
      expect(contrastRatio(hexToRgb(clamped.muted), bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hexToRgb(clamped.accent), bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hexToRgb(clamped.coverInk), hexToRgb(clamped.coverBg))).toBeGreaterThanOrEqual(4.5);
    }

    for (const pal of CURATED_CLOTH_PALETTES) {
      const bg = hexToRgb(pal.surface);
      expect(contrastRatio(hexToRgb(pal.ink), bg)).toBeGreaterThanOrEqual(7.0);
      expect(contrastRatio(hexToRgb(pal.accent), bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hexToRgb(pal.coverInk), hexToRgb(pal.coverBg))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
