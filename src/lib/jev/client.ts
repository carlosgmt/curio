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
  if (looksLikeKey(process.env.TYPESAFE_API_KEY)) {
    return { key: process.env.TYPESAFE_API_KEY, source: "env" };
  }
  try {
    const { sqlite } = require("../../db");
    const row = sqlite.prepare("SELECT value FROM app_settings WHERE key = 'typesafe_api_key'").get() as { value?: string } | undefined;
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
  if (!looksLikeKey(key)) return { mode: "offline", reason: "no TYPESAFE_API_KEY set" };
  return { mode: "online", reason: `using ${process.env.JEV_MODEL || "jev-latest"}`, keySource: source || undefined };
}

export function warnMockOnce(reason: string) {
  if (warned) return;
  warned = true;
  console.info(`[shapeshift] Offline classifier (jev-offline): ${reason}. Add a TypeSafe key in Settings to go online.`);
}

function getClient() {
  const { key } = getEffectiveKey();
  if (!client) {
    client = new TypeSafeClient({
      apiKey: key,
      defaultModel: process.env.JEV_MODEL || "jev-latest",
      // One fast attempt: a stale answer is worse than falling back to the mock.
      retry: { maxRetries: 0 },
      timeout: 2500,
    });
  }
  return client;
}

function answer<T extends string>(r: { choice: T; confidence: number; probabilities: { readonly [k in T]: number } }): Answer<T> {
  return { value: r.choice, confidence: r.confidence, probabilities: { ...r.probabilities } as Partial<Record<T, number>> };
}

/** One call, every question in parallel. Throws on network / API errors. */
export async function classifyWithJev(text: string, signal?: AbortSignal): Promise<IntentResult> {
  const started = performance.now();
  const res = await getClient().systemOne({ state: { text }, questions }, { signal });
  const latencyMs = Math.round(performance.now() - started);
  const a = res.answers;

  return {
    intent: answer(a.intent),
    readiness: a.readiness.score,
    signals: {
      isQuestion: a.isQuestion.noul,
      recurring: a.recurring.noul,
      urgency: { score: a.urgency.score, confidence: a.urgency.confidence },
      tone: answer(a.tone),
      eventMode: answer(a.eventMode),
      transport: answer(a.transport),
      tripType: answer(a.tripType),
      expenseCategory: answer(a.expenseCategory),
      colorMood: answer(a.colorMood),
      timerKind: answer(a.timerKind),
      hasExplicitOptions: a.hasExplicitOptions.noul,
      isShoppingList: a.isShoppingList.noul,
    },
    latencyMs,
    questionCount: QUESTION_COUNT,
    model: res.model,
    source: "jev",
  };
}

export { APIUserAbortError };
