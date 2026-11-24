import type { CardData } from "@/components/cards/PolymorphicCard";

export type PhysicalArchetypeId =
  | "book_hardcover"
  | "media_case"
  | "vinyl_sleeve"
  | "archival_box"
  | "linen_folio";

export interface PressPalette {
  id: string;
  surface: string;
  surfaceSecondary: string;
  ink: string;
  muted: string;
  accent: string;
  rule: string;
  coverBg: string;
  coverInk: string;
}

export interface ArchetypeSpec {
  id: PhysicalArchetypeId;
  label: string;
  widthRatio: number;
  heightRatio: number;
  depthRatio: number;
  shelfPx: { width: number; height: number; thickness: number };
  hasPageBlock: boolean;
  hasPeekingDisc: boolean;
  materialKind: "buckram" | "satin" | "matte_vinyl" | "paperboard" | "linen";
}

export const ARCHETYPE_SPECS: Record<PhysicalArchetypeId, ArchetypeSpec> = {
  book_hardcover: {
    id: "book_hardcover",
    label: "Hardcover",
    widthRatio: 1,
    heightRatio: 1.45,
    depthRatio: 0.18,
    shelfPx: { width: 170, height: 246, thickness: 32 },
    hasPageBlock: true,
    hasPeekingDisc: false,
    materialKind: "buckram",
  },
  media_case: {
    id: "media_case",
    label: "Edition Case",
    widthRatio: 1,
    heightRatio: 1.38,
    depthRatio: 0.1,
    shelfPx: { width: 168, height: 232, thickness: 22 },
    hasPageBlock: false,
    hasPeekingDisc: false,
    materialKind: "satin",
  },
  vinyl_sleeve: {
    id: "vinyl_sleeve",
    label: "LP Sleeve",
    widthRatio: 1,
    heightRatio: 1.0,
    depthRatio: 0.05,
    shelfPx: { width: 204, height: 204, thickness: 16 },
    hasPageBlock: false,
    hasPeekingDisc: true,
    materialKind: "matte_vinyl",
  },
  archival_box: {
    id: "archival_box",
    label: "Archival Box",
    widthRatio: 1,
    heightRatio: 1.22,
    depthRatio: 0.24,
    shelfPx: { width: 178, height: 218, thickness: 40 },
    hasPageBlock: false,
    hasPeekingDisc: false,
    materialKind: "paperboard",
  },
  linen_folio: {
    id: "linen_folio",
    label: "Linen Folio",
    widthRatio: 1,
    heightRatio: 1.3,
    depthRatio: 0.12,
    shelfPx: { width: 172, height: 224, thickness: 24 },
    hasPageBlock: true,
    hasPeekingDisc: false,
    materialKind: "linen",
  },
};

export const CURATED_CLOTH_PALETTES: readonly PressPalette[] = [
  {
    id: "olive",
    surface: "#2C3227",
    surfaceSecondary: "#23281F",
    ink: "#F2ECD9",
    muted: "#C4CCB6",
    accent: "#E3C16F",
    rule: "#4B5342",
    coverBg: "#3D4536",
    coverInk: "#E8CB7D",
  },
  {
    id: "oxblood",
    surface: "#3B171B",
    surfaceSecondary: "#2D1114",
    ink: "#F7EBE3",
    muted: "#D9B9B9",
    accent: "#F0B98D",
    rule: "#642D33",
    coverBg: "#5B2127",
    coverInk: "#F6E7DC",
  },
  {
    id: "slate",
    surface: "#1D2631",
    surfaceSecondary: "#161D26",
    ink: "#EDF2F7",
    muted: "#B5C3D2",
    accent: "#99BEEC",
    rule: "#37475B",
    coverBg: "#293647",
    coverInk: "#EDF2F7",
  },
  {
    id: "terracotta",
    surface: "#4B2315",
    surfaceSecondary: "#3A1B10",
    ink: "#FAF2EA",
    muted: "#E3C2B0",
    accent: "#F6CE95",
    rule: "#753A26",
    coverBg: "#8B4227",
    coverInk: "#FAF2EA",
  },
  {
    id: "forest",
    surface: "#152B27",
    surfaceSecondary: "#10211E",
    ink: "#EAF2EC",
    muted: "#B2CDC4",
    accent: "#9ED9B6",
    rule: "#2D4D46",
    coverBg: "#1F3F39",
    coverInk: "#EAF2EC",
  },
  {
    id: "charcoal",
    surface: "#1D1E20",
    surfaceSecondary: "#151618",
    ink: "#F2EFE9",
    muted: "#BAB7B0",
    accent: "#DFBF74",
    rule: "#393B3F",
    coverBg: "#2A2B2E",
    coverInk: "#F2EFE9",
  },
  {
    id: "indigo",
    surface: "#1B1F38",
    surfaceSecondary: "#14172B",
    ink: "#EEF0FA",
    muted: "#BAC1E0",
    accent: "#A4BBFA",
    rule: "#363D69",
    coverBg: "#262C4F",
    coverInk: "#EEF0FA",
  },
  {
    id: "ochre",
    surface: "#422E12",
    surfaceSecondary: "#33240D",
    ink: "#FBF5E8",
    muted: "#E0CCA4",
    accent: "#F7D88A",
    rule: "#6B4E23",
    coverBg: "#6E4E1E",
    coverInk: "#FBF5E8",
  },
];

