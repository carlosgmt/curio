import type { EnrichmentPayload } from "../dispatcher";
import type { DiscoveredCandidate, CandidateFallback } from "../universalDiscovery";

export type CommercialCategory = "garment" | "watch_luxury" | "electronics" | "cosmetics";

export interface CommercialSkuAnalysis {
  category: CommercialCategory;
  typePath: "/product/garment" | "/product" | "/product/electronics" | "/product/cosmetics";
  coreType: "PRODUCT";
  brand: string;
  model: string;
  productLineQuery: string;
  sku: string | null;
  referenceCode: string | null;
  color: string | null;
  colorHex: string | null;
  fit: string | null;
  material: string | null;
  weight: string | null;
  size: string | null;
  estimatedPriceCents: number;
  canonicalTitle: string;
}

/**
 * Curated Colorway -> Hex Swatch Dictionary for GarmentCard & CosmeticsCard
 */
export const COLOR_SWATCH_MAP: Record<string, { label: string; hex: string }> = {
  mint: { label: "Mint", hex: "#98e2c6" },
  sage: { label: "Sage", hex: "#9caf88" },
  ecru: { label: "Ecru", hex: "#f3efe0" },
  cream: { label: "Cream", hex: "#f5f2e8" },
  ivory: { label: "Ivory", hex: "#fffff0" },
  navy: { label: "Navy", hex: "#1b2a4a" },
  olive: { label: "Olive", hex: "#556b2f" },
  burgundy: { label: "Burgundy", hex: "#6b1d2f" },
  maroon: { label: "Maroon", hex: "#5c1a24" },
  camel: { label: "Camel", hex: "#c19a6b" },
  tan: { label: "Tan", hex: "#d2b48c" },
  khaki: { label: "Khaki", hex: "#c3b091" },
  sand: { label: "Sand", hex: "#e2d2b5" },
  taupe: { label: "Taupe", hex: "#8b8589" },
  beige: { label: "Beige", hex: "#e8dec8" },
  charcoal: { label: "Charcoal", hex: "#36454f" },
  slate: { label: "Slate", hex: "#5a6978" },
  anthracite: { label: "Anthracite", hex: "#293133" },
  black: { label: "Black", hex: "#1a1a1a" },
  noir: { label: "Noir", hex: "#141414" },
  white: { label: "White", hex: "#f8f8f8" },
  blanc: { label: "Blanc", hex: "#fafafa" },
  grey: { label: "Grey", hex: "#8c8c8c" },
  gray: { label: "Gray", hex: "#8c8c8c" },
  heather: { label: "Heather Grey", hex: "#b2b5b8" },
  silver: { label: "Silver", hex: "#c0c0c0" },
  gold: { label: "Gold", hex: "#d4af37" },
  rose: { label: "Rose", hex: "#e8a598" },
  blush: { label: "Blush", hex: "#f2c6c2" },
  pink: { label: "Pink", hex: "#f4b4c4" },
  coral: { label: "Coral", hex: "#f08080" },
  terracotta: { label: "Terracotta", hex: "#c86d51" },
  rust: { label: "Rust", hex: "#a44a28" },
  orange: { label: "Orange", hex: "#e87a3e" },
  amber: { label: "Amber", hex: "#d99026" },
  yellow: { label: "Yellow", hex: "#ecd464" },
  mustard: { label: "Mustard", hex: "#d4a017" },
  ochre: { label: "Ochre", hex: "#cc7722" },
  emerald: { label: "Emerald", hex: "#2e7d5b" },
  forest: { label: "Forest Green", hex: "#224229" },
  green: { label: "Green", hex: "#3b7a57" },
  teal: { label: "Teal", hex: "#2b6e72" },
  cyan: { label: "Cyan", hex: "#4ab8c4" },
  cobalt: { label: "Cobalt", hex: "#1e488f" },
  indigo: { label: "Indigo", hex: "#2e3b6e" },
  blue: { label: "Blue", hex: "#3a6ea5" },
  sky: { label: "Sky Blue", hex: "#87ceeb" },
  lavender: { label: "Lavender", hex: "#b5a8d5" },
  lilac: { label: "Lilac", hex: "#c8a2c8" },
  purple: { label: "Purple", hex: "#6a4c93" },
  plum: { label: "Plum", hex: "#5d2e46" },
  brown: { label: "Brown", hex: "#5c4033" },
  espresso: { label: "Espresso", hex: "#3b271e" },
  chocolate: { label: "Chocolate", hex: "#4a2c1d" },
};

