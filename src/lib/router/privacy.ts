/**
 * Step 0: Privacy & Modality Router
 * Classifies user capture input into PRIVATE_MEMO vs PUBLIC_ENTITY vs MULTI_ITEM_SOURCE.
 * Ensures private notes never touch public search APIs or global_entities.
 */

import { generateJsonCompletion } from "@/lib/llm/client";
import { discoverUniversalEntities } from "@/lib/enrichment/universalDiscovery";
import { parseQuoteInput } from "@/lib/types/catalog";

export type ModalityIntent = "PRIVATE_MEMO" | "PUBLIC_ENTITY" | "MULTI_ITEM_SOURCE";

export interface PrivacyClassificationResult {
  intent: ModalityIntent;
  confidence: number;
  reasoning: string;
  isPrivate: boolean;
  suggestedTitle: string;
  extractedQuery?: string;
  detectedType?: "PRODUCT" | "PLACE" | "MEDIA" | "BOOK" | "NOTE" | "SOURCE_VIDEO" | "UNKNOWN";
}

const PRIVATE_PATTERNS = [
  /\b(?:met|meeting|talked to|spoke with|call|phone)\s+[a-z]+/i,
  /\b(?:todo|to-do|task|reminder|remember to|buy groceries|dentist|doctor)\b/i,
  /\b(?:note to self|personal memo|my thoughts|private thoughts|personal thoughts|journal|diary|ideas for)\b/i,
  /\b(?:funding|investor|pitch|q[1-4]|budget|salary|nda|confidential)\b/i,
  /\b(?:flight confirmation|hotel reservation|check-in|passport|code:)\b/i,
  /^(?:buy|pick up|get|bring)\s+(?:milk|eggs|groceries|coffee beans|bread)/i,
];

const MULTI_ITEM_PATTERNS = [
  /\b(?:top\s+\d+|\d+\s+best|\d+\s+favorite|\d+\s+books|\d+\s+items|\d+\s+tools)\b/i,
  /\b(?:roundup|list of|collection of|essentials for|gear guide)\b/i,
  /\b(?:gift guide|gift ideas|recommendations for)\b/i,
];

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

/**
 * Fast deterministic heuristics when offline or for instant fallback
 */
