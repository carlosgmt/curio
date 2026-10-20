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
 * 1. Cinema / Film: JustWatch, MUBI, TMDB
 */
export function resolveCinemaLink(entity: DeepLinkEntity, fallbackTitle = "Cinema"): string {
  const canonical = entity.canonicalUrl;
  if (
    canonical &&
    (canonical.includes("justwatch.com") ||
      canonical.includes("mubi.com") ||
      canonical.includes("letterboxd.com"))
  ) {
    return canonical;
  }
  const title = entity.title || fallbackTitle;
  return `https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}`;
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

export interface ActionProviderSlot {
  label: string;
  providerName: string;
  href: string;
  iconName:
    | "info"
    | "play"
    | "music"
    | "book-open"
    | "map-pin"
    | "wine"
    | "utensils"
    | "frame"
    | "external-link"
    | "lock"
    | "gamepad-2"
    | "shopping-bag";
}

export interface TypeActionProviders {
  infoAction: ActionProviderSlot;
  playAction: ActionProviderSlot | null;
  buyAction: ActionProviderSlot | null;
}

function isReferenceOrNonMerchantUrl(url?: string | null): boolean {
  if (!url || url === "#") return true;
  const lower = url.toLowerCase();
  return (
    lower.includes("wikipedia.org") ||
    lower.includes("wikidata.org") ||
    lower.includes("wikimedia.org") ||
    lower.includes("musicbrainz.org") ||
    lower.includes("openlibrary.org") ||
    lower.includes("themoviedb.org") ||
    lower.includes("localhost")
  );
}

/**
 * Resolves the 3 canonical default action providers (More Info, Play/Experience, Buy/Acquire)
 * for every Curio card type. Guarantees buyAction never points to Wikipedia/Wikidata.
 */
export function resolveTypeActionProviders(
  entity: DeepLinkEntity,
  primarySource?: {
    sellerName?: string;
    sourceUrl?: string;
  } | null
): TypeActionProviders {
  const typePath = (entity.typePath || "").toLowerCase();
  const coreType = (entity.coreType || "").toUpperCase();
  const title = entity.title || "Item";
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const canonical = entity.canonicalUrl && entity.canonicalUrl !== "#" ? entity.canonicalUrl : null;
  const verifiedMerchantUrl =
    primarySource?.sourceUrl && !isReferenceOrNonMerchantUrl(primarySource.sourceUrl)
      ? primarySource.sourceUrl
      : !isReferenceOrNonMerchantUrl(canonical)
      ? canonical
      : null;

  // 0. Private Memo
  if (coreType === "PRIVATE_MEMO" || typePath.startsWith("/private")) {
    return {
      infoAction: {
        label: "Private Memo",
        providerName: "Vault",
        href: "#",
        iconName: "lock",
      },
      playAction: null,
      buyAction: null,
    };
  }

  // 1. Music: Album / Song / Vinyl (checked BEFORE generic MEDIA)
  if (
    typePath.startsWith("/media/music") ||
    typePath.includes("vinyl") ||
    coreType === "VINYL" ||
    coreType === "MUSIC"
  ) {
    const artistName = data.artist || entity.brandOrCreator || "";
    const query = [artistName, title].filter(Boolean).join(" ").trim() || title;
    const isSong = typePath === "/media/music/song" || typePath.endsWith("/song");
    return {
      infoAction: {
        label: "Info",
        providerName: "MusicBrainz",
        href:
          canonical ||
          `https://musicbrainz.org/search?query=${encodeURIComponent(query)}&type=${isSong ? "recording" : "release"}`,
        iconName: "info",
      },
      playAction: {
        label: "Play on Spotify",
        providerName: "Spotify",
        href: resolveMusicLink(entity),
        iconName: "music",
      },
      buyAction: {
        label: isSong ? "Buy Track" : "Buy Album",
        providerName: "Discogs",
        href: verifiedMerchantUrl || getDiscogsSearchLink(query),
        iconName: "shopping-bag",
      },
    };
  }

  // 2. Video Games
  if (typePath.includes("videogame") || typePath.includes("game") || coreType === "VIDEOGAME") {
    return {
      infoAction: {
        label: "Info",
        providerName: "Wikipedia",
        href: canonical || `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(title)}`,
        iconName: "info",
      },
      playAction: {
        label: "Play on Steam",
        providerName: "Steam",
        href: resolveGameLink(entity),
        iconName: "gamepad-2",
      },
      buyAction: {
        label: "Buy Game",
        providerName: "Steam Store",
        href: verifiedMerchantUrl || resolveGameLink(entity),
        iconName: "shopping-bag",
      },
    };
  }

  // 3. Film / Cinema
  if (typePath.startsWith("/media/film") || coreType === "MEDIA") {
    return {
      infoAction: {
        label: "Info",
        providerName: "TMDB",
        href: canonical || `https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`,
        iconName: "info",
      },
      playAction: {
        label: "Watch Film",
        providerName: "JustWatch",
        href: resolveCinemaLink(entity),
        iconName: "play",
      },
      buyAction: {
        label: "Rent / Buy",
        providerName: "Prime Video",
        href:
          verifiedMerchantUrl ||
          `https://www.amazon.com/s?k=${encodeURIComponent(title)}&i=instant-video`,
        iconName: "shopping-bag",
      },
    };
  }

  // 4. Books & Essays
  if (typePath.startsWith("/product/book") || coreType === "BOOK") {
    const authorName = data.author || entity.brandOrCreator || "";
    const query = [title, authorName].filter(Boolean).join(" ").trim() || title;
    return {
      infoAction: {
        label: "Info",
        providerName: "OpenLibrary",
        href: canonical || getOpenLibrarySearchLink(query),
        iconName: "info",
      },
      playAction: {
        label: "Read Sample",
        providerName: "Google Books",
        href: resolveBookLink(entity),
        iconName: "book-open",
      },
      buyAction: {
        label: "Buy Book",
        providerName: "Bookshop.org",
        href: verifiedMerchantUrl || `https://bookshop.org/search?keywords=${encodeURIComponent(query)}`,
        iconName: "shopping-bag",
      },
    };
  }

  // 5. Watch / Horology
  if (typePath.startsWith("/product/watch") || coreType === "WATCH") {
    const brand = data.brand || entity.brandOrCreator || "";
    const query =
      [brand, title !== brand ? title : "", data.model || data.referenceNumber]
        .filter(Boolean)
        .join(" ")
        .trim() || title;
    const chronoUrl = `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(query)}`;
    return {
      infoAction: {
        label: "Info",
        providerName: "Wikipedia",
        href: canonical || `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,
        iconName: "info",
      },
      playAction: {
        label: "Chrono24 Specs",
        providerName: "Chrono24",
        href: chronoUrl,
        iconName: "external-link",
      },
      buyAction: {
        label: "Shop Chrono24",
        providerName: "Chrono24",
        href: verifiedMerchantUrl || chronoUrl,
        iconName: "shopping-bag",
      },
    };
  }

  // 6. Estate Wine
  if (typePath.includes("wine") || coreType === "WINE") {
    const prod = data.producer || entity.brandOrCreator || "";
    const vint = data.vintage || "";
    const wineQuery = [prod, title, vint].filter(Boolean).join(" ").trim() || title;
    return {
      infoAction: {
        label: "Info",
        providerName: "Vivino",
        href: canonical || resolveWineLink(entity),
        iconName: "info",
      },
      playAction: {
        label: "Vivino Review",
        providerName: "Vivino",
        href: resolveWineLink(entity),
        iconName: "wine",
      },
      buyAction: {
        label: "Buy Wine",
        providerName: "Wine-Searcher",
        href: verifiedMerchantUrl || getWineSearcherLink(wineQuery),
        iconName: "shopping-bag",
      },
    };
  }

  // 7. Garment / Apparel
  if (typePath.startsWith("/product/garment")) {
    const brand = data.brand || entity.brandOrCreator || "";
    const query = [brand, title !== brand ? title : ""].filter(Boolean).join(" ").trim() || title;
    return {
      infoAction: {
        label: "Info",
        providerName: "Reference",
        href: canonical || `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        iconName: "info",
      },
      playAction: {
        label: "Lookbook",
        providerName: "Google Images",
        href: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`,
        iconName: "frame",
      },
      buyAction: {
        label: "Shop Style",
        providerName: "Google Shopping",
        href: verifiedMerchantUrl || resolveProductLink(entity),
        iconName: "shopping-bag",
      },
    };
  }

  // 8. Places & Cartography
  if (typePath.startsWith("/place") || coreType === "PLACE") {
    return {
      infoAction: {
        label: "Info",
        providerName: "Wikipedia",
        href: canonical || `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(title)}`,
        iconName: "info",
      },
      playAction: {
        label: "Google Maps",
        providerName: "Google Maps",
        href: resolvePlaceLink(entity),
        iconName: "map-pin",
      },
      buyAction: {
        label: "Apple Maps",
        providerName: "Apple Maps",
        href: getAppleMapsLink(title),
        iconName: "map-pin",
      },
    };
  }

  // 9. Culinary / Recipes
  if (typePath.startsWith("/culinary") || coreType === "CULINARY") {
    return {
      infoAction: {
        label: "Info",
        providerName: "Wikipedia",
        href: canonical || `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(title)}`,
        iconName: "info",
      },
      playAction: {
        label: "Cook Mode",
        providerName: "NYT Cooking",
        href: resolveRecipeLink(entity),
        iconName: "utensils",
      },
      buyAction: {
        label: "Ingredients",
        providerName: "Instacart",
        href: `https://www.instacart.com/store/s?k=${encodeURIComponent(title)}`,
        iconName: "shopping-bag",
      },
    };
  }

  // 10. Fine Art & Prints
  if (typePath.includes("art") || coreType === "ART") {
    return {
      infoAction: {
        label: "Info",
        providerName: "Wikipedia",
        href: canonical || `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(title)}`,
        iconName: "info",
      },
      playAction: {
        label: "View High-Res",
        providerName: "Artsy",
        href: resolveArtLink(entity),
        iconName: "frame",
      },
      buyAction: {
        label: "Find Print",
        providerName: "Artsy",
        href: verifiedMerchantUrl || `https://www.artsy.net/search?term=${encodeURIComponent(title)}`,
        iconName: "shopping-bag",
      },
    };
  }

  // 11. Physical Products & Default
  const brand = data.brand || entity.brandOrCreator || "";
  const query = [brand, title !== brand ? title : ""].filter(Boolean).join(" ").trim() || title;
  return {
    infoAction: {
      label: "Info",
      providerName: "Wikipedia",
      href: canonical || `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,
      iconName: "info",
    },
    playAction: {
      label: "Specs & Reviews",
      providerName: "Google",
      href: `https://www.google.com/search?q=${encodeURIComponent(query + " review")}`,
      iconName: "external-link",
    },
    buyAction: {
      label: "Buy Product",
      providerName: "Google Shopping",
      href: verifiedMerchantUrl || resolveProductLink(entity),
      iconName: "shopping-bag",
    },
  };
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
  const typePath = (entity.typePath || "").toLowerCase();
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

  // 2. Music / Album / Song / Vinyl (checked BEFORE generic coreType === "MEDIA")
  if (
    typePath.startsWith("/media/music") ||
    typePath.includes("vinyl") ||
    coreType === "VINYL" ||
    coreType === "MUSIC"
  ) {
    return {
      label: customUtilityLabel || "Play on Spotify",
      href: resolveMusicLink(entity),
      iconName: "music",
      isInteractive: Boolean(onUtilityClick),
      targetBlank: true,
    };
  }

  // 3. Film / Cinema
  if (typePath.startsWith("/media/film") || coreType === "MEDIA") {
    return {
      label: customUtilityLabel || "Watch Film",
      href: resolveCinemaLink(entity),
      iconName: "play",
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

  // 9. Watch / Horology
  if (typePath.startsWith("/product/watch") || coreType === "WATCH") {
    const providers = resolveTypeActionProviders(entity, primarySource);
    return {
      label: customUtilityLabel || "Shop Chrono24",
      href: providers.buyAction?.href || resolveProductLink(entity),
      iconName: "shopping-bag",
      isInteractive: Boolean(onUtilityClick),
      targetBlank: true,
    };
  }

  // 10. Physical Products (Garments, Cosmetics, Electronics, General Goods)
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

export const resolveContextualUtilityLink = resolveCardUtility;

