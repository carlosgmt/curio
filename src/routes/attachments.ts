import { Hono } from "hono";
import { db, sqlite } from "../db";
import { attachments, cards } from "../db/schema";
import { eq } from "drizzle-orm";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export const attachmentRoutes = new Hono();

const MEDIA_DIR = process.env.MEDIA_PATH ?? "./data/media";

try {
  mkdirSync(MEDIA_DIR, { recursive: true });
} catch {}

// ── Upload an attachment ───────────────────────────────────────────────
attachmentRoutes.post("/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  const cardId = (body["cardId"] as string) || null;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  const id = crypto.randomUUID();
  const filename = file.name || "upload.png";
  const mimeType = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = join(MEDIA_DIR, `${id}-${filename}`);

  writeFileSync(filePath, buffer);

  // If cardId is provided, save to DB immediately
  if (cardId) {
    sqlite
      .prepare(`
        INSERT INTO attachments (id, card_id, filename, mime_type, size_bytes, path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .run(id, cardId, filename, mimeType, buffer.length, filePath);
  }

  return c.json({
    id,
    filename,
    mimeType,
    sizeBytes: buffer.length,
    url: `/api/v1/attachments/${id}`,
  });
});

// ── Download / view an attachment ──────────────────────────────────────
attachmentRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  // Lookup in DB or by filename in media dir
  const row = sqlite
    .prepare("SELECT * FROM attachments WHERE id = ?")
    .get(id) as any;

  if (row && existsSync(row.path)) {
    const data = readFileSync(row.path);
    c.header("Content-Type", row.mime_type || "image/png");
    c.header("Cache-Control", "public, max-age=31536000, immutable");
    return c.body(data);
  }

  // Fallback: check media dir for any file starting with id
  const { readdirSync } = require("fs");
  try {
    const files = readdirSync(MEDIA_DIR);
    const matched = files.find((f: string) => f.startsWith(`${id}-`));
    if (matched) {
      const fullPath = join(MEDIA_DIR, matched);
      const data = readFileSync(fullPath);
      const isPng = matched.endsWith(".png");
      const isJpg = matched.endsWith(".jpg") || matched.endsWith(".jpeg");
      const isWebp = matched.endsWith(".webp");
      const mime = isPng ? "image/png" : isJpg ? "image/jpeg" : isWebp ? "image/webp" : "image/png";
      c.header("Content-Type", mime);
      c.header("Cache-Control", "public, max-age=31536000, immutable");
      return c.body(data);
    }
  } catch {}

  return c.text("Attachment not found", 404);
});

// ── PWA Web Share Target Handler ───────────────────────────────────────
attachmentRoutes.post("/share-target", async (c) => {
  const body = await c.req.parseBody();
  const title = (body["title"] as string) || "";
  const text = (body["text"] as string) || "";
  const url = (body["url"] as string) || "";
  const image = body["image"];

  const cardTitle = title || text || (url ? `Link: ${url}` : "Shared Media");
  const rawText = [text, url].filter(Boolean).join("\n") || cardTitle;
  const cardId = crypto.randomUUID();

  // Create card
  sqlite
    .prepare(`
      INSERT INTO cards (id, list_id, intent, status, title, raw_text, data, tags, created_at, updated_at)
      VALUES (?, 'inbox', 'note', 'active', ?, ?, '{}', '["shared"]', datetime('now'), datetime('now'))
    `)
    .run(cardId, cardTitle, rawText);

  // If image attached via share target
  if (image && image instanceof File) {
    const attachId = crypto.randomUUID();
    const filename = image.name || "shared.png";
    const mimeType = image.type || "image/png";
    const buffer = Buffer.from(await image.arrayBuffer());
    const filePath = join(MEDIA_DIR, `${attachId}-${filename}`);
    writeFileSync(filePath, buffer);

    sqlite
      .prepare(`
        INSERT INTO attachments (id, card_id, filename, mime_type, size_bytes, path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .run(attachId, cardId, filename, mimeType, buffer.length, filePath);
  }

  // Redirect back to main BrainSpace dashboard
  return c.redirect("/", 303);
});
