import fs from "node:fs";
import path from "node:path";
import type { SyncFetchFn } from "./engine";
import type { InstagramSavedPost } from "./instagramClient";

export const DEFAULT_MAX_VIDEO_BYTES = 250 * 1024 * 1024; // 250 MiB per Reel/video

export interface ArchivedMediaItem {
  kind: "image" | "video";
  url: string;
}

export interface ArchivedInstagramMedia {
  coverUrl: string | null;
  videoUrl: string | null;
  carouselItems: ArchivedMediaItem[];
  bytesWritten: number;
  warnings: string[];
}

export function resolveInstagramMediaBaseDir(overrideBaseDir?: string): string {
  if (overrideBaseDir) {
    return path.resolve(overrideBaseDir);
  }
  if (process.env.MEDIA_PATH) {
    return path.join(path.resolve(process.env.MEDIA_PATH), "instagram");
  }
  if (fs.existsSync("/data/media")) {
    return "/data/media/instagram";
  }
  if (process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test") {
    return path.resolve(process.cwd(), "data", "media", "instagram");
  }
  if (fs.existsSync("/Volumes/Photo/CurioMedia/instagram")) {
    return "/Volumes/Photo/CurioMedia/instagram";
  }
  if (fs.existsSync("/Users/carlosgmt/dockermounts/curio/media")) {
    return path.resolve("/Users/carlosgmt/dockermounts/curio/media", "instagram");
  }
  return path.resolve(process.cwd(), "data", "media", "instagram");
}

function sanitizeShortcode(shortcode: string): string {
  const clean = shortcode.replace(/[^A-Za-z0-9_-]/g, "");
  return clean || "post";
}

function inferImageExtension(url: string, contentType: string | null): string {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  const pathPart = url.split("?")[0].toLowerCase();
  if (pathPart.endsWith(".png")) return ".png";
  if (pathPart.endsWith(".webp")) return ".webp";
  return ".jpg";
}

async function downloadAtomic(
  url: string,
  destPath: string,
  fetchFn: SyncFetchFn,
  maxBytes: number
): Promise<{ ok: boolean; bytesWritten: number; contentType: string | null; warning?: string }> {
  try {
    const existing = await fs.promises.stat(destPath).catch(() => null);
    if (existing && existing.isFile() && existing.size > 0) {
      return { ok: true, bytesWritten: 0, contentType: null };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const res = await fetchFn(url, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { ok: false, bytesWritten: 0, contentType: null, warning: `HTTP ${res.status} for ${url}` };
    }

    const declaredLen = Number(res.headers.get("content-length") || "0");
    if (declaredLen > maxBytes) {
      return {
        ok: false,
        bytesWritten: 0,
        contentType: res.headers.get("content-type"),
        warning: `Skipped asset exceeding ${Math.round(maxBytes / (1024 * 1024))} MiB cap`,
      };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) {
      return { ok: false, bytesWritten: 0, contentType: null, warning: `Empty asset body for ${url}` };
    }
    if (buf.length > maxBytes) {
      return {
        ok: false,
        bytesWritten: 0,
        contentType: res.headers.get("content-type"),
        warning: `Skipped downloaded asset exceeding ${Math.round(maxBytes / (1024 * 1024))} MiB cap`,
      };
    }

    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    const tmpPath = `${destPath}.tmp-${Date.now()}`;
    await fs.promises.writeFile(tmpPath, buf);
    await fs.promises.rename(tmpPath, destPath);
    return {
      ok: true,
      bytesWritten: buf.length,
      contentType: res.headers.get("content-type"),
    };
  } catch (err: any) {
    return {
      ok: false,
      bytesWritten: 0,
      contentType: null,
      warning: err?.message || "Media download failed",
    };
  }
}

function buildCurioMediaUrl(shortcode: string, filename: string): string {
  return `/curio/api/v1/media/instagram/${encodeURIComponent(shortcode)}/${encodeURIComponent(filename)}`;
}

/**
 * Downloads and stores Instagram cover images, carousel slides, and Reel/video MP4s
 * atomically into Curio's local media archive so CDN link expiry never breaks cards.
 */
export async function archiveInstagramPostMedia(
  post: InstagramSavedPost,
  opts: {
    fetchFn?: SyncFetchFn;
    maxVideoBytes?: number;
    baseDir?: string;
  } = {}
): Promise<ArchivedInstagramMedia> {
  const fetchFn = opts.fetchFn || fetch;
  const maxVideoBytes = opts.maxVideoBytes ?? DEFAULT_MAX_VIDEO_BYTES;
  const baseDir = resolveInstagramMediaBaseDir(opts.baseDir);
  const safeCode = sanitizeShortcode(post.shortcode);
  const postDir = path.join(/*turbopackIgnore: true*/ baseDir, safeCode);

  let bytesWritten = 0;
  const warnings: string[] = [];
  let coverUrl: string | null = null;
  let videoUrl: string | null = null;
  const carouselItems: ArchivedMediaItem[] = [];

  if (post.coverUrl) {
    const ext = inferImageExtension(post.coverUrl, null);
    const filename = `cover${ext}`;
    const res = await downloadAtomic(post.coverUrl, path.join(postDir, filename), fetchFn, 25 * 1024 * 1024);
    if (res.ok) {
      bytesWritten += res.bytesWritten;
      coverUrl = buildCurioMediaUrl(safeCode, filename);
    } else if (res.warning) {
      warnings.push(res.warning);
    }
  }

  if (post.videoUrl) {
    const filename = "video.mp4";
    const res = await downloadAtomic(post.videoUrl, path.join(postDir, filename), fetchFn, maxVideoBytes);
    if (res.ok) {
      bytesWritten += res.bytesWritten;
      videoUrl = buildCurioMediaUrl(safeCode, filename);
    } else if (res.warning) {
      warnings.push(res.warning);
    }
  }

  if (post.carouselAssets.length > 0) {
    for (let i = 0; i < post.carouselAssets.length; i++) {
      const slide = post.carouselAssets[i];
      const idx = String(i + 1).padStart(2, "0");
      if (slide.kind === "video") {
        const filename = `slide-${idx}.mp4`;
        const res = await downloadAtomic(slide.url, path.join(postDir, filename), fetchFn, maxVideoBytes);
        if (res.ok) {
          bytesWritten += res.bytesWritten;
          carouselItems.push({ kind: "video", url: buildCurioMediaUrl(safeCode, filename) });
        } else if (res.warning) {
          warnings.push(res.warning);
        }
      } else {
        const ext = inferImageExtension(slide.url, null);
        const filename = `slide-${idx}${ext}`;
        const res = await downloadAtomic(slide.url, path.join(postDir, filename), fetchFn, 25 * 1024 * 1024);
        if (res.ok) {
          bytesWritten += res.bytesWritten;
          const localUrl = buildCurioMediaUrl(safeCode, filename);
          carouselItems.push({ kind: "image", url: localUrl });
          if (!coverUrl) coverUrl = localUrl;
        } else if (res.warning) {
          warnings.push(res.warning);
        }
      }
    }
  }

  return {
    coverUrl,
    videoUrl,
    carouselItems,
    bytesWritten,
    warnings,
  };
}
