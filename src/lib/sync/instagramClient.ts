import type { SyncFetchFn } from "./engine";
import {
  mergeInstagramSetCookieHeaders,
  type StoredInstagramAuth,
} from "./instagramAuthStore";

export const IG_WEB_APP_ID = "936619743392459";
export const IG_DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DEFAULT_MIN_DELAY_MS = 1800;
const DEFAULT_MAX_DELAY_MS = 3500;

export class InstagramAuthExpiredError extends Error {
  readonly code = "INSTAGRAM_COOKIE_EXPIRED";
  constructor(
    message = "Instagram session cookie is missing or expired. Refresh your Instagram session in Curio or via the Chrome extension."
  ) {
    super(message);
    this.name = "InstagramAuthExpiredError";
  }
}

export class InstagramChallengeError extends Error {
  readonly code = "INSTAGRAM_CHALLENGE_REQUIRED";
  constructor(
    message = "Instagram requested a challenge or rate-limited this request. Sync aborted immediately without retries."
  ) {
    super(message);
    this.name = "InstagramChallengeError";
  }
}

export interface InstagramCollection {
  id: string;
  name: string;
  mediaCount?: number;
}

export interface InstagramMediaAsset {
  kind: "image" | "video";
  url: string;
  width?: number;
  height?: number;
}

