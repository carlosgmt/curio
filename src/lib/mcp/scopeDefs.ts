export type McpDomainId =
  | "books"
  | "films"
  | "music"
  | "recipes"
  | "places"
  | "closet"
  | "myStuff"
  | "privateMemos";

export interface McpDomainMeta {
  id: McpDomainId;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export const MCP_DOMAIN_DEFS: readonly McpDomainMeta[] = [
  {
    id: "books",
    label: "Books",
    description: "Reading log, Goodreads & bookshop editions",
    defaultEnabled: true,
  },
  {
    id: "films",
    label: "Films",
    description: "Cinema archive, Letterboxd & FilmAffinity logs",
    defaultEnabled: true,
  },
  {
    id: "music",
    label: "Music",
    description: "Vinyl sleeves, albums & tracks",
    defaultEnabled: true,
  },
  {
    id: "recipes",
    label: "Recipes",
    description: "Kitchen repertoire & Chef UI notes",
    defaultEnabled: true,
  },
  {
    id: "places",
    label: "Places",
    description: "Saved cafes, restaurants & travel spots",
    defaultEnabled: true,
  },
  {
    id: "closet",
    label: "Closet",
    description: "Wardrobe garments, outfits & wear logs",
    defaultEnabled: false,
  },
  {
    id: "myStuff",
    label: "My Stuff",
    description: "Owned household inventory & Purchase Hub receipts",
    defaultEnabled: false,
  },
  {
    id: "privateMemos",
    label: "Private Memos",
    description: "Encrypted & local-only private notes",
    defaultEnabled: false,
  },
] as const;

export type McpScopeMap = Record<McpDomainId, boolean>;

export const DEFAULT_MCP_SCOPES: McpScopeMap = {
  books: true,
  films: true,
  music: true,
  recipes: true,
  places: true,
  closet: false,
  myStuff: false,
  privateMemos: false,
};

export function resolveItemMcpDomain(params: {
  typePath?: string | null;
  coreType?: string | null;
  isPrivateMemo?: boolean | null;
  tags?: unknown;
  extendedAttributes?: unknown;
}): McpDomainId | null {
  const p = (params.typePath || "").toLowerCase();
  const c = (params.coreType || "").toUpperCase();
  const ext =
    params.extendedAttributes && typeof params.extendedAttributes === "object"
      ? (params.extendedAttributes as Record<string, any>)
      : {};
  const tagList = Array.isArray(params.tags)
    ? params.tags.map((t) => String(t).toLowerCase())
    : [];

  if (params.isPrivateMemo || p.startsWith("/private") || p === "/memo" || c === "PRIVATE_MEMO") {
    return "privateMemos";
  }
  if (
    ext.source === "closet" ||
    ext.closetId ||
    p.startsWith("/product/garment") ||
    p.startsWith("/style/outfit") ||
    tagList.includes("closet") ||
    tagList.includes("wear-log")
  ) {
    return "closet";
  }
  if (ext.purchaseHubProductId || ext.source === "purchase-hub" || tagList.includes("my-stuff")) {
    return "myStuff";
  }
  if (p.startsWith("/media/music") || p.includes("vinyl") || c === "VINYL" || c === "MUSIC") {
    return "music";
  }
  if (p.startsWith("/media/film") || c === "MEDIA") {
    return "films";
  }
  if (p.startsWith("/product/book") || c === "BOOK") {
    return "books";
  }
  if (p.startsWith("/culinary") || p.includes("recipe") || c === "CULINARY") {
    return "recipes";
  }
  if (p.startsWith("/place") || c === "PLACE") {
    return "places";
  }
  return null;
}

export function resolveBoardMcpDomain(slug: string): McpDomainId | null {
  const s = slug.toLowerCase();
  if (s === "books" || s.startsWith("books-")) return "books";
  if (s === "films" || s.startsWith("films-")) return "films";
  if (s === "music" || s.startsWith("music-")) return "music";
  if (s === "recipes" || s.startsWith("recipes-")) return "recipes";
  if (s === "places" || s === "granada" || s.startsWith("places-")) return "places";
  if (s === "closet" || s === "wardrobe" || s === "outfits" || s.startsWith("closet-")) {
    return "closet";
  }
  if (s === "my-stuff" || s.startsWith("my-stuff-")) return "myStuff";
  if (s === "private" || s === "memos" || s.startsWith("private-")) return "privateMemos";
  return null;
}
