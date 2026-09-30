import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { compress } from "hono/compress";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db, sqlite } from "./db";
import { cards } from "./db/schema";
import { seed } from "./db/seed";
import { cardRoutes } from "./routes/cards";
import { listRoutes } from "./routes/lists";
import { searchRoutes } from "./routes/search";
import { eq, and, isNotNull, sql, lt } from "drizzle-orm";

// ── Boot: migrate + seed ───────────────────────────────────────────────

console.log("Running migrations...");
migrate(db, { migrationsFolder: "./drizzle" });

// FTS5 (can't be in Drizzle migrations)
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
    title, raw_text, tags, content='cards', content_rowid='rowid'
  );
  CREATE TRIGGER IF NOT EXISTS cards_fts_ai AFTER INSERT ON cards BEGIN
    INSERT INTO cards_fts(rowid, title, raw_text, tags)
    VALUES (new.rowid, new.title, new.raw_text, new.tags);
  END;
  CREATE TRIGGER IF NOT EXISTS cards_fts_ad AFTER DELETE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, title, raw_text, tags)
    VALUES ('delete', old.rowid, old.title, old.raw_text, old.tags);
  END;
  CREATE TRIGGER IF NOT EXISTS cards_fts_au AFTER UPDATE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, title, raw_text, tags)
    VALUES ('delete', old.rowid, old.title, old.raw_text, old.tags);
    INSERT INTO cards_fts(rowid, title, raw_text, tags)
    VALUES (new.rowid, new.title, new.raw_text, new.tags);
  END;
`);

seed();
console.log("Database ready.");

// ── App ────────────────────────────────────────────────────────────────

const app = new Hono();

app.use("*", logger());
app.use("*", cors());
app.use("*", compress());

app.get("/api/health", (c) =>
  c.json({ status: "ok", uptime: process.uptime() })
);

app.route("/api/v1/cards", cardRoutes);
app.route("/api/v1/lists", listRoutes);
app.route("/api/v1/search", searchRoutes);
// Stats is mounted under search/ but also at top level for convenience
app.get("/api/v1/stats", async (c) => {
  const byIntent = db
    .select({ intent: cards.intent, count: sql<number>`count(*)` })
    .from(cards)
    .groupBy(cards.intent)
    .all();
  const byStatus = db
    .select({ status: cards.status, count: sql<number>`count(*)` })
    .from(cards)
    .groupBy(cards.status)
    .all();
  const total = db.select({ count: sql<number>`count(*)` }).from(cards).get();
  return c.json({
    by_intent: Object.fromEntries(byIntent.map((r) => [r.intent, r.count])),
    by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
    total: total?.count ?? 0,
  });
});

// ── Card expiry scheduler ──────────────────────────────────────────────

setInterval(() => {
  const result = db
    .update(cards)
    .set({ status: "expired", updatedAt: sql`datetime('now')` })
    .where(
      and(
        eq(cards.status, "active"),
        isNotNull(cards.dueAt),
        lt(cards.dueAt, sql`datetime('now')`)
      )
    )
    .run();
  if (result.changes > 0) {
    console.log(`Expired ${result.changes} card(s)`);
  }
}, 60_000);

// ── Start ──────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? "8080");

export default {
  port,
  fetch: app.fetch,
};

console.log(`Morphe listening on :${port}`);
