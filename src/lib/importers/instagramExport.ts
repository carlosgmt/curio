import type { SyncFetchFn, SyncRunResult } from "@/lib/sync/engine";
import {
  buildInstagramPermalink,
  extractExternalLinks,
  fetchInstagramPostByShortcode,
  type InstagramCollection,
  type InstagramSavedPost,
} from "@/lib/sync/instagramClient";
import { getInstagramAuthRecord } from "@/lib/sync/instagramAuthStore";
import { instagramSyncAdapter, slugifyCollectionName } from "@/lib/sync/instagram";

/**
 * Meta Data Export JSON encodes UTF-8 characters as Latin-1 escape sequences
 * (e.g. "\u00c3\u00a1" -> "á", "\u00f0\u009f..." -> emoji).
 * Decodes mojibake cleanly while leaving already-valid UTF-8 strings intact.
 */
export function decodeMetaMojibake(input: string): string {
  if (!input) return "";
  // Only attempt re-decoding if characters fall exclusively in the Latin-1 byte range
  // and contain typical UTF-8 lead bytes (0xC2..0xF4).
  if (!/[\u00c2-\u00f4][\u0080-\u00bf]/.test(input)) {
    return input;
  }
  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) > 0xff) {
      return input;
    }
  }
  try {
    const bytes = Uint8Array.from(input, (ch) => ch.charCodeAt(0));
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded;
  } catch {
    return input;
  }
}

