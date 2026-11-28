export type ClipDestination = "closet" | "chef" | "my-stuff" | "curio";

export interface ClippedRecipeData {
  servings?: string | number;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  ingredients?: string[];
  instructions?: string[];
}

export interface UniversalClipPayload {
  url: string;
  name?: string;
  brand?: string;
  color?: string;
  colors?: string[];
  material?: string;
  materialText?: string;
  price?: number | string;
  currency?: string;
  description?: string;
  images?: string[];
  schemaTypes?: string[];
  selection?: string;
  caption?: string;
  sku?: string;
  manualUrl?: string;
  retailer?: string;
  recipe?: ClippedRecipeData;
}

export interface ClipClassification {
  destination: ClipDestination;
  coreType: string;
  typePath: string;
  label: string;
  targetPath: string;
  reason: string;
  tags: string[];
}

const MAX_CLIP_URL = 1200;

const APPAREL_HOSTS = new Set([
  "cos",
  "uniqlo",
  "zara",
  "hm",
  "arcteryx",
  "endclothing",
  "massimodutti",
  "zalando",
  "arket",
  "stories",
  "mango",
  "mrporter",
  "ssense",
  "farfetch",
  "nike",
  "adidas",
  "newbalance",
  "patagonia",
  "thenorthface",
  "lululemon",
  "ralphlauren",
  "acnestudios",
  "ourlegacy",
  "norseprojects",
  "sunspel",
  "suitsupply",
  "carhartt-wip",
  "salomon",
  "on-running",
  "asics",
  "muji",
]);

const GEAR_HOSTS = new Set([
  "galaxus",
  "digitec",
  "amazon",
  "apple",
  "sony",
  "bose",
  "dyson",
  "ikea",
  "brack",
  "interdiscount",
  "mediamarkt",
  "bhphotovideo",
  "thomann",
  "fujifilm",
  "leica",
  "garmin",
  "anker",
  "ugreen",
  "logitech",
  "keychron",
  "breville",
  "sageappliances",
  "miele",
  "bosch",
  "makita",
  "deuter",
  "peakdesign",
]);

const RECIPE_HOSTS_RE =
  /(?:seriouseats|bonappetit|cooking\.nytimes|allrecipes|bbcgoodfood|directoalpaladar|elcomidista|recetasgratis|giallozafferano|smittenkitchen|recipetineats)/i;

const RECIPE_PATH_RE = /(?:^|\/)(?:recipes?|recetas?)(?:\/|$)/i;

const SOCIAL_HOST_RE =
  /(?:^|\.)(?:instagram\.com|tiktok\.com|youtube\.com|youtu\.be|threads\.net|pinterest\.[a-z.]+)$/i;

const RECIPE_HEADER_RE =
  /\b(?:ingredients?|ingredientes?|zutaten|ingr[eé]dients?|preparaci[oó]n|elaboraci[oó]n|instrucciones?|instructions?|directions?|receta|recipe|paso\s*a\s*paso)\b/i;

const RECIPE_CUE_RE =
  /(?:\b\d+(?:[.,/]\d+)?\s*(?:g|gr|kg|ml|l|cl|oz|lb|tbsp|tsp|cups?|tazas?|cucharadas?|cucharaditas?|cdas?|cdtas?|min(?:utos?|s)?|°\s?[cf])|\b(?:horno|oven|sart[eé]n|air\s*fryer|preheat|precalentar)\b)/i;

const RECIPE_UNIT_GLOBAL_RE =
  /\b\d+(?:[.,/]\d+)?\s*(?:g|gr|kg|ml|l|cl|oz|lb|tbsp|tsp|cups?|tazas?|cucharadas?|cucharaditas?|cdas?|cdtas?|min(?:utos?|s)?|°\s?[cf])\b/gi;

