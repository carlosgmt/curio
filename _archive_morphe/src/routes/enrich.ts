import { Hono } from "hono";
import { autoEnrich, enrichBook, enrichMedia, enrichPlace, enrichLink } from "../lib/enrichment";

export const enrichRoutes = new Hono();

enrichRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { intent, title, text, url } = body;

  if (url) {
    const res = await enrichLink(url);
    return c.json(res ?? {});
  }

  const enriched = await autoEnrich(intent || "note", title || "", text || "");
  return c.json(enriched ?? {});
});

enrichRoutes.get("/book", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "Missing query 'q'" }, 400);
  const res = await enrichBook(q);
  return c.json(res ?? {});
});

enrichRoutes.get("/media", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "Missing query 'q'" }, 400);
  const res = await enrichMedia(q);
  return c.json(res ?? {});
});

enrichRoutes.get("/place", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "Missing query 'q'" }, 400);
  const res = await enrichPlace(q);
  return c.json(res ?? {});
});
