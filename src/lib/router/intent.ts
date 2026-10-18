/**
 * Step -0.5: Omnibox Intent Router & Disambiguation Engine (PRD v3.2 Journey 6)
 *
 * Tier 0: Syntax / Prefix (<1 ms)
 * Tier 1: Deterministic Grammar Regexes & Active Save Resolution (<15 ms, $0.00)
 * Tier 2: Asynchronous Local LLM Disambiguation (Optional Fallback)
 */

import { db, userSaves, globalEntities, entitySources, smartLists } from "@/db";
import { eq, or } from "drizzle-orm";
import { classifyWithHeuristics } from "./privacy";

export type OmniboxIntentType =
  | "SEARCH_QUERY"
  | "EDIT_SAVE"
  | "ADD_ENTITY"
  | "PRIVATE_MEMO";

export type EditActionType =
  | "RATING"
  | "NOTE"
  | "LIST_MOVE"
  | "STATUS"
  | "CHECKLIST_APPEND"
  | "VIEW";

export interface SaveCandidate {
  saveId: string;
  entityId: string | null;
  title: string;
  typePath: string | null;
  similarity: number;
  personalNotes?: string | null;
  rating?: number | null;
  heroImageUrl?: string | null;
  brandOrCreator?: string | null;
}

export interface EditDetails {
  action: EditActionType;
  targetTitle?: string;
  rating?: number;
  note?: string;
  targetList?: string;
  status?: string;
  itemToAdd?: string;
}

export interface OmniboxIntentResult {
  intent: OmniboxIntentType;
  confidence: number;
  tier: 0 | 1 | 2;
  action?: EditActionType;
  targetSave?: SaveCandidate;
  ambiguousCandidates?: SaveCandidate[];
  extractedQuery?: string;
  editDetails?: EditDetails;
  suggestedTitle?: string;
  reasoning: string;
  latencyMs?: number;
}

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const EXPLICIT_MEMO_PREFIXES = /^(?:todo:|task:|call\s+[a-z]+|met\s+[a-z]+)/i;

/**
 * Computes trigram similarity between two strings.
 */
export function computeTrigramSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().trim();
  const normB = b.toLowerCase().trim();
  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0;
  if (normA.length < 3 || normB.length < 3) {
    return normA.includes(normB) || normB.includes(normA) ? 0.85 : 0;
  }
  const trigramsA = new Set<string>();
  for (let i = 0; i <= normA.length - 3; i++) {
    trigramsA.add(normA.slice(i, i + 3));
  }
  const trigramsB = new Set<string>();
  for (let i = 0; i <= normB.length - 3; i++) {
    trigramsB.add(normB.slice(i, i + 3));
  }
  let intersection = 0;
  for (const tri of trigramsA) {
    if (trigramsB.has(tri)) intersection++;
  }
  return (2 * intersection) / (trigramsA.size + trigramsB.size);
}

/**
 * Scores candidate save title/creator against target string.
 * Exact match: 1.0
 * Prefix match: 0.95
 * Word-boundary match: 0.90
 * Trigram similarity: >0.80
 */
export function scoreCandidate(
  target: string,
  candidateTitle: string,
  candidateCreator?: string | null
): number {
  const normTarget = target.toLowerCase().trim();
  const normTitle = (candidateTitle || "").toLowerCase().trim();
  const normCreator = (candidateCreator || "").toLowerCase().trim();

  if (!normTarget) return 0;

  // 1. Exact match
  if (normTarget === normTitle || (normCreator && normTarget === normCreator)) {
    return 1.0;
  }

  // 2. Prefix match
  if (
    normTitle.startsWith(normTarget) ||
    normTarget.startsWith(normTitle) ||
    (normCreator && (normCreator.startsWith(normTarget) || normTarget.startsWith(normCreator)))
  ) {
    return 0.95;
  }

  // 3. Word-boundary match
  const escaped = normTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordBoundaryRegex = new RegExp(`\\b${escaped}\\b`, "i");
  if (wordBoundaryRegex.test(normTitle) || (normCreator && wordBoundaryRegex.test(normCreator))) {
    return 0.90;
  }

  // Also check if any individual word in candidate matches the target
  const targetWords = normTarget.split(/\s+/).filter(Boolean);
  if (targetWords.length === 1) {
    const singleWordRegex = new RegExp(`\\b${targetWords[0]}\\b`, "i");
    if (singleWordRegex.test(normTitle) || (normCreator && singleWordRegex.test(normCreator))) {
      return 0.90;
    }
  }

  // 4. Trigram similarity (>0.80)
  const triTitle = computeTrigramSimilarity(normTarget, normTitle);
  const triCreator = normCreator ? computeTrigramSimilarity(normTarget, normCreator) : 0;
  const bestTri = Math.max(triTitle, triCreator);
  if (bestTri > 0.80) {
    return bestTri;
  }

  return 0;
}

