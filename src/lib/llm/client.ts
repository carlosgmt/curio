export interface CompletionOptions {
  jsonMode?: boolean;
  timeoutMs?: number;
  temperature?: number;
  think?: boolean;
  maxTokens?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const DEFAULT_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_MODEL = "gemma4:12b-it-qat";
const DEFAULT_TIMEOUT_MS = 120000;
const INITIAL_GLOBAL_FETCH = globalThis.fetch;

export function getLocalLlmConfig() {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.LOCAL_LLM_MODEL || DEFAULT_MODEL;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), model };
}

export function isLocalLlmDisabled(customFetch?: typeof fetch): boolean {
  if (process.env.DISABLE_LOCAL_LLM === "true" || process.env.OLLAMA_BASE_URL === "disabled") {
    return true;
  }
  const activeFetch = customFetch ?? globalThis.fetch;
  const isMockedFetch = activeFetch !== INITIAL_GLOBAL_FETCH;
  if (
    process.env.NODE_ENV === "test" &&
    !isMockedFetch &&
    !process.env.OLLAMA_BASE_URL &&
    process.env.ENABLE_TEST_OLLAMA !== "true"
  ) {
    return true;
  }
  return false;
}

/**
 * Invokes local Ollama / Mini Agent Pi using OpenAI-compatible chat completions.
 * Returns null if Ollama is unreachable, times out, or fails, allowing callers to gracefully fall back.
 */
export async function generateChatCompletion(
  prompt: string,
  systemPrompt?: string,
  options: CompletionOptions = {}
): Promise<string | null> {
  if (isLocalLlmDisabled()) {
    return null;
  }
  const { baseUrl, model } = getLocalLlmConfig();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const messages: ChatMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const payload: Record<string, unknown> =
    options.think === false
      ? {
          model,
          messages,
          stream: false,
          think: false,
          ...(options.jsonMode ? { format: "json" } : {}),
          options: {
            temperature: options.temperature ?? 0.1,
            ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
          },
        }
      : {
          model,
          messages,
          stream: false,
          temperature: options.temperature ?? 0.1,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
          ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        };

  const endpointUrl =
    options.think === false
      ? `${baseUrl.replace(/\/v1\/?$/, "")}/api/chat`
      : `${baseUrl}/chat/completions`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[LocalLLM] Request failed with status ${res.status}: ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const content =
      data?.message?.content ?? data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return null;
    }

    return content.trim();
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.warn(`[LocalLLM] Request timed out after ${timeoutMs}ms`);
    } else {
      console.warn(`[LocalLLM] Ollama call failed (is Ollama running?):`, err.message || err);
    }
    return null;
  }
}

/**
 * Invokes local LLM in JSON mode and safely parses the output.
 */
export async function generateJsonCompletion<T = unknown>(
  prompt: string,
  systemPrompt?: string,
  options: CompletionOptions = {}
): Promise<T | null> {
  const raw = await generateChatCompletion(prompt, systemPrompt, {
    ...options,
    jsonMode: true,
  });

  if (!raw) return null;

  try {
    // If output is fenced in markdown code blocks like ```json ... ```, strip them
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Attempt extracting the first JSON object using regex
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // Fall through
      }
    }
    console.warn(`[LocalLLM] Failed to parse JSON response:`, raw);
    return null;
  }
}

/**
 * Explicitly unloads the active Ollama model (`keep_alive: 0`) after batch runs
 * so ~8 GB RAM is freed immediately on host mini.
 */
export async function releaseLocalLlmModel(): Promise<void> {
  if (isLocalLlmDisabled()) {
    return;
  }
  const { baseUrl, model } = getLocalLlmConfig();
  const ollamaRoot = baseUrl.replace(/\/v1\/?$/, "");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(`${ollamaRoot}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: "", keep_alive: 0, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // Non-fatal best-effort cleanup
  }
}
