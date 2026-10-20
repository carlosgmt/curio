import { db, userSaves, globalEntities, entryConnections, backgroundJobs } from "@/db";
import { eq, or, inArray } from "drizzle-orm";
import { cosineSimilarity, generateDeterministicEmbedding } from "@/lib/search/vector";

export interface TasteCluster {
  id: string;
  label: string;
  memberSaveIds: string[];
  centroid: number[]; // 768 dimensions
  dominantArchetype?: string;
  modularityScore: number;
}

export interface ClusteringResult {
  userId: string;
  clusters: TasteCluster[];
  computedAt: string;
}

// In-memory cluster cache for fast <10ms endpoint responses
const clusterCache = new Map<string, ClusteringResult>();

/**
 * Enqueues a Louvain clustering background job
 */
export async function enqueueClusteringJob(userId: string): Promise<string> {
  const [job] = await db
    .insert(backgroundJobs)
    .values({
      queueName: "clustering",
      payload: JSON.stringify({ userId }),
      status: "QUEUED",
    })
    .returning();

  return job.id;
}

/**
 * Computes Louvain modularity clustering over connections and vector affinities
 */
export async function executeClusteringJob(userId: string): Promise<ClusteringResult> {
  // 1. Fetch user saves and embeddings
  const saves = await db
    .select({
      save: userSaves,
      entity: globalEntities,
    })
    .from(userSaves)
    .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
    .where(eq(userSaves.userId, userId));

  if (saves.length === 0) {
    const emptyResult: ClusteringResult = {
      userId,
      clusters: [],
      computedAt: new Date().toISOString(),
    };
    clusterCache.set(userId, emptyResult);
    return emptyResult;
  }

  // 2. Fetch connections
  const saveIds = saves.map((s) => s.save.id);
  const connections = await db
    .select()
    .from(entryConnections)
    .where(eq(entryConnections.userId, userId));

  // 3. Build Adjacency Matrix
  const nodeIndexMap = new Map<string, number>();
  saveIds.forEach((id, idx) => nodeIndexMap.set(id, idx));
  const n = saveIds.length;

  // Initialize adjacency weights
  const adj: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  // Add explicit connection weights
  for (const conn of connections) {
    const u = nodeIndexMap.get(conn.sourceSaveId);
    const v = nodeIndexMap.get(conn.targetSaveId);
    if (u !== undefined && v !== undefined) {
      const w = conn.weight || 1.0;
      adj[u][v] += w;
      adj[v][u] += w;
    }
  }

  // Add vector similarity weights for unlinked or weakly linked pairs
  const nodeVectors: number[][] = saves.map((s) => {
    if (s.save.privateEmbedding && s.save.privateEmbedding.length === 768) {
      return Array.from(s.save.privateEmbedding);
    }
    if (s.entity?.embedding && s.entity.embedding.length === 768) {
      return Array.from(s.entity.embedding);
    }
    const text = `${s.save.privateTitle || s.entity?.title || ""} ${s.save.typePath || ""}`;
    return generateDeterministicEmbedding(text, 768);
  });

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(nodeVectors[i], nodeVectors[j]);
      if (sim > 0.65) {
        adj[i][j] += sim * 0.5;
        adj[j][i] += sim * 0.5;
      }
    }
  }

  // 4. Louvain Community Detection Partitioning
  // Initial assignment: each node in its own community
  const communityAssignment = Array.from({ length: n }, (_, i) => i);

  // Compute total edge weight
  let totalWeight = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      totalWeight += adj[i][j];
    }
  }
  const m = totalWeight > 0 ? totalWeight / 2 : 1;

  // Iterative modularity optimization pass
  let improved = true;
  let iterations = 0;
  const maxIterations = 15;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < n; i++) {
      const currentComm = communityAssignment[i];
      let bestComm = currentComm;
      let bestGain = 0;

      // Check neighbor communities
      const neighborComms = new Set<number>();
      for (let j = 0; j < n; j++) {
        if (adj[i][j] > 0) {
          neighborComms.add(communityAssignment[j]);
        }
      }

      for (const targetComm of neighborComms) {
        if (targetComm === currentComm) continue;

        // Approximate modularity gain: dQ = sum_{j in targetComm} adj[i][j]
        let weightIntoTarget = 0;
        let weightIntoCurrent = 0;
        for (let j = 0; j < n; j++) {
          if (communityAssignment[j] === targetComm) weightIntoTarget += adj[i][j];
          if (communityAssignment[j] === currentComm && j !== i) weightIntoCurrent += adj[i][j];
        }

        const gain = (weightIntoTarget - weightIntoCurrent) / (2 * m);
        if (gain > bestGain) {
          bestGain = gain;
          bestComm = targetComm;
        }
      }

      if (bestGain > 0.001 && bestComm !== currentComm) {
        communityAssignment[i] = bestComm;
        improved = true;
      }
    }
  }

  // 5. Aggregate communities into TasteClusters
  const clusterGroups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const comm = communityAssignment[i];
    const group = clusterGroups.get(comm) || [];
    group.push(i);
    clusterGroups.set(comm, group);
  }

  const clusters: TasteCluster[] = [];
  let clusterIdx = 1;

  for (const [_, memberIndices] of clusterGroups.entries()) {
    const memberSaves = memberIndices.map((idx) => saves[idx]);
    const memberIds = memberSaves.map((s) => s.save.id);

    // Compute normalized 768-dim centroid vector: C = sum(v) / ||sum(v)||
    const sumVector = new Float32Array(768);
    for (const idx of memberIndices) {
      const vec = nodeVectors[idx];
      for (let d = 0; d < 768; d++) {
        sumVector[d] += vec[d] || 0;
      }
    }

    let norm = 0;
    for (let d = 0; d < 768; d++) {
      norm += sumVector[d] * sumVector[d];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let d = 0; d < 768; d++) {
        sumVector[d] /= norm;
      }
    }

    // Determine dominant archetype / label
    const typeCounts = new Map<string, number>();
    for (const s of memberSaves) {
      const type = (s.save.typePath || s.entity?.coreType || "GENERAL").toUpperCase();
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }
    let dominantType = "CULTURE";
    let maxCount = 0;
    for (const [t, c] of typeCounts.entries()) {
      if (c > maxCount) {
        maxCount = c;
        dominantType = t;
      }
    }

    const firstTitle = memberSaves[0].save.privateTitle || memberSaves[0].entity?.title || "Taste";
    const label = `${dominantType.replace(/_/g, " ")} Cluster (${firstTitle})`;

    clusters.push({
      id: `cluster-${clusterIdx++}`,
      label,
      memberSaveIds: memberIds,
      centroid: Array.from(sumVector),
      dominantArchetype: dominantType,
      modularityScore: memberIndices.length / n,
    });
  }

  const result: ClusteringResult = {
    userId,
    clusters,
    computedAt: new Date().toISOString(),
  };

  clusterCache.set(userId, result);
  return result;
}

/**
 * Retrieves cached precomputed clusters
 */
export async function getPrecomputedClusters(userId: string): Promise<TasteCluster[]> {
  const cached = clusterCache.get(userId);
  if (cached) {
    return cached.clusters;
  }
  const result = await executeClusteringJob(userId);
  return result.clusters;
}
