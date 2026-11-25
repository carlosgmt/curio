import {
  getAdapterSyncCacheEntry,
  runSyncAdapter,
  type SyncAdapter,
  type SyncBoardTarget,
  type SyncFetchFn,
  type SyncOptions,
  type SyncRecord,
  type SyncRunResult,
} from "./engine";
import { registerSyncAdapter } from "./registry";
import { areSameBook, isTravelGuideOrStudyBook } from "@/lib/books/identity";

export interface PurchaseHubSyncItem {
  product_id: string;
  canonical_name: string;
  brand?: string | null;
  model_number?: string | null;
  category?: string | null;
  item_kind?: string | null;
  owner_scope?: string | null;
  ownership_status?: string | null;
  collections?: string[] | null;
  tags?: string[] | null;
  location?: string | null;
  manual_url?: string | null;
  has_manual?: boolean;
  image_url?: string | null;
  image_filename?: string | null;
  source_url?: string | null;
  first_bought?: string | null;
  last_bought?: string | null;
  native_currency?: string | null;
  total_spent?: number | null;
  total_spent_eur?: number | null;
  warranty_until?: string | null;
  retailers?: string | null;
  notes?: string | null;
  closet_exported?: boolean;
  updated_at?: string | null;
}

export interface PurchaseHubSyncOptions extends SyncOptions {
  purchaseHubApiUrl?: string;
  timeoutMs?: number;
  ownerScopes?: string[];
}

export function getPurchaseHubApiBaseUrl(): string {
  return (process.env.PURCHASE_HUB_API_URL || "http://127.0.0.1:8760").replace(
    /\/+$/,
    ""
  );
}

function slugifySegment(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "other";
}