export function detectNormalizedArchetype(card: CardData, overrideArchetype?: string): PhysicalArchetypeId {
  const raw = (overrideArchetype || "").toLowerCase();
  const typePath = (card.entity?.typePath || card.save.typePath || "").toLowerCase();
  const coreType = (card.entity?.coreType || "").toUpperCase();
  const tags = (card.save.autoTags || []).map((t) => String(t).toLowerCase());
  const probe = `${raw} ${typePath} ${coreType.toLowerCase()} ${tags.join(" ")}`;

  if (raw === "vinyl" || raw === "album" || raw === "song" || probe.includes("vinyl") || probe.includes("music") || probe.includes("album")) {
    return "vinyl_sleeve";
  }
  if (
    raw === "cinema" ||
    raw === "videogame" ||
    raw === "art" ||
    raw === "photo" ||
    probe.includes("film") ||
    probe.includes("movie") ||
    probe.includes("videogame") ||
    probe.includes("game") ||
    coreType === "MEDIA" ||
    probe.includes("/media/image") ||
    typePath.includes("/art")
  ) {
    return "media_case";
  }
  if (
    raw === "book" ||
    raw === "quote" ||
    raw === "memo" ||
    raw === "private_memo" ||
    probe.includes("book") ||
    probe.includes("quote") ||
    coreType === "BOOK" ||
    coreType === "QUOTE" ||
    card.save.isPrivateMemo
  ) {
    return "book_hardcover";
  }
  if (
    raw === "recipe" ||
    raw === "place" ||
    raw === "place_spot" ||
    raw === "checklist" ||
    raw === "travel" ||
    raw === "link" ||
    raw === "wine" ||
    raw === "creator" ||
    coreType === "CULINARY" ||
    coreType === "PLACE" ||
    coreType === "TRAVEL" ||
    coreType === "LINK" ||
    probe.includes("recipe") ||
    probe.includes("place") ||
    probe.includes("wine") ||
    probe.includes("travel")
  ) {
    return "linen_folio";
  }
  if (
    raw === "product" ||
    raw === "garment" ||
    raw === "outfit" ||
    raw === "cosmetics" ||
    raw === "electronics" ||
    raw === "watch" ||
    raw === "furniture" ||
    coreType === "PRODUCT" ||
    typePath.startsWith("/product") ||
    typePath.startsWith("/style") ||
    /\b(furniture|sofa|chair|table|lamp|desk|rug|decor|appliance|camera|tripod|espresso)\b/.test(probe)
  ) {
    return "archival_box";
  }
  return "linen_folio";
}

export function getArchetypeSpec(card: CardData, overrideArchetype?: string): ArchetypeSpec {
  return ARCHETYPE_SPECS[detectNormalizedArchetype(card, overrideArchetype)];
}

export function hashString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getDeterministicClothPalette(card: CardData, overrideArchetype?: string): PressPalette {
  const arch = detectNormalizedArchetype(card, overrideArchetype);
  const seed = `${arch}:${card.entity?.id || card.save.id}:${card.entity?.brandOrCreator || ""}`;
  return CURATED_CLOTH_PALETTES[hashString(seed) % CURATED_CLOTH_PALETTES.length];
}

export function resolveSameOriginImageUrl(rawUrl?: string | null): string | null {
  const s = (rawUrl || "").trim();
  if (!s) return null;
  if (s.startsWith("/curio/")) return s;
  if (s.startsWith("/api/")) return `/curio${s}`;
  if (s.startsWith("https://")) {
    return `/curio/api/v1/media/proxy?url=${encodeURIComponent(s)}`;
  }
  return null;
}

export interface SpineMeta {
  title: string;
  creator: string;
  yearOrPrice: string;
  subtitle: string;
  isWishlist?: boolean;
}

export function formatSpineMeta(card: CardData): SpineMeta {
  const e = card.entity;
  const title = (card.save.privateTitle || e?.title || "Untitled Curio").trim();
  const csd = (e?.coreStructuredData && typeof e.coreStructuredData === "object"
    ? e.coreStructuredData
    : {}) as Record<string, any>;

  const creator = String(
    e?.brandOrCreator || csd.author || csd.director || csd.artist || csd.brand || e?.coreType || "Curio"
  ).trim();

  let yearOrPrice = "";
  if (csd.year || csd.releaseYear) {
    yearOrPrice = String(csd.year || csd.releaseYear);
  } else if (typeof e?.priceCents === "number" && e.priceCents > 0) {
    const curr = (e.currency || "CHF").toUpperCase();
    yearOrPrice = `${curr} ${(e.priceCents / 100).toFixed(0)}`;
  } else if (card.save.createdAt) {
    const dt = new Date(card.save.createdAt);
    if (!Number.isNaN(dt.getTime())) yearOrPrice = String(dt.getFullYear());
  }

  const subtitle = (e?.summary || card.save.personalNotes || "").trim().slice(0, 140);
  return { title, creator, yearOrPrice, subtitle, isWishlist: Boolean(card.save.wishlist) };
}