function extractShortcodeFromUrl(rawUrl: string): {
  shortcode: string;
  isReel: boolean;
} | null {
  const m = rawUrl.match(/instagram\.com\/(?:(reel|reels|p|tv)\/)([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  return {
    shortcode: m[2],
    isReel: kind === "reel" || kind === "reels",
  };
}

function parseTimestamp(
  stringMap: Record<string, any> | undefined
): string | null {
  const savedOn = stringMap?.["Saved on"] || stringMap?.["Saved On"];
  if (!savedOn || typeof savedOn !== "object") return null;
  if (typeof savedOn.timestamp === "number" && savedOn.timestamp > 0) {
    return new Date(savedOn.timestamp * 1000).toISOString();
  }
  if (typeof savedOn.value === "string" && savedOn.value.trim()) {
    const parsed = Date.parse(savedOn.value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function parseEntryNode(
  node: Record<string, any>,
  collection?: InstagramCollection
): InstagramSavedPost | null {
  const sm = (node.string_map_data && typeof node.string_map_data === "object"
    ? node.string_map_data
    : {}) as Record<string, any>;

  const savedOn = sm["Saved on"] || sm["Saved On"] || {};
  const authorObj = sm["Author"] || sm["Shared by"] || {};

  const rawTitle = decodeMetaMojibake(String(node.title || ""));
  const candidateHref = String(savedOn.href || rawTitle || "").trim();
  const parsedUrl = extractShortcodeFromUrl(candidateHref);
  if (!parsedUrl) return null;

  const authorRaw = decodeMetaMojibake(
    String(authorObj.value || rawTitle || "instagram")
  )
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .trim();

  const authorUsername =
    authorRaw && !authorRaw.includes("/") && !authorRaw.includes(" ")
      ? authorRaw
      : "instagram";

  const captionNote =
    rawTitle && !/^https?:\/\//i.test(rawTitle) ? rawTitle : "";

  return {
    shortcode: parsedUrl.shortcode,
    mediaPk: parsedUrl.shortcode,
    permalink: buildInstagramPermalink(
      parsedUrl.shortcode,
      parsedUrl.isReel ? "clips" : null,
      parsedUrl.isReel ? "video" : "image"
    ),
    mediaType: parsedUrl.isReel ? "video" : "image",
    productType: parsedUrl.isReel ? "clips" : null,
    authorUsername,
    authorFullName: null,
    caption: captionNote,
    accessibilityCaption: null,
    takenAt: null,
    savedAt: parseTimestamp(sm),
    location: null,
    audioTitle: null,
    audioArtist: null,
    collections: collection ? [collection] : [],
    externalLinks: extractExternalLinks(captionNote),
    coverUrl: null,
    videoUrl: null,
    carouselAssets: [],
  };
}

/**
 * Parses Meta Instagram Data Export JSON (`saved_posts.json`, `saved_collections.json`,
 * or combined payloads) into normalized `InstagramSavedPost` records.
 */
export function parseInstagramExportJson(
  rawPayload: string | Record<string, unknown> | Array<unknown>
): InstagramSavedPost[] {
  let parsed: unknown = rawPayload;
  if (typeof rawPayload === "string") {
    parsed = JSON.parse(rawPayload);
  }

  const byShortcode = new Map<string, InstagramSavedPost>();

  const mergeEntry = (entry: InstagramSavedPost | null) => {
    if (!entry) return;
    const existing = byShortcode.get(entry.shortcode);
    if (!existing) {
      byShortcode.set(entry.shortcode, entry);
      return;
    }
    for (const col of entry.collections) {
      if (!existing.collections.some((c) => slugifyCollectionName(c.name) === slugifyCollectionName(col.name))) {
        existing.collections.push(col);
      }
    }
    if (existing.authorUsername === "instagram" && entry.authorUsername !== "instagram") {
      existing.authorUsername = entry.authorUsername;
    }
    if (!existing.savedAt && entry.savedAt) {
      existing.savedAt = entry.savedAt;
    }
  };

  const ingestObject = (obj: unknown) => {
    if (!obj) return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item && typeof item === "object") {
          const rec = item as Record<string, any>;
          if (Array.isArray(rec.saved_saved_media) || Array.isArray(rec.saved_collections)) {
            ingestObject(rec);
          } else {
            mergeEntry(parseEntryNode(rec));
          }
        }
      }
      return;
    }

    if (typeof obj !== "object") return;
    const record = obj as Record<string, any>;

    if (Array.isArray(record.saved_saved_media)) {
      for (const item of record.saved_saved_media) {
        if (item && typeof item === "object") {
          mergeEntry(parseEntryNode(item as Record<string, any>));
        }
      }
    }

    if (Array.isArray(record.saved_collections)) {
      let currentColName = "";
      for (const colNode of record.saved_collections) {
        if (!colNode || typeof colNode !== "object") continue;
        // Meta has used two formats across export versions:
        // (a) { name: "Design", media_list: [...] }
        // (b) flat list with string_map_data.Name.value headers + media items
        if (typeof colNode.name === "string" && Array.isArray(colNode.media_list)) {
          const colName = decodeMetaMojibake(colNode.name).trim();
          const col: InstagramCollection = {
            id: slugifyCollectionName(colName),
            name: colName,
          };
          for (const m of colNode.media_list) {
            if (m && typeof m === "object") {
              mergeEntry(parseEntryNode(m as Record<string, any>, col));
            }
          }
          continue;
        }

        const sm = colNode.string_map_data || {};
        if (typeof sm.Name?.value === "string") {
          currentColName = decodeMetaMojibake(sm.Name.value).trim();
        }
        const col = currentColName
          ? { id: slugifyCollectionName(currentColName), name: currentColName }
          : undefined;
        mergeEntry(parseEntryNode(colNode as Record<string, any>, col));
      }
    }

    if (record.saved_posts) ingestObject(record.saved_posts);
    if (record.saved_collections_json) ingestObject(record.saved_collections_json);
  };

  ingestObject(parsed);
  return [...byShortcode.values()];
}

export async function importInstagramExport(
  userId: string,
  rawPayload: string | Record<string, unknown> | Array<unknown>,
  opts: {
    hydrateLimit?: number;
    fetchFn?: SyncFetchFn;
    mediaBaseDir?: string;
    skipMediaArchive?: boolean;
  } = {}
): Promise<SyncRunResult & { parsedCount: number; hydratedCount: number }> {
  const posts = parseInstagramExportJson(rawPayload);
  if (posts.length === 0) {
    throw new Error("No Instagram saved posts or collections found in JSON export.");
  }

  let hydratedCount = 0;
  const hydrateLimit = Math.max(0, Math.min(50, opts.hydrateLimit ?? 0));
  if (hydrateLimit > 0) {
    const auth = getInstagramAuthRecord(userId);
    if (auth) {
      for (let i = 0; i < posts.length && hydratedCount < hydrateLimit; i++) {
        try {
          const rich = await fetchInstagramPostByShortcode(
            auth,
            posts[i].shortcode,
            opts.fetchFn
          );
          if (rich) {
            posts[i] = {
              ...rich,
              collections: posts[i].collections.length > 0 ? posts[i].collections : rich.collections,
              savedAt: posts[i].savedAt || rich.savedAt,
            };
            hydratedCount++;
          }
        } catch {
          // Stop hydrating gently on any rate-limit or auth error
          break;
        }
      }
    }
  }

  const syncResult = await instagramSyncAdapter.run!(userId, {
    force: true,
    preloadedPosts: posts,
    fetchFn: opts.fetchFn,
    mediaFetchFn: opts.fetchFn,
    mediaBaseDir: opts.mediaBaseDir,
    skipMediaArchive: opts.skipMediaArchive,
  });

  return {
    ...syncResult,
    parsedCount: posts.length,
    hydratedCount,
  };
}