const GARMENT_TYPE_MAP: Record<string, { label: string; defaultMaterial: string; defaultWeight: string; defaultPriceCents: number }> = {
  "t-shirt": { label: "T-Shirt", defaultMaterial: "100% Organic Cotton", defaultWeight: "220 GSM Jersey", defaultPriceCents: 6500 },
  tshirt: { label: "T-Shirt", defaultMaterial: "100% Organic Cotton", defaultWeight: "220 GSM Jersey", defaultPriceCents: 6500 },
  tee: { label: "Tee", defaultMaterial: "100% Combed Cotton", defaultWeight: "240 GSM Heavyweight", defaultPriceCents: 6000 },
  shirt: { label: "Shirt", defaultMaterial: "100% Poplin Cotton", defaultWeight: "140 GSM Woven", defaultPriceCents: 14500 },
  overshirt: { label: "Overshirt", defaultMaterial: "Brushed Cotton Twill", defaultWeight: "340 GSM Heavyweight", defaultPriceCents: 19500 },
  polo: { label: "Polo Shirt", defaultMaterial: "100% Piqué Cotton", defaultWeight: "210 GSM Piqué", defaultPriceCents: 11500 },
  sweater: { label: "Sweater", defaultMaterial: "100% Extra-Fine Merino Wool", defaultWeight: "12-Gauge Knit", defaultPriceCents: 18500 },
  jumper: { label: "Jumper", defaultMaterial: "100% Merino Wool", defaultWeight: "Midweight Knit", defaultPriceCents: 18000 },
  knit: { label: "Knit", defaultMaterial: "Merino & Cashmere Blend", defaultWeight: "7-Gauge Knit", defaultPriceCents: 21000 },
  cardigan: { label: "Cardigan", defaultMaterial: "100% Virgin Wool", defaultWeight: "Ribbed Knit", defaultPriceCents: 22000 },
  hoodie: { label: "Hoodie", defaultMaterial: "100% Loopback Cotton", defaultWeight: "420 GSM Fleece", defaultPriceCents: 16500 },
  sweatshirt: { label: "Sweatshirt", defaultMaterial: "100% Organic Loopback Cotton", defaultWeight: "380 GSM French Terry", defaultPriceCents: 14500 },
  jacket: { label: "Jacket", defaultMaterial: "Water-Repellent Technical Twill", defaultWeight: "Lined Outerwear", defaultPriceCents: 32000 },
  parka: { label: "Parka", defaultMaterial: "3-Layer Weatherproof Shell", defaultWeight: "Insulated Down", defaultPriceCents: 48000 },
  anorak: { label: "Anorak", defaultMaterial: "Ripstop Nylon", defaultWeight: "Lightweight Shell", defaultPriceCents: 26000 },
  coat: { label: "Coat", defaultMaterial: "Double-Faced Italian Wool", defaultWeight: "620 GSM Melton", defaultPriceCents: 55000 },
  trench: { label: "Trench Coat", defaultMaterial: "Cotton Gabardine", defaultWeight: "Weatherproof Weave", defaultPriceCents: 49000 },
  blazer: { label: "Blazer", defaultMaterial: "100% Virgin Wool Hopsack", defaultWeight: "Half-Canvassed", defaultPriceCents: 42000 },
  trousers: { label: "Trousers", defaultMaterial: "100% Pleated Wool Twill", defaultWeight: "280 GSM Suiting", defaultPriceCents: 19500 },
  pants: { label: "Pants", defaultMaterial: "Organic Cotton Twill", defaultWeight: "290 GSM Peached", defaultPriceCents: 16500 },
  jeans: { label: "Jeans", defaultMaterial: "100% Japanese Selvedge Denim", defaultWeight: "14 oz Raw Denim", defaultPriceCents: 24000 },
  chinos: { label: "Chinos", defaultMaterial: "Stretch Cotton Gabardine", defaultWeight: "260 GSM Twill", defaultPriceCents: 15000 },
  shorts: { label: "Shorts", defaultMaterial: "100% Linen-Cotton Blend", defaultWeight: "190 GSM Breathable", defaultPriceCents: 11000 },
  dress: { label: "Dress", defaultMaterial: "100% Mulberry Silk Crepe", defaultWeight: "Fluid Drape", defaultPriceCents: 29500 },
  skirt: { label: "Skirt", defaultMaterial: " Bias-Cut Satin", defaultWeight: "Midweight Drape", defaultPriceCents: 18500 },
  sneakers: { label: "Sneakers", defaultMaterial: "Full-Grain Calfskin & Suede", defaultWeight: "Margom Cupsole", defaultPriceCents: 28000 },
  boots: { label: "Boots", defaultMaterial: "Full-Grain Leather", defaultWeight: "Goodyear Welted", defaultPriceCents: 39000 },
  loafers: { label: "Loafers", defaultMaterial: "Unlined Suede Leather", defaultWeight: "Blake Stitched", defaultPriceCents: 34000 },
};