export function classifyPurchaseHubItem(item: PurchaseHubSyncItem): {
  skip: boolean;
  coreType: string;
  typePath: string;
  boards: SyncBoardTarget[];
} {
  const category = (item.category || "Other").trim();
  const catLower = category.toLowerCase();
  if (item.closet_exported || catLower === "apparel") {
    return { skip: true, coreType: "PRODUCT", typePath: "/product/garment", boards: [] };
  }

  const kitSection =
    Array.isArray(item.collections) && item.collections.length > 0
      ? String(item.collections[0]).trim() || null
      : null;

  if (catLower === "books & media" || catLower === "books and media") {
    const probe = `${item.canonical_name} ${item.brand || ""} ${(item.tags || []).join(" ")}`.toLowerCase();

    // 1. Hardware, e-readers, storage & workstation accessories synced under Books & Media
    if (
      /\b(nvme|ssd|usb\s*hub|usb-?c|adapter|cable|kindle|e-?reader|ebook\s*reader|tablet|computer\s*storage|pc\s*component|laptop\s*accessory)\b/.test(
        probe
      )
    ) {
      return {
        skip: false,
        coreType: "PRODUCT",
        typePath: "/product/electronics",
        boards: [
          {
            rootSlug: "my-stuff",
            rootTitle: "My Stuff",
            rootDescription: "Owned durable objects synced from Purchase Hub",
            rootDefaultLayout: "shelf",
            subSlug: "my-stuff-electronics",
            subTitle: "Electronics",
            subDescription: "Owned Electronics items synced from Purchase Hub",
            subDefaultLayout: "shelf",
            sectionHeader: kitSection,
          },
        ],
      };
    }

    // 2. Fitness / misc non-books occasionally categorized under Books & Media
    if (/\b(foam\s*roller|rodillo|myofascial|self-massage)\b/.test(probe)) {
      return {
        skip: false,
        coreType: "PRODUCT",
        typePath: "/product",
        boards: [
          {
            rootSlug: "my-stuff",
            rootTitle: "My Stuff",
            rootDescription: "Owned durable objects synced from Purchase Hub",
            rootDefaultLayout: "shelf",
            subSlug: "my-stuff-sports-outdoors",
            subTitle: "Sports & Outdoors",
            subDescription: "Owned Sports & Outdoors items synced from Purchase Hub",
            subDefaultLayout: "shelf",
            sectionHeader: kitSection,
          },
        ],
      };
    }

    // 3. Video games & digital/board RPGs -> Games media board
    if (
      /\b(video\s*game|rpg\s*game|playstation|xbox|nintendo|stadia|steam|deckbuilding|early\s*access|juego\s*completo|baldur'?s\s*gate|cyberpunk\s*2077|diablo\s*iii|destiny\s*2|little\s*nightmares|dear\s*esther|board\s*game)\b/.test(
        probe
      )
    ) {
      return {
        skip: false,
        coreType: "MEDIA",
        typePath: "/media/videogame",
        boards: [
          {
            rootSlug: "games",
            rootTitle: "Games",
            rootDefaultLayout: "shelf",
            sectionHeader: kitSection,
            autoRules: { typePathPrefix: "/media/videogame" },
          },
        ],
      };
    }

    // 4. Music / Vinyl
    if (/\b(vinyl|lp|album|turntable|record|soundtrack cd)\b/.test(probe)) {
      return {
        skip: false,
        coreType: "MEDIA",
        typePath: "/media/music/album",
        boards: [
          {
            rootSlug: "music",
            rootTitle: "Music",
            rootDefaultLayout: "shelf",
            sectionHeader: kitSection,
            autoRules: { typePathPrefix: "/media/music" },
          },
        ],
      };
    }

    // 5. Films / Blu-ray (skip textbooks/books with bundled CD/DVD or ISBN-13)
    const hasIsbn13 = /\b97[89]\d{10}\b/.test(probe) || (item.model_number ? /^97[89]\d{10}$/.test(item.model_number.trim()) : false);
    const looksLikeBookWithDisc =
      hasIsbn13 ||
      (/\b(eleve|textbook|workbook|libro|book)\b/.test(probe) &&
        /\b(cd\+?dvd|with dvd|con dvd|cd)\b/.test(probe));

    if (!looksLikeBookWithDisc && /\b(blu-?ray|dvd|4k uhd|film|movie|criterion)\b/.test(probe)) {
      return {
        skip: false,
        coreType: "MEDIA",
        typePath: "/media/film",
        boards: [
          {
            rootSlug: "films",
            rootTitle: "Films",
            rootDefaultLayout: "posters",
            sectionHeader: kitSection,
            autoRules: { typePathPrefix: "/media/film" },
          },
        ],
      };
    }

    // 6. Kids' sticker, coloring & toddler activity books -> excluded from Personal Library
    if (
      /\b(sticker\s*book|sticker\s*activity|coloring\s*book|colouring\s*book|libros?\s*para\s*colorear|colorear|activity\s*book|toddler\s*activity|toddler\s*book|kids?\s*activity|peppa\s*pig|shaun\s*the\s*sheep|tiptoi|watch\s*me\s*color)\b/.test(
        probe
      )
    ) {
      return {
        skip: false,
        coreType: "PRODUCT",
        typePath: "/product/kids-activity",
        boards: [
          {
            rootSlug: "my-stuff",
            rootTitle: "My Stuff",
            rootDescription: "Owned durable objects synced from Purchase Hub",
            rootDefaultLayout: "shelf",
            subSlug: "my-stuff-kids-activities",
            subTitle: "Kids & Activities",
            subDescription: "Owned kids sticker, coloring & activity items synced from Purchase Hub",
            subDefaultLayout: "shelf",
            sectionHeader: kitSection,
          },
        ],
      };
    }

    // 6b. Travel guides & language/study books -> My Stuff / Travel & Study (excluded from Books board)
    if (isTravelGuideOrStudyBook(probe)) {
      return {
        skip: false,
        coreType: "PRODUCT",
        typePath: "/product/reference",
        boards: [
          {
            rootSlug: "my-stuff",
            rootTitle: "My Stuff",
            rootDescription: "Owned durable objects synced from Purchase Hub",
            rootDefaultLayout: "shelf",
            subSlug: "my-stuff-reference-travel",
            subTitle: "Travel & Study",
            subDescription:
              "Owned travel guides, language textbooks, and study books synced from Purchase Hub",
            subDefaultLayout: "shelf",
            sectionHeader: kitSection,
          },
        ],
      };
    }

    // 7. Genuine Books -> Personal Library
    return {
      skip: false,
      coreType: "BOOK",
      typePath: "/product/book",
      boards: [
        {
          rootSlug: "books",
          rootTitle: "Books",
          rootDefaultLayout: "shelf",
          sectionHeader: kitSection,
          autoRules: { coreType: "BOOK" },
        },
      ],
    };
  }

  let typePath = "/product";
  if (catLower === "furniture") {
    typePath = "/product/furniture";
  } else if (catLower === "electronics" || catLower === "office & tech") {
    typePath = "/product/electronics";
  }

  const catSlug = slugifySegment(category);
  return {
    skip: false,
    coreType: "PRODUCT",
    typePath,
    boards: [
      {
        rootSlug: "my-stuff",
        rootTitle: "My Stuff",
        rootDescription: "Owned durable objects synced from Purchase Hub",
        rootDefaultLayout: "shelf",
        subSlug: `my-stuff-${catSlug}`,
        subTitle: category,
        subDescription: `Owned ${category} items synced from Purchase Hub`,
        subDefaultLayout: "shelf",
        sectionHeader: kitSection,
      },
    ],
  };
}

