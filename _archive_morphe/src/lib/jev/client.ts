import "server-only";
import { APIUserAbortError, TypeSafeClient } from "@typesafe-ai/sdk";
import { questions, QUESTION_COUNT } from "./questions";
import type { Answer, IntentResult } from "./types";

let client: TypeSafeClient | null = null;
let runtimeKey: string | null = null;
let warned = false;

/** A real-looking key: not empty and not a copied placeholder like "sk-..." or "your-key-here". */
export function looksLikeKey(key: string | undefined | null): key is string {
  const k = key?.trim() ?? "";
  return k.length >= 12 && !/\.\.\.|your|xxx|placeholder|changeme|<|>/i.test(k);
}

export function setRuntimeKey(key: string | null) {
  runtimeKey = key;
  client = null; // Re-instantiate client with new key
}

export function getEffectiveKey(): { key: string | undefined; source: string | null } {
  if (looksLikeKey(runtimeKey)) {
    return { key: runtimeKey, source: "runtime" };
  }
  if (looksLikeKey(process.env.OPENROUTER_API_KEY)) {
    return { key: process.env.OPENROUTER_API_KEY, source: "env" };
  }
  if (looksLikeKey(process.env.TYPESAFE_API_KEY)) {
    return { key: process.env.TYPESAFE_API_KEY, source: "env" };
  }
  try {
    const { sqlite } = require("../../db");
    const row = sqlite.prepare("SELECT value FROM app_settings WHERE key IN ('openrouter_api_key', 'typesafe_api_key') ORDER BY updated_at DESC LIMIT 1").get() as { value?: string } | undefined;
    if (looksLikeKey(row?.value)) {
      return { key: row.value, source: "database" };
    }
  } catch {
    // DB not ready or table missing
  }
  return { key: undefined, source: null };
}

/**
 * Offline by default. The online Jev model is used only when a real API key is set,
 * and NEXT_PUBLIC_USE_MOCK=true can still force offline for UI work and demos.
 */
export function classifierMode(): { mode: "online" | "offline"; reason: string; keySource?: string } {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") return { mode: "offline", reason: "NEXT_PUBLIC_USE_MOCK=true" };
  const { key, source } = getEffectiveKey();
  if (!looksLikeKey(key)) return { mode: "offline", reason: "no API key set" };
  return { mode: "online", reason: "using jev-latest on OpenRouter", keySource: source || undefined };
}

export function warnMockOnce(reason: string) {
  if (warned) return;
  warned = true;
  console.info(`[shapeshift] Offline classifier (jev-offline): ${reason}. Add an OpenRouter key in Settings to use Jev online.`);
}

function getClient() {
  const { key } = getEffectiveKey();
  if (!client) {
    client = new TypeSafeClient({
      apiKey: key,
      baseURL: "https://api.typesafe.ai",
      defaultModel: "jev-latest",
      // One fast attempt: a stale answer is worse than falling back to the mock.
      retry: { maxRetries: 0 },
      timeout: 3000,
    });
  }
  return client;
}

function answer<T extends string>(r: { choice?: T; value?: T; confidence?: number; probabilities?: { readonly [k in T]: number } }): Answer<T> {
  const val = (r?.choice ?? r?.value ?? "none") as T;
  return { value: val, confidence: r?.confidence ?? 1, probabilities: { ...r?.probabilities } as Partial<Record<T, number>> };
}

/** One call, every question in parallel. Throws on network / API errors. */
export async function classifyWithJev(text: string, signal?: AbortSignal): Promise<IntentResult> {
  const { key } = getEffectiveKey();
  if (!key) {
    throw new Error("No API key configured for Jev");
  }

  const started = performance.now();
  let a: any;
  let modelName = "jev-latest";

  if (key.startsWith("sk-or-")) {
    // OpenRouter Decisions API
    const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "typesafe/jev-1.13",
        state: { text },
        questions,
      }),
      signal,
    });

    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as any;
      const errMsg = errBody?.error?.message || response.statusText;
      if (response.status === 402) {
        throw new Error("OpenRouter credit balance is $0. Add credits at https://openrouter.ai/settings/credits or use Local Ollama.");
      }
      if (response.status === 401) {
        throw new Error("OpenRouter error (401): Invalid OpenRouter API key.");
      }
      throw new Error(`OpenRouter Decisions API error (${response.status}): ${errMsg}`);
    }

    const data = (await response.json()) as any;
    a = data.answers;
    modelName = data.model || "typesafe/jev-1.13";
  } else {
    // Native TypeSafe Client
    const res = await getClient().systemOne({ state: { text }, questions }, { signal });
    a = res.answers;
    modelName = res.model || "jev-latest";
  }

  const latencyMs = Math.round(performance.now() - started);

  return {
    intent: answer(a?.intent),
    readiness: a?.readiness?.score ?? 0.5,
    signals: {
      isQuestion: a?.isQuestion?.noul ?? 0,
      recurring: a?.recurring?.noul ?? 0,
      urgency: { score: a?.urgency?.score ?? 0, confidence: a?.urgency?.confidence ?? 1 },
      tone: answer(a?.tone),
      eventMode: answer(a?.eventMode),
      transport: answer(a?.transport),
      tripType: answer(a?.tripType),
      expenseCategory: answer(a?.expenseCategory),
      colorMood: answer(a?.colorMood),
      timerKind: answer(a?.timerKind),
      hasExplicitOptions: a?.hasExplicitOptions?.noul ?? 0,
      isShoppingList: a?.isShoppingList?.noul ?? 0,
    },
    latencyMs,
    questionCount: QUESTION_COUNT,
    model: modelName,
    source: key.startsWith("sk-or-") ? "openrouter" : "jev",
  };
}

export { APIUserAbortError };