function isCulinaryCaption(text: string, isSocialHost: boolean): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 30) return false;
  const bulletCount = (trimmed.match(/(?:^|\n)\s*(?:[-•*]|\d+[.)])\s+\S/g) || []).length;
  if (RECIPE_HEADER_RE.test(trimmed) && (RECIPE_CUE_RE.test(trimmed) || bulletCount >= 2)) {
    return true;
  }
  if (isSocialHost && trimmed.length >= 80) {
    const unitCount = (trimmed.match(RECIPE_UNIT_GLOBAL_RE) || []).length;
    if (unitCount >= 3) return true;
  }
  return false;
}

const APPAREL_KEYWORDS_RE =
  /\b(?:shirt|t-shirt|tee|polo|sweater|knit|knitwear|cardigan|hoodie|fleece|overshirt|jacket|coat|parka|puffer|blazer|vest|pants|trousers|chinos|jeans|shorts|sweatpants|sneakers|boots|loafers|shoes|socks|scarf|beanie|cap|belt|merino|cashmere|corduroy|denim|menswear|womenswear|apparel|garment)\b/i;

const STRIP_HOST_PREFIXES = new Set([
  "www",
  "www2",
  "shop",
  "store",
  "eu",
  "ch",
  "uk",
  "us",
  "en",
  "de",
  "fr",
  "it",
  "m",
  "online",
  "intl",
]);

function extractRegistrableHostLabel(hostname: string): string {
  const parts = hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .split(".")
    .filter(Boolean);
  while (parts.length > 2 && STRIP_HOST_PREFIXES.has(parts[0])) {
    parts.shift();
  }
  return parts[0] || "";
}

export function parseClipPriceCents(rawPrice: unknown): number | null {
  if (typeof rawPrice === "number") {
    return Number.isFinite(rawPrice) && rawPrice > 0 ? Math.round(rawPrice * 100) : null;
  }
  if (typeof rawPrice !== "string") return null;
  let cleaned = rawPrice.trim();
  if (!cleaned) return null;
  if (/\d,\d{2}(?:\D*$)/.test(cleaned)) {
    cleaned = cleaned.replace(/\.(?=\d{3}\b)/g, "").replace(/['\s]/g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/[,']/g, "");
  }
  const num = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
  return !Number.isNaN(num) && num > 0 ? Math.round(num * 100) : null;
}