export function mapPurchaseHubItemToSyncRecord(
  item: PurchaseHubSyncItem
): SyncRecord | null {
  const cls = classifyPurchaseHubItem(item);
  if (cls.skip) return null;

  const entityKey = `purchase-hub:${item.product_id}`;
  const priceCents =
    typeof item.total_spent === "number" && item.total_spent > 0
      ? Math.round(item.total_spent * 100)
      : null;
  const currency = (item.native_currency || "CHF").toUpperCase();
  const canonicalUrl =
    item.source_url && /^https?:\/\//i.test(item.source_url.trim())
      ? item.source_url.trim()
      : `https://mini.orca-banjo.ts.net/my-stuff/#product-${item.product_id}`;

  const heroImageUrl = item.image_filename
    ? `/curio/api/v1/media/purchase-hub/${encodeURIComponent(item.image_filename)}`
    : item.image_url && /^https?:\/\//i.test(item.image_url)
    ? item.image_url
    : null;

  const summaryParts = [
    item.brand,
    item.model_number,
    item.retailers,
    item.location ? `Location: ${item.location}` : null,
  ].filter(Boolean);

  const tags = [
    ...(Array.isArray(item.collections) ? item.collections : []),
    ...(Array.isArray(item.tags) ? item.tags : []),
    item.owner_scope ? `owner:${item.owner_scope}` : null,
  ].filter((t): t is string => Boolean(t && t.trim()));

  const cleanBrand =
    item.brand && !/^(amazon|galaxus|google_play|provini)$/i.test(item.brand.trim())
      ? item.brand.trim()
      : null;

  const coreStructuredData: Record<string, unknown> = {};
  if (cleanBrand) coreStructuredData.brand = cleanBrand;
  if (item.model_number) coreStructuredData.modelNumber = item.model_number;
  if (item.retailers) coreStructuredData.retailer = item.retailers;
  const purchaseDate = item.last_bought ?? item.first_bought;
  if (purchaseDate) coreStructuredData.purchaseDate = purchaseDate;
  if (item.warranty_until) coreStructuredData.warrantyUntil = item.warranty_until;
  if (cls.coreType === "BOOK") {
    coreStructuredData.title = item.canonical_name;
    if (item.model_number && /^[0-9Xx]{10,13}$/.test(item.model_number.trim())) {
      coreStructuredData.isbn = item.model_number.trim();
    }
  }

  return {
    externalId: item.product_id,
    entityKey,
    canonicalExternalId: entityKey,
    canonicalUrl,
    coreType: cls.coreType,
    typePath: cls.typePath,
    title: item.canonical_name,
    brandOrCreator: cls.coreType === "BOOK" ? cleanBrand : item.brand ?? null,
    modelNumber: item.model_number ?? null,
    summary: summaryParts.join(" · ") || null,
    heroImageUrl,
    priceCents,
    currency,
    wishlist: false,
    tags,
    personalNotes: item.notes?.trim() || null,
    coreStructuredData,
    extendedAttributes: {
      source: "purchase-hub",
      purchaseHubProductId: item.product_id,
      ownerScope: item.owner_scope || "home",
      category: item.category || "Other",
      collections: item.collections || [],
      retailers: item.retailers ?? null,
      firstBought: item.first_bought ?? null,
      lastBought: item.last_bought ?? null,
      warrantyUntil: item.warranty_until ?? null,
      location: item.location ?? null,
      hasManual: Boolean(item.has_manual),
      manualUrl: item.manual_url ?? null,
      modelNumber: item.model_number ?? null,
      ...(cls.coreType === "BOOK" ? { bookSource: "OWNED", owned: true } : {}),
    },
    sourceLink: item.source_url
      ? {
          sellerName: item.retailers || "Merchant",
          sourceUrl: item.source_url,
          priceCents,
          currency,
        }
      : null,
    boards: cls.boards,
  };
}

