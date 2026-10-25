export interface CompletionOptions {
  jsonMode?: boolean;
  timeoutMs?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const DEFAULT_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_MODEL = "gemma4:12b-it-qat";
const DEFAULT_TIMEOUT_MS = 120000;

export function getLocalLlmConfig() {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.LOCAL_LLM_MODEL || DEFAULT_MODEL;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), model };
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
  const { baseUrl, model } = getLocalLlmConfig();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const messages: ChatMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const payload: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    temperature: options.temperature ?? 0.1,
  };

  if (options.jsonMode) {
    payload.response_format = { type: "json_object" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${baseUrl}/chat/completions`, {
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
    const content = data?.choices?.[0]?.message?.content;
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
