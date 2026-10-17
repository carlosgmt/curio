/**
 * Schema.org / JSON-LD Structured Data Engine for Curio
 * Generates standards-compliant semantic microdata for entities and curated boards.
 */

export interface JsonLdEntityInput {
  id?: string;
  title: string;
  summary?: string | null;
  heroImageUrl?: string | null;
  canonicalUrl?: string;
  coreType?: string;
  typePath?: string | null;
  brandOrCreator?: string | null;
  priceCents?: number | null;
  bestPriceCents?: number | null;
  currency?: string | null;
  canonicalExternalId?: string | null;
  coreStructuredData?: any;
  extendedAttributes?: any;
  isPrivateMemo?: boolean;
}

export interface JsonLdPrimarySourceInput {
  sellerName?: string | null;
  sourceUrl?: string;
  priceCents?: number | null;
  currency?: string | null;
  inStock?: boolean;
}

export interface JsonLdCreatorInput {
  id?: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface JsonLdListItemInput {
  save?: {
    id: string;
    isPrivateMemo?: boolean;
    privateTitle?: string | null;
    [key: string]: any;
  };
  entity?: JsonLdEntityInput | null;
  listItem?: {
    positionIndex?: number;
    sectionHeader?: string | null;
    curatorNote?: string | null;
    [key: string]: any;
  };
  primarySource?: JsonLdPrimarySourceInput | null;
  sources?: JsonLdPrimarySourceInput[];
}

export interface JsonLdListInput {
  id?: string;
  title: string;
  slug?: string;
  description?: string | null;
  visibility?: string;
  createdAt?: string;
}

function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined && val !== null) {
      if (typeof val === "object" && !Array.isArray(val)) {
        const cleanedSub = cleanUndefined(val);
        if (Object.keys(cleanedSub).length > 0) {
          result[key] = cleanedSub;
        }
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

function parseGeo(coordinates?: string | [number, number] | { latitude: number; longitude: number } | null) {
  if (!coordinates) return undefined;
  if (typeof coordinates === "object" && !Array.isArray(coordinates) && "latitude" in coordinates && "longitude" in coordinates) {
    return {
      "@type": "GeoCoordinates",
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
  }
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    return {
      "@type": "GeoCoordinates",
      latitude: Number(coordinates[0]),
      longitude: Number(coordinates[1]),
    };
  }
  if (typeof coordinates === "string") {
    const parts = coordinates.split(",").map((p) => parseFloat(p.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return {
        "@type": "GeoCoordinates",
        latitude: parts[0],
        longitude: parts[1],
      };
    }
  }
  return undefined;
}

/**
 * Generates Schema.org compliant structured objects for Curio entities.
 * Returns null for PrivateMemos or invalid/empty entities.
 */
export function generateEntityJsonLd(
  entity: JsonLdEntityInput | null | undefined,
  primarySource?: JsonLdPrimarySourceInput | null,
  creator?: JsonLdCreatorInput | null
): Record<string, any> | null {
  if (!entity) return null;

  // Strict privacy gate: PrivateMemos MUST NEVER be serialized into JSON-LD
  if (
    entity.isPrivateMemo === true ||
    entity.coreType === "PRIVATE_MEMO" ||
    entity.typePath === "/private_memo"
  ) {
    return null;
  }

  const structured = (entity.coreStructuredData as Record<string, any>) || {};
  const extended = (entity.extendedAttributes as Record<string, any>) || {};
  const data = { ...structured, ...extended };

  const typePath = (entity.typePath || "").toLowerCase();
  const coreType = (entity.coreType || "").toUpperCase();

  // Determine Archetype
  const isBook =
    typePath.includes("/book") ||
    coreType === "BOOK" ||
    Boolean(data.isbn && (data.author || entity.brandOrCreator));

  const isMovie =
    typePath.includes("/film") ||
    typePath.includes("/movie") ||
    (coreType === "MEDIA" && (Boolean(data.director) || typePath.includes("film")));

  const isVinyl =
    typePath.includes("/vinyl") ||
    typePath.includes("/music") ||
    (coreType === "MEDIA" && (Boolean(data.album) || Boolean(data.artist) || Boolean(data.rpm)));

  const isRecipe =
    typePath.includes("/recipe") ||
    coreType === "CULINARY" ||
    Boolean(data.ingredients || data.recipeIngredient || data.directions);

  const isPlace =
    typePath.includes("/place") ||
    typePath.includes("transit") ||
    typePath.includes("trail") ||
    coreType === "PLACE" ||
    Boolean(data.coordinates || data.location);

  // 1. Book (https://schema.org/Book)
  if (isBook) {
    const authorName = data.author || entity.brandOrCreator;
    const isbn = data.isbn || (entity.canonicalExternalId?.startsWith("isbn:") ? entity.canonicalExternalId.replace("isbn:", "") : undefined);
    
    return cleanUndefined({
      "@context": "https://schema.org",
      "@type": "Book",
      name: entity.title,
      author: authorName ? { "@type": "Person", name: authorName } : undefined,
      isbn: isbn || undefined,
      publisher: data.publisher ? { "@type": "Organization", name: data.publisher } : undefined,
      inLanguage: data.inLanguage || data.language || "en",
      numberOfPages: data.pageCount || undefined,
      description: entity.summary || undefined,
      image: entity.heroImageUrl || undefined,
      url: entity.canonicalUrl || undefined,
      ...(creator ? { creator: { "@type": "Person", name: creator.displayName || creator.username } } : {}),
    });
  }

  // 2. Movie (https://schema.org/Movie)
  if (isMovie) {
    const directorName = data.director || entity.brandOrCreator;
    const releaseYear = data.releaseYear ? String(data.releaseYear) : undefined;
    
    let aggregateRating: Record<string, any> | undefined;
    if (data.aggregateRating && typeof data.aggregateRating === "object") {
      aggregateRating = {
        "@type": "AggregateRating",
        ...data.aggregateRating,
      };
    } else if (data.rating !== undefined && data.rating !== null) {
      aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: data.rating,
        bestRating: "10",
        worstRating: "1",
      };
    }

    return cleanUndefined({
      "@context": "https://schema.org",
      "@type": "Movie",
      name: entity.title,
      director: directorName ? { "@type": "Person", name: directorName } : undefined,
      dateCreated: data.dateCreated || releaseYear || undefined,
      datePublished: data.datePublished || releaseYear || undefined,
      aggregateRating,
      duration: data.runtimeMinutes ? `PT${data.runtimeMinutes}M` : (data.duration || undefined),
      description: entity.summary || undefined,
      image: entity.heroImageUrl || undefined,
      url: entity.canonicalUrl || undefined,
      ...(creator ? { creator: { "@type": "Person", name: creator.displayName || creator.username } } : {}),
    });
  }

  // 3. Vinyl (https://schema.org/MusicAlbum)
  if (isVinyl) {
    const artistName = data.artist || entity.brandOrCreator;
    const tracks = Array.isArray(data.track || data.tracks)
      ? (data.track || data.tracks).map((t: any, idx: number) => {
          if (typeof t === "string") {
            return { "@type": "MusicRecording", name: t, position: idx + 1 };
          }
          return { "@type": "MusicRecording", position: idx + 1, ...t };
        })
      : undefined;

    return cleanUndefined({
      "@context": "https://schema.org",
      "@type": "MusicAlbum",
      name: entity.title || data.album,
      byArtist: artistName ? { "@type": "MusicGroup", name: artistName } : undefined,
      albumReleaseType: "https://schema.org/AlbumRelease",
      track: tracks && tracks.length > 0 ? tracks : undefined,
      datePublished: data.releaseYear ? String(data.releaseYear) : undefined,
      description: entity.summary || undefined,
      image: entity.heroImageUrl || undefined,
      url: entity.canonicalUrl || undefined,
      ...(creator ? { creator: { "@type": "Person", name: creator.displayName || creator.username } } : {}),
    });
  }

  // 4. Recipe (https://schema.org/Recipe)
  if (isRecipe) {
    let ingredients: string[] | undefined;
    if (Array.isArray(data.ingredients)) {
      ingredients = data.ingredients.map((item: any) => {
        if (typeof item === "string") return item;
        return [item.amount, item.unit, item.item].filter(Boolean).join(" ");
      });
    } else if (Array.isArray(data.recipeIngredient)) {
      ingredients = data.recipeIngredient;
    }

    let instructions: any[] | undefined;
    const rawDirections = data.directions || data.recipeInstructions || data.instructions;
    if (Array.isArray(rawDirections)) {
      instructions = rawDirections.map((step: any, idx: number) => {
        if (typeof step === "string") {
          return { "@type": "HowToStep", position: idx + 1, text: step };
        }
        return { "@type": "HowToStep", position: idx + 1, ...step };
      });
    }

    const prepTime = data.prepTimeMinutes ? `PT${data.prepTimeMinutes}M` : (data.prepTime || undefined);
    const cookTime = data.cookTimeMinutes ? `PT${data.cookTimeMinutes}M` : (data.cookTime || undefined);
    const recipeYield = data.yieldServings ? `${data.yieldServings} servings` : (data.recipeYield || undefined);

    return cleanUndefined({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: entity.title,
      recipeIngredient: ingredients && ingredients.length > 0 ? ingredients : undefined,
      recipeInstructions: instructions && instructions.length > 0 ? instructions : undefined,
      prepTime,
      cookTime,
      recipeYield,
      recipeCuisine: data.cuisine || undefined,
      description: entity.summary || undefined,
      image: entity.heroImageUrl || undefined,
      url: entity.canonicalUrl || undefined,
      ...(creator ? { creator: { "@type": "Person", name: creator.displayName || creator.username } } : {}),
    });
  }

  // 5. Place (https://schema.org/Place)
  if (isPlace) {
    const geo = parseGeo(data.coordinates || data.geo);
    const addressStr = data.location || data.address;
    const address = addressStr
      ? typeof addressStr === "string"
        ? { "@type": "PostalAddress", streetAddress: addressStr }
        : addressStr
      : undefined;

    return cleanUndefined({
      "@context": "https://schema.org",
      "@type": "Place",
      name: entity.title || data.name,
      geo,
      address,
      description: entity.summary || undefined,
      image: entity.heroImageUrl || undefined,
      url: entity.canonicalUrl || undefined,
      ...(creator ? { creator: { "@type": "Person", name: creator.displayName || creator.username } } : {}),
    });
  }

  // 6. Product / Wine / Art / General Product (https://schema.org/Product)
  const category =
    entity.typePath ||
    data.category ||
    (typePath.includes("/wine")
      ? "Wine"
      : typePath.includes("/art")
      ? "Fine Art"
      : "Product");

  const brandName = entity.brandOrCreator || data.producer || data.artist || data.brand;

  let offers: Record<string, any> | undefined;
  const priceVal =
    entity.priceCents != null
      ? (entity.priceCents / 100).toFixed(2)
      : primarySource?.priceCents != null
      ? (primarySource.priceCents / 100).toFixed(2)
      : undefined;

  if (priceVal !== undefined || primarySource) {
    offers = cleanUndefined({
      "@type": "Offer",
      price: priceVal,
      priceCurrency: entity.currency || primarySource?.currency || "USD",
      url: primarySource?.sourceUrl || entity.canonicalUrl || undefined,
      availability:
        primarySource?.inStock === false
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      seller: primarySource?.sellerName
        ? { "@type": "Organization", name: primarySource.sellerName }
        : undefined,
    });
  }

  return cleanUndefined({
    "@context": "https://schema.org",
    "@type": "Product",
    name: entity.title,
    category,
    offers,
    brand: brandName ? { "@type": "Brand", name: brandName } : undefined,
    description: entity.summary || undefined,
    image: entity.heroImageUrl || undefined,
    url: entity.canonicalUrl || undefined,
    ...(creator ? { creator: { "@type": "Person", name: creator.displayName || creator.username } } : {}),
  });
}

/**
 * Generates Schema.org compliant ItemList structured data for curated boards.
 */
export function generateListJsonLd(
  list: JsonLdListInput | null | undefined,
  items: JsonLdListItemInput[] = [],
  owner?: JsonLdCreatorInput | null,
  baseUrl: string = ""
): Record<string, any> | null {
  if (!list) return null;

  // Filter out any private memos from public JSON-LD output
  const publicItems = items.filter((item) => {
    if (item.save?.isPrivateMemo) return false;
    if (item.entity?.isPrivateMemo) return false;
    if (item.entity?.coreType === "PRIVATE_MEMO") return false;
    return true;
  });

  const elements = publicItems.map((item, index) => {
    const entity = item.entity;
    const cardUrl = item.save?.id
      ? `${baseUrl}/card/${item.save.id}`
      : entity?.canonicalUrl;

    const nestedEntity = entity
      ? generateEntityJsonLd(
          entity,
          item.primarySource || (item.sources && item.sources[0]) || null,
          null
        )
      : undefined;

    return cleanUndefined({
      "@type": "ListItem",
      position: index + 1,
      name: entity?.title || item.save?.privateTitle || `Item ${index + 1}`,
      url: cardUrl || undefined,
      item: nestedEntity || undefined,
    });
  });

  return cleanUndefined({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: list.title,
    description: list.description || undefined,
    url: list.slug ? `${baseUrl}/list/${list.slug}` : undefined,
    numberOfItems: elements.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    author: owner
      ? {
          "@type": "Person",
          name: owner.displayName || owner.username,
          identifier: owner.id || undefined,
        }
      : undefined,
    itemListElement: elements,
  });
}
