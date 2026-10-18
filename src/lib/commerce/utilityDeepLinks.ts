/**
 * Canonical Contextual Utility Deep-Link Engine
 * Resolves context-aware search queries and deep links across cultural archetypes:
 * Cinema, Music/Vinyl, Books, Places, Wine, Culinary/Recipes, and Art.
 */

export interface DeepLinkEntity {
  id?: string;
  title?: string;
  canonicalUrl?: string;
  coreType?: string;
  typePath?: string | null;
  heroImageUrl?: string | null;
  brandOrCreator?: string | null;
  summary?: string | null;
  coreStructuredData?: any;
}

export interface CardUtilityResult {
  label: string;
  href: string;
  iconName: "play" | "music" | "book-open" | "map-pin" | "wine" | "utensils" | "frame" | "external-link" | "lock" | "gamepad-2" | "shopping-bag";
  isInteractive: boolean;
  targetBlank: boolean;
}

export interface ResolveCardUtilityParams {
  entity: DeepLinkEntity;
  customUtilityLabel?: string;
  primarySource?: {
    sellerName?: string;
    sourceUrl?: string;
  } | null;
  onUtilityClick?: () => void;
}

/**
 * 1. Cinema / Film: MUBI, JustWatch, TMDB
 */
export function resolveCinemaLink(entity: DeepLinkEntity, fallbackTitle = "Cinema"): string {
  const canonical = entity.canonicalUrl;
  if (canonical && (canonical.includes("mubi.com") || canonical.includes("letterboxd.com"))) {
    return canonical;
  }
  const title = entity.title || fallbackTitle;
  return `https://mubi.com/search?query=${encodeURIComponent(title)}`;
}

export function getCinemaSearchLinks(title: string) {
  const enc = encodeURIComponent(title);
  return {
    mubi: `https://mubi.com/search?query=${enc}`,
    appleTv: `https://tv.apple.com/search?term=${enc}`,
    justWatch: `https://www.justwatch.com/us/search?q=${enc}`,
    tmdb: `https://www.themoviedb.org/search?query=${enc}`,
  };
}

/**
 * 2. Vinyl & Music: Spotify & Discogs
 */
