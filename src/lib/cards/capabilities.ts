import {
  getAppleMapsLink,
  getDiscogsSearchLink,
  getOpenLibrarySearchLink,
  resolveBookLink,
  resolveCinemaLink,
  resolveMusicLink,
  resolvePlaceLink,
  resolveWineLink,
  type ActionProviderSlot,
  type DeepLinkEntity,
} from "@/lib/commerce/utilityDeepLinks";

export interface CapabilityCardLike {
  save: {
    id: string;
    isPrivateMemo?: boolean | null;
    wishlist?: boolean | null;
    typePath?: string | null;
  };
  entity?: (DeepLinkEntity & {
    ucpSkuId?: string | null;
    priceCents?: number | null;
    currency?: string | null;
    extendedAttributes?: any;
  }) | null;
}

function getStructuredData(entity?: DeepLinkEntity | null): Record<string, any> {
  return entity?.coreStructuredData && typeof entity.coreStructuredData === "object"
    ? (entity.coreStructuredData as Record<string, any>)
    : {};
}

function getExtendedAttrs(entity?: CapabilityCardLike["entity"]): Record<string, any> {
  return entity?.extendedAttributes && typeof entity.extendedAttributes === "object"
    ? (entity.extendedAttributes as Record<string, any>)
    : {};
}

