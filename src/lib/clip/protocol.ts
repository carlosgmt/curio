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

  // 1. Recipe -> Chef
  const hasRecipeSchema = schemaLower.some((s) => s.includes("recipe"));
  const hasRecipeIngredients = (clip.recipe?.ingredients?.length ?? 0) >= 2;
  if (hasRecipeSchema || hasRecipeIngredients || RECIPE_HOSTS_RE.test(hostname) || RECIPE_PATH_RE.test(pathname)) {
    return {
      destination: "chef",
      coreType: "CULINARY",
      typePath: "/culinary/recipe",
      label: "Chef",
      targetPath: "/chef/",
      reason: hasRecipeSchema || hasRecipeIngredients ? "Recipe structured data detected" : "Recipe URL detected",
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
    selection: strOrUndef(obj.selection, 800),
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

  // Zero literal '#' characters inside the javascript: payload so address bars never truncate at a fragment.
  const script =
    `(function(){` +
    `try{` +
    `var D=document,L=location;` +
    `if(!/^https?:$/.test(L.protocol)){alert("Open a web page first.");return;}` +
    `var M={},ms=D.querySelectorAll("meta");` +
    `for(var i=0;i<ms.length;i++){` +
    `var k=(ms[i].getAttribute("property")||ms[i].getAttribute("name")||ms[i].getAttribute("itemprop")||"").toLowerCase().trim();` +
    `var v=(ms[i].getAttribute("content")||"").trim();` +
    `if(k&&v&&!M[k])M[k]=v;` +
    `}` +
    `var ST=[],REC=null,PROD=null,BOOK=null,MEDIA=null;` +
    `function scan(n){` +
    `if(!n||typeof n!=="object")return;` +
    `if(Array.isArray(n)){for(var a=0;a<n.length;a++)scan(n[a]);return;}` +
    `var t=n["@type"],ts=Array.isArray(t)?t:t?[t]:[];` +
    `for(var b=0;b<ts.length;b++){` +
    `var s=String(ts[b]),sl=s.toLowerCase();` +
    `if(ST.indexOf(s)<0&&ST.length<8)ST.push(s);` +
    `if(sl.indexOf("recipe")>=0&&!REC)REC=n;` +
    `else if(sl.indexOf("book")>=0&&!BOOK)BOOK=n;` +
    `else if((sl.indexOf("movie")>=0||sl.indexOf("tvseries")>=0)&&!MEDIA)MEDIA=n;` +
    `else if(sl.indexOf("product")>=0&&!PROD)PROD=n;` +
    `}` +
    `if(n["@graph"])scan(n["@graph"]);` +
    `}` +
    `var lds=D.querySelectorAll('script[type="application/ld+json"]');` +
    `for(var j=0;j<lds.length;j++){try{scan(JSON.parse(lds[j].textContent||""));}catch(e){}}` +
    `var P=REC||BOOK||MEDIA||PROD;` +
    `var imgs=[],seen={};` +
    `function addImg(u){` +
    `if(!u)return;` +
    `if(Array.isArray(u)){for(var x=0;x<u.length;x++)addImg(u[x]);return;}` +
    `if(typeof u==="object"){addImg(u.url||u.contentUrl||u.src||u.image);return;}` +
    `if(typeof u!=="string")return;` +
    `u=u.trim();if(!u||/^(?:data|blob|javascript):/i.test(u))return;` +
    `try{u=new URL(u,L.href).href;}catch(e){return;}` +
    `if(/\\.(?:svg|gif|ico)(?:[?]|$)/i.test(u)||/(?:logo|favicon|sprite|icon|avatar|badge|visa|mastercard|paypal|klarna)/i.test(u))return;` +
    `if(!seen[u]&&imgs.length<8){seen[u]=1;imgs.push(u);}` +
    `}` +
    `if(P){addImg(P.image);if(P.hasVariant)addImg(P.hasVariant);}` +
    `addImg(M["og:image:secure_url"]||M["og:image"]||M["twitter:image"]);` +
    `var els=D.querySelectorAll("img");` +
    `for(var g=0;g<els.length&&imgs.length<8;g++){` +
    `var el=els[g],nw=el.naturalWidth||el.width||0,nh=el.naturalHeight||el.height||0;` +
    `if((nw>=250||nh>=250)||(nw===0&&nh===0&&el.getBoundingClientRect().width>=200)){addImg(el.currentSrc||el.getAttribute("src")||el.getAttribute("data-src"));}` +
    `}` +
    `var cols=[];` +
    `function addCol(c){if(!c)return;if(Array.isArray(c)){for(var q=0;q<c.length;q++)addCol(c[q]);return;}if(typeof c==="object")c=c.name;if(typeof c==="string"){c=c.trim();if(c&&cols.indexOf(c)<0&&cols.length<8)cols.push(c);}}` +
    `if(PROD){addCol(PROD.color);if(Array.isArray(PROD.hasVariant))for(var v0=0;v0<PROD.hasVariant.length;v0++)addCol(PROD.hasVariant[v0]&&PROD.hasVariant[v0].color);}` +
    `addCol(M["product:color"]);` +
    `var colSel=D.querySelector('[class*="color" i],[data-testid*="color" i],[aria-label*="color" i]');` +
    `if(colSel&&colSel.textContent){var cm=colSel.textContent.trim().match(/^(?:colou?r|farbe)\\s*[:\\-]\\s*([a-zA-Z\\u00C0-\\u00FF\\s\\/-]{2,28})/i);if(cm)addCol(cm[1]);}` +
    `var offer=PROD&&PROD.offers?(Array.isArray(PROD.offers)?PROD.offers[0]:PROD.offers):null;` +
    `var price=(offer&&(offer.price||offer.lowPrice))||M["product:price:amount"]||M["og:price:amount"]||"";` +
    `var curr=(offer&&offer.priceCurrency)||M["product:price:currency"]||M["og:price:currency"]||"";` +
    `if(!price){var pe=D.querySelector('[itemprop="price"],[data-testid*="price" i],[class*="product-price" i]');if(pe)price=(pe.getAttribute("content")||pe.textContent||"").trim().slice(0,32);}` +
    `var mat=(PROD&&typeof PROD.material==="string"?PROD.material:"")||M["product:material"]||"";` +
    `var matLines=[],nodes=D.querySelectorAll('details,[class*="material" i],[class*="composition" i],[class*="fabric" i],[class*="detail" i],[class*="care" i]');` +
    `for(var d0=0;d0<nodes.length;d0++){var tx=(nodes[d0].textContent||"").replace(/\\s+/g," ").trim();if(tx.length>4&&tx.length<300&&/(?:%|cotton|wool|merino|linen|silk|cashmere|polyamide|polyester|elastane|nylon|leather|gore-?tex|waterproof|water-?repellent)/i.test(tx))matLines.push(tx);}` +
    `var bt=(D.body&&D.body.innerText?D.body.innerText:"").split(/\\r?\\n/);` +
    `for(var bl=0;bl<bt.length&&matLines.length<10;bl++){var ln=bt[bl].trim();if(ln.length>4&&ln.length<200&&/(?:\\d+\\s*%\\s*[a-zA-Z]|composition|shell\\s*:|lining\\s*:|fabric\\s*:|material\\s*:|gore-?tex|waterproof|water-?repellent)/i.test(ln))matLines.push(ln);}` +
    `var manUrl="";var links=D.querySelectorAll("a[href]");` +
    `for(var li=0;li<links.length;li++){var href=links[li].href||"",ltxt=(links[li].textContent||"").trim();if(/\\.pdf(?:[?]|$)/i.test(href)&&/(?:manual|handbook|guide|instruction|datasheet|spec)/i.test(href+" "+ltxt)){manUrl=href.slice(0,400);break;}}` +
    `var recObj=null;` +
    `if(REC){` +
    `var ings=Array.isArray(REC.recipeIngredient)?REC.recipeIngredient.slice(0,25).map(function(s){return String(s).replace(/\\s+/g," ").trim().slice(0,180);}):[];` +
    `var steps=[];` +
    `function addStep(s){if(!s||steps.length>=20)return;if(Array.isArray(s)){for(var u=0;u<s.length;u++)addStep(s[u]);return;}if(typeof s==="string"){var c=s.replace(/\\s+/g," ").trim();if(c)steps.push(c.slice(0,320));return;}if(typeof s==="object"){if(s.text)addStep(s.text);else if(s.itemListElement)addStep(s.itemListElement);else if(s.name)addStep(s.name);}}` +
    `addStep(REC.recipeInstructions);` +
    `recObj={servings:Array.isArray(REC.recipeYield)?REC.recipeYield[0]:(REC.recipeYield||""),prepTime:REC.prepTime||"",cookTime:REC.cookTime||"",totalTime:REC.totalTime||"",ingredients:ings,instructions:steps};` +
    `}` +
    `var sel="";try{sel=(window.getSelection&&window.getSelection().toString()||"").replace(/\\s+/g," ").trim().slice(0,500);}catch(e){}` +
    `var h1=D.querySelector("h1");` +
    `var br=P&&P.brand?(typeof P.brand==="string"?P.brand:P.brand.name):(P&&P.author?(typeof P.author==="string"?P.author:(Array.isArray(P.author)?(P.author[0]&&P.author[0].name):P.author.name)):"");` +
    `var sku=PROD?(PROD.sku||PROD.mpn||PROD.gtin13||PROD.model||""):"";` +
    `var payload={` +
    `url:L.href.slice(0,${MAX_CLIP_URL}),` +
    `name:((P&&typeof P.name==="string"?P.name:"")||(P&&typeof P.headline==="string"?P.headline:"")||M["og:title"]||(h1&&h1.textContent)||D.title||"").replace(/\\s+/g," ").trim().slice(0,200),` +
    `brand:String(br||M["product:brand"]||"").replace(/\\s+/g," ").trim().slice(0,80),` +
    `retailer:String(M["og:site_name"]||"").replace(/\\s+/g," ").trim().slice(0,60),` +
    `color:cols[0]||"",` +
    `colors:cols,` +
    `material:String(mat).trim().slice(0,120),` +
    `materialText:matLines.join(" | ").slice(0,700),` +
    `price:price,` +
    `currency:String(curr).slice(0,12),` +
    `sku:String(sku).slice(0,60),` +
    `manualUrl:manUrl,` +
    `description:String((P&&P.description)||M["og:description"]||M.description||"").replace(/\\s+/g," ").trim().slice(0,360),` +
    `images:imgs,` +
    `schemaTypes:ST,` +
    `selection:sel,` +
    `recipe:recObj` +
    `};` +
    `var b64=btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");` +
    `var dest=${JSON.stringify(normalizedUrl)}+String.fromCharCode(35)+"clip="+b64;` +
    `if(!window.open(dest,"_blank"))L.href=dest;` +
    `}catch(err){alert("Save to Curio error: "+(err&&err.message?err.message:err));}` +
    `})();`;

  return `javascript:${script}`;
}