const KNOWN_FASHION_BRANDS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\breiss\b/i, canonical: "Reiss" },
  { pattern: /\ba\.?p\.?c\.?\b/i, canonical: "A.P.C." },
  { pattern: /\buniqlo\b/i, canonical: "Uniqlo" },
  { pattern: /\bcos\b/i, canonical: "COS" },
  { pattern: /\barket\b/i, canonical: "ARKET" },
  { pattern: /\bacne\s+studios\b/i, canonical: "Acne Studios" },
  { pattern: /\bour\s+legacy\b/i, canonical: "Our Legacy" },
  { pattern: /\bnorse\s+projects\b/i, canonical: "Norse Projects" },
  { pattern: /\bsunspel\b/i, canonical: "Sunspel" },
  { pattern: /\bbrunello\s+cucinelli\b/i, canonical: "Brunello Cucinelli" },
  { pattern: /\bloro\s+piana\b/i, canonical: "Loro Piana" },
  { pattern: /\bzegna\b/i, canonical: "Zegna" },
  { pattern: /\bralph\s+lauren\b/i, canonical: "Ralph Lauren" },
  { pattern: /\baim[eé]\s+leon\s+dore\b/i, canonical: "Aimé Leon Dore" },
  { pattern: /\bst[uü]ssy\b/i, canonical: "Stüssy" },
  { pattern: /\bpatagonia\b/i, canonical: "Patagonia" },
  { pattern: /\barc'?teryx\b/i, canonical: "Arc'teryx" },
  { pattern: /\bstone\s+island\b/i, canonical: "Stone Island" },
  { pattern: /\bbarbour\b/i, canonical: "Barbour" },
  { pattern: /\bburberry\b/i, canonical: "Burberry" },
  { pattern: /\bprada\b/i, canonical: "Prada" },
  { pattern: /\bgucci\b/i, canonical: "Gucci" },
  { pattern: /\bloewe\b/i, canonical: "Loewe" },
  { pattern: /\bbottega\s+veneta\b/i, canonical: "Bottega Veneta" },
  { pattern: /\bceline\b/i, canonical: "Celine" },
  { pattern: /\bsaint\s+laurent\b/i, canonical: "Saint Laurent" },
  { pattern: /\bmaison\s+margiela\b|\bmargiela\b/i, canonical: "Maison Margiela" },
  { pattern: /\brick\s+owens\b/i, canonical: "Rick Owens" },
  { pattern: /\bjil\s+sander\b/i, canonical: "Jil Sander" },
  { pattern: /\blemaire\b/i, canonical: "Lemaire" },
  { pattern: /\btoteme\b/i, canonical: "Toteme" },
  { pattern: /\bkhaite\b/i, canonical: "Khaite" },
  { pattern: /\bganni\b/i, canonical: "GANNI" },
  { pattern: /\bs[eé]zane\b/i, canonical: "Sézane" },
  { pattern: /\bzara\b/i, canonical: "Zara" },
  { pattern: /\bmassimo\s+dutti\b/i, canonical: "Massimo Dutti" },
  { pattern: /\beverlane\b/i, canonical: "Everlane" },
  { pattern: /\bbuck\s+mason\b/i, canonical: "Buck Mason" },
  { pattern: /\btodd\s+snyder\b/i, canonical: "Todd Snyder" },
  { pattern: /\bdrake'?s\b/i, canonical: "Drake's" },
  { pattern: /\bnike\b/i, canonical: "Nike" },
  { pattern: /\badidas\b/i, canonical: "Adidas" },
  { pattern: /\bnew\s+balance\b/i, canonical: "New Balance" },
  { pattern: /\bsalomon\b/i, canonical: "Salomon" },
  { pattern: /\basics\b/i, canonical: "ASICS" },
  { pattern: /\bcommon\s+projects\b/i, canonical: "Common Projects" },
  { pattern: /\bparaboot\b/i, canonical: "Paraboot" },
  { pattern: /\balden\b/i, canonical: "Alden" },
  { pattern: /\bcarhartt\b/i, canonical: "Carhartt WIP" },
  { pattern: /\blevi'?s\b/i, canonical: "Levi's" },
  { pattern: /\blululemon\b/i, canonical: "Lululemon" },
];

interface BrandSpec {
  pattern: RegExp;
  canonical: string;
  category: "watch_luxury" | "electronics" | "cosmetics";
  defaultPriceCents: number;
  sellerName: string;
  sellerSearchUrl: (q: string) => string;
  models?: Array<{ pattern: RegExp; canonical: string; priceCents?: number }>;
}

const WATCH_AND_LUXURY_BRANDS: BrandSpec[] = [
  {
    pattern: /\brolex\b/i,
    canonical: "Rolex",
    category: "watch_luxury",
    defaultPriceCents: 1050000,
    sellerName: "Chrono24",
    sellerSearchUrl: (q) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(q)}`,
    models: [
      { pattern: /\bexplorer\s*(?:ii|2)\b/i, canonical: "Explorer II", priceCents: 965000 },
      { pattern: /\bexplorer\b/i, canonical: "Explorer", priceCents: 770000 },
      { pattern: /\bsubmariner\b/i, canonical: "Submariner", priceCents: 1025000 },
      { pattern: /\bgmt[\s-]*master\s*(?:ii|2)?\b/i, canonical: "GMT-Master II", priceCents: 1115000 },
      { pattern: /\bdaytona\b/i, canonical: "Cosmograph Daytona", priceCents: 1510000 },
      { pattern: /\bdatejust\b/i, canonical: "Datejust", priceCents: 850000 },
      { pattern: /\bday[\s-]*date\b/i, canonical: "Day-Date", priceCents: 3850000 },
      { pattern: /\boyster\s+perpetual\b/i, canonical: "Oyster Perpetual", priceCents: 640000 },
      { pattern: /\byacht[\s-]*master\b/i, canonical: "Yacht-Master", priceCents: 1230000 },
      { pattern: /\bsky[\s-]*dweller\b/i, canonical: "Sky-Dweller", priceCents: 1615000 },
      { pattern: /\bmilgauss\b/i, canonical: "Milgauss", priceCents: 930000 },
    ],
  },
  {
    pattern: /\bomega\b/i,
    canonical: "Omega",
    category: "watch_luxury",
    defaultPriceCents: 700000,
    sellerName: "Chrono24",
    sellerSearchUrl: (q) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(q)}`,
    models: [
      { pattern: /\bspeedmaster\b/i, canonical: "Speedmaster Professional", priceCents: 700000 },
      { pattern: /\bseamaster\b/i, canonical: "Seamaster Diver 300M", priceCents: 590000 },
      { pattern: /\baqua\s+terra\b/i, canonical: "Seamaster Aqua Terra", priceCents: 630000 },
      { pattern: /\bconstellation\b/i, canonical: "Constellation", priceCents: 680000 },
    ],
  },
  {
    pattern: /\btudor\b/i,
    canonical: "Tudor",
    category: "watch_luxury",
    defaultPriceCents: 425000,
    sellerName: "Chrono24",
    sellerSearchUrl: (q) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(q)}`,
    models: [
      { pattern: /\bblack\s+bay\s*58\b/i, canonical: "Black Bay 58", priceCents: 395000 },
      { pattern: /\bblack\s+bay\s*54\b/i, canonical: "Black Bay 54", priceCents: 385000 },
      { pattern: /\bblack\s+bay\s*pro\b/i, canonical: "Black Bay Pro", priceCents: 422500 },
      { pattern: /\bblack\s+bay\b/i, canonical: "Black Bay", priceCents: 435000 },
      { pattern: /\bpelagos\s*39\b/i, canonical: "Pelagos 39", priceCents: 470000 },
      { pattern: /\bpelagos\b/i, canonical: "Pelagos", priceCents: 502500 },
    ],
  },
  {
    pattern: /\bcartier\b/i,
    canonical: "Cartier",
    category: "watch_luxury",
    defaultPriceCents: 745000,
    sellerName: "Cartier",
    sellerSearchUrl: (q) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(q)}`,
    models: [
      { pattern: /\bsantos\b/i, canonical: "Santos de Cartier", priceCents: 775000 },
      { pattern: /\btank\s+must\b/i, canonical: "Tank Must", priceCents: 345000 },
      { pattern: /\btank\s+louis\b/i, canonical: "Tank Louis Cartier", priceCents: 1300000 },
      { pattern: /\btank\b/i, canonical: "Tank", priceCents: 365000 },
      { pattern: /\bpanth[eè]re\b/i, canonical: "Panthère de Cartier", priceCents: 445000 },
    ],
  },
  {
    pattern: /\bpatek\s+philippe\b|\bpatek\b/i,
    canonical: "Patek Philippe",
    category: "watch_luxury",
    defaultPriceCents: 3500000,
    sellerName: "Chrono24",
    sellerSearchUrl: (q) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(q)}`,
    models: [
      { pattern: /\bnautilus\b/i, canonical: "Nautilus", priceCents: 6800000 },
      { pattern: /\baquanaut\b/i, canonical: "Aquanaut", priceCents: 4500000 },
      { pattern: /\bcalatrava\b/i, canonical: "Calatrava", priceCents: 3200000 },
    ],
  },
  {
    pattern: /\baudemars\s+piguet\b/i,
    canonical: "Audemars Piguet",
    category: "watch_luxury",
    defaultPriceCents: 3800000,
    sellerName: "Chrono24",
    sellerSearchUrl: (q) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(q)}`,
    models: [{ pattern: /\broyal\s+oak\b/i, canonical: "Royal Oak", priceCents: 3800000 }],
  },
  {
    pattern: /\bgrand\s+seiko\b/i,
    canonical: "Grand Seiko",
    category: "watch_luxury",
    defaultPriceCents: 620000,
    sellerName: "Grand Seiko",
    sellerSearchUrl: (q) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(q)}`,
  },
  {
    pattern: /\bseiko\b/i,
    canonical: "Seiko",
    category: "watch_luxury",
    defaultPriceCents: 85000,
    sellerName: "Seiko",
    sellerSearchUrl: (q) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(q)}`,
  },
  {
    pattern: /\bcasio\b|\bg-shock\b/i,
    canonical: "Casio",
    category: "watch_luxury",
    defaultPriceCents: 15000,
    sellerName: "Casio",
    sellerSearchUrl: (q) => `https://www.casio.com/us/search-result/?q=${encodeURIComponent(q)}`,
  },
  {
    pattern: /\biwc\b/i,
    canonical: "IWC Schaffhausen",
    category: "watch_luxury",
    defaultPriceCents: 680000,
    sellerName: "Chrono24",
    sellerSearchUrl: (q) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(q)}`,
  },
  {
    pattern: /\bjaeger[\s-]*lecoultre\b|\bjlc\b/i,
    canonical: "Jaeger-LeCoultre",
    category: "watch_luxury",
    defaultPriceCents: 1080000,
    sellerName: "Chrono24",
    sellerSearchUrl: (q) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(q)}`,
  },
  {
    pattern: /\bherman\s+miller\b/i,
    canonical: "Herman Miller",
    category: "watch_luxury",
    defaultPriceCents: 169500,
    sellerName: "Herman Miller",
    sellerSearchUrl: (q) => `https://store.hermanmiller.com/search?q=${encodeURIComponent(q)}`,
    models: [
      { pattern: /\baeron\b/i, canonical: "Aeron Chair", priceCents: 180500 },
      { pattern: /\bembody\b/i, canonical: "Embody Chair", priceCents: 189500 },
      { pattern: /\beames\b/i, canonical: "Eames Lounge Chair", priceCents: 689500 },
    ],
  },
  {
    pattern: /\brimowa\b/i,
    canonical: "Rimowa",
    category: "watch_luxury",
    defaultPriceCents: 143000,
    sellerName: "Rimowa",
    sellerSearchUrl: (q) => `https://www.rimowa.com/us/en/search?q=${encodeURIComponent(q)}`,
  },
];

