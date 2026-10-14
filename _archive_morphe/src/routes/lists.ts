import { Hono } from "hono";
import { db } from "../db";
import { lists, listRules, cards } from "../db/schema";
import { eq, sql, ne } from "drizzle-orm";

export const listRoutes = new Hono();

// ── List all lists (with card counts) ──────────────────────────────────

listRoutes.get("/", async (c) => {
  const rows = db
    .select({
      id: lists.id,
      name: lists.name,
      icon: lists.icon,
      color: lists.color,
      sortOrder: lists.sortOrder,
      isDefault: lists.isDefault,
      createdAt: lists.createdAt,
      cardCount: sql<number>`(
        SELECT count(*) FROM cards
        WHERE cards.list_id = lists.id AND cards.status != 'archived'
      )`,
    })
    .from(lists)
    .orderBy(lists.sortOrder)
    .all();

  return c.json(rows);
});

// ── Create list ────────────────────────────────────────────────────────

listRoutes.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.name) return c.json({ error: "name is required" }, 400);

  const maxOrder = db
    .select({ m: sql<number>`coalesce(max(sort_order), 0)` })
    .from(lists)
    .get();

  const row = db
    .insert(lists)
    .values({
      id: body.id ?? crypto.randomUUID(),
      name: body.name,
      icon: body.icon ?? null,
      color: body.color ?? null,
      sortOrder: (maxOrder?.m ?? 0) + 1,
    })
    .returning()
    .get();

  return c.json(row, 201);
});

// ── Update list ────────────────────────────────────────────────────────

listRoutes.patch("/:id", async (c) => {
  const body = await c.req.json();
  const sets: Record<string, any> = {};
  if (body.name !== undefined) sets.name = body.name;
  if (body.icon !== undefined) sets.icon = body.icon;
  if (body.color !== undefined) sets.color = body.color;
  if (body.sort_order !== undefined) sets.sortOrder = body.sort_order;

  if (Object.keys(sets).length === 0) {
    const row = db.select().from(lists).where(eq(lists.id, c.req.param("id"))).get();
    return c.json(row);
  }

  const row = db
    .update(lists)
    .set(sets)
    .where(eq(lists.id, c.req.param("id")))
    .returning()
    .get();
  if (!row) return c.json({ error: "list not found" }, 404);
  return c.json(row);
});

// ── Delete list (moves cards to inbox) ─────────────────────────────────

listRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  // Prevent deleting default list
  const list = db.select().from(lists).where(eq(lists.id, id)).get();
  if (!list) return c.json({ error: "list not found" }, 404);
  if (list.isDefault) return c.json({ error: "cannot delete default list" }, 400);

  // Move cards to inbox
  db.update(cards)
    .set({ listId: "inbox", updatedAt: sql`datetime('now')` })
    .where(eq(cards.listId, id))
    .run();

  db.delete(lists).where(eq(lists.id, id)).run();
  return c.body(null, 204);
});

// ── Rules ──────────────────────────────────────────────────────────────

listRoutes.get("/rules", async (c) => {
  return c.json(db.select().from(listRules).all());
});

listRoutes.put("/rules/:intent", async (c) => {
  const intent = c.req.param("intent");
  const body = await c.req.json();
  if (!body.list_id) return c.json({ error: "list_id is required" }, 400);

  db.insert(listRules)
    .values({ listId: body.list_id, intent })
    .onConflictDoUpdate({
      target: listRules.intent,
      set: { listId: body.list_id },
    })
    .run();

  return c.body(null, 204);
});

listRoutes.delete("/rules/:intent", async (c) => {
  db.delete(listRules)
    .where(eq(listRules.intent, c.req.param("intent")))
    .run();
  return c.body(null, 204);
});
