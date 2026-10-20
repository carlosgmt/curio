import { db, entryConnections, userSaves, globalEntities } from "@/db";
import { inArray, or, eq } from "drizzle-orm";

export interface PathNode {
  saveId: string;
  title: string;
  typePath?: string | null;
  coreType?: string;
  heroImageUrl?: string | null;
}

export interface PathEdge {
  connectionId: string;
  sourceSaveId: string;
  targetSaveId: string;
  connectionType: string;
  weight: number;
}

export interface ShortestPathResult {
  found: boolean;
  depth: number;
  totalWeight: number;
  path: PathNode[];
  edges: PathEdge[];
}

interface EdgeEntry {
  connectionId: string;
  sourceId: string;
  targetId: string;
  connectionType: string;
  weight: number;
  cost: number;
}

interface SearchState {
  cost: number;
  depth: number;
  path: string[];
  edges: PathEdge[];
}

/**
 * Bounded Bidirectional Dijkstra Shortest Path Search (maxDepth: 4)
 */
export async function findShortestPath(
  sourceSaveId: string,
  targetSaveId: string,
  maxDepth = 4
): Promise<ShortestPathResult> {
  if (sourceSaveId === targetSaveId) {
    const [node] = await fetchNodeDetails([sourceSaveId]);
    return {
      found: true,
      depth: 0,
      totalWeight: 0,
      path: node ? [node] : [],
      edges: [],
    };
  }

  // Forward search state
  const forwardVisited = new Map<string, SearchState>();
  forwardVisited.set(sourceSaveId, {
    cost: 0,
    depth: 0,
    path: [sourceSaveId],
    edges: [],
  });

  // Backward search state
  const backwardVisited = new Map<string, SearchState>();
  backwardVisited.set(targetSaveId, {
    cost: 0,
    depth: 0,
    path: [targetSaveId],
    edges: [],
  });

  let bestMeetingNode: string | null = null;
  let bestTotalCost = Infinity;

  let forwardFrontier = [sourceSaveId];
  let backwardFrontier = [targetSaveId];
  let currentDepth = 0;

  while (
    forwardFrontier.length > 0 &&
    backwardFrontier.length > 0 &&
    currentDepth < maxDepth
  ) {
    currentDepth++;

    // Expand forward frontier
    const nextForwardFrontier: string[] = [];
    const forwardEdges = await fetchAdjacency(forwardFrontier);

    for (const edge of forwardEdges) {
      const fromId = edge.sourceId;
      const toId = edge.targetId;
      const curr = forwardVisited.get(fromId);
      if (!curr || curr.depth >= maxDepth) continue;

      const newCost = curr.cost + edge.cost;
      const newDepth = curr.depth + 1;

      const existing = forwardVisited.get(toId);
      if (!existing || newCost < existing.cost) {
        const pathEdge: PathEdge = {
          connectionId: edge.connectionId,
          sourceSaveId: edge.sourceId,
          targetSaveId: edge.targetId,
          connectionType: edge.connectionType,
          weight: edge.weight,
        };

        const state: SearchState = {
          cost: newCost,
          depth: newDepth,
          path: [...curr.path, toId],
          edges: [...curr.edges, pathEdge],
        };
        forwardVisited.set(toId, state);
        nextForwardFrontier.push(toId);

        // Check if backward search already visited toId
        const backState = backwardVisited.get(toId);
        if (backState && curr.depth + backState.depth + 1 <= maxDepth) {
          const total = newCost + backState.cost;
          if (total < bestTotalCost) {
            bestTotalCost = total;
            bestMeetingNode = toId;
          }
        }
      }
    }

    forwardFrontier = nextForwardFrontier;

    // Expand backward frontier
    const nextBackwardFrontier: string[] = [];
    const backwardEdges = await fetchAdjacency(backwardFrontier);

    for (const edge of backwardEdges) {
      // In backward expansion, edge leads into edge.targetId or reversed
      const fromId = edge.sourceId;
      const toId = edge.targetId;
      const curr = backwardVisited.get(fromId);
      if (!curr || curr.depth >= maxDepth) continue;

      const newCost = curr.cost + edge.cost;
      const newDepth = curr.depth + 1;

      const existing = backwardVisited.get(toId);
      if (!existing || newCost < existing.cost) {
        const pathEdge: PathEdge = {
          connectionId: edge.connectionId,
          sourceSaveId: edge.sourceId,
          targetSaveId: edge.targetId,
          connectionType: edge.connectionType,
          weight: edge.weight,
        };

        const state: SearchState = {
          cost: newCost,
          depth: newDepth,
          path: [...curr.path, toId],
          edges: [...curr.edges, pathEdge],
        };
        backwardVisited.set(toId, state);
        nextBackwardFrontier.push(toId);

        // Check if forward search already visited toId
        const fwdState = forwardVisited.get(toId);
        if (fwdState && curr.depth + fwdState.depth + 1 <= maxDepth) {
          const total = newCost + fwdState.cost;
          if (total < bestTotalCost) {
            bestTotalCost = total;
            bestMeetingNode = toId;
          }
        }
      }
    }

    backwardFrontier = nextBackwardFrontier;

    // Early termination if optimal meeting point found
    if (bestMeetingNode) {
      break;
    }
  }

  if (!bestMeetingNode) {
    return {
      found: false,
      depth: maxDepth,
      totalWeight: Infinity,
      path: [],
      edges: [],
    };
  }

  const fwd = forwardVisited.get(bestMeetingNode)!;
  const bwd = backwardVisited.get(bestMeetingNode)!;

  // Combine paths: forward path up to meeting node + reversed backward path after meeting node
  const backwardPathReversed = [...bwd.path].reverse().slice(1);
  const fullSaveIdPath = [...fwd.path, ...backwardPathReversed];

  // Combine edges
  const backwardEdgesReversed = [...bwd.edges].reverse();
  const fullEdges = [...fwd.edges, ...backwardEdgesReversed];

  const nodes = await fetchNodeDetails(fullSaveIdPath);
  const nodeMap = new Map(nodes.map((n) => [n.saveId, n]));
  const orderedNodes = fullSaveIdPath
    .map((id) => nodeMap.get(id))
    .filter(Boolean) as PathNode[];

  return {
    found: true,
    depth: fullEdges.length,
    totalWeight: bestTotalCost,
    path: orderedNodes,
    edges: fullEdges,
  };
}