const ELECTRONICS_BRANDS: BrandSpec[] = [
  {
    pattern: /\bleica\b/i,
    canonical: "Leica",
    category: "electronics",
    defaultPriceCents: 599500,
    sellerName: "B&H Photo",
    sellerSearchUrl: (q) => `https://www.bhphotovideo.com/c/search?Ntt=${encodeURIComponent(q)}`,
    models: [
      { pattern: /\bq3\b/i, canonical: "Q3", priceCents: 599500 },
      { pattern: /\bq2\b/i, canonical: "Q2", priceCents: 579500 },
      { pattern: /\bm11\b/i, canonical: "M11", priceCents: 899500 },
      { pattern: /\bm6\b/i, canonical: "M6", priceCents: 554000 },
    ],
  },
  {
    pattern: /\bfujifilm\b/i,
    canonical: "Fujifilm",
    category: "electronics",
    defaultPriceCents: 159900,
    sellerName: "B&H Photo",
    sellerSearchUrl: (q) => `https://www.bhphotovideo.com/c/search?Ntt=${encodeURIComponent(q)}`,
    models: [
      { pattern: /\bx100vi\b/i, canonical: "X100VI", priceCents: 159900 },
      { pattern: /\bx100v\b/i, canonical: "X100V", priceCents: 139900 },
    ],
  },
  {
    pattern: /\bsony\s+wh[\s-]*1000xm\d\b|\bsony\s+a7/i,
    canonical: "Sony",
    category: "electronics",
    defaultPriceCents: 39900,
    sellerName: "Sony",
    sellerSearchUrl: (q) => `https://electronics.sony.com/search/${encodeURIComponent(q)}`,
  },
  {
    pattern: /\bteenage\s+engineering\b/i,
    canonical: "Teenage Engineering",
    category: "electronics",
    defaultPriceCents: 199900,
    sellerName: "Teenage Engineering",
    sellerSearchUrl: (q) => `https://teenage.engineering/products`,
  },
  {
    pattern: /\bbang\s*&\s*olufsen\b|\bb&o\b/i,
    canonical: "Bang & Olufsen",
    category: "electronics",
    defaultPriceCents: 99900,
    sellerName: "Bang & Olufsen",
    sellerSearchUrl: (q) => `https://www.bang-olufsen.com/en/us/search?q=${encodeURIComponent(q)}`,
  },
];