export interface OmniboxOptions {
  skipLocalLlm?: boolean;
}

/**
 * Parse grammar patterns into edit details.
 */
export function parseEditGrammar(input: string): EditDetails | null {
  const trimmed = input.trim();

  // 1. Rating:
  // /^(?:change|update|set)?\s*rating(?:\s*to)?\s*([1-5](?:\.[0-9])?|\d+)\s*(?:stars?)?(?:\s*(?:for|to|on)\s*(.+))?$/i
  const ratingMatch1 = trimmed.match(
    /^(?:change|update|set)?\s*rating(?:\s*to)?\s*([1-5](?:\.[0-9])?|\d+)\s*(?:stars?)?(?:\s*(?:for|to|on)\s*(.+))?$/i
  );
  if (ratingMatch1) {
    const rating = parseFloat(ratingMatch1[1]);
    const targetTitle = (ratingMatch1[2] || "").trim();
    return {
      action: "RATING",
      rating,
      targetTitle,
    };
  }

  // /(?:rate)\s+(.+?)\s+([1-5](?:\.[0-9])?|\d+)\s*(?:stars?)?/i
  const ratingMatch2 = trimmed.match(/(?:rate)\s+(.+?)\s+([1-5](?:\.[0-9])?|\d+)\s*(?:stars?)?$/i);
  if (ratingMatch2) {
    const targetTitle = ratingMatch2[1].trim();
    const rating = parseFloat(ratingMatch2[2]);
    return {
      action: "RATING",
      rating,
      targetTitle,
    };
  }

  // /(.+?):\s*([1-5](?:\.[0-9])?|\d+)\s*stars?/i
  const ratingMatch3 = trimmed.match(/^(.+?):\s*([1-5](?:\.[0-9])?|\d+)\s*stars?$/i);
  if (ratingMatch3) {
    const targetTitle = ratingMatch3[1].trim();
    const rating = parseFloat(ratingMatch3[2]);
    return {
      action: "RATING",
      rating,
      targetTitle,
    };
  }

  // 2. List Movement:
  // /^(?:move)\s+(.+?)\s+to\s+([a-z0-9\s_-]+)$/i
  const moveMatch = trimmed.match(/^(?:move)\s+(.+?)\s+to\s+([a-z0-9\s_-]+)$/i);
  if (moveMatch) {
    return {
      action: "LIST_MOVE",
      targetTitle: moveMatch[1].trim(),
      targetList: moveMatch[2].trim(),
    };
  }

  // 3. Notes / Reactions with "add notes to":
  // /(?:add\s+notes?(?:\s*to)?|note:?)\s*(.+?)(?::\s*(.+))?$/i
  const noteMatch = trimmed.match(/^(?:add\s+notes?(?:\s*to)?|note:?)\s*(.+?)(?::\s*(.+))?$/i);
  if (noteMatch) {
    const targetTitle = noteMatch[1].trim();
    const note = (noteMatch[2] || "").trim();
    return {
      action: "NOTE",
      targetTitle,
      note,
    };
  }

  // 4. Status / Progress:
  // /^(?:finished|completed|read|watched|listened to)\s+(?:reading\s+|watching\s+)?(.+)$/i
  const statusMatch = trimmed.match(
    /^(?:finished|completed|read|watched|listened to)\s+(?:reading\s+|watching\s+)?(.+)$/i
  );
  if (statusMatch) {
    const verb = trimmed.split(/\s+/)[0].toLowerCase();
    const targetTitle = statusMatch[1].trim();
    return {
      action: "STATUS",
      targetTitle,
      status: verb,
      note: trimmed,
    };
  }

  // 5. Notes / Reactions:
  // /^(?:loved|liked|hated|enjoyed|disliked|started|reading|watching)\s+(?:the\s+)?(?:ending\s+of\s+|book\s+|movie\s+|album\s+)?(.+)/i
  const reactionMatch = trimmed.match(
    /^(?:loved|liked|hated|enjoyed|disliked|started|reading|watching)\s+(?:the\s+)?(?:ending\s+of\s+|book\s+|movie\s+|album\s+)?(.+)/i
  );
  if (reactionMatch) {
    const targetTitle = reactionMatch[1].trim();
    return {
      action: "NOTE",
      targetTitle,
      note: trimmed,
    };
  }

  // 6. Generic "add [item] to [target]"
  const addMatch = trimmed.match(/^add\s+(.+?)\s+to\s+(.+)$/i);
  if (addMatch) {
    return {
      action: "LIST_MOVE",
      targetTitle: addMatch[1].trim(),
      targetList: addMatch[2].trim(),
      itemToAdd: addMatch[1].trim(),
    };
  }

  return null;
}

