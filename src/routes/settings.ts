import { Hono } from "hono";
import { getOpenRouterConfig, setRuntimeConfig, testOpenRouterConnection, CURATED_MODELS, DEFAULT_OPENROUTER_MODEL } from "../lib/openrouter";
import { db, sqlite } from "../db";
import { lists, customTypes, cards } from "../db/schema";
import { sql } from "drizzle-orm";

export const settingsRoutes = new Hono();

settingsRoutes.get("/", async (c) => {
  const config = getOpenRouterConfig();
  const listCount = db.select({ count: sql<number>`count(*)` }).from(lists).get()?.count ?? 0;
  const customTypeCount = db.select({ count: sql<number>`count(*)` }).from(customTypes).get()?.count ?? 0;
  const totalCards = db.select({ count: sql<number>`count(*)` }).from(cards).get()?.count ?? 0;

  return c.json({
    openrouter: {
      hasKey: Boolean(config.key),
      keySource: config.source,
      model: config.model,
      models: CURATED_MODELS,
      defaultModel: DEFAULT_OPENROUTER_MODEL,
    },
    // Backwards-compatible jev payload for any existing consumers
    jev: {
      mode: config.key ? "online" : "offline",
      reason: config.key ? `using ${config.model}` : "offline heuristic matching",
      model: config.model,
      hasKey: Boolean(config.key),
      keySource: config.source,
    },
    counts: {
      lists: listCount,
      customTypes: customTypeCount,
      totalCards,
    },
    app: {
      name: "BrainSpace",
      version: "0.1.0",
    }
  });
});

settingsRoutes.post("/test-jev", async (c) => {
  const config = getOpenRouterConfig();
  if (!config.key) {
    return c.json({
      success: true,
      mode: "offline",
      message: "Offline heuristic matching active. Add an OpenRouter key to enable cloud models.",
    });
  }

  const result = await testOpenRouterConnection(config.key, config.model);
  return c.json({
    ...result,
    provider: "openrouter",
    model: config.model,
  }, result.success ? 200 : 400);
});

settingsRoutes.post("/key", async (c) => {
  const body = await c.req.json();
  const key = (body.key ?? "").trim();
  const model = (body.model ?? "").trim();

  if (key && key !== "KEEP_EXISTING_KEY") {
    sqlite.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('openrouter_api_key', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run(key);
  }

  if (model) {
    sqlite.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('openrouter_model', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run(model);
  }

  setRuntimeConfig(key && key !== "KEEP_EXISTING_KEY" ? key : null, model || undefined);

  return c.json({ success: true, message: "OpenRouter configuration saved" });
});

settingsRoutes.delete("/key", async (c) => {
  sqlite.prepare("DELETE FROM app_settings WHERE key = 'openrouter_api_key'").run();
  setRuntimeConfig(null);

  return c.json({ success: true, message: "OpenRouter key removed" });
});