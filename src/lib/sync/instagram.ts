import fs from "node:fs";
import path from "node:path";
import { and, eq, like } from "drizzle-orm";
import { db, globalEntities, smartLists, users, userSaves } from "@/db";
import { releaseLocalLlmModel } from "@/lib/llm/client";
import {
  ensureHierarchicalBoard,
  runSyncAdapter,
  type SyncAdapter,
  type SyncBoardTarget,
  type SyncFetchFn,
  type SyncOptions,
  type SyncRecord,
  type SyncRunResult,
} from "./engine";
import { registerSyncAdapter } from "./registry";
import {
  getInstagramAuthRecord,
  setInstagramAuthRecord,
  type StoredInstagramAuth,
} from "./instagramAuthStore";
import {
  fetchInstagramSavedPosts,
  InstagramAuthExpiredError,
  InstagramChallengeError,
  type InstagramCollection,
  type InstagramSavedPost,
} from "./instagramClient";
import {
  archiveInstagramPostMedia,
  resolveInstagramMediaBaseDir,
  type ArchivedMediaItem,
} from "./instagramMedia";
import {
  classifyInstagramPost,
  type UserBoardHint,
} from "./instagramClassifier";

export const INSTAGRAM_ROOT_BOARD_SLUG = "instagram-saves";
export const INSTAGRAM_ROOT_BOARD_TITLE = "Instagram Saves";
export const INSTAGRAM_ROOT_BOARD_DESC =
  "Auto-synced Instagram saved posts, Reels, carousels, and collections";

const SYSTEM_BOARD_SLUGS = new Set([
  "films",
  "books",
  "music",
  "games",
  "recipes",
  "recipes-ideas",
  "closet",
  "wardrobe",
  "outfits",
  "my-stuff",
]);

export interface InstagramSyncOptions extends SyncOptions {
  cookie?: string;
  igUsername?: string;
  incremental?: boolean;
  maxPages?: number;
  mediaFetchFn?: SyncFetchFn;
  mediaBaseDir?: string;
  delayFn?: (ms: number) => Promise<void>;
  /**
   * Optional pre-parsed posts (used by Meta Data Export JSON backfill).
   */
  preloadedPosts?: InstagramSavedPost[];
  skipMediaArchive?: boolean;
}

export function slugifyCollectionName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "collection";
}

function getHostnameLabel(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, "");
  } catch {
    return "External Link";
  }
}

function checkArchivedMediaPresent(
  igMeta: Record<string, any>,
  baseDir: string,
  shortcode: string
): boolean {
  const coverUrl = typeof igMeta.coverUrl === "string" ? igMeta.coverUrl : "";
  const videoUrl = typeof igMeta.videoUrl === "string" ? igMeta.videoUrl : "";
  const checks = [coverUrl, videoUrl].filter(Boolean);
  if (checks.length === 0) return false;
  for (const url of checks) {
    const filename = path.basename(url.split("?")[0]);
    const full = path.join(baseDir, shortcode, filename);
    if (!fs.existsSync(full)) return false;
  }
  return true;
}

function mergeCollections(
  existing: unknown,
  incoming: InstagramCollection[]
): InstagramCollection[] {
  const byKey = new Map<string, InstagramCollection>();
  if (Array.isArray(existing)) {
    for (const c of existing) {
      if (c && typeof c === "object" && (c as any).name) {
        const name = String((c as any).name).trim();
        const id = String((c as any).id || slugifyCollectionName(name));
        byKey.set(slugifyCollectionName(name), { id, name });
      }
    }
  }
  for (const c of incoming) {
    if (!c?.name) continue;
    const key = slugifyCollectionName(c.name);
    byKey.set(key, { id: c.id || key, name: c.name.trim() });
  }
  return [...byKey.values()];
}