/**
 * Primary Omnibox Intent Classifier
 */
export async function classifyOmniboxIntent(
  input: string,
  userId: string,
  options?: OmniboxOptions
): Promise<OmniboxIntentResult> {
  const startTime = performance.now();
  const trimmed = input.trim();

  // -------------------------------------------------------------
  // TIER 0: Syntax / Prefix (<1 ms)
  // -------------------------------------------------------------

  // 1. Starts with '/' -> SEARCH_QUERY
  if (trimmed.startsWith("/")) {
    const query = trimmed.slice(1).trim();
    return {
      intent: "SEARCH_QUERY",
      confidence: 1.0,
      tier: 0,
      extractedQuery: query,
      suggestedTitle: query,
      reasoning: "Leading slash detected (Search Query)",
      latencyMs: performance.now() - startTime,
    };
  }

  // 2. Valid URL check
  if (URL_PATTERN.test(trimmed)) {
    // Check if user already saved this entity/URL
    const matchingSources = await db
      .select({
        saveId: userSaves.id,
        entityId: userSaves.entityId,
        privateTitle: userSaves.privateTitle,
        globalTitle: globalEntities.title,
        typePath: userSaves.typePath,
        heroImageUrl: globalEntities.heroImageUrl,
      })
      .from(userSaves)
      .innerJoin(entitySources, eq(userSaves.entityId, entitySources.entityId))
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.userId, userId))
      .limit(1);

    const savedBySource = matchingSources.find((s) => s.saveId);
    if (savedBySource) {
      const candidate: SaveCandidate = {
        saveId: savedBySource.saveId,
        entityId: savedBySource.entityId,
        title: savedBySource.privateTitle || savedBySource.globalTitle || trimmed,
        typePath: savedBySource.typePath,
        similarity: 1.0,
        heroImageUrl: savedBySource.heroImageUrl,
      };
      return {
        intent: "EDIT_SAVE",
        confidence: 1.0,
        tier: 0,
        action: "VIEW",
        targetSave: candidate,
        suggestedTitle: candidate.title,
        reasoning: "URL already present in vault (Open/Edit Card)",
        latencyMs: performance.now() - startTime,
      };
    }

    return {
      intent: "ADD_ENTITY",
      confidence: 0.95,
      tier: 0,
      extractedQuery: trimmed,
      suggestedTitle: trimmed,
      reasoning: "Valid external URL detected (Ingest entity)",
      latencyMs: performance.now() - startTime,
    };
  }

  // 3. Explicit Memo triggers
  if (EXPLICIT_MEMO_PREFIXES.test(trimmed)) {
    return {
      intent: "PRIVATE_MEMO",
      confidence: 0.95,
      tier: 0,
      suggestedTitle: trimmed.length > 60 ? trimmed.substring(0, 57) + "..." : trimmed,
      reasoning: "Explicit memo trigger detected (todo / met / call)",
      latencyMs: performance.now() - startTime,
    };
  }

  // -------------------------------------------------------------
  // TIER 1: Deterministic Grammar & Active Save Resolution (<15 ms)
  // -------------------------------------------------------------
  const editDetails = parseEditGrammar(trimmed);

  if (editDetails && editDetails.targetTitle) {
    // Resolve active saves for the target title
    const userVault = await db
      .select({
        saveId: userSaves.id,
        entityId: userSaves.entityId,
        privateTitle: userSaves.privateTitle,
        personalNotes: userSaves.personalNotes,
        typePath: userSaves.typePath,
        globalTitle: globalEntities.title,
        brandOrCreator: globalEntities.brandOrCreator,
        heroImageUrl: globalEntities.heroImageUrl,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.userId, userId));

    const scoredCandidates: SaveCandidate[] = [];
    for (const item of userVault) {
      const title = item.privateTitle || item.globalTitle || "";
      const score = scoreCandidate(editDetails.targetTitle, title, item.brandOrCreator);
      if (score >= 0.80) {
        scoredCandidates.push({
          saveId: item.saveId,
          entityId: item.entityId,
          title,
          typePath: item.typePath,
          similarity: score,
          personalNotes: item.personalNotes,
          heroImageUrl: item.heroImageUrl,
          brandOrCreator: item.brandOrCreator,
        });
      }
    }

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.similarity - a.similarity);

    const highConfidenceCandidates = scoredCandidates.filter((c) => c.similarity >= 0.88);

    // Single high confidence match: EDIT_SAVE
    if (highConfidenceCandidates.length === 1) {
      const best = highConfidenceCandidates[0];
      return {
        intent: "EDIT_SAVE",
        confidence: best.similarity,
        tier: 1,
        action: editDetails.action,
        targetSave: best,
        editDetails,
        suggestedTitle: best.title,
        reasoning: `High confidence match for saved item '${best.title}'`,
        latencyMs: performance.now() - startTime,
      };
    }

    // Multiple high confidence matches: Ambiguous EDIT_SAVE
    if (highConfidenceCandidates.length > 1) {
      return {
        intent: "EDIT_SAVE",
        confidence: 0.65,
        tier: 1,
        action: editDetails.action,
        ambiguousCandidates: highConfidenceCandidates,
        targetSave: highConfidenceCandidates[0],
        editDetails,
        suggestedTitle: highConfidenceCandidates[0].title,
        reasoning: `Ambiguous match: multiple saved items match '${editDetails.targetTitle}'`,
        latencyMs: performance.now() - startTime,
      };
    }

    // Edit verb detected but no existing save matches
    return {
      intent: "ADD_ENTITY",
      confidence: 0.85,
      tier: 1,
      action: editDetails.action,
      editDetails,
      suggestedTitle: editDetails.targetTitle,
      extractedQuery: editDetails.targetTitle,
      reasoning: `Edit operation detected for '${editDetails.targetTitle}', but item is not yet saved. Offering capture as new card.`,
      latencyMs: performance.now() - startTime,
    };
  }

  // -------------------------------------------------------------
  // General text checks (Private Memo vs Add Entity)
  // -------------------------------------------------------------
  const heuristicResult = classifyWithHeuristics(trimmed);
  if (heuristicResult.intent === "PRIVATE_MEMO") {
    return {
      intent: "PRIVATE_MEMO",
      confidence: heuristicResult.confidence,
      tier: 1,
      suggestedTitle: heuristicResult.suggestedTitle,
      reasoning: heuristicResult.reasoning,
      latencyMs: performance.now() - startTime,
    };
  }

  return {
    intent: "ADD_ENTITY",
    confidence: 0.90,
    tier: 1,
    suggestedTitle: trimmed,
    extractedQuery: trimmed,
    reasoning: "Standard entity capture input",
    latencyMs: performance.now() - startTime,
  };
}
