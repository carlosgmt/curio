import "server-only";
import { type CardIntent, type IntentResult, INTENT_KEYS, noneResult } from "./jev/types";
import { mockClassify } from "./jev/mock";

export const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.0-flash-001";

export const CURATED_MODELS = [
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", desc: "Fastest response, ultra-low latency & economical (Recommended)" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", desc: "High performance open-weights powerhouse" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", desc: "Powerful reasoning and general knowledge" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", desc: "Highest nuance and precise instruction following" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", desc: "Fast, reliable compact model from OpenAI" },
];

let runtimeKey: string | null = null;
let runtimeModel: string | null = null;

export function looksLikeKey(key: string | undefined | null): key is string {
  const k = key?.trim() ?? "";
  return k.length >= 10 && !/\.\.\.|your|xxx|placeholder|changeme|<|>/i.test(k);
}

export function setRuntimeConfig(key: string | null, model?: string | null) {
  runtimeKey = key;
  if (model) runtimeModel = model;
}

export function getOpenRouterConfig(): { key: string | undefined; model: string; source: string | null } {
  let model = runtimeModel || process.env.OPENROUTER_MODEL;
  let key = looksLikeKey(runtimeKey) ? runtimeKey : undefined;
  let source = key ? "runtime" : null;

  if (!key && looksLikeKey(process.env.OPENROUTER_API_KEY)) {
    key = process.env.OPENROUTER_API_KEY;
    source = "env";
  }

  try {
    const { sqlite } = require("../db");
    const keyRow = sqlite.prepare("SELECT value FROM app_settings WHERE key = 'openrouter_api_key'").get() as { value?: string } | undefined;
    if (!key && looksLikeKey(keyRow?.value)) {
      key = keyRow.value;
      source = "database";
    }
    const modelRow = sqlite.prepare("SELECT value FROM app_settings WHERE key = 'openrouter_model'").get() as { value?: string } | undefined;
    if (modelRow?.value) {
      model = modelRow.value;
    }
  } catch {}

  return {
    key,
    model: model || DEFAULT_OPENROUTER_MODEL,
    source,
  };
}

export async function testOpenRouterConnection(key: string, modelToTest?: string): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
  limit?: string | number;
}> {
  const start = performance.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      return {
        success: false,
        latencyMs,
        message: "OpenRouter authorization rejected. Check your API key.",
      };
    }

    const data = await res.json();
    const limit = data?.data?.limit != null ? `$${data.data.limit}` : "Unlimited";
    const usage = data?.data?.usage != null ? `$${Number(data.data.usage).toFixed(2)}` : "$0";

    return {
      success: true,
      latencyMs,
      message: `OpenRouter key validated (${latencyMs}ms). Credit limit: ${limit} (used ${usage}).`,
      limit,
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Math.round(performance.now() - start),
      message: err?.message || "Network error connecting to OpenRouter.",
    };
  }
}

const SYSTEM_PROMPT = `You are a high-speed intent classifier for a smart card & memory app.
Analyze the user's raw text and classify it into EXACTLY ONE intent from this list:
[todo, note, event, reminder, timer, habit, color, split, expense, convert, calc, travel, poll, contact, link, countdown, timezone, random, goal]

Rules:
- Output MUST be valid JSON only. No markdown, no prose.
- Shape:
{
  "intent": "<one of the intents above>",
  "confidence": <number between 0.5 and 1.0>,
  "summary": "<concise title or action item>",
  "urgency": <number between 0 and 2.0>
}`;

export async function classifyWithOpenRouter(text: string, signal?: AbortSignal): Promise<IntentResult> {
  const { key, model } = getOpenRouterConfig();
  if (!key) {
    return mockClassify(text);
  }

  const start = performance.now();

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "BrainSpace",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal,
    });

    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      console.warn(`[openrouter] API error ${res.status}: falling back to mock classifier`);
      return mockClassify(text);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);

    const intentKey = (parsed.intent || "").toLowerCase();
    const validIntent: CardIntent = INTENT_KEYS.includes(intentKey as any) && intentKey !== "none"
      ? (intentKey as CardIntent)
      : "note";

    const base = mockClassify(text);
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.95;

    return {
      ...base,
      intent: {
        value: validIntent,
        confidence,
        probabilities: { [validIntent]: confidence },
      },
      latencyMs,
      model,
      source: "openrouter",
    };
  } catch (err: any) {
    if (signal?.aborted) throw err;
    console.warn("[openrouter] classification exception:", err?.message || err);
    return mockClassify(text);
  }
}
