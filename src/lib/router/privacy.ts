/**
 * Step 0: Privacy & Modality Router
 * Classifies user capture input into PRIVATE_MEMO vs PUBLIC_ENTITY vs MULTI_ITEM_SOURCE.
 * Ensures private notes never touch public search APIs or global_entities.
 */

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
  /\b(?:note to self|personal memo|my thoughts|journal|diary|ideas for)\b/i,
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

/**
 * Step 0 Router: Classifies capture input using Gemini Flash-Lite with fallback to heuristics
 */
export async function classifyPrivacyAndModality(
  input: string,
  options?: {
    apiKey?: string;
    fetchFn?: typeof fetch;
  }
): Promise<PrivacyClassificationResult> {
  const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY;
  const fetchFn = options?.fetchFn ?? fetch;

  if (!apiKey) {
    return classifyWithHeuristics(input);
  }

  try {
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
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

    if (!response.ok) {
      return classifyWithHeuristics(input);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return classifyWithHeuristics(input);
    }

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
  } catch {
    return classifyWithHeuristics(input);
  }
}