function isReferenceOrInternalUrl(url?: string | null): boolean {
  if (!url || url === "#") return true;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return true;
  const lower = trimmed.toLowerCase();
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

export function isSyncedClosetItem(entity?: CapabilityCardLike["entity"]): boolean {
  return Boolean(getStructuredData(entity).closetId);
}

export function isSyncedPurchaseHubItem(entity?: CapabilityCardLike["entity"]): boolean {
  const ext = getExtendedAttrs(entity);
  return Boolean(ext.purchaseHubProductId || ext.source === "purchase-hub");
}

export function isSyncedChefItem(entity?: CapabilityCardLike["entity"]): boolean {
  const data = getStructuredData(entity);
  const ext = getExtendedAttrs(entity);
  return Boolean(
    data.chefSlug ||
      ext.chefSlug ||
      data.source === "chef-ui" ||
      ext.source === "chef-ui" ||
      (typeof entity?.canonicalUrl === "string" && entity.canonicalUrl.includes("/chef/"))
  );
}

/**
 * Only unowned purchasable physical goods support "Bought it -> Promote to My Stuff".
 * Recipes, Places, Films, Quotes, Private Memos, Checklists, Outfits, and already-owned synced items never do.
 */
export function canMarkBought(card?: CapabilityCardLike | null): boolean {
  if (!card) return false;
  if (card.save.isPrivateMemo) return false;
  if (isSyncedClosetItem(card.entity) || isSyncedPurchaseHubItem(card.entity)) return false;

  const typePath = (card.entity?.typePath || card.save.typePath || "").toLowerCase();
  const coreType = (card.entity?.coreType || "").toUpperCase();

  if (
    typePath.startsWith("/private") ||
    typePath.startsWith("/culinary") ||
    typePath.includes("recipe") ||
    typePath.startsWith("/place") ||
    typePath.includes("travel") ||
    typePath.startsWith("/style/outfit") ||
    typePath.includes("quote") ||
    typePath.includes("checklist") ||
    typePath.startsWith("/media/film") ||
    coreType === "PRIVATE_MEMO" ||
    coreType === "CULINARY" ||
    coreType === "PLACE"
  ) {
    return false;
  }

  return (
    typePath.startsWith("/product") ||
    typePath.includes("vinyl") ||
    typePath.includes("videogame") ||
    typePath.includes("wine") ||
    typePath.startsWith("/media/music") ||
    typePath.startsWith("/media/videogame") ||
    coreType === "PRODUCT" ||
    coreType === "BOOK" ||
    coreType === "WATCH" ||
    coreType === "WINE" ||
    coreType === "VINYL" ||
    coreType === "MUSIC" ||
    coreType === "VIDEOGAME"
  );
}

/**
 * Gates Wishlist / Want-to toggling to acquirable or experiential items.
 * Already-wishlisted items always remain toggleable so users can untoggle legacy wishes.
 */
export function canWishlist(card?: CapabilityCardLike | null): boolean {
  if (!card) return false;
  if (card.save.wishlist) return true;
  if (card.save.isPrivateMemo) return false;

  const typePath = (card.entity?.typePath || card.save.typePath || "").toLowerCase();
  const coreType = (card.entity?.coreType || "").toUpperCase();

  if (
    typePath.startsWith("/private") ||
    typePath.startsWith("/style/outfit") ||
    typePath.includes("quote") ||
    typePath.includes("checklist") ||
    coreType === "PRIVATE_MEMO"
  ) {
    return false;
  }

  if (isSyncedClosetItem(card.entity) || isSyncedPurchaseHubItem(card.entity)) {
    return false;
  }

  return true;
}

export interface AuthenticFooterAction {
  slot: "info" | "experience" | "buy" | "owned";
  label: string;
  providerName: string;
  href: string;
  iconName: ActionProviderSlot["iconName"];
  priceTag?: string | null;
}

/**
 * Resolves only authentic, type-appropriate footer actions for card hovers and drawers.
 * Returns [] for Quotes, Private Memos, Outfits, Photos, Checklists, and unlinked Recipes/Products
 * instead of inventing Google Shopping / Instacart / Google Images search URLs.
 */
export function resolveAuthenticFooterActions(
  entity: DeepLinkEntity & {
    ucpSkuId?: string | null;
    priceCents?: number | null;
    currency?: string | null;
    extendedAttributes?: any;
  },
  primarySource?: {
    sellerName?: string;
    sourceUrl?: string;
    priceCents?: number | null;
    currency?: string | null;
  } | null,
  isWishlist = false
): AuthenticFooterAction[] {
  const data = getStructuredData(entity);
  const ext = getExtendedAttrs(entity);
  const typePath = (entity.typePath || "").toLowerCase();
  const coreType = (entity.coreType || "").toUpperCase();
  const title = entity.title || "Item";
  const canonical = entity.canonicalUrl && entity.canonicalUrl !== "#" ? entity.canonicalUrl : null;

  // 1. Synced owned items (Closet / My Stuff) — handled unless explicitly wishlisted
  if ((isSyncedClosetItem(entity) || isSyncedPurchaseHubItem(entity)) && !isWishlist) {
    return [];
  }

  // 2. Self-contained items with zero external action need
  if (
    coreType === "PRIVATE_MEMO" ||
    typePath.startsWith("/private") ||
    typePath.startsWith("/style/outfit") ||
    typePath.includes("quote") ||
    typePath.includes("checklist") ||
    typePath.startsWith("/media/photo")
  ) {
    return [];
  }

  const verifiedExternalUrl =
    primarySource?.sourceUrl && !isReferenceOrInternalUrl(primarySource.sourceUrl)
      ? primarySource.sourceUrl
      : !isReferenceOrInternalUrl(canonical)
      ? canonical
      : typeof data.buyUrl === "string" && !isReferenceOrInternalUrl(data.buyUrl)
      ? data.buyUrl
      : null;

  // 3. Music / Vinyl
  if (
    typePath.startsWith("/media/music") ||
    typePath.includes("vinyl") ||
    coreType === "VINYL" ||
    coreType === "MUSIC"
  ) {
    const artistName = data.artist || entity.brandOrCreator || "";
    const query = [artistName, title].filter(Boolean).join(" ").trim() || title;
    const isSong = typePath === "/media/music/song" || typePath.endsWith("/song");
    return [
      {
        slot: "experience",
        label: "Play on Spotify",
        providerName: "Spotify",
        href: resolveMusicLink(entity),
        iconName: "music",
      },
      {
        slot: "buy",
        label: isSong ? "Buy Track" : "Buy Album",
        providerName: "Discogs",
        href: verifiedExternalUrl || getDiscogsSearchLink(query),
        iconName: "shopping-bag",
      },
    ];
  }

  // 4. Video Games
  if (typePath.includes("videogame") || typePath.includes("game") || coreType === "VIDEOGAME") {
    return [
      {
        slot: "experience",
        label: "Play on Steam",
        providerName: "Steam",
        href: verifiedExternalUrl || `https://store.steampowered.com/search/?term=${encodeURIComponent(title)}`,
        iconName: "gamepad-2",
      },
    ];
  }

  // 5. Film / Cinema
  if (typePath.startsWith("/media/film") || coreType === "MEDIA") {
    const actions: AuthenticFooterAction[] = [
      {
        slot: "info",
        label: "TMDB",
        providerName: "TMDB",
        href: canonical && canonical.includes("themoviedb.org")
          ? canonical
          : `https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`,
        iconName: "info",
      },
      {
        slot: "experience",
        label: "Watch Film",
        providerName: "JustWatch",
        href: resolveCinemaLink(entity),
        iconName: "play",
      },
    ];
    if (verifiedExternalUrl && !verifiedExternalUrl.includes("letterboxd.com")) {
      actions.push({
        slot: "buy",
        label: primarySource?.sellerName || "Watch",
        providerName: primarySource?.sellerName || "Stream",
        href: verifiedExternalUrl,
        iconName: "shopping-bag",
      });
    }
    return actions;
  }

  // 6. Books
  if (typePath.startsWith("/product/book") || coreType === "BOOK") {
    const authorName = data.author || entity.brandOrCreator || "";
    const query = [title, authorName].filter(Boolean).join(" ").trim() || title;
    return [
      {
        slot: "info",
        label: "Info",
        providerName: "OpenLibrary",
        href:
          canonical && canonical.includes("openlibrary.org")
            ? canonical
            : getOpenLibrarySearchLink(query),
        iconName: "info",
      },
      {
        slot: "experience",
        label: "Preview",
        providerName: "Google Books",
        href: resolveBookLink(entity),
        iconName: "book-open",
      },
      {
        slot: "buy",
        label: "Buy Book",
        providerName: primarySource?.sellerName || "Bookshop.org",
        href: verifiedExternalUrl || `https://bookshop.org/search?keywords=${encodeURIComponent(query)}`,
        iconName: "shopping-bag",
      },
    ];
  }

  // 7. Places
  if (typePath.startsWith("/place") || coreType === "PLACE") {
    const actions: AuthenticFooterAction[] = [
      {
        slot: "experience",
        label: "Google Maps",
        providerName: "Google Maps",
        href: resolvePlaceLink(entity),
        iconName: "map-pin",
      },
      {
        slot: "info",
        label: "Apple Maps",
        providerName: "Apple Maps",
        href: getAppleMapsLink(title),
        iconName: "map-pin",
      },
    ];
    if (verifiedExternalUrl && !verifiedExternalUrl.includes("google.com/maps")) {
      actions.push({
        slot: "buy",
        label: "Website",
        providerName: primarySource?.sellerName || "Venue",
        href: verifiedExternalUrl,
        iconName: "external-link",
      });
    }
    return actions;
  }

  // 8. Recipes (Synced Chef -> Open in Chef + optional external source; unlinked recipes -> verified source only)
  if (typePath.startsWith("/culinary") || typePath.includes("recipe") || coreType === "CULINARY") {
    const actions: AuthenticFooterAction[] = [];
    if (verifiedExternalUrl) {
      actions.push({
        slot: "info",
        label: primarySource?.sellerName && primarySource.sellerName !== "Chef UI" ? primarySource.sellerName : "Source",
        providerName: primarySource?.sellerName || "Recipe Source",
        href: verifiedExternalUrl,
        iconName: "utensils",
      });
    }
    if (isSyncedChefItem(entity)) {
      const slug = data.chefSlug || ext.chefSlug;
      actions.push({
        slot: "owned",
        label: "Open in Chef",
        providerName: "Chef UI",
        href: slug ? `/chef/#recipe-${slug}` : "/chef/",
        iconName: "utensils",
      });
    }
    return actions;
  }

  // 9. Wine
  if (typePath.includes("wine") || coreType === "WINE") {
    const actions: AuthenticFooterAction[] = [
      {
        slot: "experience",
        label: "Vivino",
        providerName: "Vivino",
        href: resolveWineLink(entity),
        iconName: "wine",
      },
    ];
    if (verifiedExternalUrl) {
      actions.push({
        slot: "buy",
        label: primarySource?.sellerName || "Buy Wine",
        providerName: primarySource?.sellerName || "Merchant",
        href: verifiedExternalUrl,
        iconName: "shopping-bag",
      });
    }
    return actions;
  }

  // 10. Physical Goods, Art, Web Links: authentic verified URLs only (zero fabricated search links)
  if (verifiedExternalUrl) {
    return [
      {
        slot: "buy",
        label:
          typePath.startsWith("/product") || coreType === "PRODUCT" || coreType === "WATCH"
            ? primarySource?.sellerName || "Visit Shop"
            : primarySource?.sellerName || "Open Link",
        providerName: primarySource?.sellerName || "Source",
        href: verifiedExternalUrl,
        iconName:
          typePath.startsWith("/product") || coreType === "PRODUCT" || coreType === "WATCH"
            ? "shopping-bag"
            : "external-link",
      },
    ];
  }

  return [];
}
