import { Hono } from "hono";
import { getEffectiveKey, setRuntimeKey, classifyWithJev, classifierMode } from "../lib/jev/client";
import { testOllamaConnection, classifyWithOllama } from "../lib/ollama";
import { db, sqlite } from "../db";
import { lists, customTypes, cards } from "../db/schema";
import { sql } from "drizzle-orm";

export const settingsRoutes = new Hono();

settingsRoutes.get("/", async (c) => {
  const { key, source } = getEffectiveKey();
  const listCount = db.select({ count: sql<number>`count(*)` }).from(lists).get()?.count ?? 0;
  const customTypeCount = db.select({ count: sql<number>`count(*)` }).from(customTypes).get()?.count ?? 0;
  const totalCards = db.select({ count: sql<number>`count(*)` }).from(cards).get()?.count ?? 0;

  let currentEngine = "openrouter";
  try {
    const row = sqlite.prepare("SELECT value FROM app_settings WHERE key = 'ai_engine'").get() as { value?: string } | undefined;
    if (row?.value) currentEngine = row.value;
    else if (!key) currentEngine = "ollama";
  } catch {}

  const ollamaStatus = await testOllamaConnection();

  return c.json({
    engine: currentEngine,
    openrouter: {
      hasKey: Boolean(key),
      keySource: source,
      model: "jev-latest",
      name: "Jev (Latest)",
      provider: "OpenRouter (~typesafe/jev-latest)",
    },
    ollama: {
      available: ollamaStatus.success,
      host: ollamaStatus.host,
      gemmaModel: ollamaStatus.gemmaModel,
      models: ollamaStatus.models,
    },
    jev: {
      mode: key ? "online" : "offline",
      reason: key ? "using jev-latest on OpenRouter" : "offline heuristic matching",
      model: "jev-latest",
      hasKey: Boolean(key),
      keySource: source,
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

settingsRoutes.post("/engine", async (c) => {
  const body = await c.req.json();
  const engine = (body.engine ?? "openrouter").trim();

  sqlite.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('ai_engine', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(engine);

  return c.json({ success: true, engine, message: `Active engine set to ${engine}` });
});

settingsRoutes.post("/test-jev", async (c) => {
  const { key } = getEffectiveKey();
  if (!key) {
    return c.json({
      success: false,
      message: "No OpenRouter key configured. Enter your key (sk-or-v1-...) to test Jev.",
    }, 400);
  }

  const start = performance.now();
  try {
    const result = await classifyWithJev("Buy milk and sourdough bread tomorrow at 9am");
    const latencyMs = Math.round(performance.now() - start);
    return c.json({
      success: true,
      model: "jev-latest",
      latencyMs,
      intent: result.intent.value,
      confidence: result.intent.confidence,
      message: `OpenRouter Jev Latest operational (${latencyMs}ms latency). Intent: ${result.intent.value} (${Math.round((result.intent.confidence || 0) * 100)}%).`,
    });
  } catch (err: any) {
    return c.json({
      success: false,
      latencyMs: Math.round(performance.now() - start),
      error: err?.message || "Failed to reach Jev on OpenRouter",
      message: "OpenRouter Jev test failed. Check your API key.",
    }, 400);
  }
});

settingsRoutes.post("/test-ollama", async (c) => {
  const status = await testOllamaConnection();
  if (!status.success) {
    return c.json({
      success: false,
      message: status.message,
    }, 400);
  }

  const start = performance.now();
  try {
    const result = await classifyWithOllama("Meeting with Alex on Friday 3pm");
    const latencyMs = Math.round(performance.now() - start);
    return c.json({
      success: true,
      model: result.model,
      latencyMs,
      intent: result.intent.value,
      message: `Ollama Gemma operational (${latencyMs}ms latency). Model: ${result.model}. Classified as: ${result.intent.value}.`,
    });
  } catch (err: any) {
    return c.json({
      success: false,
      message: err?.message || "Ollama generation failed.",
    }, 400);
  }
});

settingsRoutes.post("/key", async (c) => {
  const body = await c.req.json();
  const key = (body.key ?? "").trim();

  if (!key || key === "KEEP_EXISTING_KEY") {
    return c.json({ error: "key is required" }, 400);
  }

  sqlite.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('openrouter_api_key', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(key);

  setRuntimeKey(key);

  return c.json({ success: true, message: "OpenRouter API key saved" });
});

settingsRoutes.delete("/key", async (c) => {
  sqlite.prepare("DELETE FROM app_settings WHERE key IN ('openrouter_api_key', 'typesafe_api_key')").run();
  setRuntimeKey(null);

  return c.json({ success: true, message: "API key removed" });
});