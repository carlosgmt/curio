import { classifierMode, classifyWithJev, APIUserAbortError } from "@/lib/jev/client";
import { classifyWithOllama } from "@/lib/ollama";
import { mockClassify } from "@/lib/jev/mock";
import { type IntentResult, intentRequestSchema, noneResult } from "@/lib/jev/types";
import { LRU, normalizeKey } from "@/lib/lru";
import { sqlite } from "@/db";

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

  // Check configured engine: "openrouter" (Jev) | "ollama" (Gemma) | "offline"
  let engine = "openrouter";
  try {
    const row = sqlite.prepare("SELECT value FROM app_settings WHERE key = 'ai_engine'").get() as { value?: string } | undefined;
    if (row?.value) engine = row.value;
  } catch {}

  // 1. Ollama (Gemma)
  if (engine === "ollama") {
    try {
      const result = await classifyWithOllama(text, request.signal);
      console.info(`[ollama] ${result.model} ${result.latencyMs}ms "${key.slice(0, 40)}" → ${result.intent.value}`);
      cache.set(key, result);
      return Response.json(result);
    } catch (err: any) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      console.warn(`[ollama] fallback to mock: ${err?.message || err}`);
      return Response.json(mockClassify(text));
    }
  }

  // 2. OpenRouter (Jev Latest)
  const { mode } = classifierMode();
  if (mode === "online") {
    try {
      const result = await classifyWithJev(text, request.signal);
      console.info(`[jev-openrouter] ${result.model} ${result.latencyMs}ms "${key.slice(0, 40)}" → ${result.intent.value}`);
      cache.set(key, result);
      return Response.json(result);
    } catch (err: any) {
      if (err instanceof APIUserAbortError || request.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      console.warn(`[jev-openrouter] call failed: ${err?.message || err}`);
      return Response.json(mockClassify(text));
    }
  }

  // 3. Offline Heuristic Classifier (instant 0.1ms)
  return Response.json(mockClassify(text));
}
