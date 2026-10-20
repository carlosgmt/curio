import { db, userSaves, globalEntities } from "@/db";
import { eq, desc } from "drizzle-orm";
import { getLocalLlmConfig } from "@/lib/llm/client";
import { decryptPrivateField } from "@/lib/security/encryption";

export interface HybridSearchOptions {
  query: string;
  userId: string;
  limit?: number;
  semanticWeight?: number; // 0.0 (lexical only) to 1.0 (semantic only), default 0.5
  category?: string;
}

export interface HybridSearchResult {
  saveId: string;
  title: string;
  summary: string | null;
  heroImageUrl: string | null;
  typePath: string | null;
  coreType: string | null;
  isPrivateMemo: boolean;
  score: number;
  semanticScore: number;
  lexicalScore: number;
  save: typeof userSaves.$inferSelect;
  entity: typeof globalEntities.$inferSelect | null;
}

const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";
const EMBEDDING_TIMEOUT_MS = 2000;
const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 1000;

/**
 * Computes dot product of two vectors of equal length.
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Computes cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  // Bound to -1 .. 1 due to floating point precision
  return Math.max(-1, Math.min(1, sim));
}

function fnv1a(str: string, seed: number = 0x811c9dc5): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Generates a deterministic 768-dimensional dense TF-IDF character/word n-gram vector.
 * Used as an instant local fallback when Ollama is offline or unconfigured.
 */
export function generateDeterministicEmbedding(text: string, dimensions: number = 768): number[] {
  const vector = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().trim();
  if (!normalized) return vector;

  // 1. Unigram / Character hashing pass (ensures strings < 3 chars like "AI", "4K", "CD", "Go" produce non-zero unit vectors)
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    let hash = 0x811c9dc5 ^ code;
    hash = Math.imul(hash, 0x01000193);
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 0.5;
  }

  // 2. FNV-1a 3-gram hashing expanded to 768 dimensions
  if (normalized.length >= 3) {
    for (let i = 0; i < normalized.length - 2; i++) {
      const gram = normalized.slice(i, i + 3);
      let hash = 0x811c9dc5;
      for (let j = 0; j < gram.length; j++) {
        hash ^= gram.charCodeAt(j);
        hash = Math.imul(hash, 0x01000193);
      }
      const idx = Math.abs(hash) % dimensions;
      vector[idx] += 1.0;
    }
  }

  // 3. L2 normalize
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) sumSq += vector[i] * vector[i];
  const mag = Math.sqrt(sumSq) || 1;
  return vector.map((v) => v / mag);
}

/**
 * Generates vector embeddings for a given text.
 * Queries local Ollama `/v1/embeddings` endpoint with timeout.
 * Automatically and gracefully falls back to deterministic 384-d dense vector when Ollama is offline.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const cacheKey = text.trim();
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  const { baseUrl } = getLocalLlmConfig();
  const model = process.env.LOCAL_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

    const res = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: text,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const embedding = data?.data?.[0]?.embedding;
      if (Array.isArray(embedding) && embedding.length > 0) {
        if (embeddingCache.size >= MAX_CACHE_SIZE) {
          embeddingCache.clear();
        }
        embeddingCache.set(cacheKey, embedding);
        return embedding;
      }
    }
  } catch {
    // Ollama offline or timed out; fall back gracefully to deterministic dense vector
  }

  const fallback = generateDeterministicEmbedding(text);
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    embeddingCache.clear();
  }
  embeddingCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Computes lexical match score between query and document text fields.
 */
export function computeLexicalScore(
  query: string,
  doc: {
    title: string;
    summary?: string | null;
    personalNotes?: string | null;
    autoTags?: string[] | null;
    brandOrCreator?: string | null;
  }
): number {
  const qTokens = (query.toLowerCase().match(/\b\w+\b/g) || []).filter((t) => t.length > 1);
  if (qTokens.length === 0) return 0;

  const titleLower = (doc.title || "").toLowerCase();
  const summaryLower = (doc.summary || "").toLowerCase();
  const notesLower = (doc.personalNotes || "").toLowerCase();
  const brandLower = (doc.brandOrCreator || "").toLowerCase();
  const tagsLower = (doc.autoTags || []).map((t) => t.toLowerCase());

  let totalScore = 0;
  const queryLower = query.toLowerCase().trim();

  // Exact phrase match bonus in title
  if (titleLower.includes(queryLower)) {
    totalScore += 0.4;
  }

  for (const token of qTokens) {
    let tokenScore = 0;

    if (titleLower.includes(token)) {
      tokenScore += 0.35;
    }
    if (tagsLower.some((t) => t.includes(token))) {
      tokenScore += 0.25;
    }
    if (brandLower.includes(token)) {
      tokenScore += 0.2;
    }
    if (summaryLower.includes(token) || notesLower.includes(token)) {
      tokenScore += 0.2;
    }

    totalScore += tokenScore / qTokens.length;
  }

  return Math.min(1.0, Math.max(0.0, totalScore));
}

