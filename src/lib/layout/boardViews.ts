import type { LayoutEngineType } from "@/components/layout/ViewModeSwitcher";

export type MediaPreferredLayout = "stage" | "grid";

/**
 * Only specialized physical-media boards (Books, Films, Music) offer a toggle
 * between their signature 3D stage and a fast 2D cover grid.
 */
export function supportsMediaStageToggle(slug: string | null): boolean {
  if (!slug) return false;
  const s = slug.toLowerCase();
  return s === "books" || s === "films" || s === "music";
}

/**
 * Deterministic automatic view engine resolution based on board domain.
 * Prevents Recipes, My Stuff, Wishlist, or Stream from ever mounting inside the 3D Bookshelf.
 */
export function resolveAutomaticBoardLayout({
  slug,
  wishOnly = false,
  isMyStuffDescendant = false,
  isClosetDescendant = false,
  preferredMediaView = "stage",
}: {
  slug: string | null;
  wishOnly?: boolean;
  isMyStuffDescendant?: boolean;
  isClosetDescendant?: boolean;
  preferredMediaView?: MediaPreferredLayout;
}): LayoutEngineType {
  if (wishOnly || !slug) {
    return "masonry";
  }

  const s = slug.toLowerCase();

  if (s === "books") {
    return preferredMediaView === "grid" ? "grid" : "shelf";
  }
  if (s === "films") {
    return preferredMediaView === "grid" ? "grid" : "posters";
  }
  if (s === "music") {
    return preferredMediaView === "grid" ? "grid" : "shelf";
  }

  if (
    s === "closet" ||
    s === "wardrobe" ||
    s === "outfits" ||
    isClosetDescendant ||
    s === "my-stuff" ||
    s.startsWith("my-stuff-") ||
    isMyStuffDescendant ||
    s === "games"
  ) {
    return "grid";
  }

  // Stream, Recipes, Keep Ideas, Places (Granada), M said, and custom boards:
  return "masonry";
}