export const purchaseHubAdapter: SyncAdapter<PurchaseHubSyncOptions> = {
  sourceId: "purchase-hub",
  displayName: "Purchase Hub (My Stuff)",
  supportsWishlistPromotion: true,
  supportsPruning: true,
  keyPrefix: "purchase-hub:",
  getStatus(userId: string) {
    return {
      configuredUrl: getPurchaseHubApiBaseUrl(),
      ...getAdapterSyncCacheEntry("purchase-hub", userId),
    };
  },
  async fetchSnapshot(_userId: string, options?: PurchaseHubSyncOptions) {
    const fetchFn: SyncFetchFn = options?.fetchFn ?? fetch;
    const baseUrl = (options?.purchaseHubApiUrl || getPurchaseHubApiBaseUrl()).replace(
      /\/+$/,
      ""
    );
    const timeoutMs = options?.timeoutMs ?? 6000;
    const scopes =
      options?.ownerScopes && options.ownerScopes.length > 0
        ? options.ownerScopes.join(",")
        : "home,personal";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let payload: { digest?: string; items?: PurchaseHubSyncItem[] };
    try {
      const res = await fetchFn(
        `${baseUrl}/api/sync/curio?owner_scopes=${encodeURIComponent(scopes)}`,
        {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        }
      );
      if (!res.ok) {
        throw new Error(`Purchase Hub API returned ${res.status}`);
      }
      payload = (await res.json()) as { digest?: string; items?: PurchaseHubSyncItem[] };
    } finally {
      clearTimeout(timer);
    }

    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const records: SyncRecord[] = [];
    const bookRecords: SyncRecord[] = [];
    let skippedClosetOrApparel = 0;

    for (const item of rawItems) {
      if (!item || !item.product_id) continue;
      const mapped = mapPurchaseHubItemToSyncRecord(item);
      if (!mapped) {
        skippedClosetOrApparel++;
        continue;
      }

      if (mapped.coreType === "BOOK") {
        const mappedProbe = {
          title: mapped.title,
          author:
            mapped.brandOrCreator ||
            (typeof mapped.coreStructuredData?.author === "string"
              ? mapped.coreStructuredData.author
              : null),
          isbn:
            (typeof mapped.coreStructuredData?.isbn === "string"
              ? mapped.coreStructuredData.isbn
              : null) || mapped.modelNumber,
          coverUrl: mapped.heroImageUrl,
        };
        const dup = bookRecords.find((existing) =>
          areSameBook(
            {
              title: existing.title,
              author:
                existing.brandOrCreator ||
                (typeof existing.coreStructuredData?.author === "string"
                  ? existing.coreStructuredData.author
                  : null),
              isbn:
                (typeof existing.coreStructuredData?.isbn === "string"
                  ? existing.coreStructuredData.isbn
                  : null) || existing.modelNumber,
              coverUrl: existing.heroImageUrl,
            },
            mappedProbe
          )
        );
        if (dup) {
          const dupExt = (dup.extendedAttributes || {}) as Record<string, unknown>;
          const prevIds = Array.isArray(dupExt.mergedPurchaseHubIds)
            ? dupExt.mergedPurchaseHubIds.map(String)
            : [dup.externalId];
          dup.extendedAttributes = {
            ...dupExt,
            mergedPurchaseHubIds: [...new Set([...prevIds, mapped.externalId])],
          };
          if (!dup.heroImageUrl && mapped.heroImageUrl) {
            dup.heroImageUrl = mapped.heroImageUrl;
          }
          if (!dup.brandOrCreator && mapped.brandOrCreator) {
            dup.brandOrCreator = mapped.brandOrCreator;
          }
          if (!dup.personalNotes && mapped.personalNotes) {
            dup.personalNotes = mapped.personalNotes;
          }
          const mergedTags = new Map<string, string>();
          for (const t of [...(dup.tags || []), ...(mapped.tags || [])]) {
            const c = String(t || "").trim();
            if (c && !mergedTags.has(c.toLowerCase())) {
              mergedTags.set(c.toLowerCase(), c);
            }
          }
          dup.tags = [...mergedTags.values()];
          continue;
        }
        mapped.extendedAttributes = {
          ...(mapped.extendedAttributes || {}),
          mergedPurchaseHubIds: [mapped.externalId],
        };
        bookRecords.push(mapped);
      }

      records.push(mapped);
    }

    return {
      digest: payload.digest || `ph-${records.length}`,
      records,
      meta: {
        upstreamCount: rawItems.length,
        skippedClosetOrApparel,
      },
    };
  },
};

