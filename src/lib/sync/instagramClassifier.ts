import { z } from "zod";
import { generateJsonCompletion, isLocalLlmDisabled } from "@/lib/llm/client";
import type { InstagramSavedPost } from "./instagramClient";

export const CANONICAL_IG_TYPE_MAP = {
  "/place": "PLACE",
  "/culinary/recipe": "CULINARY",
  "/product/book": "BOOK",
  "/media/film": "MEDIA",
  "/media/music/vinyl": "MEDIA",
  "/media/music/song": "MEDIA",
  "/media/videogame": "MEDIA",
  "/product": "PRODUCT",
  "/product/garment": "PRODUCT",
  "/product/electronics": "PRODUCT",
  "/product/watch": "PRODUCT",
  "/product/cosmetics": "PRODUCT",
  "/product/beverage/wine": "PRODUCT",
  "/product/art": "PRODUCT",
  "/style/outfit": "PRODUCT",
  "/quote": "MEMO",
  "/link": "LINK",
  "/media/image": "MEDIA",
} as const;

export type CanonicalIgTypePath = keyof typeof CANONICAL_IG_TYPE_MAP;

const ALLOWED_TYPE_PATHS = Object.keys(CANONICAL_IG_TYPE_MAP) as [
  CanonicalIgTypePath,
  ...CanonicalIgTypePath[],
];

const LlmClassificationSchema = z.object({
  typePath: z.enum(ALLOWED_TYPE_PATHS).default("/media/image"),
  title: z.string().min(1).max(140),
  brandOrCreator: z.string().max(100).nullable().optional(),
  summary: z.string().max(400).nullable().optional(),
  tags: z.array(z.string().max(40)).max(10).default([]),
  suggestedBoardSlug: z.string().max(80).nullable().optional(),
  structuredFields: z.record(z.string(), z.unknown()).optional(),
});

export interface ClassifiedInstagramPost {
  coreType: string;
  typePath: CanonicalIgTypePath;
  title: string;
  brandOrCreator: string | null;
  summary: string | null;
  tags: string[];
  wishlist: boolean;
  suggestedBoardSlug: string | null;
  coreStructuredData: Record<string, unknown>;
  usedLlm: boolean;
}

export interface UserBoardHint {
  slug: string;
  title: string;
}

const RESERVED_CLOSET_TAGS = new Set(["closet", "outfit", "wardrobe", "owned"]);

function cleanTitleFromCaption(post: InstagramSavedPost): string {
  const firstLine = post.caption
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("#") && !/^https?:\/\//i.test(l));
  if (firstLine) {
    const cleaned = firstLine.replace(/https?:\/\/\S+/gi, "").trim();
    if (cleaned.length >= 4) {
      return cleaned.length > 96 ? `${cleaned.slice(0, 93).trim()}...` : cleaned;
    }
  }
  if (post.location?.name) {
    return `${post.location.name} (@${post.authorUsername})`;
  }
  return `Saved post by @${post.authorUsername}`;
}

function normalizeTags(
  rawTags: string[],
  typePath: CanonicalIgTypePath,
  collections: Array<{ name: string }>
): string[] {
  const seen = new Map<string, string>();
  const addTag = (raw: string) => {
    const clean = raw.trim().replace(/^#+/, "").toLowerCase();
    if (!clean || clean.length > 36) return;
    if (RESERVED_CLOSET_TAGS.has(clean)) return;
    if (!seen.has(clean)) seen.set(clean, clean);
  };

  addTag("instagram");
  if (typePath === "/culinary/recipe") {
    addTag("recipe");
  }
  for (const col of collections) {
    addTag(col.name);
  }
  for (const t of rawTags) {
    addTag(t);
  }
  return [...seen.values()].slice(0, 12);
}

function buildStructuredFields(
  post: InstagramSavedPost,
  typePath: CanonicalIgTypePath,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(extra || {}) };
  if (post.location) {
    if (!out.location) out.location = post.location.name;
    if (post.location.city && !out.city) out.city = post.location.city;
    if (post.location.address && !out.address) out.address = post.location.address;
    if (
      typeof post.location.lat === "number" &&
      typeof post.location.lng === "number" &&
      !out.coordinates
    ) {
      out.coordinates = { lat: post.location.lat, lng: post.location.lng };
    }
  }
  if (post.audioTitle && (typePath.startsWith("/media/music") || typePath === "/media/film")) {
    if (!out.audioTitle) out.audioTitle = post.audioTitle;
    if (post.audioArtist && !out.audioArtist) out.audioArtist = post.audioArtist;
  }
  if (typePath === "/quote" && !out.text && post.caption) {
    out.text = post.caption.slice(0, 400);
    if (!out.author) out.author = post.authorFullName || `@${post.authorUsername}`;
  }
  if (typePath === "/link" && post.externalLinks.length > 0 && !out.url) {
    out.url = post.externalLinks[0];
  }
  return out;
}