export function normalizeClipCurrency(rawCurrency?: string, rawPrice?: unknown): string {
  const combined = `${rawCurrency || ""} ${typeof rawPrice === "string" ? rawPrice : ""}`.trim();
  if (/€|\bEUR\b/i.test(combined)) return "EUR";
  if (/£|\bGBP\b/i.test(combined)) return "GBP";
  if (/\$|\bUSD\b/i.test(combined)) return "USD";
  if (/\bCHF\b|\bFR\.?\b/i.test(combined)) return "CHF";
  const upper = (rawCurrency || "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  return upper.length === 3 ? upper : "CHF";
}

export function getClipDestinationTarget(destination: ClipDestination, saveId?: string | null): {
  label: string;
  targetPath: string;
} {
  switch (destination) {
    case "closet":
      return { label: "Closet", targetPath: "/closet/" };
    case "chef":
      return { label: "Chef", targetPath: "/chef/" };
    case "my-stuff":
      return { label: "My Stuff", targetPath: "/my-stuff/" };
    case "curio":
      return {
        label: "Curio",
        targetPath: saveId ? `/curio/card/${encodeURIComponent(saveId)}` : "/curio",
      };
  }
}

export function classifyClipDestination(clip: UniversalClipPayload): ClipClassification {
  let hostname = "";
  let pathname = "";
  try {
    const parsed = new URL(clip.url);
    hostname = parsed.hostname.toLowerCase();
    pathname = parsed.pathname;
  } catch {
    // keep empty
  }

  const hostLabel = extractRegistrableHostLabel(hostname);
  const schemaLower = (clip.schemaTypes || []).map((s) => s.toLowerCase());
  const probeText = `${clip.name || ""} ${pathname} ${clip.materialText || ""} ${clip.material || ""} ${clip.description || ""}`;
  const hasProductSchema = schemaLower.some((s) => s.includes("product") && !s.includes("book"));
  const hasPrice = parseClipPriceCents(clip.price) !== null;

  // 1. Recipe -> Chef (structured Recipe OR culinary social/caption cues before VideoObject/Film)
  const isSocialHost = SOCIAL_HOST_RE.test(hostname);
  const captionProbe = [clip.caption, clip.selection, clip.description, clip.name].filter(Boolean).join("\n");
  const hasRecipeSchema = schemaLower.some((s) => s.includes("recipe"));
  const hasRecipeIngredients = (clip.recipe?.ingredients?.length ?? 0) >= 2;
  const hasCaptionRecipe = isCulinaryCaption(captionProbe, isSocialHost);
  if (hasRecipeSchema || hasRecipeIngredients || hasCaptionRecipe || RECIPE_HOSTS_RE.test(hostname) || RECIPE_PATH_RE.test(pathname)) {
    return {
      destination: "chef",
      coreType: "CULINARY",
      typePath: "/culinary/recipe",
      label: "Chef",
      targetPath: "/chef/",
      reason:
        hasRecipeSchema || hasRecipeIngredients
          ? "Recipe structured data detected"
          : hasCaptionRecipe
            ? "Recipe detected in social caption"
            : "Recipe URL detected",
      tags: ["clipped", "recipe", "chef"],
    };
  }

  // 2. Apparel -> Closet
  const isApparelHost = APPAREL_HOSTS.has(hostLabel);
  const hasApparelWords = APPAREL_KEYWORDS_RE.test(probeText);
  if (isApparelHost || ((hasProductSchema || hasPrice || Boolean(clip.materialText)) && hasApparelWords)) {
    return {
      destination: "closet",
      coreType: "PRODUCT",
      typePath: "/product/garment",
      label: "Closet",
      targetPath: "/closet/",
      reason: isApparelHost ? `Apparel store (${hostLabel})` : "Apparel garment attributes detected",
      tags: ["clipped", "apparel", "closet"],
    };
  }

  // 3. Books / Movies / Places stay in Curio (before generic product routing)
  const isBook =
    schemaLower.some((s) => s.includes("book")) ||
    /(?:goodreads\.com|bookshop\.org|storygraph\.com|openlibrary\.org)/i.test(hostname);
  if (isBook) {
    return {
      destination: "curio",
      coreType: "BOOK",
      typePath: "/product/book",
      label: "Curio",
      targetPath: "/curio",
      reason: "Book metadata detected",
      tags: ["clipped", "book"],
    };
  }

  const isFilm =
    schemaLower.some((s) => s.includes("movie") || s.includes("tvseries") || s.includes("videoobject")) ||
    /(?:letterboxd\.com|imdb\.com|filmaffinity\.com|themoviedb\.org|rottentomatoes\.com)/i.test(hostname);
  if (isFilm) {
    return {
      destination: "curio",
      coreType: "MEDIA",
      typePath: "/media/film",
      label: "Curio",
      targetPath: "/curio",
      reason: "Film or series metadata detected",
      tags: ["clipped", "cinema"],
    };
  }

  const isPlace =
    schemaLower.some((s) => s.includes("place") || s.includes("restaurant") || s.includes("localbusiness")) ||
    /(?:maps\.google\.com|maps\.apple\.com)/i.test(hostname) ||
    /\/maps\//i.test(pathname);
  if (isPlace) {
    return {
      destination: "curio",
      coreType: "PLACE",
      typePath: "/place",
      label: "Curio",
      targetPath: "/curio",
      reason: "Place metadata detected",
      tags: ["clipped", "place"],
    };
  }

  // 4. Electronics, durables & gear -> My Stuff
  const isGearHost = GEAR_HOSTS.has(hostLabel);
  if (isGearHost || Boolean(clip.manualUrl) || Boolean(clip.sku) || hasProductSchema || hasPrice) {
    return {
      destination: "my-stuff",
      coreType: "PRODUCT",
      typePath: "/product/electronics",
      label: "My Stuff",
      targetPath: "/my-stuff/",
      reason: isGearHost
        ? `Gear/retailer store (${hostLabel})`
        : clip.manualUrl || clip.sku
          ? "Product SKU/manual detected"
          : "Product page detected",
      tags: ["clipped", "gear", "my-stuff"],
    };
  }

  // 5. Fallback -> Curio Article or Quote
  if (clip.selection && clip.selection.trim().length > 0) {
    return {
      destination: "curio",
      coreType: "ARTICLE",
      typePath: "/quote",
      label: "Curio",
      targetPath: "/curio",
      reason: "Highlighted quote captured",
      tags: ["clipped", "quote"],
    };
  }

  return {
    destination: "curio",
    coreType: "ARTICLE",
    typePath: "/article",
    label: "Curio",
    targetPath: "/curio",
    reason: "Web article/reference captured",
    tags: ["clipped", "article"],
  };
}

function toBase64Url(jsonText: string): string {
  const bytes = new TextEncoder().encode(jsonText);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): string {
  let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function extractCompactLdAndMeta(obj: Record<string, unknown>): {
  name?: string;
  brand?: string;
  retailer?: string;
  color?: string;
  colors?: string[];
  material?: string;
  price?: number | string;
  currency?: string;
  sku?: string;
  description?: string;
  images?: string[];
  schemaTypes?: string[];
  recipe?: Record<string, unknown>;
} {
  const metaRaw = (obj.meta && typeof obj.meta === "object" ? obj.meta : obj.M && typeof obj.M === "object" ? obj.M : {}) as Record<string, unknown>;
  const M: Record<string, string> = {};
  for (const [k, v] of Object.entries(metaRaw)) {
    if (typeof v === "string" && v.trim()) {
      M[k.toLowerCase().trim()] = v.trim();
    }
  }

  const schemaTypes: string[] = [];
  const found: {
    rec: Record<string, any> | null;
    book: Record<string, any> | null;
    media: Record<string, any> | null;
    prod: Record<string, any> | null;
  } = { rec: null, book: null, media: null, prod: null };

  const scan = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) scan(item);
      return;
    }
    const rec = node as Record<string, any>;
    const t = rec["@type"];
    const ts = Array.isArray(t) ? t : t ? [t] : [];
    for (const entry of ts) {
      const s = String(entry);
      const sl = s.toLowerCase();
      if (!schemaTypes.includes(s) && schemaTypes.length < 8) schemaTypes.push(s);
      if (sl.includes("recipe") && !found.rec) found.rec = rec;
      else if (sl.includes("book") && !found.book) found.book = rec;
      else if ((sl.includes("movie") || sl.includes("tvseries")) && !found.media) found.media = rec;
      else if (sl.includes("product") && !found.prod) found.prod = rec;
    }
    if (rec["@graph"]) scan(rec["@graph"]);
  };

  if (Array.isArray(obj.ld)) {
    scan(obj.ld);
  } else if (obj.ld && typeof obj.ld === "object") {
    scan(obj.ld);
  }

  const REC = found.rec;
  const PROD = found.prod;
  const P = REC || found.book || found.media || PROD;
  const baseUrl = typeof obj.url === "string" ? obj.url : typeof obj.u === "string" ? obj.u : "https://example.com";

  const images: string[] = [];
  const seenImgs = new Set<string>();
  const addImg = (u: unknown) => {
    if (!u) return;
    if (Array.isArray(u)) {
      for (const x of u) addImg(x);
      return;
    }
    if (typeof u === "object") {
      const o = u as Record<string, unknown>;
      addImg(o.url || o.contentUrl || o.src || o.image);
      return;
    }
    if (typeof u !== "string") return;
    let clean = u.trim();
    if (!clean || /^(?:data|blob|javascript):/i.test(clean)) return;
    try {
      clean = new URL(clean, baseUrl).href;
    } catch {
      return;
    }
    if (
      /\.(?:svg|gif|ico)(?:[?]|$)/i.test(clean) ||
      /(?:logo|favicon|sprite|icon|avatar|badge|visa|mastercard|paypal|klarna)/i.test(clean)
    ) {
      return;
    }
    if (!seenImgs.has(clean) && images.length < 12) {
      seenImgs.add(clean);
      images.push(clean);
    }
  };

  if (P) {
    addImg(P.image);
    if (P.hasVariant) addImg(P.hasVariant);
  }
  addImg(M["og:image:secure_url"] || M["og:image"] || M["twitter:image"]);
  if (Array.isArray(obj.images)) addImg(obj.images);
  if (Array.isArray(obj.i)) addImg(obj.i);

  const colors: string[] = [];
  const addCol = (c: unknown) => {
    if (!c) return;
    if (Array.isArray(c)) {
      for (const x of c) addCol(x);
      return;
    }
    if (typeof c === "object") {
      addCol((c as Record<string, unknown>).name);
      return;
    }
    if (typeof c === "string") {
      const clean = c.trim();
      if (clean && !colors.includes(clean) && colors.length < 10) colors.push(clean);
    }
  };
  if (PROD) {
    addCol(PROD.color);
    if (Array.isArray(PROD.hasVariant)) {
      for (const v of PROD.hasVariant) {
        if (v && typeof v === "object") addCol((v as Record<string, unknown>).color);
      }
    }
  }
  addCol(M["product:color"]);

  const offer = PROD?.offers ? (Array.isArray(PROD.offers) ? PROD.offers[0] : PROD.offers) : null;
  const price =
    (offer && (offer.price ?? offer.lowPrice)) ||
    M["product:price:amount"] ||
    M["og:price:amount"] ||
    undefined;
  const currency =
    (offer && offer.priceCurrency) ||
    M["product:price:currency"] ||
    M["og:price:currency"] ||
    undefined;

  const brandVal = P?.brand
    ? typeof P.brand === "string"
      ? P.brand
      : P.brand?.name
    : P?.author
      ? typeof P.author === "string"
        ? P.author
        : Array.isArray(P.author)
          ? P.author[0]?.name
          : P.author?.name
      : "";

  const flattenInstructions = (val: unknown, out: string[] = []): string[] => {
    if (!val || out.length >= 25) return out;
    if (Array.isArray(val)) {
      for (const item of val) flattenInstructions(item, out);
      return out;
    }
    if (typeof val === "string") {
      const c = val.replace(/\s+/g, " ").trim();
      if (c) out.push(c);
      return out;
    }
    if (typeof val === "object") {
      const o = val as Record<string, unknown>;
      flattenInstructions(o.text ?? o.itemListElement ?? o.name, out);
    }
    return out;
  };

  let recipe: Record<string, unknown> | undefined;
  if (REC) {
    recipe = {
      servings: Array.isArray(REC.recipeYield) ? REC.recipeYield[0] : REC.recipeYield,
      prepTime: REC.prepTime,
      cookTime: REC.cookTime,
      totalTime: REC.totalTime,
      ingredients: Array.isArray(REC.recipeIngredient) ? REC.recipeIngredient : undefined,
      instructions: flattenInstructions(REC.recipeInstructions),
    };
  }

  return {
    name:
      (P && typeof P.name === "string" ? P.name : undefined) ||
      (P && typeof P.headline === "string" ? P.headline : undefined) ||
      M["og:title"],
    brand: (typeof brandVal === "string" && brandVal.trim()) || M["product:brand"] || undefined,
    retailer: M["og:site_name"] || undefined,
    color: colors[0],
    colors: colors.length > 0 ? colors : undefined,
    material: (PROD && typeof PROD.material === "string" ? PROD.material : undefined) || M["product:material"],
    price,
    currency,
    sku: PROD ? String(PROD.sku || PROD.mpn || PROD.gtin13 || PROD.model || "").trim() || undefined : undefined,
    description: (P && typeof P.description === "string" ? P.description : undefined) || M["og:description"] || M.description,
    images: images.length > 0 ? images : undefined,
    schemaTypes: schemaTypes.length > 0 ? schemaTypes : undefined,
    recipe,
  };
}

