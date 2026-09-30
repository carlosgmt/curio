import { Hono } from "hono";
import { db, sqlite } from "../db";
import { cards } from "../db/schema";
import { sql } from "drizzle-orm";

export const searchRoutes = new Hono();

// ── Full-text search via FTS5 ──────────────────────────────────────────

searchRoutes.get("/", async (c) => {
  const q = c.req.query("q") ?? "";
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const offset = parseInt(c.req.query("offset") ?? "0");
  const intentFilter = c.req.query("intent");
  const statusFilter = c.req.query("status");
  const listFilter = c.req.query("list");

  if (!q) {
    return c.json({ cards: [], total: 0 });
  }

  // Build WHERE clause fragments
  const filters: string[] = [];
  const params: any[] = [q];

  if (intentFilter) {
    const intents = intentFilter.split(",");
    filters.push(`c.intent IN (${intents.map(() => "?").join(",")})`);
    params.push(...intents);
  }
  if (statusFilter) {
    const statuses = statusFilter.split(",");
    filters.push(`c.status IN (${statuses.map(() => "?").join(",")})`);
    params.push(...statuses);
  }
  if (listFilter) {
    const lists = listFilter.split(",");
    filters.push(`c.list_id IN (${lists.map(() => "?").join(",")})`);
    params.push(...lists);
  }

  const whereExtra = filters.length > 0 ? "AND " + filters.join(" AND ") : "";

  // FTS5 query — raw SQL since Drizzle doesn't support virtual tables
  const countRow = sqlite
    .prepare(
      `SELECT count(*) as n FROM cards c
       JOIN cards_fts f ON c.rowid = f.rowid
       WHERE f.cards_fts MATCH ? ${whereExtra}`
    )
    .get(...params) as { n: number };

  const rows = sqlite
    .prepare(
      `SELECT c.* FROM cards c
       JOIN cards_fts f ON c.rowid = f.rowid
       WHERE f.cards_fts MATCH ? ${whereExtra}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as any[];

  return c.json({
    cards: rows.map((r) => ({
      ...r,
      data: JSON.parse(r.data),
      tags: JSON.parse(r.tags),
    })),
    total: countRow?.n ?? 0,
  });
});

// ── Stats ──────────────────────────────────────────────────────────────

searchRoutes.get("/stats", async (c) => {
  const byIntent = db
    .select({
      intent: cards.intent,
      count: sql<number>`count(*)`,
    })
    .from(cards)
    .groupBy(cards.intent)
    .all();

  const byStatus = db
    .select({
      status: cards.status,
      count: sql<number>`count(*)`,
    })
    .from(cards)
    .groupBy(cards.status)
    .all();

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(cards)
    .get();

  return c.json({
    by_intent: Object.fromEntries(byIntent.map((r) => [r.intent, r.count])),
    by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
    total: total?.count ?? 0,
  });
});