registerSyncAdapter(purchaseHubAdapter);

export async function syncPurchaseHubWithCurio(
  userId: string,
  options?: PurchaseHubSyncOptions
): Promise<SyncRunResult> {
  return runSyncAdapter(userId, purchaseHubAdapter, options);
}

export function getPurchaseHubSyncStatus(userId: string): {
  configuredUrl: string;
  lastSyncedAt: string | null;
  digest: string | null;
  lastResult: SyncRunResult | null;
} {
  return {
    configuredUrl: getPurchaseHubApiBaseUrl(),
    ...getAdapterSyncCacheEntry("purchase-hub", userId),
  };
}

export function extractPurchaseHubProductId(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const c of candidates) {
    if (!c || typeof c !== "string") continue;
    const m = c.trim().match(/^(?:purchase-hub:)?(prd_[A-Za-z0-9_-]+)$/);
    if (m) return m[1];
  }
  return null;
}

export async function syncCurioSaveEditToPurchaseHub(
  identifiers: {
    entityKey?: string | null;
    canonicalExternalId?: string | null;
    extendedAttributes?: Record<string, unknown> | null;
  },
  updates: {
    title?: string | null;
    brandOrCreator?: string | null;
    personalNotes?: string | null;
  },
  options?: { fetchFn?: SyncFetchFn; purchaseHubApiUrl?: string }
): Promise<boolean> {
  const pid = extractPurchaseHubProductId(
    typeof identifiers.extendedAttributes?.purchaseHubProductId === "string"
      ? identifiers.extendedAttributes.purchaseHubProductId
      : null,
    identifiers.canonicalExternalId,
    identifiers.entityKey
  );
  if (!pid) return false;

  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined && updates.title !== null && updates.title.trim()) {
    payload.canonical_name = updates.title.trim();
  }
  if (updates.brandOrCreator !== undefined) {
    payload.brand = updates.brandOrCreator ?? "";
  }
  if (updates.personalNotes !== undefined) {
    payload.notes = updates.personalNotes ?? "";
  }
  if (Object.keys(payload).length === 0) return false;

  const fetchFn: SyncFetchFn = options?.fetchFn ?? fetch;
  const baseUrl = (options?.purchaseHubApiUrl || getPurchaseHubApiBaseUrl()).replace(
    /\/+$/,
    ""
  );
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetchFn(`${baseUrl}/api/products/${encodeURIComponent(pid)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function createPurchaseHubItemFromWishlist(
  payload: {
    canonicalName: string;
    brand?: string | null;
    price?: number | null;
    currency?: string | null;
    orderDate?: string | null;
    retailer?: string | null;
    category?: string | null;
    ownerScope?: "home" | "personal";
    collections?: string[];
    location?: string | null;
    imageUrl?: string | null;
    sourceUrl?: string | null;
    notes?: string | null;
  },
  options?: { fetchFn?: SyncFetchFn; purchaseHubApiUrl?: string; timeoutMs?: number }
): Promise<{ productId: string; orderId?: string; product?: Record<string, unknown> | null }> {
  const fetchFn: SyncFetchFn = options?.fetchFn ?? fetch;
  const baseUrl = (options?.purchaseHubApiUrl || getPurchaseHubApiBaseUrl()).replace(
    /\/+$/,
    ""
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 5000);
  try {
    const res = await fetchFn(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        canonical_name: payload.canonicalName,
        brand: payload.brand ?? null,
        price: payload.price ?? 0,
        currency: payload.currency || "CHF",
        order_date: payload.orderDate || new Date().toISOString().slice(0, 10),
        retailer: payload.retailer || "Manual",
        category: payload.category || "Other",
        item_kind: "durable",
        owner_scope: payload.ownerScope || "home",
        collections: payload.collections || [],
        location: payload.location ?? null,
        image_url: payload.imageUrl ?? null,
        source_url: payload.sourceUrl ?? null,
        notes: payload.notes ?? null,
      }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok || !data.product_id) {
      throw new Error(data.error || `Purchase Hub returned ${res.status}`);
    }
    return {
      productId: String(data.product_id),
      orderId: data.order_id ? String(data.order_id) : undefined,
      product: data.product ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}