export function sanitizeUniversalClipPayload(raw: unknown): UniversalClipPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const rawUrlVal = obj.url ?? obj.u;
  const rawUrl = typeof rawUrlVal === "string" ? rawUrlVal.trim() : "";
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  const derived = obj.ld || obj.M || obj.meta ? extractCompactLdAndMeta(obj) : {};

  const strOrUndef = (val: unknown, maxLen: number): string | undefined => {
    if (typeof val !== "string") return undefined;
    const clean = val.replace(/\s+/g, " ").trim().slice(0, maxLen);
    return clean || undefined;
  };

  const multilineOrUndef = (val: unknown, maxLen: number): string | undefined => {
    if (typeof val !== "string") return undefined;
    const clean = val
      .replace(/\r\n?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, maxLen);
    return clean || undefined;
  };

  const strArray = (val: unknown, maxItems: number, maxLen: number, httpOnly = false): string[] | undefined => {
    if (!Array.isArray(val)) return undefined;
    const items = val
      .filter((entry): entry is string => typeof entry === "string")
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 0 && (!httpOnly || /^https?:\/\//i.test(s)))
      .map((s) => s.slice(0, maxLen))
      .slice(0, maxItems);
    return items.length > 0 ? items : undefined;
  };

  let recipe: ClippedRecipeData | undefined;
  const rawRecipe = (obj.recipe && typeof obj.recipe === "object" ? obj.recipe : derived.recipe) as Record<string, unknown> | undefined;
  if (rawRecipe && typeof rawRecipe === "object") {
    const r = rawRecipe;
    const ingredients = strArray(r.ingredients, 30, 220);
    const instructions = strArray(r.instructions, 25, 500);
    const servings =
      typeof r.servings === "number" || typeof r.servings === "string" ? r.servings : undefined;
    const prepTime = strOrUndef(r.prepTime, 48);
    const cookTime = strOrUndef(r.cookTime, 48);
    const totalTime = strOrUndef(r.totalTime, 48);
    if (ingredients || instructions || servings || prepTime || cookTime || totalTime) {
      recipe = { servings, prepTime, cookTime, totalTime, ingredients, instructions };
    }
  }

  const rawPrice = obj.price ?? derived.price;
  const price =
    typeof rawPrice === "number" || typeof rawPrice === "string" ? rawPrice : undefined;

  const manualRaw = strOrUndef(obj.manualUrl ?? obj.p, 800);
  const manualUrl = manualRaw && /^https?:\/\//i.test(manualRaw) ? manualRaw : undefined;

  const colors = strArray(obj.colors ?? derived.colors, 10, 48);
  const mergedImages = strArray(derived.images ?? obj.images ?? obj.i, 12, 800, true);
  const schemaTypes = strArray(obj.schemaTypes ?? derived.schemaTypes, 8, 60);

  return {
    url: parsedUrl.toString().slice(0, MAX_CLIP_URL),
    name: strOrUndef(obj.name ?? derived.name ?? obj.n, 240),
    brand: strOrUndef(obj.brand ?? derived.brand, 80),
    color: strOrUndef(obj.color ?? derived.color, 80) ?? colors?.[0],
    colors,
    material: strOrUndef(obj.material ?? derived.material, 120),
    materialText: strOrUndef(obj.materialText ?? obj.m, 1200),
    price,
    currency: strOrUndef(obj.currency ?? derived.currency, 16),
    description: strOrUndef(obj.description ?? derived.description, 800),
    images: mergedImages,
    schemaTypes,
    selection: multilineOrUndef(obj.selection ?? obj.s, 1500),
    caption: multilineOrUndef(obj.caption ?? obj.c, 3000),
    sku: strOrUndef(obj.sku ?? derived.sku, 80),
    manualUrl,
    retailer: strOrUndef(obj.retailer ?? derived.retailer, 80),
    recipe,
  };
}