/**
 * Loads adjacency edges for a set of nodes
 */
async function fetchAdjacency(nodeIds: string[]): Promise<EdgeEntry[]> {
  if (nodeIds.length === 0) return [];

  const rawEdges = await db
    .select()
    .from(entryConnections)
    .where(
      or(
        inArray(entryConnections.sourceSaveId, nodeIds),
        inArray(entryConnections.targetSaveId, nodeIds)
      )
    );

  const entries: EdgeEntry[] = [];

  for (const edge of rawEdges) {
    const weight = edge.weight || 1.0;
    const cost = 1.0 / Math.max(0.01, weight);

    if (nodeIds.includes(edge.sourceSaveId)) {
      entries.push({
        connectionId: edge.id,
        sourceId: edge.sourceSaveId,
        targetId: edge.targetSaveId,
        connectionType: edge.connectionType,
        weight,
        cost,
      });
    }

    if (edge.isBidirectional && nodeIds.includes(edge.targetSaveId)) {
      entries.push({
        connectionId: edge.id,
        sourceId: edge.targetSaveId,
        targetId: edge.sourceSaveId,
        connectionType: edge.connectionType,
        weight,
        cost,
      });
    }
  }

  return entries;
}

/**
 * Loads metadata for path nodes
 */
async function fetchNodeDetails(saveIds: string[]): Promise<PathNode[]> {
  if (saveIds.length === 0) return [];

  const records = await db
    .select({
      save: userSaves,
      entity: globalEntities,
    })
    .from(userSaves)
    .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
    .where(inArray(userSaves.id, saveIds));

  return records.map((r) => ({
    saveId: r.save.id,
    title: r.save.privateTitle || r.entity?.title || "Untitled",
    typePath: r.save.typePath || r.entity?.typePath || null,
    coreType: r.entity?.coreType || "UNKNOWN",
    heroImageUrl: r.entity?.heroImageUrl || null,
  }));
}
