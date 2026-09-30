import { classifyWithOpenRouter, getOpenRouterConfig } from "@/lib/openrouter";
import { mockClassify } from "@/lib/jev/mock";
import { type IntentResult, intentRequestSchema, noneResult } from "@/lib/jev/types";
import { LRU, normalizeKey } from "@/lib/lru";

export const runtime = "nodejs";

const cache = new LRU<string, IntentResult>(500);

export async function POST(request: Request) {
  const body = intentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Expected { text: string }" }, { status: 400 });

  const text = body.data.text;
  const key = normalizeKey(text);
  if (key.length < 2) return Response.json(noneResult({ model: "none" }));

  const hit = cache.get(key);
  if (hit) return Response.json({ ...hit, latencyMs: 0, cached: true } satisfies IntentResult);

  const { key: openRouterKey, model } = getOpenRouterConfig();

  // If no cloud key is provided, use instant local heuristic classifier
  if (!openRouterKey) {
    return Response.json(mockClassify(text));
  }

  try {
    const result = await classifyWithOpenRouter(text, request.signal);
    console.info(`[openrouter] ${result.model} ${result.latencyMs}ms "${key.slice(0, 40)}" → ${result.intent.value}`);
    cache.set(key, result);
    return Response.json(result);
  } catch (err: any) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    console.warn(`[openrouter] classification fallback: ${err?.message || err}`);
    return Response.json(mockClassify(text));
  }
}