export interface InstagramLocationMeta {
  name: string;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface InstagramSavedPost {
  shortcode: string;
  mediaPk: string;
  permalink: string;
  mediaType: "image" | "video" | "carousel";
  productType?: string | null;
  authorUsername: string;
  authorFullName?: string | null;
  caption: string;
  accessibilityCaption?: string | null;
  takenAt?: string | null;
  savedAt?: string | null;
  location?: InstagramLocationMeta | null;
  audioTitle?: string | null;
  audioArtist?: string | null;
  collections: InstagramCollection[];
  externalLinks: string[];
  coverUrl?: string | null;
  videoUrl?: string | null;
  carouselAssets: InstagramMediaAsset[];
}

export interface FetchInstagramSavedOptions {
  maxPages?: number;
  knownShortcodes?: Set<string>;
  incremental?: boolean;
  includePerCollectionFallback?: boolean;
  minDelayMs?: number;
  maxDelayMs?: number;
  fetchFn?: SyncFetchFn;
  delayFn?: (ms: number) => Promise<void>;
  onCookieUpdate?: (mergedCookie: string) => void;
}

export interface FetchInstagramSavedResult {
  collections: InstagramCollection[];
  posts: InstagramSavedPost[];
  pagesFetched: number;
  stoppedEarly: boolean;
}

const TRACKING_PARAM_RE = /^(?:utm_|fbclid|gclid|igsh|igshid|ref|mc_)/i;

/**
 * Extracts clean, deduplicated external http(s) URLs from caption/text,
 * stripping Instagram self-links and tracking query parameters.
 */
export function extractExternalLinks(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s<>"'`)\]]+/gi) || [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of matches) {
    const cleaned = raw.replace(/[.,;:!?)'"\]]+$/, "");
    try {
      const u = new URL(cleaned);
      const host = u.hostname.replace(/^www\./i, "").toLowerCase();
      if (
        host === "instagram.com" ||
        host.endsWith(".instagram.com") ||
        host === "instagr.am"
      ) {
        continue;
      }
      const params = new URLSearchParams(u.search);
      for (const k of [...params.keys()]) {
        if (TRACKING_PARAM_RE.test(k)) {
          params.delete(k);
        }
      }
      u.search = params.toString();
      const normalized = u.toString();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        out.push(normalized);
      }
    } catch {
      // Ignore malformed URL tokens
    }
  }
  return out;
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredDelayMs(minMs: number, maxMs: number): number {
  if (maxMs <= minMs) return Math.max(0, minMs);
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

function buildHeaders(auth: StoredInstagramAuth): Record<string, string> {
  const headers: Record<string, string> = {
    Cookie: auth.cookie,
    "User-Agent": IG_DEFAULT_USER_AGENT,
    "X-IG-App-ID": IG_WEB_APP_ID,
    "X-ASBD-ID": "129477",
    "X-IG-WWW-Claim": "0",
    "X-Requested-With": "XMLHttpRequest",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://www.instagram.com/",
    Origin: "https://www.instagram.com",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
  };
  if (auth.csrfToken) {
    headers["X-CSRFToken"] = auth.csrfToken;
  }
  return headers;
}

function extractSetCookieHeaders(headers: Headers): string[] {
  const anyHeaders = headers as unknown as { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    const list = anyHeaders.getSetCookie();
    if (Array.isArray(list)) return list;
  }
  const combined = headers.get("set-cookie");
  if (!combined) return [];
  // Split multiple Set-Cookie headers joined by comma without breaking Expires dates (e.g. "Thu, 01 Jan ...")
  return combined.split(/,(?=\s*[A-Za-z0-9_.-]+=)/).map((s) => s.trim());
}

async function fetchIgJson(
  url: string,
  auth: StoredInstagramAuth,
  fetchFn: SyncFetchFn,
  onCookieUpdate?: (mergedCookie: string) => void
): Promise<Record<string, any>> {
  const res = await fetchFn(url, {
    method: "GET",
    headers: buildHeaders(auth),
    redirect: "manual",
  });

  if (res.status === 301 || res.status === 302) {
    const loc = res.headers.get("location") || "";
    if (loc.includes("challenge") || loc.includes("checkpoint")) {
      throw new InstagramChallengeError();
    }
    throw new InstagramAuthExpiredError();
  }

  if (res.status === 401) {
    throw new InstagramAuthExpiredError();
  }
  if (res.status === 429 || res.status === 403) {
    let bodyMsg = "";
    try {
      const txt = await res.text();
      if (txt.includes("login_required")) {
        throw new InstagramAuthExpiredError();
      }
      bodyMsg = txt.slice(0, 180);
    } catch (err) {
      if (err instanceof InstagramAuthExpiredError) throw err;
    }
    throw new InstagramChallengeError(
      bodyMsg.includes("challenge")
        ? "Instagram challenge_required encountered. Complete verification in Chrome before syncing."
        : `Instagram returned HTTP ${res.status}. Sync aborted without retries to protect your account.`
    );
  }

  if (!res.ok) {
    throw new Error(`Instagram API HTTP ${res.status}`);
  }

  const rawText = await res.text();
  if (/^\s*<!doctype|^\s*<html/i.test(rawText)) {
    if (/login|accounts\/login/i.test(rawText)) {
      throw new InstagramAuthExpiredError();
    }
    throw new Error("Instagram returned HTML instead of JSON");
  }

  let data: Record<string, any>;
  try {
    data = JSON.parse(rawText) as Record<string, any>;
  } catch {
    throw new Error("Instagram returned invalid JSON payload");
  }
  if (data?.require_login || data?.message === "login_required") {
    throw new InstagramAuthExpiredError();
  }
  if (
    data?.message === "challenge_required" ||
    data?.message === "checkpoint_required" ||
    data?.spam === true ||
    data?.challenge_url
  ) {
    throw new InstagramChallengeError();
  }

  const setCookies = extractSetCookieHeaders(res.headers);
  if (setCookies.length > 0) {
    const merged = mergeInstagramSetCookieHeaders(auth, setCookies);
    if (merged.updated) {
      auth.cookie = merged.cookie;
      auth.sessionId = merged.sessionId;
      auth.csrfToken = merged.csrfToken;
      auth.dsUserId = merged.dsUserId;
      onCookieUpdate?.(merged.cookie);
    }
  }

  return data;
}

function pickBestImageCandidate(
  candidates?: Array<{ url?: string; width?: number; height?: number }>
): { url: string; width?: number; height?: number } | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  let best: { url: string; width?: number; height?: number } | null = null;
  let bestArea = -1;
  for (const c of candidates) {
    if (!c?.url) continue;
    const area = (c.width || 0) * (c.height || 0);
    if (area > bestArea) {
      bestArea = area;
      best = { url: c.url, width: c.width, height: c.height };
    }
  }
  return best;
}

function pickBestVideoVersion(
  versions?: Array<{ url?: string; width?: number; height?: number; type?: number }>
): { url: string; width?: number; height?: number } | null {
  if (!Array.isArray(versions) || versions.length === 0) return null;
  let best: { url: string; width?: number; height?: number } | null = null;
  let bestArea = -1;
  for (const v of versions) {
    if (!v?.url) continue;
    const area = (v.width || 0) * (v.height || 0);
    if (area > bestArea) {
      bestArea = area;
      best = { url: v.url, width: v.width, height: v.height };
    }
  }
  return best;
}

function epochToIso(raw?: number | string | null): string | null {
  if (raw === null || raw === undefined) return null;
  const num = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(num) || num <= 0) return null;
  const ms = num > 1e12 ? num : num * 1000;
  return new Date(ms).toISOString();
}

