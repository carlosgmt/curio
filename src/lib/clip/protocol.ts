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

export function sanitizeUniversalClipPayload(raw: unknown): UniversalClipPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const rawUrl = typeof obj.url === "string" ? obj.url.trim() : "";
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

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
  if (obj.recipe && typeof obj.recipe === "object") {
    const r = obj.recipe as Record<string, unknown>;
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

  const price =
    typeof obj.price === "number" || typeof obj.price === "string" ? obj.price : undefined;

  const manualRaw = strOrUndef(obj.manualUrl, 800);
  const manualUrl = manualRaw && /^https?:\/\//i.test(manualRaw) ? manualRaw : undefined;

  return {
    url: parsedUrl.toString().slice(0, MAX_CLIP_URL),
    name: strOrUndef(obj.name, 240),
    brand: strOrUndef(obj.brand, 80),
    color: strOrUndef(obj.color, 80),
    colors: strArray(obj.colors, 10, 48),
    material: strOrUndef(obj.material, 120),
    materialText: strOrUndef(obj.materialText, 1200),
    price,
    currency: strOrUndef(obj.currency, 16),
    description: strOrUndef(obj.description, 800),
    images: strArray(obj.images, 12, 800, true),
    schemaTypes: strArray(obj.schemaTypes, 8, 60),
    selection: multilineOrUndef(obj.selection, 1500),
    caption: multilineOrUndef(obj.caption, 3000),
    sku: strOrUndef(obj.sku, 80),
    manualUrl,
    retailer: strOrUndef(obj.retailer, 80),
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

  // Zero literal '#' and zero bare '%' anywhere; return encodeURI(script) so strict mobile URL parsers (Android/iOS Chrome, Safari) execute cleanly.
  const q = "'";
  const script =
    `(function(){` +
    `try{` +
    `var D=document,L=location;` +
    `if(!/^https?:$/.test(L.protocol)){alert(${q}Open a web page first.${q});return;}` +
    `var isS=function(x){return typeof x===${q}string${q};},isA=Array.isArray,` +
    `Q=function(r){return D.querySelector(r);},QA=function(r){return D.querySelectorAll(r);},` +
    `G=function(e,k){return(e.getAttribute(k)||${q}${q}).trim();},` +
    `C=function(v,n){return String(v||${q}${q}).replace(/\\s+/g,${q} ${q}).trim().slice(0,n);},` +
    `M={},ms=QA(${q}meta${q}),i,k,v;` +
    `for(i=0;i<ms.length;i++){` +
    `k=(G(ms[i],${q}property${q})||G(ms[i],${q}name${q})||G(ms[i],${q}itemprop${q})).toLowerCase();` +
    `v=G(ms[i],${q}content${q});` +
    `if(k&&v&&!M[k])M[k]=v;` +
    `}` +
    `var ST=[],REC=null,PROD=null,BOOK=null,MEDIA=null;` +
    `function scan(n){` +
    `if(!n||typeof n!==${q}object${q})return;` +
    `if(isA(n)){for(var a=0;a<n.length;a++)scan(n[a]);return;}` +
    `var t=n[${q}@type${q}],ts=isA(t)?t:t?[t]:[];` +
    `for(var b=0;b<ts.length;b++){` +
    `var r=String(ts[b]),rl=r.toLowerCase();` +
    `if(ST.indexOf(r)<0&&ST.length<8)ST.push(r);` +
    `if(rl.indexOf(${q}recipe${q})>=0&&!REC)REC=n;` +
    `else if(rl.indexOf(${q}book${q})>=0&&!BOOK)BOOK=n;` +
    `else if((rl.indexOf(${q}movie${q})>=0||rl.indexOf(${q}tvseries${q})>=0)&&!MEDIA)MEDIA=n;` +
    `else if(rl.indexOf(${q}product${q})>=0&&!PROD)PROD=n;` +
    `}` +
    `if(n[${q}@graph${q}])scan(n[${q}@graph${q}]);` +
    `}` +
    `var lds=QA(${q}script[type="application/ld+json"]${q});` +
    `for(i=0;i<lds.length;i++){try{scan(JSON.parse(lds[i].textContent||${q}${q}));}catch(e){}}` +
    `var P=REC||BOOK||MEDIA||PROD,imgs=[],seen={};` +
    `function addImg(u){` +
    `if(!u)return;` +
    `if(isA(u)){for(var x=0;x<u.length;x++)addImg(u[x]);return;}` +
    `if(typeof u===${q}object${q}){addImg(u.url||u.contentUrl||u.src||u.image);return;}` +
    `if(!isS(u))return;u=u.trim();` +
    `if(!u||/^(?:data|blob|javascript):/i.test(u))return;` +
    `try{u=new URL(u,L.href).href;}catch(e){return;}` +
    `if(u.length>600||(imgs.length>0&&u.length>420))return;` +
    `if(/\\.(?:svg|gif|ico)(?:[?]|$)/i.test(u)||/(?:logo|favicon|sprite|icon|avatar|badge|visa|mastercard|paypal|klarna)/i.test(u))return;` +
    `if(!seen[u]&&imgs.length<6){seen[u]=1;imgs.push(u);}` +
    `}` +
    `if(P){addImg(P.image);if(P.hasVariant)addImg(P.hasVariant);}` +
    `addImg(M[${q}og:image:secure_url${q}]||M[${q}og:image${q}]||M[${q}twitter:image${q}]);` +
    `var els=QA(${q}img${q});` +
    `for(i=0;i<els.length&&imgs.length<6;i++){` +
    `var el=els[i],nw=el.naturalWidth||el.width||0,nh=el.naturalHeight||el.height||0;` +
    `if((nw>=250||nh>=250)||(nw===0&&nh===0&&el.getBoundingClientRect().width>=200))addImg(el.currentSrc||G(el,${q}src${q})||G(el,${q}data-src${q}));` +
    `}` +
    `var cols=[];` +
    `function addCol(c){if(!c)return;if(isA(c)){for(var j=0;j<c.length;j++)addCol(c[j]);return;}if(typeof c===${q}object${q})c=c.name;if(isS(c)){c=c.trim();if(c&&cols.indexOf(c)<0&&cols.length<6)cols.push(c);}}` +
    `if(PROD){addCol(PROD.color);if(isA(PROD.hasVariant))for(i=0;i<PROD.hasVariant.length;i++)addCol(PROD.hasVariant[i]&&PROD.hasVariant[i].color);}` +
    `addCol(M[${q}product:color${q}]);` +
    `var cs=Q(${q}[class*="color" i],[data-testid*="color" i],[aria-label*="color" i]${q});` +
    `if(cs&&cs.textContent){var cm=cs.textContent.trim().match(/^(?:colou?r|farbe)\\s*[:\\-]\\s*([a-zA-Z\\u00C0-\\u00FF\\s\\/-]{2,28})/i);if(cm)addCol(cm[1]);}` +
    `var off=PROD&&PROD.offers?(isA(PROD.offers)?PROD.offers[0]:PROD.offers):null;` +
    `var price=(off&&(off.price||off.lowPrice))||M[${q}product:price:amount${q}]||M[${q}og:price:amount${q}]||${q}${q};` +
    `var curr=(off&&off.priceCurrency)||M[${q}product:price:currency${q}]||M[${q}og:price:currency${q}]||${q}${q};` +
    `if(!price){var pe=Q(${q}[itemprop="price"],[data-testid*="price" i],[class*="product-price" i]${q});if(pe)price=(G(pe,${q}content${q})||pe.textContent||${q}${q}).trim().slice(0,32);}` +
    `var mat=(PROD&&isS(PROD.material)?PROD.material:${q}${q})||M[${q}product:material${q}]||${q}${q};` +
    `var mRe=/(?:\\x25|cotton|wool|merino|linen|silk|cashmere|polyamide|polyester|elastane|nylon|leather|gore-?tex|water-?(?:proof|repellent))/i;` +
    `var ml=[],nds=QA(${q}details,[class*="material" i],[class*="composition" i],[class*="fabric" i],[class*="detail" i],[class*="care" i]${q});` +
    `for(i=0;i<nds.length;i++){var tx=C(nds[i].textContent,300);if(tx.length>4&&mRe.test(tx))ml.push(tx);}` +
    `var bt=(D.body&&D.body.innerText||${q}${q}).split(/\\r?\\n/);` +
    `for(i=0;i<bt.length&&ml.length<10;i++){var ln=bt[i].trim();if(ln.length>4&&ln.length<200&&/(?:\\d+\\s*\\x25\\s*[a-zA-Z]|(?:composition|shell|lining|fabric|material)\\s*:|gore-?tex|water-?(?:proof|repellent))/i.test(ln))ml.push(ln);}` +
    `var manUrl=${q}${q},lks=QA(${q}a[href]${q});` +
    `for(i=0;i<lks.length;i++){var hr=lks[i].href||${q}${q},lt=(lks[i].textContent||${q}${q}).trim();if(/\\.pdf(?:[?]|$)/i.test(hr)&&/(?:manual|handbook|guide|instruction|datasheet|spec)/i.test(hr+${q} ${q}+lt)){manUrl=hr.slice(0,400);break;}}` +
    `var rec=null;` +
    `if(REC){` +
    `var ings=isA(REC.recipeIngredient)?REC.recipeIngredient.slice(0,25).map(function(x){return C(x,180);}):[];` +
    `var st=[];` +
    `function addSt(x){if(!x||st.length>=20)return;if(isA(x)){for(var u=0;u<x.length;u++)addSt(x[u]);return;}if(isS(x)){var c=C(x,320);if(c)st.push(c);return;}if(typeof x===${q}object${q})addSt(x.text||x.itemListElement||x.name);}` +
    `addSt(REC.recipeInstructions);` +
    `rec={servings:isA(REC.recipeYield)?REC.recipeYield[0]:(REC.recipeYield||${q}${q}),prepTime:REC.prepTime||${q}${q},cookTime:REC.cookTime||${q}${q},totalTime:REC.totalTime||${q}${q},ingredients:ings,instructions:st};` +
    `}` +
    `var sel=${q}${q};try{sel=(window.getSelection&&window.getSelection().toString()||${q}${q}).replace(/\\r\\n?/g,${q}\\n${q}).trim().slice(0,1200);}catch(e){}` +
    `var soc=/(?:instagram\\.com|tiktok\\.com|youtube\\.com|youtu\\.be|threads\\.net|pinterest\\.)/i.test(L.hostname),cap=${q}${q};` +
    `if(soc){` +
    `var cd=[],cels=QA(${q}[data-e2e="browse-video-desc"],[data-e2e="video-desc"],[id="description-inline-expander"],ytd-text-inline-expander,[id="attributed-snippet-text"],article h1,main h1,[role="dialog"] h1,article ul li span[dir="auto"],[role="dialog"] span[dir="auto"]${q});` +
    `for(i=0;i<cels.length;i++){var cx=(cels[i].innerText||cels[i].textContent||${q}${q}).replace(/\\r\\n?/g,${q}\\n${q}).trim();if(cx.length>=40&&!/(?:log in|sign up|forgot password|create new account)/i.test(cx))cd.push(cx);}` +
    `cd.sort(function(a,b){return b.length-a.length;});` +
    `if(cd[0])cap=cd[0].slice(0,2400);` +
    `}` +
    `var h1=Q(${q}h1${q});` +
    `var br=P&&P.brand?(isS(P.brand)?P.brand:P.brand.name):(P&&P.author?(isS(P.author)?P.author:(isA(P.author)?(P.author[0]&&P.author[0].name):P.author.name)):${q}${q});` +
    `var sku=PROD?(PROD.sku||PROD.mpn||PROD.gtin13||PROD.model||${q}${q}):${q}${q};` +
    `var pl={url:L.href.slice(0,${MAX_CLIP_URL}),name:C((P&&isS(P.name)?P.name:${q}${q})||(P&&isS(P.headline)?P.headline:${q}${q})||M[${q}og:title${q}]||(h1&&h1.textContent)||D.title,200),brand:C(br||M[${q}product:brand${q}],80),retailer:C(M[${q}og:site_name${q}],60),color:cols[0]||${q}${q},colors:cols,material:C(mat,120),materialText:ml.join(${q} | ${q}).slice(0,700),price:price,currency:String(curr).slice(0,12),sku:String(sku).slice(0,60),manualUrl:manUrl,description:C((P&&P.description)||M[${q}og:description${q}]||M.description,360),images:imgs,schemaTypes:ST,selection:sel,caption:cap,recipe:rec};` +
    `var u8=new TextEncoder().encode(JSON.stringify(pl)),bin=${q}${q};` +
    `for(i=0;i<u8.length;i++)bin+=String.fromCharCode(u8[i]);` +
    `var b64=btoa(bin).replace(/\\+/g,${q}-${q}).replace(/\\//g,${q}_${q}).replace(/=+$/,${q}${q});` +
    `var dest=${JSON.stringify(normalizedUrl)}+String.fromCharCode(35)+${q}clip=${q}+b64;` +
    `var mob=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);` +
    `if(mob||!window.open(dest,${q}_blank${q}))L.href=dest;` +
    `}catch(err){alert(${q}Save to Curio error: ${q}+(err&&err.message?err.message:err));}` +
    `})();`;

  return `javascript:${encodeURI(script)}`;
}
