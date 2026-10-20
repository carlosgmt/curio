import { db, userSaves, globalEntities, entryConnections } from "@/db";
import { eq, or, inArray } from "drizzle-orm";
import { cosineSimilarity, generateDeterministicEmbedding } from "@/lib/search/vector";

export interface SerendipityRecommendation {
  sourceSaveId: string;
  sourceTitle: string;
  sourceTypePath: string;
  targetSaveId: string;
  targetTitle: string;
  targetTypePath: string;
  cosineSimilarity: number;
  taxonomicDistance: number;
  sharedEdges: number;
  serendipityScore: number;
  rationale: string;
}

/**
 * Computes Jaccard taxonomic overlap between two materialized type paths
 */
export function calculateTaxonomicJaccard(
  typePathA?: string | null,
  typePathB?: string | null
): number {
  if (!typePathA || !typePathB) return 0;
  const setA = new Set(typePathA.toLowerCase().split("/").filter(Boolean));
  const setB = new Set(typePathB.toLowerCase().split("/").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Serendipity Formula (PRD v3.2 FR-5.3):
 * Serendipity(A, B) = cos(vA, vB) * (1 - J_tax(A, B)) * (1 / (1 + sharedEdges(A, B)))
 */
export function computeSerendipityScore(params: {
  cosineSim: number;
  typePathA?: string | null;
  typePathB?: string | null;
  sharedEdges: number;
}): number {
  const { cosineSim, typePathA, typePathB, sharedEdges } = params;
  const jaccard = calculateTaxonomicJaccard(typePathA, typePathB);
  const scaling = 1.0 / (1.0 + Math.max(0, sharedEdges));
  return Math.max(0, cosineSim) * (1.0 - jaccard) * scaling;
}

/**
 * Generates cross-archetype serendipity recommendations
 */
export async function findSerendipityRecommendations(
  userId: string,
  targetSaveId?: string,
  limit = 10
): Promise<SerendipityRecommendation[]> {
  // 1. Fetch user saves
  const saves = await db
    .select({
      save: userSaves,
      entity: globalEntities,
    })
    .from(userSaves)
    .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
    .where(eq(userSaves.userId, userId));

  if (saves.length < 2) return [];

  // 2. Fetch connections to compute shared edges
  const connections = await db
    .select()
    .from(entryConnections)
    .where(eq(entryConnections.userId, userId));

  const neighborMap = new Map<string, Set<string>>();
  for (const conn of connections) {
    if (!neighborMap.has(conn.sourceSaveId)) neighborMap.set(conn.sourceSaveId, new Set());
    if (!neighborMap.has(conn.targetSaveId)) neighborMap.set(conn.targetSaveId, new Set());
    neighborMap.get(conn.sourceSaveId)!.add(conn.targetSaveId);
    if (conn.isBidirectional) {
      neighborMap.get(conn.targetSaveId)!.add(conn.sourceSaveId);
    }
  }

  // 3. Resolve embeddings
  const savesWithVectors = saves.map((s) => {
    let vec: number[];
    if (s.save.privateEmbedding && s.save.privateEmbedding.length === 768) {
      vec = Array.from(s.save.privateEmbedding);
    } else if (s.entity?.embedding && s.entity.embedding.length === 768) {
      vec = Array.from(s.entity.embedding);
    } else {
      const text = `${s.save.privateTitle || s.entity?.title || ""} ${s.save.typePath || ""}`;
      vec = generateDeterministicEmbedding(text, 768);
    }
    return {
      ...s,
      vector: vec,
      typePath: s.save.typePath || s.entity?.typePath || "/general",
      title: s.save.privateTitle || s.entity?.title || "Untitled",
    };
  });

  const candidates: SerendipityRecommendation[] = [];

  const sourceItems = targetSaveId
    ? savesWithVectors.filter((s) => s.save.id === targetSaveId)
    : savesWithVectors;

  for (const source of sourceItems) {
    const sourceNeighbors = neighborMap.get(source.save.id) || new Set();

    for (const target of savesWithVectors) {
      if (source.save.id === target.save.id) continue;
      // Do not recommend directly connected pairs
      if (sourceNeighbors.has(target.save.id)) continue;

      const jaccard = calculateTaxonomicJaccard(source.typePath, target.typePath);
      // Low taxonomic overlap (< 0.3) ensures true cross-archetype serendipity
      if (jaccard > 0.3) continue;

      const sim = cosineSimilarity(source.vector, target.vector);
      if (sim < 0.65) continue;

      // Compute shared edges (common neighbors)
      const targetNeighbors = neighborMap.get(target.save.id) || new Set();
      let shared = 0;
      for (const n of sourceNeighbors) {
        if (targetNeighbors.has(n)) shared++;
      }

      const score = computeSerendipityScore({
        cosineSim: sim,
        typePathA: source.typePath,
        typePathB: target.typePath,
        sharedEdges: shared,
      });

      candidates.push({
        sourceSaveId: source.save.id,
        sourceTitle: source.title,
        sourceTypePath: source.typePath,
        targetSaveId: target.save.id,
        targetTitle: target.title,
        targetTypePath: target.typePath,
        cosineSimilarity: sim,
        taxonomicDistance: 1 - jaccard,
        sharedEdges: shared,
        serendipityScore: score,
        rationale: `Cross-archetype resonance between ${source.typePath} and ${target.typePath} (${(sim * 100).toFixed(0)}% affinity)`,
      });
    }
  }

  // Sort by highest serendipity score
  return candidates.sort((a, b) => b.serendipityScore - a.serendipityScore).slice(0, limit);
}