/**
 * Performs hybrid semantic + lexical search across a user's Curio saves.
 */
export async function hybridSearch(options: HybridSearchOptions): Promise<HybridSearchResult[]> {
  const { query, userId, limit = 20, semanticWeight = 0.5 } = options;
  const trimmed = query.trim();

  // Retrieve user's saves with linked entities
  let records = await db
    .select({
      save: userSaves,
      entity: globalEntities,
    })
    .from(userSaves)
    .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
    .where(eq(userSaves.userId, userId))
    .orderBy(desc(userSaves.createdAt));

  if (options.category) {
    const cat = options.category.toLowerCase();
    records = records.filter(
      (r) =>
        (r.save.typePath || "").toLowerCase().startsWith(cat) ||
        (r.entity?.typePath || "").toLowerCase().startsWith(cat)
    );
  }

  if (records.length === 0) {
    return [];
  }

  // If query is empty, return latest saves
  if (!trimmed) {
    return records.slice(0, limit).map((r) => {
      const decryptedTitle = r.save.privateTitle ? decryptPrivateField(r.save.privateTitle) : null;
      const decryptedNotes = r.save.personalNotes ? decryptPrivateField(r.save.personalNotes) : null;
      const title = decryptedTitle || r.entity?.title || "Untitled";
      const summary = r.entity?.summary || decryptedNotes || null;

      return {
        saveId: r.save.id,
        title,
        summary,
        heroImageUrl: r.entity?.heroImageUrl || null,
        typePath: r.save.typePath || r.entity?.typePath || null,
        coreType: r.entity?.coreType || (r.save.isPrivateMemo ? "PRIVATE_MEMO" : "UNKNOWN"),
        isPrivateMemo: r.save.isPrivateMemo,
        score: 1.0,
        semanticScore: 1.0,
        lexicalScore: 1.0,
        save: {
          ...r.save,
          privateTitle: decryptedTitle,
          personalNotes: decryptedNotes,
        },
        entity: r.entity,
      };
    });
  }

  const queryEmbedding = await generateEmbedding(trimmed);
  const scoredItems: HybridSearchResult[] = [];

  for (const r of records) {
    const decryptedTitle = r.save.privateTitle ? decryptPrivateField(r.save.privateTitle) : null;
    const decryptedNotes = r.save.personalNotes ? decryptPrivateField(r.save.personalNotes) : null;

    const title = decryptedTitle || r.entity?.title || "Untitled";
    const summary = r.entity?.summary || null;
    const personalNotes = decryptedNotes;
    const autoTags = r.save.autoTags || [];
    const brand = r.entity?.brandOrCreator || null;

    // 1. Lexical Score
    const lexicalScore = computeLexicalScore(trimmed, {
      title,
      summary,
      personalNotes,
      autoTags,
      brandOrCreator: brand,
    });

    // 2. Semantic Score
    const docRepresentation = [title, summary, personalNotes, autoTags.join(" "), brand]
      .filter(Boolean)
      .join(" ");

    const docEmbedding = await generateEmbedding(docRepresentation);
    let semanticScore = 0;
    if (queryEmbedding.length === docEmbedding.length) {
      const cosSim = cosineSimilarity(queryEmbedding, docEmbedding);
      // Map [-1, 1] to [0, 1]
      semanticScore = Math.max(0, cosSim);
    }

    // 3. Blend Scores
    const weight = Math.max(0, Math.min(1, semanticWeight));
    const finalScore = weight * semanticScore + (1 - weight) * lexicalScore;

    if (finalScore > 0.05 || lexicalScore > 0) {
      scoredItems.push({
        saveId: r.save.id,
        title,
        summary: summary || personalNotes,
        heroImageUrl: r.entity?.heroImageUrl || null,
        typePath: r.save.typePath || r.entity?.typePath || null,
        coreType: r.entity?.coreType || (r.save.isPrivateMemo ? "PRIVATE_MEMO" : "UNKNOWN"),
        isPrivateMemo: r.save.isPrivateMemo,
        score: Number(finalScore.toFixed(4)),
        semanticScore: Number(semanticScore.toFixed(4)),
        lexicalScore: Number(lexicalScore.toFixed(4)),
        save: {
          ...r.save,
          privateTitle: decryptedTitle,
          personalNotes: decryptedNotes,
        },
        entity: r.entity,
      });
    }
  }

  // Sort descending by finalScore
  scoredItems.sort((a, b) => b.score - a.score);

  return scoredItems.slice(0, limit);
}