export function resolveMusicLink(entity: DeepLinkEntity, artist?: string, fallbackTitle = "Music"): string {
  const canonical = entity.canonicalUrl;
  if (canonical && (canonical.includes("spotify.com") || canonical.includes("open.spotify.com"))) {
    return canonical;
  }
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const artistName = artist || data.artist || entity.brandOrCreator || "";
  const title = entity.title || fallbackTitle;
  const query = [artistName, title].filter(Boolean).join(" ").trim() || "Music";
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

export function getDiscogsSearchLink(query: string): string {
  return `https://www.discogs.com/search/?q=${encodeURIComponent(query)}&type=release`;
}

/**
 * 3. Books & Essays: Google Books & OpenLibrary
 */
export function resolveBookLink(entity: DeepLinkEntity, author?: string, fallbackTitle = "Book"): string {
  const canonical = entity.canonicalUrl;
  if (canonical && (canonical.includes("openlibrary.org") || canonical.includes("books.google.com") || canonical.includes("bookshop.org"))) {
    return canonical;
  }
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const authorName = author || data.author || entity.brandOrCreator || "";
  const title = entity.title || fallbackTitle;
  const query = [title, authorName].filter(Boolean).join(" ").trim() || "Book";
  return `https://books.google.com/books?q=${encodeURIComponent(query)}`;
}

export function getOpenLibrarySearchLink(query: string): string {
  return `https://openlibrary.org/search?q=${encodeURIComponent(query)}`;
}

/**
 * 4. Places & Cartography: Google Maps & Apple Maps
 */
export function resolvePlaceLink(entity: DeepLinkEntity, address?: string, fallbackTitle = "Map"): string {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const place = address || data.location || data.address || data.coordinates || entity.title || fallbackTitle;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

export function getAppleMapsLink(place: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(place)}`;
}

/**
 * 5. Estate Wine: Vivino & Wine-Searcher
 */
export function resolveWineLink(
  entity: DeepLinkEntity,
  producer?: string,
  vintage?: string,
  fallbackTitle = "Wine"
): string {
  const canonical = entity.canonicalUrl;
  if (canonical && (canonical.includes("vivino.com") || canonical.includes("wine-searcher.com"))) {
    return canonical;
  }
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const prod = producer || data.producer || entity.brandOrCreator || "";
  const vint = vintage || data.vintage || "";
  const title = entity.title || fallbackTitle;
  const wineQuery = [prod, title, vint].filter(Boolean).join(" ").trim() || "Wine";
  return `https://www.vivino.com/search/wines?q=${encodeURIComponent(wineQuery)}`;
}

export function getWineSearcherLink(wineQuery: string): string {
  return `https://www.wine-searcher.com/find/${encodeURIComponent(wineQuery)}`;
}

/**
 * 6. Recipes & Culinary: NYT Cooking & Cook Mode
 */
export function resolveRecipeLink(entity: DeepLinkEntity, fallbackTitle = "Recipe"): string {
  const canonical = entity.canonicalUrl;
  if (canonical && !canonical.includes("wikipedia.org") && canonical !== "#") {
    return canonical;
  }
  const title = entity.title || fallbackTitle;
  return `https://cooking.nytimes.com/search?q=${encodeURIComponent(title)}`;
}

/**
 * 7. Fine Art & Prints: High-Res Image & Artsy
 */
export function resolveArtLink(entity: DeepLinkEntity, artist?: string, fallbackTitle = "Artwork"): string {
  if (entity.heroImageUrl) {
    return entity.heroImageUrl;
  }
  const canonical = entity.canonicalUrl;
  if (canonical && (canonical.includes("artsy.net") || canonical.includes("metmuseum.org"))) {
    return canonical;
  }
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const artArtist = artist || data.artist || entity.brandOrCreator || "";
  const title = entity.title || fallbackTitle;
  const artQuery = [artArtist, title].filter(Boolean).join(" ").trim() || "Artwork";
  return `https://www.artsy.net/search?term=${encodeURIComponent(artQuery)}`;
}

/**
 * 8. Video Games: Steam Store & Gaming Platforms
 */
export function resolveGameLink(entity: DeepLinkEntity, fallbackTitle = "Game"): string {
  const canonical = entity.canonicalUrl;
  if (
    canonical &&
    (canonical.includes("steampowered.com") ||
      canonical.includes("store.playstation.com") ||
      canonical.includes("nintendo.com") ||
      canonical.includes("epicgames.com"))
  ) {
    return canonical;
  }
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  if (data.storeUrl) return data.storeUrl;
  const title = entity.title || fallbackTitle;
  return `https://store.steampowered.com/search/?term=${encodeURIComponent(title)}`;
}

/**
 * 9. Physical Products: Garments, Cosmetics, Electronics, and General Goods
 */
export function resolveProductLink(entity: DeepLinkEntity, fallbackTitle = "Product"): string {
  const canonical = entity.canonicalUrl;
  if (canonical && !canonical.includes("wikipedia.org") && canonical !== "#") {
    return canonical;
  }
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  if (data.buyUrl) return data.buyUrl;
  if (data.asin) return `https://www.amazon.com/dp/${data.asin}`;
  const brand = data.brand || entity.brandOrCreator || "";
  const title = entity.title || fallbackTitle;
  const query = [brand, title, data.model || data.ean].filter(Boolean).join(" ").trim() || "Product";
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}

/**
 * Main dispatcher: Resolves canonical label, href, icon, and interactivity for any card
 */
export function resolveCardUtility({
  entity,
  customUtilityLabel,
  primarySource,
  onUtilityClick,
}: ResolveCardUtilityParams): CardUtilityResult {
  const typePath = entity.typePath || "";
  const coreType = (entity.coreType || "").toUpperCase();

  // Invariant 2: Step 0 Privacy Guarantee (Memos never leak network queries)
  if (coreType === "PRIVATE_MEMO" || typePath.startsWith("/private")) {
    return {
      label: customUtilityLabel || "Private Memo",
      href: "#",
      iconName: "lock",
      isInteractive: false,
      targetBlank: false,
    };
  }

  // 1. Video Game
  if (typePath.includes("videogame") || typePath.includes("game") || coreType === "VIDEOGAME") {
    return {
      label: customUtilityLabel || "Play on Steam",
      href: resolveGameLink(entity),
      iconName: "gamepad-2",
      isInteractive: Boolean(onUtilityClick),
      targetBlank: true,
    };
  }

  // 2. Film / Cinema
  if (typePath.startsWith("/media/film") || coreType === "MEDIA") {
    return {
      label: customUtilityLabel || "Watch on MUBI",
      href: resolveCinemaLink(entity),
      iconName: "play",
      isInteractive: Boolean(onUtilityClick),
      targetBlank: true,
    };
  }

  // 3. Vinyl & Music
  if (typePath.startsWith("/media/music") || typePath.includes("vinyl") || coreType === "VINYL") {
    return {
      label: customUtilityLabel || "Play on Spotify",
      href: resolveMusicLink(entity),
      iconName: "music",
      isInteractive: Boolean(onUtilityClick),
      targetBlank: true,
    };
  }

  // 4. Books & Essays
  if (typePath.startsWith("/product/book") || coreType === "BOOK") {
    return {
      label: customUtilityLabel || "Read Sample",
      href: resolveBookLink(entity),
      iconName: "book-open",
      isInteractive: Boolean(onUtilityClick),
      targetBlank: true,
    };
  }

  // 5. Places & Cartography (Restaurants, Cafes, Hotels, Shops, Trails)
  if (typePath.startsWith("/place") || coreType === "PLACE") {
    return {
      label: customUtilityLabel || "Google Maps",
      href: resolvePlaceLink(entity),
      iconName: "map-pin",
      isInteractive: Boolean(onUtilityClick),
      targetBlank: true,
    };
  }

  // 6. Estate Wine
  if (typePath.includes("wine") || coreType === "WINE") {
    return {
      label: customUtilityLabel || "Vivino Review",
      href: resolveWineLink(entity),
      iconName: "wine",
      isInteractive: Boolean(onUtilityClick),
      targetBlank: true,
    };
  }

  // 7. Culinary / Recipes
  if (typePath.startsWith("/culinary") || coreType === "CULINARY") {
    return {
      label: customUtilityLabel || "Cook Mode",
      href: resolveRecipeLink(entity),
      iconName: "utensils",
      isInteractive: Boolean(onUtilityClick),
      targetBlank: true,
    };
  }

  // 8. Fine Art & Prints
  if (typePath.includes("art") || coreType === "ART") {
    return {
      label: customUtilityLabel || "View High-Res",
      href: resolveArtLink(entity),
      iconName: "frame",
      isInteractive: Boolean(onUtilityClick),
      targetBlank: true,
    };
  }

  // 9. Physical Products (Garments, Cosmetics, Electronics, General Goods)
  if (typePath.startsWith("/product") || coreType === "PRODUCT") {
    return {
      label: customUtilityLabel || "Buy Online",
      href: resolveProductLink(entity),
      iconName: "shopping-bag",
      isInteractive: Boolean(onUtilityClick),
      targetBlank: true,
    };
  }

  // Default Fallback
  return {
    label: customUtilityLabel || "Learn More",
    href: entity.canonicalUrl || "#",
    iconName: "external-link",
    isInteractive: Boolean(onUtilityClick),
    targetBlank: true,
  };
}
