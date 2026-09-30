import { Hono } from "hono";
import { db } from "../db";
import { customTypes } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { INTENT_KEYS } from "../lib/jev/types";

export const typeRoutes = new Hono();

// ── List all types (built-in + custom) ───────────────────────────────────

typeRoutes.get("/", async (c) => {
  const rows = db.select().from(customTypes).all();
  const customs = rows.map((r) => ({
    ...r,
    fields: JSON.parse(r.fields),
    patterns: JSON.parse(r.patterns),
  }));

  return c.json({
    builtins: INTENT_KEYS.filter((k) => k !== "none"),
    customs,
  });
});

// ── Create or update custom type ─────────────────────────────────────────

typeRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const id = (body.id || body.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (!id || !body.name) {
    return c.json({ error: "name is required" }, 400);
  }

  const existing = db.select().from(customTypes).where(eq(customTypes.id, id)).get();

  if (existing) {
    const updated = db
      .update(customTypes)
      .set({
        name: body.name,
        description: body.description ?? existing.description,
        icon: body.icon ?? existing.icon,
        color: body.color ?? existing.color,
        fields: JSON.stringify(body.fields ?? JSON.parse(existing.fields)),
        patterns: JSON.stringify(body.patterns ?? JSON.parse(existing.patterns)),
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(customTypes.id, id))
      .returning()
      .get();

    return c.json({
      ...updated,
      fields: JSON.parse(updated.fields),
      patterns: JSON.parse(updated.patterns),
    });
  }

  const inserted = db
    .insert(customTypes)
    .values({
      id,
      name: body.name,
      description: body.description ?? null,
      icon: body.icon ?? "Sparkles",
      color: body.color ?? "oklch(0.65 0.18 270)",
      fields: JSON.stringify(body.fields ?? []),
      patterns: JSON.stringify(body.patterns ?? [id, body.name.toLowerCase()]),
    })
    .returning()
    .get();

  return c.json(
    {
      ...inserted,
      fields: JSON.parse(inserted.fields),
      patterns: JSON.parse(inserted.patterns),
    },
    201
  );
});

// ── Delete custom type ───────────────────────────────────────────────────

typeRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const deleted = db.delete(customTypes).where(eq(customTypes.id, id)).returning().get();
  if (!deleted) return c.json({ error: "type not found" }, 404);
  return c.body(null, 204);
});