export function classifyWithHeuristics(input: string): PrivacyClassificationResult {
  const trimmed = input.trim();

  // 0. Explicit deterministic prefix override
  const prefixMatch = trimmed.match(
    /^(film|movie|cinema|book|novel|song|album|music|vinyl|wine|place|game|videogame|quote|memo|note|todo|private):\s*(.+)$/i
  );
  if (prefixMatch) {
    const rawPrefix = prefixMatch[1].toLowerCase();
    const cleanQuery = prefixMatch[2].trim();
    if (["memo", "note", "todo", "private"].includes(rawPrefix)) {
      return {
        intent: "PRIVATE_MEMO",
        confidence: 1.0,
        reasoning: `Deterministic prefix '${rawPrefix}:' forced private memo`,
        isPrivate: true,
        suggestedTitle: cleanQuery.length > 60 ? cleanQuery.substring(0, 57) + "..." : cleanQuery,
        detectedType: "NOTE",
      };
    }
    if (rawPrefix === "quote") {
      return {
        intent: "PUBLIC_ENTITY",
        confidence: 1.0,
        reasoning: "Deterministic prefix 'quote:' forced quote route",
        isPrivate: false,
        suggestedTitle: cleanQuery,
        extractedQuery: cleanQuery,
        detectedType: "NOTE",
      };
    }

    let detectedType: PrivacyClassificationResult["detectedType"] = "UNKNOWN";
    if (["film", "movie", "cinema"].includes(rawPrefix)) detectedType = "MEDIA";
    else if (["book", "novel"].includes(rawPrefix)) detectedType = "BOOK";
    else if (["song", "album", "music", "vinyl"].includes(rawPrefix)) detectedType = "MEDIA";
    else if (rawPrefix === "wine") detectedType = "PRODUCT";
    else if (rawPrefix === "place") detectedType = "PLACE";
    else if (["game", "videogame"].includes(rawPrefix)) detectedType = "PRODUCT";

    return {
      intent: "PUBLIC_ENTITY",
      confidence: 1.0,
      reasoning: `Deterministic prefix '${rawPrefix}:' forced entity route`,
      isPrivate: false,
      suggestedTitle: cleanQuery,
      extractedQuery: cleanQuery,
      detectedType,
    };
  }

  // 1. URL check
  if (URL_PATTERN.test(trimmed)) {
    const isMulti = /youtube\.com\/playlist|list=|roundup|top-\d+/i.test(trimmed);
    return {
      intent: isMulti ? "MULTI_ITEM_SOURCE" : "PUBLIC_ENTITY",
      confidence: 0.95,
      reasoning: "Valid external URL detected",
      isPrivate: false,
      suggestedTitle: trimmed,
      extractedQuery: trimmed,
      detectedType: isMulti ? "SOURCE_VIDEO" : "UNKNOWN",
    };
  }

  // 1.5. Quotation patterns (e.g. "..." - Author, “...” by Author)
  const parsedQuote = parseQuoteInput(trimmed);
  if (parsedQuote) {
    return {
      intent: "PUBLIC_ENTITY",
      confidence: 0.95,
      reasoning: "Matched quotation pattern with author attribution",
      isPrivate: false,
      suggestedTitle: parsedQuote.text,
      extractedQuery: `${parsedQuote.text} ${parsedQuote.author}`,
      detectedType: "NOTE",
    };
  }

  // 2. Private memo patterns
  for (const pattern of PRIVATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        intent: "PRIVATE_MEMO",
        confidence: 0.92,
        reasoning: "Matched private memo / task / meeting pattern",
        isPrivate: true,
        suggestedTitle: trimmed.length > 60 ? trimmed.substring(0, 57) + "..." : trimmed,
        detectedType: "NOTE",
      };
    }
  }

  // 3. Multi-item patterns
  for (const pattern of MULTI_ITEM_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        intent: "MULTI_ITEM_SOURCE",
        confidence: 0.88,
        reasoning: "Matched multi-item curation or roundup list pattern",
        isPrivate: false,
        suggestedTitle: trimmed,
        extractedQuery: trimmed,
        detectedType: "UNKNOWN",
      };
    }
  }

  // 4. Default to public entity search
  let detectedType: PrivacyClassificationResult["detectedType"] = "UNKNOWN";
  if (/\b(?:book|novel|biography|hardcover|paperback)\b/i.test(trimmed)) {
    detectedType = "BOOK";
  } else if (/\b(?:chair|desk|headphones|shoes|keyboard|camera|phone|laptop|mouse|monitor)\b/i.test(trimmed)) {
    detectedType = "PRODUCT";
  } else if (/\b(?:cafe|coffee|restaurant|hotel|bar|museum|park|tokyo|paris|london|nyc|berlin)\b/i.test(trimmed)) {
    detectedType = "PLACE";
  } else if (/\b(?:movie|film|album|song|podcast|track|director)\b/i.test(trimmed)) {
    detectedType = "MEDIA";
  }

  return {
    intent: "PUBLIC_ENTITY",
    confidence: 0.8,
    reasoning: "General entity or item query",
    isPrivate: false,
    suggestedTitle: trimmed,
    extractedQuery: trimmed,
    detectedType,
  };
}

const LOCAL_SYSTEM_PROMPT = `You are the privacy and entity classifier for Curio, an autonomous personal knowledge and taste graph.
Classify user input into one of three intents:
1. PRIVATE_MEMO: Personal thoughts, private tasks, journal, CRM notes, meeting memos, confidential reminders. These MUST NEVER touch public search.
2. PUBLIC_ENTITY: Single public commercial product, book, movie, restaurant/place, music album, software, hardware.
3. MULTI_ITEM_SOURCE: Video roundups, listicles, articles containing multiple curated items.

Also detect the entity category: "BOOK", "MEDIA", "PRODUCT", "PLACE", "CULINARY", "NOTE", "SOURCE_VIDEO", or "UNKNOWN".
Extract a clean search query for public entities (omit personal lead-in words like "I want to read" or "Look into").
For PRIVATE_MEMO, extractedQuery must be null or empty.

Respond ONLY with valid JSON matching this schema:
{
  "intent": "PRIVATE_MEMO" | "PUBLIC_ENTITY" | "MULTI_ITEM_SOURCE",
  "confidence": number,
  "reasoning": string,
  "suggestedTitle": string,
  "detectedType": "PRODUCT" | "PLACE" | "MEDIA" | "BOOK" | "NOTE" | "SOURCE_VIDEO" | "UNKNOWN",
  "extractedQuery": string | null
}`;

/**
 * Step 0 Router: Classifies capture input using local LLM (Mini Agent Pi / Ollama)
 * with graceful fallback to deterministic regex heuristics.
 */