function findMatchingUserBoard(
  text: string,
  userBoards: UserBoardHint[]
): string | null {
  const lower = text.toLowerCase();
  for (const b of userBoards) {
    const titleLower = b.title.toLowerCase().trim();
    const slugLower = b.slug.toLowerCase().trim();
    if (titleLower.length >= 4 && lower.includes(titleLower)) {
      return b.slug;
    }
    if (slugLower.length >= 4 && lower.includes(slugLower.replace(/-/g, " "))) {
      return b.slug;
    }
  }
  return null;
}

/**
 * Deterministic fallback classifier when Ollama is disabled or unreachable.
 */
export function classifyInstagramPostHeuristic(
  post: InstagramSavedPost,
  userBoards: UserBoardHint[] = []
): ClassifiedInstagramPost {
  const colNames = post.collections.map((c) => c.name).join(" ");
  const linksJoined = post.externalLinks.join(" ");
  const probe = `${colNames} ${post.caption} ${post.location?.name || ""} ${linksJoined}`.toLowerCase();

  let typePath: CanonicalIgTypePath = "/media/image";

  if (/\b(letterboxd\.com|imdb\.com|themoviedb\.org)\b/.test(probe) || /\b(film|movie|cinema|pelicula|película|director|cine)\b/.test(probe)) {
    typePath = "/media/film";
  } else if (/\b(goodreads\.com|openlibrary\.org|bookshop\.org)\b/.test(probe) || /\b(book|novel|reading|isbn|libro|lectura)\b/.test(probe)) {
    typePath = "/product/book";
  } else if (/\b(recipe|recipes|receta|recetas|ingredients|ingredientes|tbsp|tsp|preheat|hornear|cocinar|pasta|salsa)\b/.test(probe)) {
    typePath = "/culinary/recipe";
  } else if (/\b(open\.spotify\.com|bandcamp\.com|discogs\.com|music\.apple\.com)\b/.test(probe) || /\b(vinyl|album|lp|tracklist|concert)\b/.test(probe)) {
    typePath = "/media/music/vinyl";
  } else if (/\b(wine|vino|bodega|cuvee|cuvée|vintage|sommelier|tempranillo|ribera|rioja|burgundy)\b/.test(probe)) {
    typePath = "/product/beverage/wine";
  } else if (/\b(watch|horology|caliber|rolex|omega|seiko|cartier|patek|tudor)\b/.test(probe)) {
    typePath = "/product/watch";
  } else if (/\b(outfit|lookbook|menswear|streetwear|fitcheck|ootd)\b/.test(probe)) {
    typePath = "/style/outfit";
  } else if (/\b(jacket|coat|sneaker|boots|trousers|shirt|sweater|hoodie|selvedge|garment|chaqueta|abrigo|zapatillas)\b/.test(probe)) {
    typePath = "/product/garment";
  } else if (/\b(maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl)\b/.test(probe) || Boolean(post.location?.name) || /\b(restaurant|restaurante|cafe|café|hotel|bar|bistro|museum|museo|travel|viaje)\b/.test(probe)) {
    typePath = "/place";
  } else if (/\b(quote|quotes|cita|citas|maxim|stoic|philosophy)\b/.test(probe)) {
    typePath = "/quote";
  } else if (/\b(steam|nintendo|playstation|ps5|videogame|rpg|indie game)\b/.test(probe)) {
    typePath = "/media/videogame";
  } else if (/\b(exhibition|gallery|painting|sculpture|print|poster|fine art|arte)\b/.test(probe)) {
    typePath = "/product/art";
  } else if (/\b(camera|lens|keyboard|headphones|speaker|monitor|espresso machine|tech|gadget)\b/.test(probe)) {
    typePath = "/product/electronics";
  } else if (post.externalLinks.length > 0 && !/\b(youtube\.com|youtu\.be)\b/.test(probe)) {
    typePath = "/link";
  }

  const coreType = CANONICAL_IG_TYPE_MAP[typePath];
  const wishlist = coreType === "PRODUCT";
  const suggestedBoardSlug = findMatchingUserBoard(probe, userBoards);
  const hashtags = (post.caption.match(/#[a-zA-Z0-9_\u00C0-\u024F]+/g) || []).slice(0, 6);

  return {
    coreType,
    typePath,
    title: cleanTitleFromCaption(post),
    brandOrCreator: post.authorFullName || `@${post.authorUsername}`,
    summary: post.caption ? post.caption.slice(0, 280).trim() : null,
    tags: normalizeTags(hashtags, typePath, post.collections),
    wishlist,
    suggestedBoardSlug,
    coreStructuredData: buildStructuredFields(post, typePath),
    usedLlm: false,
  };
}

/**
 * Classifies an Instagram saved post using local Ollama (`gemma4:12b-it-qat`),
 * falling back cleanly to deterministic heuristics if Ollama is unavailable.
 */
export async function classifyInstagramPost(
  post: InstagramSavedPost,
  userBoards: UserBoardHint[] = []
): Promise<ClassifiedInstagramPost> {
  if (isLocalLlmDisabled()) {
    return classifyInstagramPostHeuristic(post, userBoards);
  }

  const allowedBoardSlugs = new Set(userBoards.map((b) => b.slug));
  const boardListText =
    userBoards.length > 0
      ? userBoards.map((b) => `- "${b.slug}" (${b.title})`).join("\n")
      : "None";

  const systemPrompt = `You are Curio's cultural taxonomy classifier. Classify an Instagram saved post into exactly one canonical typePath and extract clean metadata as JSON.

Allowed typePath values:
- "/place": restaurants, cafes, bars, hotels, cities, parks, travel spots, museums
- "/culinary/recipe": recipes, cooking tutorials, cocktails, food preparation
- "/product/book": books, novels, essays, publications
- "/media/film": movies, cinema, directors, documentaries, series
- "/media/music/vinyl" or "/media/music/song": albums, vinyl records, songs, concerts
- "/media/videogame": video games
- "/product": general physical objects, home goods, furniture, gear
- "/product/garment": clothing, footwear, accessories
- "/style/outfit": complete outfits, lookbooks, styling inspiration
- "/product/electronics": gadgets, cameras, audio gear, keyboards
- "/product/watch": watches, horology
- "/product/cosmetics": skincare, fragrances, grooming
- "/product/beverage/wine": wine, spirits, specialty coffee
- "/product/art": art, prints, architecture, posters, photography books
- "/quote": memorable quotes, text slides, passages
- "/link": essays, tools, websites, newsletters with an external URL
- "/media/image": visual inspiration, memes, Reels, or general photography when no specific domain fits

Rules:
1. Respond with valid JSON ONLY matching: {"typePath": string, "title": string, "brandOrCreator": string|null, "summary": string|null, "tags": string[], "suggestedBoardSlug": string|null, "structuredFields": object}.
2. Keep "title" concise (<= 90 chars), descriptive, without hashtags or URLs.
3. Never use tags "closet", "outfit", "wardrobe", or "owned".
4. Only set "suggestedBoardSlug" if one of the user's manual boards clearly matches the topic, otherwise null.`;

  const promptPayload = {
    author: `@${post.authorUsername}${post.authorFullName ? ` (${post.authorFullName})` : ""}`,
    mediaType: post.mediaType,
    collections: post.collections.map((c) => c.name),
    location: post.location,
    audio: post.audioTitle ? `${post.audioTitle}${post.audioArtist ? ` - ${post.audioArtist}` : ""}` : null,
    externalLinks: post.externalLinks.slice(0, 5),
    caption: post.caption.slice(0, 1800),
    accessibilityCaption: post.accessibilityCaption ? post.accessibilityCaption.slice(0, 400) : null,
    userManualBoards: boardListText,
  };

  try {
    const raw = await generateJsonCompletion<unknown>(
      `Classify this saved Instagram post:\n${JSON.stringify(promptPayload, null, 2)}`,
      systemPrompt,
      { temperature: 0.1, timeoutMs: 90_000 }
    );
    if (!raw) {
      return classifyInstagramPostHeuristic(post, userBoards);
    }

    const parsed = LlmClassificationSchema.safeParse(raw);
    if (!parsed.success) {
      return classifyInstagramPostHeuristic(post, userBoards);
    }

    const data = parsed.data;
    const typePath = data.typePath;
    const coreType = CANONICAL_IG_TYPE_MAP[typePath];
    const wishlist = coreType === "PRODUCT";
    const suggestedBoardSlug =
      data.suggestedBoardSlug && allowedBoardSlugs.has(data.suggestedBoardSlug)
        ? data.suggestedBoardSlug
        : null;

    return {
      coreType,
      typePath,
      title: data.title.trim() || cleanTitleFromCaption(post),
      brandOrCreator:
        data.brandOrCreator?.trim() || post.authorFullName || `@${post.authorUsername}`,
      summary: data.summary?.trim() || (post.caption ? post.caption.slice(0, 280).trim() : null),
      tags: normalizeTags(data.tags, typePath, post.collections),
      wishlist,
      suggestedBoardSlug,
      coreStructuredData: buildStructuredFields(post, typePath, data.structuredFields),
      usedLlm: true,
    };
  } catch {
    return classifyInstagramPostHeuristic(post, userBoards);
  }
}
