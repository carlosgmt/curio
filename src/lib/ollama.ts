import "server-only";
import { type CardIntent, type IntentResult, INTENT_KEYS } from "./jev/types";
import { mockClassify } from "./jev/mock";

const OLLAMA_HOSTS = [
  process.env.OLLAMA_HOST,
  "http://host.docker.internal:11434",
  "http://127.0.0.1:11434",
  "http://localhost:11434",
].filter(Boolean) as string[];

async function getReachableHost(): Promise<string | null> {
  for (const host of OLLAMA_HOSTS) {
    try {
      const res = await fetch(`${host}/api/tags`, {
        signal: AbortSignal.timeout(1200),
      });
      if (res.ok) return host;
    } catch {}
  }
  return null;
}

export async function testOllamaConnection(): Promise<{
  success: boolean;
  host: string | null;
  models: string[];
  gemmaModel: string | null;
  message: string;
}> {
  const host = await getReachableHost();
  if (!host) {
    return {
      success: false,
      host: null,
      models: [],
      gemmaModel: null,
      message: "Ollama not detected on port 11434.",
    };
  }

  try {
    const res = await fetch(`${host}/api/tags`);
    const data = await res.json();
    const modelNames: string[] = (data?.models || []).map((m: any) => m.name || m.model);
    const gemma = modelNames.find((m) => m.toLowerCase().includes("gemma")) || modelNames[0] || null;

    return {
      success: true,
      host,
      models: modelNames,
      gemmaModel: gemma,
      message: gemma
        ? `Ollama active at ${host}. Found Gemma model: ${gemma}`
        : `Ollama active at ${host}. No Gemma model found (available: ${modelNames.join(", ")}).`,
    };
  } catch (err: any) {
    return {
      success: false,
      host,
      models: [],
      gemmaModel: null,
      message: err?.message || "Failed to query Ollama tags",
    };
  }
}

const PROMPT_TEMPLATE = (text: string) => `Classify the following text into EXACTLY ONE intent from this list:
[todo, note, event, reminder, timer, habit, color, split, expense, convert, calc, travel, poll, contact, link, countdown, timezone, random, goal]

Input: "${text}"

Respond in JSON only with format: {"intent": "<one_intent_from_list>", "confidence": 0.95}`;

export async function classifyWithOllama(text: string, signal?: AbortSignal): Promise<IntentResult> {
  const host = await getReachableHost();
  if (!host) {
    return mockClassify(text);
  }

  const start = performance.now();

  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma4:e4b",
        prompt: PROMPT_TEMPLATE(text),
        format: "json",
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 30,
        },
      }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(3000)]) : AbortSignal.timeout(3000),
    });

    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      return mockClassify(text);
    }

    const data = await res.json();
    let parsed: any = {};
    try {
      parsed = JSON.parse(data.response || "{}");
    } catch {}

    const intentKey = (parsed.intent || "").toLowerCase();
    const validIntent: CardIntent = INTENT_KEYS.includes(intentKey as any) && intentKey !== "none"
      ? (intentKey as CardIntent)
      : "note";

    const base = mockClassify(text);
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.92;

    return {
      ...base,
      intent: {
        value: validIntent,
        confidence,
        probabilities: { [validIntent]: confidence },
      },
      latencyMs,
      model: data.model || "gemma4:e4b",
      source: "ollama",
    };
  } catch (err: any) {
    if (signal?.aborted) throw err;
    return mockClassify(text);
  }
}