export async function classifyPrivacyAndModality(
  input: string,
  options?: {
    apiKey?: string;
    fetchFn?: typeof fetch;
    skipLocalLlm?: boolean;
    timeoutMs?: number;
  }
): Promise<PrivacyClassificationResult> {
  const trimmed = input.trim();

  // Instant deterministic check for URLs or quotations
  if (URL_PATTERN.test(trimmed) || parseQuoteInput(trimmed)) {
    return classifyWithHeuristics(trimmed);
  }

  // 1. Explicit Gemini API key (e.g. for unit tests)
  if (options?.apiKey) {
    try {
      const fetchFn = options.fetchFn ?? fetch;
      const prompt = `Analyze this user input for the Curio ingestion pipeline:
"${input}"

Classify into one of these intents:
- PRIVATE_MEMO: Personal thoughts, private tasks, CRM notes, meeting memos, journal entries, personal reminders. These MUST NEVER touch public search.
- PUBLIC_ENTITY: Single public commercial product, book, movie, restaurant/place, music album, software, hardware.
- MULTI_ITEM_SOURCE: Video roundups, listicles, articles containing multiple curated items.

Respond ONLY with valid JSON matching this schema:
{
  "intent": "PRIVATE_MEMO" | "PUBLIC_ENTITY" | "MULTI_ITEM_SOURCE",
  "confidence": number (between 0 and 1),
  "reasoning": string,
  "suggestedTitle": string,
  "detectedType": "PRODUCT" | "PLACE" | "MEDIA" | "BOOK" | "NOTE" | "SOURCE_VIDEO" | "UNKNOWN",
  "extractedQuery": string (clean entity name for search, or empty for PRIVATE_MEMO)
}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${options.apiKey}`;
      const response = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          const intent: ModalityIntent =
            parsed.intent === "PRIVATE_MEMO" ||
            parsed.intent === "MULTI_ITEM_SOURCE" ||
            parsed.intent === "PUBLIC_ENTITY"
              ? parsed.intent
              : "PUBLIC_ENTITY";

          return {
            intent,
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
            reasoning: parsed.reasoning || "Gemini Flash-Lite classification",
            isPrivate: intent === "PRIVATE_MEMO",
            suggestedTitle: parsed.suggestedTitle || input,
            extractedQuery: intent === "PRIVATE_MEMO" ? undefined : (parsed.extractedQuery || input),
            detectedType: parsed.detectedType || (intent === "PRIVATE_MEMO" ? "NOTE" : "UNKNOWN"),
          };
        }
      }
    } catch {
      // Fall through
    }
  }

  // Instant deterministic check for clear private memo patterns (privacy-first: zero model leakage)
  for (const pattern of PRIVATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return classifyWithHeuristics(trimmed);
    }
  }

  // 2. Local LLM (Mini Agent Pi / Ollama with gemma4:12b-it-qat)
  if (!options?.skipLocalLlm) {
    try {
      const localResult = await generateJsonCompletion<{
        intent?: string;
        confidence?: number;
        reasoning?: string;
        suggestedTitle?: string;
        detectedType?: string;
        extractedQuery?: string | null;
      }>(
        `Analyze and classify this user capture input:\n"${trimmed}"`,
        LOCAL_SYSTEM_PROMPT,
        { timeoutMs: options?.timeoutMs ?? 15000 }
      );

      if (
        localResult?.intent === "PRIVATE_MEMO" ||
        localResult?.intent === "PUBLIC_ENTITY" ||
        localResult?.intent === "MULTI_ITEM_SOURCE"
      ) {
        let intent = localResult.intent as ModalityIntent;
        let detectedType =
          (localResult.detectedType as any) || (intent === "PRIVATE_MEMO" ? "NOTE" : "UNKNOWN");
        let extractedQuery =
          intent === "PRIVATE_MEMO" ? undefined : (localResult.extractedQuery || trimmed);

        // Guard against local LLM literal bias / cutoff (e.g. classifying Spanish film "Mi vida sin mi" as personal diary)
        if (intent === "PRIVATE_MEMO") {
          const hasPrivateKeyword = PRIVATE_PATTERNS.some((p) => p.test(trimmed));
          if (!hasPrivateKeyword && trimmed.split(/\s+/).length <= 6) {
            try {
              const universalHits = await discoverUniversalEntities(trimmed, { timeoutMs: 1500 });
              if (universalHits.length > 0 && universalHits[0].typePath !== "/product/generic") {
                const top = universalHits[0];
                intent = "PUBLIC_ENTITY";
                detectedType = (top.coreType as any) || "MEDIA";
                extractedQuery = top.title || trimmed;
              }
            } catch {
              // Ignore discovery timeout/errors and preserve private classification
            }
          }
        }

        return {
          intent,
          confidence: typeof localResult.confidence === "number" ? localResult.confidence : 0.95,
          reasoning: localResult.reasoning || "Local LLM (gemma4) classification",
          isPrivate: intent === "PRIVATE_MEMO",
          suggestedTitle: localResult.suggestedTitle || trimmed,
          extractedQuery,
          detectedType,
        };
      }
    } catch (err) {
      console.warn("[PrivacyRouter] Local LLM failed, falling back to heuristics:", err);
    }
  }

  // 3. Deterministic Heuristics Fallback
  return classifyWithHeuristics(input);
}