const COSMETICS_BRANDS: BrandSpec[] = [
  {
    pattern: /\baesop\b/i,
    canonical: "Aesop",
    category: "cosmetics",
    defaultPriceCents: 4300,
    sellerName: "Aesop",
    sellerSearchUrl: (q) => `https://www.aesop.com/us/r/search/?q=${encodeURIComponent(q)}`,
  },
  {
    pattern: /\ble\s+labo\b/i,
    canonical: "Le Labo",
    category: "cosmetics",
    defaultPriceCents: 23500,
    sellerName: "Le Labo",
    sellerSearchUrl: (q) => `https://www.lelabofragrances.com/search.html?term=${encodeURIComponent(q)}`,
  },
  {
    pattern: /\bbyredo\b/i,
    canonical: "Byredo",
    category: "cosmetics",
    defaultPriceCents: 22500,
    sellerName: "Byredo",
    sellerSearchUrl: (q) => `https://www.byredo.com/us_en/catalogsearch/result/?q=${encodeURIComponent(q)}`,
  },
  {
    pattern: /\bdiptyque\b/i,
    canonical: "Diptyque",
    category: "cosmetics",
    defaultPriceCents: 17500,
    sellerName: "Diptyque",
    sellerSearchUrl: (q) => `https://www.diptyqueparis.com/en_us/catalogsearch/result/?q=${encodeURIComponent(q)}`,
  },
  {
    pattern: /\bla\s+roche[\s-]*posay\b/i,
    canonical: "La Roche-Posay",
    category: "cosmetics",
    defaultPriceCents: 2499,
    sellerName: "Dermstore",
    sellerSearchUrl: (q) => `https://www.dermstore.com/elysium.search?search=${encodeURIComponent(q)}`,
  },
  {
    pattern: /\bcerave\b/i,
    canonical: "CeraVe",
    category: "cosmetics",
    defaultPriceCents: 1699,
    sellerName: "Ulta Beauty",
    sellerSearchUrl: (q) => `https://www.ulta.com/search?search=${encodeURIComponent(q)}`,
  },
];

/**
 * Normalizes watch/product model numerals (e.g. "Explorer 2" -> "Explorer II")
 */
function normalizeWatchModelName(rawModel: string): string {
  return rawModel
    .replace(/\bexplorer\s*2\b/i, "Explorer II")
    .replace(/\bgmt[\s-]*master\s*2\b/i, "GMT-Master II")
    .replace(/\byacht[\s-]*master\s*2\b/i, "Yacht-Master II")
    .trim();
}

/**
 * LAYER 1A: Commercial SKU Detector & Facet Parser
 *
 * Detects commercial product queries (garments with colorways/SKUs, watches with reference codes,
 * electronics models, and cosmetics/fragrances) and extracts structured facets for Curio's
 * specialized product silhouettes.
 */
