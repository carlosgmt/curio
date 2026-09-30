import { Hono } from "hono";
import { db } from "../db";
import { cards, listRules, cardEvents } from "../db/schema";
import { eq, and, inArray, sql, like, gte, lte, desc, asc } from "drizzle-orm";

export const cardRoutes = new Hono();

// ── List / filter cards ────────────────────────────────────────────────

cardRoutes.get("/", async (c) => {
  const q = c.req.query();
  const limit = Math.min(parseInt(q.limit ?? "20"), 100);
  const offset = parseInt(q.offset ?? "0");

  const conditions: any[] = [];

  if (q.intent) {
    conditions.push(inArray(cards.intent, q.intent.split(",")));
  }
  if (q.status) {
    conditions.push(inArray(cards.status, q.status.split(",")));
  }
  if (q.list) {
    conditions.push(inArray(cards.listId, q.list.split(",")));
  }
  if (q.tags) {
    for (const tag of q.tags.split(",")) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM json_each(${cards.tags}) WHERE json_each.value = ${tag})`
      );
    }
  }
  if (q.from) {
    conditions.push(gte(cards.createdAt, q.from));
  }
  if (q.to) {
    conditions.push(lte(cards.createdAt, q.to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderCol =
    q.sort === "updated_at" ? cards.updatedAt :
    q.sort === "due_at" ? cards.dueAt :
    cards.createdAt;
  const orderDir = q.sort === "due_at" ? asc(orderCol) : desc(orderCol);

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(cards)
      .where(where)
      .orderBy(orderDir)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(cards)
      .where(where),
  ]);

  return c.json({
    cards: rows.map(deserializeCard),
    total: countResult[0].count,
  });
});

// ── Create card ────────────────────────────────────────────────────────

cardRoutes.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.intent || !body.title) {
    return c.json({ error: "intent and title are required" }, 400);
  }

  // Auto-assign list from rules if not provided
  let listId = body.list_id ?? body.listId;
  if (!listId) {
    const rule = db
      .select({ listId: listRules.listId })
      .from(listRules)
      .where(eq(listRules.intent, body.intent))
      .get();
    listId = rule?.listId ?? "inbox";
  }

  const row = db
    .insert(cards)
    .values({
      intent: body.intent,
      status: body.status ?? "active",
      title: body.title,
      rawText: body.raw_text ?? body.rawText ?? body.title,
      data: JSON.stringify(body.data ?? {}),
      tags: JSON.stringify(body.tags ?? []),
      listId,
      dueAt: body.due_at ?? body.dueAt ?? null,
    })
    .returning()
    .get();

  // Audit event
  db.insert(cardEvents)
    .values({ cardId: row.id, actor: body.actor ?? "user", action: "created" })
    .run();

  return c.json(deserializeCard(row), 201);
});

// ── Get card ───────────────────────────────────────────────────────────

cardRoutes.get("/:id", async (c) => {
  const row = db.select().from(cards).where(eq(cards.id, c.req.param("id"))).get();
  if (!row) return c.json({ error: "card not found" }, 404);
  return c.json(deserializeCard(row));
});

// ── Update card ────────────────────────────────────────────────────────

cardRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const sets: Record<string, any> = { updatedAt: sql`datetime('now')` };
  const diff: Record<string, any> = {};

  if (body.title !== undefined) { sets.title = body.title; diff.title = body.title; }
  if (body.status !== undefined) {
    sets.status = body.status;
    diff.status = body.status;
    if (body.status === "archived") sets.archivedAt = sql`datetime('now')`;
    if (body.status === "active") sets.archivedAt = null;
  }
  if (body.list_id !== undefined || body.listId !== undefined) {
    const lid = body.list_id ?? body.listId;
    sets.listId = lid;
    diff.list_id = lid;
  }
  if (body.data !== undefined) { sets.data = JSON.stringify(body.data); diff.data = body.data; }
  if (body.tags !== undefined) { sets.tags = JSON.stringify(body.tags); diff.tags = body.tags; }
  if (body.due_at !== undefined || body.dueAt !== undefined) {
    const d = body.due_at ?? body.dueAt;
    sets.dueAt = d;
    diff.due_at = d;
  }

  const row = db.update(cards).set(sets).where(eq(cards.id, id)).returning().get();
  if (!row) return c.json({ error: "card not found" }, 404);

  const action = body.status === "archived" ? "archived" :
    diff.list_id ? "moved" : "updated";
  db.insert(cardEvents)
    .values({
      cardId: id,
      actor: body.actor ?? "user",
      action,
      diff: JSON.stringify(diff),
    })
    .run();

  return c.json(deserializeCard(row));
});

// ── Delete card ────────────────────────────────────────────────────────

cardRoutes.delete("/:id", async (c) => {
  const deleted = db
    .delete(cards)
    .where(eq(cards.id, c.req.param("id")))
    .returning()
    .get();
  if (!deleted) return c.json({ error: "card not found" }, 404);
  return c.body(null, 204);
});

// ── Helpers ────────────────────────────────────────────────────────────

function deserializeCard(row: typeof cards.$inferSelect) {
  return {
    ...row,
    data: JSON.parse(row.data),
    tags: JSON.parse(row.tags),
  };
}
