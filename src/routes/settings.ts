import { Hono } from "hono";
import { classifierMode, looksLikeKey } from "../lib/jev/client";
import { db } from "../db";
import { lists, customTypes, cards } from "../db/schema";
import { sql } from "drizzle-orm";

export const settingsRoutes = new Hono();

settingsRoutes.get("/", async (c) => {
  const modeInfo = classifierMode();
  const listCount = db.select({ count: sql<number>`count(*)` }).from(lists).get()?.count ?? 0;
  const customTypeCount = db.select({ count: sql<number>`count(*)` }).from(customTypes).get()?.count ?? 0;
  const totalCards = db.select({ count: sql<number>`count(*)` }).from(cards).get()?.count ?? 0;

  return c.json({
    jev: {
      mode: modeInfo.mode,
      reason: modeInfo.reason,
      model: process.env.JEV_MODEL || "jev-latest",
      hasKey: modeInfo.mode === "online" || Boolean(modeInfo.keySource),
      keySource: modeInfo.keySource || null,
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
  const modeInfo = classifierMode();
  if (modeInfo.mode === "offline") {
    return c.json({
      success: true,
      mode: "offline",
      message: "Offline classifier is active (no API key required). Instant heuristic matching enabled.",
    });
  }

  const { getEffectiveKey } = await import("../lib/jev/client");
  const { key } = getEffectiveKey();

  if (key && key.startsWith("sk-or-v1-")) {
    try {
      const start = performance.now();
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok) {
        const keyData = await res.json();
        return c.json({
          success: true,
          mode: "online",
          provider: "openrouter",
          latencyMs,
          message: `Connected to OpenRouter successfully (${latencyMs}ms latency). Limit: $${keyData?.data?.limit ?? "Unlimited"}.`,
        });
      } else {
        return c.json({
          success: false,
          error: "Unauthorized",
          message: "OpenRouter authorization failed. Check your API key.",
        }, 400);
      }
    } catch (err: any) {
      return c.json({
        success: false,
        error: err?.message || "Failed to reach OpenRouter",
        message: "Failed to connect to OpenRouter.",
      }, 500);
    }
  }

  try {
    const { classifyWithJev } = await import("../lib/jev/client");
    const result = await classifyWithJev("Buy milk and eggs tomorrow");
    return c.json({
      success: true,
      mode: "online",
      provider: "typesafe",
      latencyMs: result.latencyMs,
      intent: result.intent.value,
      confidence: result.intent.confidence,
      message: `Connected to TypeSafe Jev successfully (${result.latencyMs}ms latency).`,
    });
  } catch (err: any) {
    return c.json({
      success: false,
      error: err?.message || "Failed to reach TypeSafe API",
      message: "Connection test failed. Check your API key.",
    }, 500);
  }
});
settingsRoutes.post("/key", async (c) => {
  const body = await c.req.json();
  const key = (body.key ?? "").trim();
  const { sqlite } = await import("../db");
  const { setRuntimeKey } = await import("../lib/jev/client");

  if (!key) {
    return c.json({ error: "key is required" }, 400);
  }

  sqlite.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('typesafe_api_key', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(key);

  setRuntimeKey(key);

  return c.json({ success: true, message: "TypeSafe API key saved" });
});

settingsRoutes.delete("/key", async (c) => {
  const { sqlite } = await import("../db");
  const { setRuntimeKey } = await import("../lib/jev/client");

  sqlite.prepare("DELETE FROM app_settings WHERE key = 'typesafe_api_key'").run();
  setRuntimeKey(null);

  return c.json({ success: true, message: "TypeSafe API key removed" });
});