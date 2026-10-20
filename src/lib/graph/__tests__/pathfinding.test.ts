import { describe, expect, it } from "bun:test";
import { db, users, userSaves, entryConnections } from "@/db";
import { findShortestPath } from "../pathfinding";
import { createConnection } from "@/lib/connections/service";

describe("Bounded Bidirectional Dijkstra Pathfinding (FR-5.1)", () => {
  it("finds shortest path within maxDepth: 4 and terminates gracefully beyond depth 4", async () => {
    const runId = Date.now();

    // 1. Ensure user
    let [user] = await db.select().from(users).limit(1);
    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          email: `graph-test-${runId}@curio.local`,
          username: `graph_test_${runId}`,
          displayName: "Graph Path Test",
        })
        .returning();
    }

    // 2. Create chain of saves: N0 -> N1 -> N2 -> N3 -> N4 -> N5
    const saves = [];
    for (let i = 0; i < 6; i++) {
      const [save] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          privateTitle: `Taste Node ${i} (${runId})`,
          typePath: "/media/film",
        })
        .returning();
      saves.push(save);
    }

    // Connect sequentially: (0,1), (1,2), (2,3), (3,4), (4,5)
    for (let i = 0; i < 5; i++) {
      await createConnection({
        userId: user.id,
        sourceSaveId: saves[i].id,
        targetSaveId: saves[i + 1].id,
        connectionType: "AESTHETIC_SIBLING",
        weight: 1.0,
        isBidirectional: true,
      });
    }

    // 3. Query path from N0 to N3 (3 hops, <= maxDepth 4)
    const resWithinBound = await findShortestPath(saves[0].id, saves[3].id, 4);
    expect(resWithinBound.found).toBe(true);
    expect(resWithinBound.depth).toBe(3);
    expect(resWithinBound.path.length).toBe(4);
    expect(resWithinBound.path[0].saveId).toBe(saves[0].id);
    expect(resWithinBound.path[3].saveId).toBe(saves[3].id);

    // 4. Query path from N0 to N5 (5 hops, exceeds maxDepth 4)
    const resExceedsBound = await findShortestPath(saves[0].id, saves[5].id, 4);
    expect(resExceedsBound.found).toBe(false);
    expect(resExceedsBound.path.length).toBe(0);

    // 5. Query path between same node N0 to N0
    const resSame = await findShortestPath(saves[0].id, saves[0].id, 4);
    expect(resSame.found).toBe(true);
    expect(resSame.depth).toBe(0);
    expect(resSame.path.length).toBe(1);
  });
});
