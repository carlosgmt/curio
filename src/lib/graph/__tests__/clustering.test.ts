import { describe, expect, it } from "bun:test";
import { db, users, userSaves, backgroundJobs } from "@/db";
import { enqueueClusteringJob, executeClusteringJob } from "../clustering";
import { eq } from "drizzle-orm";

describe("Louvain Modularity Clustering & Taste Centroids (FR-5.2)", () => {
  it("enqueues clustering background job and computes unit-magnitude 768-d centroids", async () => {
    const runId = Date.now();

    // 1. Ensure user
    let [user] = await db.select().from(users).limit(1);
    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          email: `cluster-test-${runId}@curio.local`,
          username: `cluster_test_${runId}`,
          displayName: "Cluster Test",
        })
        .returning();
    }

    // 2. Insert 4 diverse cultural saves
    const titles = [
      "Stalker (Tarkovsky, 1979)",
      "Solaris (Tarkovsky, 1972)",
      "Barolo Cascina Francia (Giacomo Conterno)",
      "Monfortino Barolo Riserva (Conterno)",
    ];

    for (const title of titles) {
      await db.insert(userSaves).values({
        userId: user.id,
        privateTitle: `${title} - ${runId}`,
        typePath: title.includes("Tarkovsky") ? "/media/film/auteur" : "/product/beverage/wine/barolo",
      });
    }

    // 3. Test background job enqueue
    const jobId = await enqueueClusteringJob(user.id);
    expect(jobId).toBeDefined();

    const [queuedJob] = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, jobId))
      .limit(1);

    expect(queuedJob).toBeDefined();
    expect(queuedJob.queueName).toBe("clustering");
    expect(queuedJob.status).toBe("QUEUED");

    // 4. Execute clustering
    const result = await executeClusteringJob(user.id);
    expect(result.clusters).toBeDefined();
    expect(result.clusters.length).toBeGreaterThan(0);

    // 5. Verify each cluster centroid has length 768 and unit magnitude
    for (const cluster of result.clusters) {
      expect(cluster.centroid.length).toBe(768);

      let sumSq = 0;
      for (const val of cluster.centroid) {
        sumSq += val * val;
      }
      const magnitude = Math.sqrt(sumSq);
      expect(Math.abs(magnitude - 1.0)).toBeLessThan(1e-4);
    }
  });
});