function mergeLinks(existing: unknown, incoming: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...(Array.isArray(existing) ? existing : []), ...incoming]) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const clean = raw.trim();
    if (!seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

async function updateUserInstagramStatus(
  userId: string,
  patch: {
    instagramUsername?: string;
    instagramAuthStatus?: "ok" | "expired" | "challenge" | "unconfigured";
    instagramLastError?: string | null;
    instagramLastSyncedAt?: string | null;
  }
): Promise<void> {
  const [freshUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!freshUser) return;
  const tokens = (freshUser.googleSyncTokens as Record<string, any>) || {};
  await db
    .update(users)
    .set({
      googleSyncTokens: {
        ...tokens,
        ...patch,
      },
    })
    .where(eq(users.id, userId));
}

export async function ensureInstagramRootSmartBoard(userId: string): Promise<string> {
  const res = await ensureHierarchicalBoard(userId, {
    rootSlug: INSTAGRAM_ROOT_BOARD_SLUG,
    rootTitle: INSTAGRAM_ROOT_BOARD_TITLE,
    rootDescription: INSTAGRAM_ROOT_BOARD_DESC,
    rootDefaultLayout: "masonry",
    autoRules: { tagsInclude: ["instagram"] },
  });
  return res.listId;
}

export const instagramSyncAdapter: SyncAdapter<InstagramSyncOptions> = {
  sourceId: "instagram",
  displayName: "Instagram Saves",
  supportsWishlistPromotion: false,
  supportsPruning: false,
  keyPrefix: "instagram:",

  async getStatus(userId: string) {
    const [freshUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const tokens = (freshUser?.googleSyncTokens as Record<string, any>) || {};
    const authRec = getInstagramAuthRecord(userId);
    const hasCookie = Boolean(authRec?.cookie);

    return {
      configured: hasCookie,
      instagramUsername: authRec?.igUsername || tokens.instagramUsername || null,
      hasCookie,
      authStatus: tokens.instagramAuthStatus || (hasCookie ? "ok" : "unconfigured"),
      lastError: tokens.instagramLastError || null,
      lastSyncedAt: tokens.instagramLastSyncedAt || null,
      boardSlug: INSTAGRAM_ROOT_BOARD_SLUG,
    };
  },

  async run(userId: string, options: InstagramSyncOptions = {}): Promise<SyncRunResult> {
    if (typeof options.cookie === "string" && options.cookie.trim()) {
      setInstagramAuthRecord(userId, {
        cookie: options.cookie.trim(),
        igUsername: options.igUsername,
      });
    }

    const authRec: StoredInstagramAuth | null = getInstagramAuthRecord(userId);
    if (!options.preloadedPosts && !authRec?.cookie) {
      return {
        sourceId: "instagram",
        synced: false,
        skippedReason: "cookie_required",
        recordsProcessed: 0,
        createdSaves: 0,
        updatedSaves: 0,
        promotedFromWishlist: 0,
        prunedSaves: 0,
        prunedEntities: 0,
        connectionsSynced: 0,
        boardsCreated: 0,
        digest: "",
        syncedAt: new Date().toISOString(),
      };
    }

    // Ensure the permanent smart root board exists FIRST so autoRules are applied
    await ensureInstagramRootSmartBoard(userId);

    // Load existing instagram:* entities for incremental stop + classification preservation
    const existingIgRows = await db
      .select({ save: userSaves, entity: globalEntities })
      .from(userSaves)
      .innerJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(
        and(
          eq(userSaves.userId, userId),
          like(globalEntities.entityKey, "instagram:%")
        )
      );

    const existingByShortcode = new Map<
      string,
      { save: typeof userSaves.$inferSelect; entity: typeof globalEntities.$inferSelect }
    >();
    for (const row of existingIgRows) {
      const code = row.entity.entityKey.replace(/^instagram:/, "");
      if (code) existingByShortcode.set(code, row);
    }

    const userBoardsAll = await db
      .select({ slug: smartLists.slug, title: smartLists.title })
      .from(smartLists)
      .where(eq(smartLists.userId, userId));

    const manualUserBoards: UserBoardHint[] = userBoardsAll.filter(
      (b) =>
        !SYSTEM_BOARD_SLUGS.has(b.slug) &&
        !b.slug.startsWith("my-stuff-") &&
        !b.slug.startsWith(INSTAGRAM_ROOT_BOARD_SLUG)
    );
    const manualBoardBySlug = new Map(manualUserBoards.map((b) => [b.slug, b]));

    let posts: InstagramSavedPost[];
    let pagesFetched = 0;
    let stoppedEarly = false;

    try {
      if (options.preloadedPosts) {
        posts = options.preloadedPosts;
      } else {
        const res = await fetchInstagramSavedPosts(authRec!, {
          maxPages: options.maxPages ?? 5,
          knownShortcodes: new Set(existingByShortcode.keys()),
          incremental: options.incremental !== false,
          fetchFn: options.fetchFn,
          delayFn: options.delayFn,
          onCookieUpdate: (mergedCookie) => {
            setInstagramAuthRecord(userId, {
              cookie: mergedCookie,
              igUsername: authRec?.igUsername,
            });
          },
        });
        posts = res.posts;
        pagesFetched = res.pagesFetched;
        stoppedEarly = res.stoppedEarly;
      }
    } catch (err) {
      if (err instanceof InstagramAuthExpiredError) {
        await updateUserInstagramStatus(userId, {
          instagramAuthStatus: "expired",
          instagramLastError: err.message,
        });
      } else if (err instanceof InstagramChallengeError) {
        await updateUserInstagramStatus(userId, {
          instagramAuthStatus: "challenge",
          instagramLastError: err.message,
        });
      } else {
        await updateUserInstagramStatus(userId, {
          instagramLastError: err instanceof Error ? err.message : "Instagram sync error",
        });
      }
      throw err;
    }

    const mediaBaseDir = resolveInstagramMediaBaseDir(options.mediaBaseDir);
    const records: SyncRecord[] = [];
    let usedLlmInBatch = false;
    let mediaArchivedCount = 0;

    try {
      for (const post of posts) {
        const existing = existingByShortcode.get(post.shortcode);
        const existingExt =
          existing?.entity.extendedAttributes &&
          typeof existing.entity.extendedAttributes === "object"
            ? (existing.entity.extendedAttributes as Record<string, any>)
            : {};
        const existingIgMeta =
          existingExt.instagram && typeof existingExt.instagram === "object"
            ? (existingExt.instagram as Record<string, any>)
            : {};

        let coverUrl: string | null =
          typeof existingIgMeta.coverUrl === "string" ? existingIgMeta.coverUrl : null;
        let videoUrl: string | null =
          typeof existingIgMeta.videoUrl === "string" ? existingIgMeta.videoUrl : null;
        let carouselItems: ArchivedMediaItem[] = Array.isArray(existingIgMeta.carouselItems)
          ? existingIgMeta.carouselItems
          : [];

        const shouldArchiveMedia =
          !options.skipMediaArchive &&
          (post.coverUrl || post.videoUrl || post.carouselAssets.length > 0) &&
          (!existing || !checkArchivedMediaPresent(existingIgMeta, mediaBaseDir, post.shortcode));

        if (shouldArchiveMedia) {
          const archived = await archiveInstagramPostMedia(post, {
            fetchFn: options.mediaFetchFn || options.fetchFn,
            baseDir: mediaBaseDir,
          });
          if (archived.coverUrl) coverUrl = archived.coverUrl;
          if (archived.videoUrl) videoUrl = archived.videoUrl;
          if (archived.carouselItems.length > 0) carouselItems = archived.carouselItems;
          if (archived.bytesWritten > 0) mediaArchivedCount++;
        }

        const mergedCollections = mergeCollections(existingIgMeta.collections, post.collections);
        const mergedLinks = mergeLinks(existingIgMeta.externalLinks, post.externalLinks);

        let coreType: string;
        let typePath: string;
        let title: string;
        let brandOrCreator: string | null;
        let summary: string | null;
        let tags: string[];
        let wishlist: boolean;
        let coreStructuredData: Record<string, unknown>;
        let suggestedBoardSlug: string | null = null;

        if (existing) {
          // Preserve user edits and prior classification on re-sync
          coreType = existing.entity.coreType;
          typePath = existing.save.typePath || existing.entity.typePath || "/media/image";
          title = existing.entity.title;
          brandOrCreator = existing.entity.brandOrCreator;
          summary = existing.entity.summary;
          tags = [
            "instagram",
            ...mergedCollections.map((c) => c.name.toLowerCase()),
          ];
          wishlist = Boolean(existing.save.wishlist);
          coreStructuredData =
            existing.entity.coreStructuredData &&
            typeof existing.entity.coreStructuredData === "object"
              ? (existing.entity.coreStructuredData as Record<string, unknown>)
              : {};
        } else {
          const classified = await classifyInstagramPost(post, manualUserBoards);
          if (classified.usedLlm) usedLlmInBatch = true;
          coreType = classified.coreType;
          typePath = classified.typePath;
          title = classified.title;
          brandOrCreator = classified.brandOrCreator;
          summary = classified.summary;
          tags = classified.tags;
          wishlist = classified.wishlist;
          coreStructuredData = classified.coreStructuredData;
          suggestedBoardSlug = classified.suggestedBoardSlug;
        }

        const boards: SyncBoardTarget[] = [];
        for (const col of mergedCollections) {
          const colSlug = slugifyCollectionName(col.name);
          boards.push({
            rootSlug: INSTAGRAM_ROOT_BOARD_SLUG,
            rootTitle: INSTAGRAM_ROOT_BOARD_TITLE,
            rootDescription: INSTAGRAM_ROOT_BOARD_DESC,
            rootDefaultLayout: "masonry",
            subSlug: `${INSTAGRAM_ROOT_BOARD_SLUG}-${colSlug}`,
            subTitle: col.name,
            subDescription: `Instagram collection: ${col.name}`,
            subDefaultLayout: "masonry",
          });
        }
        if (suggestedBoardSlug && manualBoardBySlug.has(suggestedBoardSlug)) {
          const b = manualBoardBySlug.get(suggestedBoardSlug)!;
          boards.push({
            rootSlug: b.slug,
            rootTitle: b.title,
          });
        }

        const extraSourceLinks = mergedLinks.map((url) => ({
          sellerName: getHostnameLabel(url),
          sourceUrl: url,
        }));

        const heroImageUrl =
          coverUrl ||
          existing?.entity.heroImageUrl ||
          post.coverUrl ||
          null;

        const captionText =
          post.caption ||
          (typeof existingIgMeta.caption === "string" ? existingIgMeta.caption : "");

        records.push({
          externalId: post.shortcode,
          entityKey: `instagram:${post.shortcode}`,
          canonicalExternalId: `instagram:${post.shortcode}`,
          canonicalUrl: post.permalink,
          coreType,
          typePath,
          title,
          brandOrCreator,
          summary,
          heroImageUrl,
          wishlist,
          tags,
          coreStructuredData,
          extendedAttributes: {
            ...existingExt,
            source: "instagram",
            instagram: {
              ...existingIgMeta,
              shortcode: post.shortcode,
              mediaPk: post.mediaPk,
              permalink: post.permalink,
              mediaType: post.mediaType,
              productType: post.productType ?? existingIgMeta.productType ?? null,
              authorUsername: post.authorUsername,
              authorFullName: post.authorFullName ?? existingIgMeta.authorFullName ?? null,
              caption: captionText,
              takenAt: post.takenAt ?? existingIgMeta.takenAt ?? null,
              savedAt: post.savedAt ?? existingIgMeta.savedAt ?? null,
              collections: mergedCollections,
              coverUrl,
              videoUrl,
              carouselItems,
              externalLinks: mergedLinks,
              location: post.location ?? existingIgMeta.location ?? null,
              audioTitle: post.audioTitle ?? existingIgMeta.audioTitle ?? null,
              audioArtist: post.audioArtist ?? existingIgMeta.audioArtist ?? null,
            },
          },
          sourceLink: {
            sellerName: "Instagram",
            sourceUrl: post.permalink,
          },
          extraSourceLinks,
          boards,
        });
      }
    } finally {
      if (usedLlmInBatch) {
        await releaseLocalLlmModel();
      }
    }

    const digestPayload = records.map((r) => ({
      key: r.entityKey,
      cols: ((r.extendedAttributes as any)?.instagram?.collections || []).map((c: any) => c.name),
      cover: r.heroImageUrl,
    }));
    const digest = JSON.stringify(digestPayload);

    const adapterResult = await runSyncAdapter(
      userId,
      {
        sourceId: "instagram",
        displayName: "Instagram Saves",
        supportsWishlistPromotion: false,
        supportsPruning: false,
        keyPrefix: "instagram:",
        fetchSnapshot: async () => ({
          digest,
          records,
          meta: {
            pagesFetched,
            stoppedEarly,
            mediaArchivedCount,
          },
        }),
      },
      { ...options, force: true }
    );

    const syncedAt = new Date().toISOString();
    await updateUserInstagramStatus(userId, {
      instagramAuthStatus: authRec?.cookie ? "ok" : "unconfigured",
      instagramLastError: null,
      instagramLastSyncedAt: syncedAt,
      ...(authRec?.igUsername ? { instagramUsername: authRec.igUsername } : {}),
    });

    return {
      ...adapterResult,
      syncedAt,
    };
  },
};

registerSyncAdapter(instagramSyncAdapter);