export function buildInstagramPermalink(
  shortcode: string,
  productType?: string | null,
  mediaType?: "image" | "video" | "carousel"
): string {
  const clean = encodeURIComponent(shortcode);
  if (productType === "clips" || (mediaType === "video" && productType !== "igtv")) {
    return `https://www.instagram.com/reel/${clean}/`;
  }
  return `https://www.instagram.com/p/${clean}/`;
}

export function parseInstagramMediaNode(
  rawNode: Record<string, any>,
  collectionMap: Map<string, InstagramCollection>
): InstagramSavedPost | null {
  const media = rawNode?.media && typeof rawNode.media === "object" ? rawNode.media : rawNode;
  if (!media || typeof media !== "object") return null;

  const shortcode = String(media.code || media.shortcode || "").trim();
  if (!shortcode) return null;

  const mediaPk = String(media.pk || media.id || shortcode);
  const productType = media.product_type ? String(media.product_type) : null;
  const numericMediaType = Number(media.media_type || 1);
  const mediaType: "image" | "video" | "carousel" =
    numericMediaType === 8 || Array.isArray(media.carousel_media)
      ? "carousel"
      : numericMediaType === 2 || Array.isArray(media.video_versions)
      ? "video"
      : "image";

  const captionText =
    typeof media.caption === "string"
      ? media.caption
      : typeof media.caption?.text === "string"
      ? media.caption.text
      : "";

  const user = media.user && typeof media.user === "object" ? media.user : {};
  const authorUsername = String(user.username || "instagram").trim();
  const authorFullName = user.full_name ? String(user.full_name).trim() : null;

  const cover = pickBestImageCandidate(media.image_versions2?.candidates);
  const video = pickBestVideoVersion(media.video_versions);

  const carouselAssets: InstagramMediaAsset[] = [];
  if (Array.isArray(media.carousel_media)) {
    for (const slide of media.carousel_media) {
      const slideVid = pickBestVideoVersion(slide?.video_versions);
      if (slideVid) {
        carouselAssets.push({
          kind: "video",
          url: slideVid.url,
          width: slideVid.width,
          height: slideVid.height,
        });
        continue;
      }
      const slideImg = pickBestImageCandidate(slide?.image_versions2?.candidates);
      if (slideImg) {
        carouselAssets.push({
          kind: "image",
          url: slideImg.url,
          width: slideImg.width,
          height: slideImg.height,
        });
      }
    }
  }

  const coverUrl =
    cover?.url ||
    carouselAssets.find((a) => a.kind === "image")?.url ||
    null;

  const collectionIds: string[] = Array.isArray(media.saved_collection_ids)
    ? media.saved_collection_ids.map(String)
    : [];

  const collections: InstagramCollection[] = [];
  const seenColIds = new Set<string>();
  for (const cid of collectionIds) {
    if (seenColIds.has(cid)) continue;
    const found = collectionMap.get(cid);
    if (found) {
      collections.push(found);
      seenColIds.add(cid);
    }
  }

  const locRaw = media.location && typeof media.location === "object" ? media.location : null;
  const location: InstagramLocationMeta | null = locRaw?.name
    ? {
        name: String(locRaw.name),
        address: locRaw.address ? String(locRaw.address) : null,
        city: locRaw.city ? String(locRaw.city) : null,
        lat: typeof locRaw.lat === "number" ? locRaw.lat : null,
        lng: typeof locRaw.lng === "number" ? locRaw.lng : null,
      }
    : null;

  const musicAsset = media.clips_metadata?.music_info?.music_asset_info;
  const origSound = media.clips_metadata?.original_sound_info;
  const audioTitle = musicAsset?.title
    ? String(musicAsset.title)
    : origSound?.original_audio_title
    ? String(origSound.original_audio_title)
    : null;
  const audioArtist = musicAsset?.display_artist
    ? String(musicAsset.display_artist)
    : origSound?.ig_artist?.username
    ? `@${origSound.ig_artist.username}`
    : null;

  const externalLinks = extractExternalLinks(captionText);

  return {
    shortcode,
    mediaPk,
    permalink: buildInstagramPermalink(shortcode, productType, mediaType),
    mediaType,
    productType,
    authorUsername,
    authorFullName,
    caption: captionText,
    accessibilityCaption: media.accessibility_caption
      ? String(media.accessibility_caption)
      : null,
    takenAt: epochToIso(media.taken_at),
    savedAt: epochToIso(rawNode?.saved_at || media.saved_at) || new Date().toISOString(),
    location,
    audioTitle,
    audioArtist,
    collections,
    externalLinks,
    coverUrl,
    videoUrl: video?.url || null,
    carouselAssets,
  };
}

