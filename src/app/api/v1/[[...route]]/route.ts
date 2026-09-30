import { settingsRoutes } from "@/routes/settings";
import { typeRoutes } from "@/routes/types";
import { Hono } from "hono";
import { cardRoutes } from "@/routes/cards";
import { listRoutes } from "@/routes/lists";
import { searchRoutes } from "@/routes/search";
import { cards } from "@/db/schema";
import { db } from "@/db";
import { sql } from "drizzle-orm";

const app = new Hono().basePath("/api/v1");

app.route("/cards", cardRoutes);
app.route("/lists", listRoutes);
app.route("/search", searchRoutes);
app.route("/types", typeRoutes);
app.route("/settings", settingsRoutes);
app.get("/stats", async (c) => {
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

export const GET = (req: Request) => app.fetch(req);
export const POST = (req: Request) => app.fetch(req);
export const PATCH = (req: Request) => app.fetch(req);
export const PUT = (req: Request) => app.fetch(req);
export const DELETE = (req: Request) => app.fetch(req);