export function encodeUniversalClipFragment(clip: UniversalClipPayload): string {
  return toBase64Url(JSON.stringify(clip));
}

export function decodeUniversalClipFragment(rawHashOrSearch: string): {
  clip: UniversalClipPayload;
  rawToken: string;
} | null {
  if (!rawHashOrSearch || typeof rawHashOrSearch !== "string") return null;
  const trimmed = rawHashOrSearch.replace(/^[#?]+/, "");
  const match = trimmed.match(/(?:^|&)clip=([^&]+)/);
  if (!match || !match[1]) return null;
  const rawToken = match[1];
  try {
    const jsonStr = fromBase64Url(rawToken);
    const parsed = JSON.parse(jsonStr);
    const clip = sanitizeUniversalClipPayload(parsed);
    if (!clip) return null;
    return { clip, rawToken };
  } catch {
    return null;
  }
}

export function getCurioClipEndpointUrl(): string {
  if (typeof window === "undefined") return "https://mini.orca-banjo.ts.net/curio/clip";
  const prefix = window.location.pathname.startsWith("/curio") ? "/curio" : "";
  return `${window.location.origin}${prefix}/clip`;
}

export function buildCurioSaveToBookmarkletHref(curioClipUrl: string): string {
  let normalizedUrl: string;
  try {
    const u = new URL(curioClipUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("Bookmarklet target must use http or https");
    }
    normalizedUrl = `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    throw new Error("Invalid Curio clip URL");
  }

  // Ultra-compact (<2KB encoded) DOM capture; JSON-LD & meta parsing runs server-side in sanitizeUniversalClipPayload.
  // Zero literal '#' and zero bare '%'; wrapped in encodeURI() for Android/iOS Chrome compatibility.
  const script =
    `(()=>{try{` +
    `var D=document,L=location,M={},A=s=>[...D.querySelectorAll(s)],F=x=>(x??'').replace(/\\s+/g,' ').trim();` +
    `if(L.protocol[0]!='h')return alert('Open http page');` +
    `A('meta').map(e=>{var k=(e.getAttribute('property')||e.name||'').toLowerCase(),v=F(e.content);if(/^(og:|product:|desc)/.test(k)&&v&&!M[k])M[k]=v;});` +
    `var ld=A('script[type*=ld]').map(e=>{var t=e.textContent??'';if(/product|recipe|book|movie|tv/i.test(t)&&!t[18e3])try{var o=JSON.parse(t);o.review=0;return o;}catch{}}).filter(x=>x).slice(0,2),` +
    `I=[...new Set([M['og:image'],...A('img').filter(e=>Math.max(e.naturalWidth,e.naturalHeight,e.width)>249).map(e=>e.currentSrc||e.src)].filter(u=>u&&/^https?:/.test(u)&&!u[480]&&!/\\.(svg|gif|ico)|logo|icon|sprite|avatar/i.test(u)))].slice(0,6),` +
    `m=(D.body.innerText??'').split('\\n').map(F).filter(x=>x[4]&&!x[160]&&/\\d ?\\x25|cotton|wool|merino|linen|silk|cashmere|poly|nylon|leather|gore|water/i.test(x)).slice(0,8).join(';'),` +
    `p=(A('a').find(a=>/\\.pdf\\b/i.test(a.href))?.href??'').slice(0,300),` +
    `c=(/instag|tiktok|youtu|threads|pinter/i.test(L.host)?A('h1,[data-e2e*=desc],[id*=desc],span[dir=auto]').map(e=>(e.innerText??'').trim()).filter(x=>x[39]&&!/log in|sign up/i.test(x)).sort((a,b)=>b.length-a.length)[0]??'':'').slice(0,2400),` +
    `pl={u:L.href.slice(0,${MAX_CLIP_URL}),n:F(M['og:title']??A('h1')[0]?.textContent??D.title).slice(0,200),M,ld,i:I,m:m.slice(0,650),p,s:(''+getSelection()).trim().slice(0,900),c},` +
    `b='';new TextEncoder().encode(JSON.stringify(pl)).forEach(x=>b+=String.fromCharCode(x));` +
    `var d='${normalizedUrl}\\x23clip='+btoa(b).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');` +
    `if(/Mobi|Android/i.test(navigator.userAgent)||!open(d))L.href=d;` +
    `}catch(e){alert('Clip:'+e);}})()`;

  return `javascript:${encodeURI(script)}`;
}