export async function fetchInstagramCollections(
  auth: StoredInstagramAuth,
  fetchFn: SyncFetchFn = fetch,
  onCookieUpdate?: (mergedCookie: string) => void
): Promise<InstagramCollection[]> {
  const url =
    "https://www.instagram.com/api/v1/collections/list/?collection_types=%5B%22ALL_MEDIA_AUTO_COLLECTION%22%2C%22MEDIA%22%5D";
  const data = await fetchIgJson(url, auth, fetchFn, onCookieUpdate);
  const items = Array.isArray(data?.items) ? data.items : [];
  const collections: InstagramCollection[] = [];

  for (const item of items) {
    const id = String(item?.collection_id || "").trim();
    const name = String(item?.collection_name || "").trim();
    const colType = String(item?.collection_type || "");
    if (!id || !name) continue;
    if (colType === "ALL_MEDIA_AUTO_COLLECTION" || id === "ALL_MEDIA_AUTO_COLLECTION") {
      continue;
    }
    collections.push({
      id,
      name,
      mediaCount: typeof item?.collection_media_count === "number" ? item.collection_media_count : undefined,
    });
  }
  return collections;
}

export async function fetchInstagramSavedPosts(
  auth: StoredInstagramAuth,
  opts: FetchInstagramSavedOptions = {}
): Promise<FetchInstagramSavedResult> {
  const workingAuth: StoredInstagramAuth = { ...auth };
  const fetchFn = opts.fetchFn || fetch;
  const delayFn = opts.delayFn || defaultDelay;
  const maxPages = Math.max(1, opts.maxPages ?? 5);
  const minDelayMs = opts.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
  const maxDelayMs = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const knownShortcodes = opts.knownShortcodes || new Set<string>();
  const incremental = opts.incremental !== false;

  let collections: InstagramCollection[] = [];
  try {
    collections = await fetchInstagramCollections(
      workingAuth,
      fetchFn,
      opts.onCookieUpdate
    );
  } catch (err) {
    if (
      err instanceof InstagramAuthExpiredError ||
      err instanceof InstagramChallengeError
    ) {
      throw err;
    }
    // Meta deprecated /api/v1/collections/list/ for some web clients (404 HTML);
    // degrade gracefully and continue syncing /api/v1/feed/saved/posts/.
    collections = [];
  }
  const collectionMap = new Map(collections.map((c) => [c.id, c]));

  const postMap = new Map<string, InstagramSavedPost>();
  let nextMaxId: string | null = null;
  let pagesFetched = 0;
  let stoppedEarly = false;

  while (pagesFetched < maxPages) {
    if (pagesFetched > 0) {
      await delayFn(jitteredDelayMs(minDelayMs, maxDelayMs));
    }

    const qs = new URLSearchParams({ include_igtv_preview: "false" });
    if (nextMaxId) qs.set("max_id", nextMaxId);

    const data = await fetchIgJson(
      `https://www.instagram.com/api/v1/feed/saved/posts/?${qs.toString()}`,
      workingAuth,
      fetchFn,
      opts.onCookieUpdate
    );
    pagesFetched++;

    const rawItems = Array.isArray(data?.items) ? data.items : [];
    let pageHasNew = false;

    for (const rawItem of rawItems) {
      const parsed = parseInstagramMediaNode(rawItem, collectionMap);
      if (!parsed) continue;
      if (!knownShortcodes.has(parsed.shortcode)) {
        pageHasNew = true;
      }
      if (!postMap.has(parsed.shortcode)) {
        postMap.set(parsed.shortcode, parsed);
      }
    }

    if (incremental && knownShortcodes.size > 0 && rawItems.length > 0 && !pageHasNew) {
      stoppedEarly = true;
      break;
    }

    if (!data?.more_available || !data?.next_max_id) {
      break;
    }
    nextMaxId = String(data.next_max_id);
  }

  // Optional per-collection mapping pass if items omitted saved_collection_ids
  const anyCollectionsTagged = [...postMap.values()].some((p) => p.collections.length > 0);
  if (
    opts.includePerCollectionFallback !== false &&
    collections.length > 0 &&
    !anyCollectionsTagged &&
    postMap.size > 0
  ) {
    for (const col of collections) {
      await delayFn(jitteredDelayMs(minDelayMs, maxDelayMs));
      let colNextMaxId: string | null = null;
      let colPages = 0;
      const colPageLimit = Math.min(2, maxPages);

      while (colPages < colPageLimit) {
        const qs = new URLSearchParams({ include_igtv_preview: "false" });
        if (colNextMaxId) qs.set("max_id", colNextMaxId);
        const colData = await fetchIgJson(
          `https://www.instagram.com/api/v1/feed/collection/${encodeURIComponent(col.id)}/posts/?${qs.toString()}`,
          workingAuth,
          fetchFn,
          opts.onCookieUpdate
        );
        colPages++;
        const colItems = Array.isArray(colData?.items) ? colData.items : [];
        for (const rawItem of colItems) {
          const parsed = parseInstagramMediaNode(rawItem, collectionMap);
          if (!parsed) continue;
          const existing = postMap.get(parsed.shortcode);
          if (existing) {
            if (!existing.collections.some((c) => c.id === col.id)) {
              existing.collections.push(col);
            }
          }
        }
        if (!colData?.more_available || !colData?.next_max_id) break;
        colNextMaxId = String(colData.next_max_id);
        await delayFn(jitteredDelayMs(minDelayMs, maxDelayMs));
      }
    }
  }

  return {
    collections,
    posts: [...postMap.values()],
    pagesFetched,
    stoppedEarly,
  };
}

export async function fetchInstagramPostByShortcode(
  auth: StoredInstagramAuth,
  shortcode: string,
  fetchFn: SyncFetchFn = fetch
): Promise<InstagramSavedPost | null> {
  const clean = shortcode.trim();
  if (!clean) return null;
  const url = `https://www.instagram.com/p/${encodeURIComponent(clean)}/?__a=1&__d=dis`;
  const data = await fetchIgJson(url, auth, fetchFn);
  const item =
    (Array.isArray(data?.items) && data.items[0]) ||
    data?.graphql?.shortcode_media ||
    null;
  if (!item) return null;
  return parseInstagramMediaNode(item, new Map());
}