export function detectAndParseCommercialSku(query: string): CommercialSkuAnalysis | null {
  const trimmed = query.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return null;

  // Never hijack explicit cultural media queries
  if (
    /\b(?:movie|film|cinema|directed by|written by|book|novel|memoir|isbn|album|vinyl|song|symphony|recipe)\b/i.test(
      trimmed
    )
  ) {
    return null;
  }

  const lower = trimmed.toLowerCase();

  // ---------------------------------------------------------------------------
  // 1. Check Watch / Luxury Reference SKUs (e.g. "Rolex Explorer 2 226570" or "Rolex Explorer 2 xyz")
  // ---------------------------------------------------------------------------
  for (const brandSpec of WATCH_AND_LUXURY_BRANDS) {
    const brandMatch = trimmed.match(brandSpec.pattern);
    if (brandMatch) {
      let remainder = trimmed.replace(brandSpec.pattern, " ").replace(/\s+/g, " ").trim();
      let model = "";
      let estimatedPriceCents = brandSpec.defaultPriceCents;

      if (brandSpec.models) {
        for (const m of brandSpec.models) {
          const mMatch = remainder.match(m.pattern) || trimmed.match(m.pattern);
          if (mMatch) {
            model = m.canonical;
            if (m.priceCents) estimatedPriceCents = m.priceCents;
            remainder = remainder.replace(m.pattern, " ").replace(/\s+/g, " ").trim();
            break;
          }
        }
      }

      // Extract colourway if present in remainder
      let color: string | null = null;
      let colorHex: string | null = null;
      const remTokens = remainder.split(/\s+/).filter(Boolean);
      const nonColorTokens: string[] = [];

      for (const tok of remTokens) {
        const cleanTok = tok.toLowerCase().replace(/[^a-z0-9\-]/g, "");
        if (!color && COLOR_SWATCH_MAP[cleanTok]) {
          color = COLOR_SWATCH_MAP[cleanTok].label;
          colorHex = COLOR_SWATCH_MAP[cleanTok].hex;
        } else if (!/^(?:ref|reference|watch|model|sku)$/i.test(cleanTok)) {
          nonColorTokens.push(tok.replace(/^ref\.?/i, "").trim());
        }
      }

      let sku: string | null = null;
      let referenceCode: string | null = null;

      if (model) {
        // Any remaining token(s) after brand + known model is the reference/SKU code (e.g. "226570", "16570", "xyz")
        if (nonColorTokens.length > 0) {
          referenceCode = nonColorTokens.join(" ").trim();
          sku = referenceCode;
        }
      } else if (nonColorTokens.length > 0) {
        // Check if last token looks like a reference code
        const lastTok = nonColorTokens[nonColorTokens.length - 1];
        if (/\d/.test(lastTok) || (nonColorTokens.length >= 2 && lastTok.length <= 8)) {
          referenceCode = lastTok;
          sku = lastTok;
          model = normalizeWatchModelName(nonColorTokens.slice(0, -1).join(" "));
        } else {
          model = normalizeWatchModelName(nonColorTokens.join(" "));
        }
      }

      if (!model) {
        model = brandSpec.canonical;
      }

      const productLineQuery = `${brandSpec.canonical} ${model}`.trim();
      const canonicalTitle = referenceCode
        ? `${brandSpec.canonical} ${model} Ref. ${referenceCode}`
        : `${brandSpec.canonical} ${model}`;

      return {
        category: "watch_luxury",
        typePath: "/product",
        coreType: "PRODUCT",
        brand: brandSpec.canonical,
        model,
        productLineQuery,
        sku,
        referenceCode,
        color,
        colorHex,
        fit: null,
        material: null,
        weight: null,
        size: null,
        estimatedPriceCents,
        canonicalTitle,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Check Electronics Hardware SKUs
  // ---------------------------------------------------------------------------
  for (const elecSpec of ELECTRONICS_BRANDS) {
    if (elecSpec.pattern.test(trimmed)) {
      let remainder = trimmed.replace(elecSpec.pattern, " ").replace(/\s+/g, " ").trim();
      let model = remainder || elecSpec.canonical;
      let estimatedPriceCents = elecSpec.defaultPriceCents;

      if (elecSpec.models) {
        for (const m of elecSpec.models) {
          if (m.pattern.test(trimmed)) {
            model = m.canonical;
            if (m.priceCents) estimatedPriceCents = m.priceCents;
            remainder = remainder.replace(m.pattern, " ").replace(/\s+/g, " ").trim();
            break;
          }
        }
      }

      const sku = remainder && remainder !== model ? remainder : model;
      return {
        category: "electronics",
        typePath: "/product/electronics",
        coreType: "PRODUCT",
        brand: elecSpec.canonical,
        model,
        productLineQuery: `${elecSpec.canonical} ${model}`.trim(),
        sku,
        referenceCode: sku,
        color: null,
        colorHex: null,
        fit: null,
        material: null,
        weight: null,
        size: null,
        estimatedPriceCents,
        canonicalTitle: `${elecSpec.canonical} ${model}${remainder && remainder !== model ? ` (${remainder})` : ""}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Check Cosmetics & Fragrance SKUs
  // ---------------------------------------------------------------------------
  for (const cosSpec of COSMETICS_BRANDS) {
    if (cosSpec.pattern.test(trimmed)) {
      const remainder = trimmed.replace(cosSpec.pattern, " ").replace(/\s+/g, " ").trim();
      const model = remainder || "Signature Formulation";
      return {
        category: "cosmetics",
        typePath: "/product/cosmetics",
        coreType: "PRODUCT",
        brand: cosSpec.canonical,
        model,
        productLineQuery: `${cosSpec.canonical} ${model}`.trim(),
        sku: null,
        referenceCode: null,
        color: null,
        colorHex: null,
        fit: null,
        material: null,
        weight: null,
        size: null,
        estimatedPriceCents: cosSpec.defaultPriceCents,
        canonicalTitle: `${cosSpec.canonical} ${model}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Check Garment & Apparel SKUs (e.g. "Reiss tshirt mint xyz")
  // ---------------------------------------------------------------------------
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  let matchedGarmentKey: string | null = null;
  let garmentTokenIndex = -1;

  for (let i = 0; i < tokens.length; i++) {
    const cleanTok = tokens[i].toLowerCase().replace(/[^a-z\-]/g, "");
    if (GARMENT_TYPE_MAP[cleanTok]) {
      matchedGarmentKey = cleanTok;
      garmentTokenIndex = i;
      break;
    }
  }

  if (matchedGarmentKey && garmentTokenIndex !== -1) {
    const garmentSpec = GARMENT_TYPE_MAP[matchedGarmentKey];

    // Identify brand
    let brand: string | null = null;
    let workingQuery = trimmed;

    for (const b of KNOWN_FASHION_BRANDS) {
      if (b.pattern.test(workingQuery)) {
        brand = b.canonical;
        workingQuery = workingQuery.replace(b.pattern, " ").replace(/\s+/g, " ").trim();
        break;
      }
    }

    // If no known brand from dictionary, check if there are leading tokens before the garment noun
    if (!brand && garmentTokenIndex > 0) {
      const leadingTokens = tokens.slice(0, garmentTokenIndex).filter((t) => {
        const lt = t.toLowerCase();
        return !COLOR_SWATCH_MAP[lt] && !/^(?:slim|regular|oversized|relaxed|mens|womens|unisex)$/i.test(lt);
      });
      if (leadingTokens.length > 0) {
        brand = leadingTokens
          .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
          .join(" ");
      }
    }

    // Extract color, fit, material, size, and trailing SKU tokens
    let color: string | null = null;
    let colorHex: string | null = null;
    let fit: string | null = null;
    let material: string | null = null;
    let size: string | null = null;
    const leftoverSkuTokens: string[] = [];

    const remainingTokens = workingQuery.split(/\s+/).filter(Boolean);
    for (const rawTok of remainingTokens) {
      const cleanLower = rawTok.toLowerCase().replace(/[^a-z0-9\-]/g, "");
      if (!cleanLower) continue;

      // Skip the garment word itself
      if (cleanLower === matchedGarmentKey || GARMENT_TYPE_MAP[cleanLower]) {
        continue;
      }

      // Skip tokens that are part of the extracted brand
      if (brand && brand.toLowerCase().split(/\s+/).includes(cleanLower)) {
        continue;
      }

      // Colorway check
      if (!color && COLOR_SWATCH_MAP[cleanLower]) {
        color = COLOR_SWATCH_MAP[cleanLower].label;
        colorHex = COLOR_SWATCH_MAP[cleanLower].hex;
        continue;
      }

      // Fit check
      if (!fit && /^(?:slim|regular|oversized|relaxed|tailored|boxy)$/i.test(cleanLower)) {
        fit = cleanLower.charAt(0).toUpperCase() + cleanLower.slice(1);
        continue;
      }

      // Material check
      if (!material && /^(?:linen|cashmere|merino|wool|silk|cotton|denim|selvedge|corduroy|fleece|suede|leather)$/i.test(cleanLower)) {
        material = `100% ${cleanLower.charAt(0).toUpperCase() + cleanLower.slice(1)}`;
        continue;
      }

      // Size check
      if (!size && /^(?:xxs|xs|s|m|l|xl|xxl)$/i.test(cleanLower)) {
        size = cleanLower.toUpperCase();
        continue;
      }

      leftoverSkuTokens.push(rawTok);
    }

    // Require at least a brand, colorway, fit, material, or SKU token so a lone word like " Dress" isn't misclassified if ambiguous
    if (brand || color || fit || material || leftoverSkuTokens.length > 0) {
      const finalBrand = brand || "Atelier Curio";
      const sku = leftoverSkuTokens.length > 0 ? leftoverSkuTokens.join(" ") : null;
      const titleParts = [
        finalBrand !== "Atelier Curio" ? finalBrand : null,
        color,
        fit && fit !== "Regular" ? fit : null,
        garmentSpec.label,
      ].filter(Boolean);

      const baseTitle = titleParts.join(" ");
      const canonicalTitle = sku ? `${baseTitle} (${sku})` : baseTitle;

      return {
        category: "garment",
        typePath: "/product/garment",
        coreType: "PRODUCT",
        brand: finalBrand,
        model: garmentSpec.label,
        productLineQuery: `${finalBrand} ${garmentSpec.label}`.trim(),
        sku,
        referenceCode: sku,
        color: color || "Noir",
        colorHex: colorHex || "#2b2b2b",
        fit: fit || "Regular",
        material: material || garmentSpec.defaultMaterial,
        weight: garmentSpec.defaultWeight,
        size,
        estimatedPriceCents: garmentSpec.defaultPriceCents,
        canonicalTitle,
      };
    }
  }

  return null;
}

/**
 * LAYER 2 (Commercial): Hydrates a full EnrichmentPayload for a detected Commercial SKU.
 * Combines parsed SKU facets (brand, model, referenceCode, colorHex swatch, fit, material)
 * with optional Wikipedia/Wikidata product-line imagery & history.
 */
export async function resolveCommercialProduct(
  query: string,
  skuAnalysis: CommercialSkuAnalysis,
  options?: {
    fetchFn?: typeof fetch;
    wikiCandidate?: DiscoveredCandidate | null;
    runnerUpCandidates?: CandidateFallback[];
  }
): Promise<EnrichmentPayload> {
  const wiki = options?.wikiCandidate || null;
  const encodedQuery = encodeURIComponent(query.trim());

  // 1. Garment & Apparel Hydration (/product/garment -> GarmentCard)
  if (skuAnalysis.category === "garment") {
    const brandSlug = skuAnalysis.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const colorSlug = (skuAnalysis.color || "default").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const modelSlug = skuAnalysis.model.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const skuSlug = skuAnalysis.sku ? skuAnalysis.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "std";

    const canonicalExternalId = `sku:garment:${brandSlug}:${modelSlug}:${colorSlug}:${skuSlug}`;
    const canonicalUrl = `https://www.google.com/search?tbm=shop&q=${encodedQuery}`;

    const runnerUps: CandidateFallback[] = options?.runnerUpCandidates?.length
      ? options.runnerUpCandidates
      : [
          {
            title: `${skuAnalysis.brand} ${skuAnalysis.model} — Official Store`,
            url: `https://www.google.com/search?q=${encodeURIComponent(skuAnalysis.brand + " " + skuAnalysis.model + " official")}`,
            snippet: `Explore ${skuAnalysis.brand} seasonal collection, sizing guide, and fabric provenance`,
            coreType: "PRODUCT",
            typePath: "/product/garment",
            badgeLabel: "GARMENT",
          },
          {
            title: `${skuAnalysis.canonicalTitle} on Lyst`,
            url: `https://www.lyst.com/search/?q=${encodedQuery}`,
            snippet: `Compare stock and retail pricing across authorized luxury stockists`,
            coreType: "PRODUCT",
            typePath: "/product/garment",
            badgeLabel: "GARMENT",
          },
        ];

    return {
      title: skuAnalysis.canonicalTitle,
      summary:
        wiki?.snippet ||
        `${skuAnalysis.brand} ${skuAnalysis.color ? skuAnalysis.color + " " : ""}${skuAnalysis.model} crafted in ${skuAnalysis.material}${skuAnalysis.sku ? ` (Style / SKU: ${skuAnalysis.sku})` : ""}.`,
      heroImageUrl: wiki?.thumbnailUrl || null,
      coreType: "PRODUCT",
      typePath: "/product/garment",
      canonicalExternalId,
      canonicalUrl,
      brandOrCreator: skuAnalysis.brand,
      priceCents: skuAnalysis.estimatedPriceCents,
      currency: "USD",
      coreStructuredData: {
        brand: skuAnalysis.brand,
        model: skuAnalysis.model,
        sku: skuAnalysis.sku,
        referenceCode: skuAnalysis.referenceCode,
        color: skuAnalysis.color,
        colorHex: skuAnalysis.colorHex,
        fit: skuAnalysis.fit || "Regular",
        material: skuAnalysis.material,
        weight: skuAnalysis.weight,
        size: skuAnalysis.size,
        care: ["Wash 30°C", "Do Not Tumble Dry", "Cool Iron"],
        availability: "in_stock",
      },
      primarySource: {
        sellerName: skuAnalysis.brand,
        sourceUrl: canonicalUrl,
        priceCents: skuAnalysis.estimatedPriceCents,
        currency: "USD",
      },
      runnerUpCandidates: runnerUps,
    };
  }

  // 2. Watch & Luxury Reference SKU Hydration (/product -> ProductCard)
  if (skuAnalysis.category === "watch_luxury") {
    const brandSlug = skuAnalysis.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const modelSlug = skuAnalysis.model.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const refSlug = (skuAnalysis.referenceCode || "base").toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const canonicalExternalId = `sku:product:${brandSlug}:${modelSlug}:${refSlug}`;
    const chronoUrl = `https://www.chrono24.com/search/index.htm?query=${encodedQuery}`;

    const specsSummary = skuAnalysis.referenceCode
      ? `${skuAnalysis.model} • Ref. ${skuAnalysis.referenceCode}`
      : skuAnalysis.model;

    const runnerUps: CandidateFallback[] = [
      ...(options?.runnerUpCandidates || []),
      {
        title: `${skuAnalysis.brand} ${skuAnalysis.model} — WatchCharts Market Index`,
        url: `https://watchcharts.com/watches/search?q=${encodedQuery}`,
        snippet: `Secondary market pricing history and reference analytics for ${skuAnalysis.canonicalTitle}`,
        coreType: "PRODUCT",
        typePath: "/product",
        badgeLabel: "PRODUCT",
      },
    ];

    return {
      title: skuAnalysis.canonicalTitle,
      summary:
        wiki?.snippet ||
        `${skuAnalysis.brand} ${skuAnalysis.model}${skuAnalysis.referenceCode ? ` (Reference ${skuAnalysis.referenceCode})` : ""} — precision timepiece & collector reference.`,
      heroImageUrl: wiki?.thumbnailUrl || null,
      coreType: "PRODUCT",
      typePath: "/product",
      canonicalExternalId,
      canonicalUrl: chronoUrl,
      brandOrCreator: skuAnalysis.brand,
      priceCents: skuAnalysis.estimatedPriceCents,
      currency: "USD",
      coreStructuredData: {
        brand: skuAnalysis.brand,
        model: skuAnalysis.model,
        sku: skuAnalysis.sku,
        referenceCode: skuAnalysis.referenceCode,
        color: skuAnalysis.color,
        colorHex: skuAnalysis.colorHex,
        specsSummary,
        availability: "in_stock",
        wikidataUri: wiki?.conceptUri || null,
      },
      primarySource: {
        sellerName: "Chrono24",
        sourceUrl: chronoUrl,
        priceCents: skuAnalysis.estimatedPriceCents,
        currency: "USD",
      },
      runnerUpCandidates: runnerUps.slice(0, 3),
    };
  }

  // 3. Electronics Hardware SKU Hydration (/product/electronics -> ElectronicsCard)
  if (skuAnalysis.category === "electronics") {
    const brandSlug = skuAnalysis.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const modelSlug = skuAnalysis.model.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const canonicalExternalId = `sku:electronics:${brandSlug}:${modelSlug}`;
    const sourceUrl = `https://www.bhphotovideo.com/c/search?Ntt=${encodedQuery}`;

    return {
      title: skuAnalysis.canonicalTitle,
      summary: wiki?.snippet || `${skuAnalysis.brand} ${skuAnalysis.model} hardware specification.`,
      heroImageUrl: wiki?.thumbnailUrl || null,
      coreType: "PRODUCT",
      typePath: "/product/electronics",
      canonicalExternalId,
      canonicalUrl: sourceUrl,
      brandOrCreator: skuAnalysis.brand,
      priceCents: skuAnalysis.estimatedPriceCents,
      currency: "USD",
      coreStructuredData: {
        brand: skuAnalysis.brand,
        model: skuAnalysis.model,
        sku: skuAnalysis.sku,
        referenceCode: skuAnalysis.referenceCode,
        specsSummary: `${skuAnalysis.brand} ${skuAnalysis.model}`,
        availability: "in_stock",
      },
      primarySource: {
        sellerName: "B&H Photo",
        sourceUrl,
        priceCents: skuAnalysis.estimatedPriceCents,
        currency: "USD",
      },
      runnerUpCandidates: options?.runnerUpCandidates || [],
    };
  }

  // 4. Cosmetics & Fragrance Hydration (/product/cosmetics -> CosmeticsCard)
  const brandSlug = skuAnalysis.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const modelSlug = skuAnalysis.model.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const canonicalExternalId = `sku:cosmetics:${brandSlug}:${modelSlug}`;
  const sourceUrl = `https://www.google.com/search?tbm=shop&q=${encodedQuery}`;

  return {
    title: skuAnalysis.canonicalTitle,
    summary: wiki?.snippet || `${skuAnalysis.brand} ${skuAnalysis.model} botanical & dermatological formulation.`,
    heroImageUrl: wiki?.thumbnailUrl || null,
    coreType: "PRODUCT",
    typePath: "/product/cosmetics",
    canonicalExternalId,
    canonicalUrl: sourceUrl,
    brandOrCreator: skuAnalysis.brand,
    priceCents: skuAnalysis.estimatedPriceCents,
    currency: "USD",
    coreStructuredData: {
      brand: skuAnalysis.brand,
      model: skuAnalysis.model,
      sku: skuAnalysis.sku,
      shade: skuAnalysis.color || "Botanical Blend",
      shadeHex: skuAnalysis.colorHex || "#d8a47f",
      volume: "50 ml / 1.7 fl. oz.",
      cleanBadge: "Clean & Cruelty-Free",
      skinTypes: ["All Skin Types", "Sensitive"],
      availability: "in_stock",
    },
    primarySource: {
      sellerName: skuAnalysis.brand,
      sourceUrl,
      priceCents: skuAnalysis.estimatedPriceCents,
      currency: "USD",
    },
    runnerUpCandidates: options?.runnerUpCandidates || [],
  };
}
