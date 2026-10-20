/**
 * Schema-Driven Card Fill-in & Token Extraction Engine (PRD v3.2 §4.3)
 *
 * Pass 1: Deterministic token extraction for ratings, dates, tags, prices, and status.
 * Pass 2: Schema-directed field mapping conforming to effectiveJsonSchema.
 * Strict Partitioning: Public objective attributes vs Personal subjective values.
 */

export interface ExtractCardDataParams {
  input: string;
  rawMetadata?: Record<string, any>;
  typePath?: string;
  effectiveSchema?: Record<string, any>;
  uiFieldConfig?: Array<{ key: string; label: string; primitive: string; isPublicObjective: boolean }>;
}

export interface ExtractedCardData {
  rating?: number;
  price?: {
    amount: number;
    currency: string;
    cents: number;
  };
  date?: string;
  tags: string[];
  status?: string;
  objectiveAttributes: Record<string, unknown>;
  subjectiveValues: Record<string, unknown>;
  personalNotes?: string;
  cleanedText: string;
}

// Known objective keys (specifications / public attributes)
const DEFAULT_OBJECTIVE_KEYS = new Set([
  "artist",
  "album",
  "releaseyear",
  "rpm",
  "catalognumber",
  "recordlabel",
  "gatefold",
  "vinylcolor",
  "title",
  "director",
  "runtimeminutes",
  "cinematographer",
  "aspectratio",
  "distributor",
  "billingblock",
  "author",
  "isbn",
  "pagecount",
  "publisher",
  "edition",
  "obitext",
  "binding",
  "producer",
  "cuvee",
  "vintage",
  "appellation",
  "region",
  "country",
  "varietal",
  "farming",
  "abv",
  "medium",
  "dimensions",
  "galleryormuseum",
  "cuisine",
  "preptimeminutes",
  "cooktimeminutes",
  "yieldservings",
  "ingredients",
  "directions",
  "location",
  "coordinates",
  "distancekm",
  "elevationgainmeters",
  "passtype",
  "kilntemperature",
  "sliprating",
  "finish",
  "material",
  "brand",
  "model",
  "sku",
  "referencecode",
  "color",
  "colorhex",
  "fit",
  "weight",
  "care",
  "size",
  "specssummary",
  "connectivity",
  "chip",
  "batteryhours",
  "wattage",
  "ports",
  "shade",
  "shadehex",
  "volume",
  "cleanbadge",
  "skintypes",
  "availability",
  "wikidatauri",
]);

/**
 * Normalizes an ISO date from "today", "yesterday", or raw date strings.
 */
function parseDateToken(token: string): string {
  const norm = token.toLowerCase().trim();
  const now = new Date();
  if (norm === "today") {
    return now.toISOString().slice(0, 10);
  }
  if (norm === "yesterday") {
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return y.toISOString().slice(0, 10);
  }
  // Try direct parse
  const parsed = new Date(token);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return token;
}

/**
 * Extracts structured card data with regex parsing and schema mapping.
 */
export function extractStructuredCardData(params: ExtractCardDataParams): ExtractedCardData {
  const { input, rawMetadata = {}, effectiveSchema, uiFieldConfig = [] } = params;

  let workingText = input;
  let extractedRating: number | undefined;
  let extractedPrice: ExtractedCardData["price"] | undefined;
  let extractedDate: string | undefined;
  const extractedTags: string[] = [];
  let extractedStatus: string | undefined;

  const objectiveAttributes: Record<string, unknown> = {};
  const subjectiveValues: Record<string, unknown> = {};

  // -------------------------------------------------------------
  // Pass 1: Deterministic regex extractors
  // -------------------------------------------------------------

  // 1. Rating extraction (e.g. 4.5 stars, 5★, 9/10, 5/5, rating: 4)
  const rating10Match = workingText.match(/\b([0-9]|10)\/10\b/i);
  if (rating10Match) {
    const rawVal = parseFloat(rating10Match[1]);
    extractedRating = Math.round((rawVal / 2) * 10) / 10;
    workingText = workingText.replace(rating10Match[0], " ");
  } else {
    const rating5Match = workingText.match(/\b([1-5](?:\.[0-9])?)\s*(?:stars?|★|\/5)(?:\s|$|(?=[^0-9a-zA-Z]))/i);
    if (rating5Match) {
      extractedRating = parseFloat(rating5Match[1]);
      workingText = workingText.replace(rating5Match[0], " ");
    } else {
      const explicitRatingMatch = workingText.match(/\brating(?:\s*to|:)?\s*([1-5](?:\.[0-9])?)\b/i);
      if (explicitRatingMatch) {
        extractedRating = parseFloat(explicitRatingMatch[1]);
        workingText = workingText.replace(explicitRatingMatch[0], " ");
      }
    }
  }

  // 2. Date extraction ("today", "yesterday", or YYYY-MM-DD)
  const isoDateMatch = workingText.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoDateMatch) {
    extractedDate = isoDateMatch[1];
    workingText = workingText.replace(isoDateMatch[0], " ");
  } else {
    const relativeDateMatch = workingText.match(/\b(today|yesterday)\b/i);
    if (relativeDateMatch) {
      extractedDate = parseDateToken(relativeDateMatch[1]);
      workingText = workingText.replace(relativeDateMatch[0], " ");
    }
  }

  // 3. Price extraction ($29.99, €45, £12.50)
  const currencySymbolMatch = workingText.match(/([$€£¥])\s*(\d+(?:\.\d{1,2})?)/);
  if (currencySymbolMatch) {
    const sym = currencySymbolMatch[1];
    const amount = parseFloat(currencySymbolMatch[2]);
    const currencyMap: Record<string, string> = {
      $: "USD",
      "€": "EUR",
      "£": "GBP",
      "¥": "JPY",
    };
    extractedPrice = {
      amount,
      currency: currencyMap[sym] || "USD",
      cents: Math.round(amount * 100),
    };
    workingText = workingText.replace(currencySymbolMatch[0], " ");
  } else {
    const isoPriceMatch = workingText.match(/(\d+(?:\.\d{1,2})?)\s*(USD|EUR|GBP)/i);
    if (isoPriceMatch) {
      const amount = parseFloat(isoPriceMatch[1]);
      const currency = isoPriceMatch[2].toUpperCase();
      extractedPrice = {
        amount,
        currency,
        cents: Math.round(amount * 100),
      };
      workingText = workingText.replace(isoPriceMatch[0], " ");
    }
  }

  // 4. Tags extraction (#naturalwine, #fiction)
  const tagMatches = workingText.match(/#[a-zA-Z0-9_\-]+/g);
  if (tagMatches) {
    for (const tag of tagMatches) {
      extractedTags.push(tag.toLowerCase());
      workingText = workingText.replace(tag, " ");
    }
  }

  // 5. Status keywords
  if (/\b(?:finished|completed|read|watched|done)\b/i.test(workingText)) {
    extractedStatus = "finished";
  } else if (/\b(?:started|reading|watching|listening)\b/i.test(workingText)) {
    extractedStatus = "in_progress";
  } else if (/\b(?:want to read|to read|to watch|backlog|wishlist)\b/i.test(workingText)) {
    extractedStatus = "want_to_consume";
  }

  // -------------------------------------------------------------
  // Pass 2: Schema-directed field mapping
  // -------------------------------------------------------------

  // Explicit field extractors
  // ABV (e.g. "13.5% ABV" or "ABV: 13.5")
  const abvMatch = workingText.match(/(?:abv|alcohol|alc\.?):\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i) ||
    workingText.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*abv/i);
  if (abvMatch) {
    const abv = parseFloat(abvMatch[1]);
    objectiveAttributes.abv = abv;
    workingText = workingText.replace(abvMatch[0], " ");
  }

  // Vintage (e.g. "Vintage: 2018" or "2018 vintage")
  const vintageMatch = workingText.match(/(?:vintage|year):\s*([12]\d{3})/i) ||
    workingText.match(/\b([12]\d{3})\s+vintage\b/i);
  if (vintageMatch) {
    objectiveAttributes.vintage = vintageMatch[1];
    workingText = workingText.replace(vintageMatch[0], " ");
  }

  // Kiln temperature (e.g. "kiln temp: 1220C" or "kiln: 1220")
  const kilnMatch = workingText.match(/(?:kiln(?:\s*temp(?:erature)?)?):\s*(\d+)\s*(?:°?[cf]|deg(?:rees)?)?/i);
  if (kilnMatch) {
    objectiveAttributes.kilnTemperature = parseInt(kilnMatch[1], 10);
    workingText = workingText.replace(kilnMatch[0], " ");
  }

  // Slip rating (e.g. "slip rating: R11" or "slip: R10")
  const slipMatch = workingText.match(/(?:slip(?:\s*rating)?):\s*(r\d{1,2}|[a-z0-9]+)/i);
  if (slipMatch) {
    objectiveAttributes.slipRating = slipMatch[1].toUpperCase();
    workingText = workingText.replace(slipMatch[0], " ");
  }

  // Prep time (e.g. "prep time: 25 mins" or "prep: 30m")
  const prepMatch = workingText.match(/prep(?:\s*time)?:\s*(\d+)\s*(?:mins?|minutes?|m\b)/i);
  if (prepMatch) {
    objectiveAttributes.prepTimeMinutes = parseInt(prepMatch[1], 10);
    workingText = workingText.replace(prepMatch[0], " ");
  }

  // Generic key:value pairs conforming to schema
  const kvMatches = workingText.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^,\n;]+)/g);
  for (const m of kvMatches) {
    const rawKey = m[1].trim();
    const rawVal = m[2].trim();
    const cleanKey = rawKey.charAt(0).toLowerCase() + rawKey.slice(1);

    // Determine partitioning
    const uiConfig = uiFieldConfig.find((c) => c.key.toLowerCase() === cleanKey.toLowerCase());
    const isPublic = uiConfig ? uiConfig.isPublicObjective : DEFAULT_OBJECTIVE_KEYS.has(cleanKey.toLowerCase());

    const numVal = Number(rawVal);
    const parsedVal = !isNaN(numVal) && rawVal !== "" ? numVal : rawVal;

    if (isPublic) {
      objectiveAttributes[cleanKey] = parsedVal;
    } else {
      subjectiveValues[cleanKey] = parsedVal;
    }
  }

  // Map rawMetadata values into objective attributes if conforming
  for (const [key, val] of Object.entries(rawMetadata)) {
    if (val !== undefined && val !== null) {
      const cleanKey = key.charAt(0).toLowerCase() + key.slice(1);
      const uiConfig = uiFieldConfig.find((c) => c.key.toLowerCase() === cleanKey.toLowerCase());
      const isPublic = uiConfig ? uiConfig.isPublicObjective : DEFAULT_OBJECTIVE_KEYS.has(cleanKey.toLowerCase());

      if (isPublic && objectiveAttributes[cleanKey] === undefined) {
        objectiveAttributes[cleanKey] = val;
      } else if (!isPublic && subjectiveValues[cleanKey] === undefined) {
        subjectiveValues[cleanKey] = val;
      }
    }
  }

  // If rating was extracted, place in subjectiveValues
  if (extractedRating !== undefined) {
    subjectiveValues.rating = extractedRating;
  }

  // Clean remaining text
  const cleanedText = workingText.replace(/\s+/g, " ").trim();

  // If there's remaining descriptive text, treat it as personal notes candidate
  let personalNotes: string | undefined;
  if (cleanedText && cleanedText.length > 5) {
    personalNotes = cleanedText;
  }

  return {
    rating: extractedRating,
    price: extractedPrice,
    date: extractedDate,
    tags: extractedTags,
    status: extractedStatus,
    objectiveAttributes,
    subjectiveValues,
    personalNotes,
    cleanedText,
  };
}
