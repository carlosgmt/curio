import { describe, expect, it } from "bun:test";
import { db, users, userSaves } from "@/db";
import {
  computeSerendipityScore,
  calculateTaxonomicJaccard,
  findSerendipityRecommendations,
} from "../serendipity";
import { generateDeterministicEmbedding } from "@/lib/search/vector";

describe("Serendipity Discovery Engine (FR-5.3)", () => {
  it("computes serendipity score with normalized 1 / (1 + sharedEdges) formula", () => {
    // 1. Zero shared edges & zero taxonomic overlap
    const scoreZeroShared = computeSerendipityScore({
      cosineSim: 0.8,
      typePathA: "/media/film/auteur",
      typePathB: "/product/beverage/wine/burgundy",
      sharedEdges: 0,
    });
    expect(Math.abs(scoreZeroShared - 0.8)).toBeLessThan(1e-4);

    // 2. 1 shared edge
    const scoreOneShared = computeSerendipityScore({
      cosineSim: 0.8,
      typePathA: "/media/film/auteur",
      typePathB: "/product/beverage/wine/burgundy",
      sharedEdges: 1,
    });
    expect(Math.abs(scoreOneShared - 0.4)).toBeLessThan(1e-4);

    // 3. 3 shared edges
    const scoreThreeShared = computeSerendipityScore({
      cosineSim: 0.8,
      typePathA: "/media/film/auteur",
      typePathB: "/product/beverage/wine/burgundy",
      sharedEdges: 3,
    });
    expect(Math.abs(scoreThreeShared - 0.2)).toBeLessThan(1e-4);

    // 4. Verify Jaccard overlap on identical taxonomy reduces serendipity
    const jaccardSame = calculateTaxonomicJaccard("/media/film", "/media/film");
    expect(jaccardSame).toBe(1.0);

    const scoreSameTax = computeSerendipityScore({
      cosineSim: 0.9,
      typePathA: "/media/film",
      typePathB: "/media/film",
      sharedEdges: 0,
    });
    expect(scoreSameTax).toBe(0.0);
  });

  it("yields cross-archetype recommendations with cosine > 0.65", async () => {
    const runId = Date.now();

    // 1. Ensure user
    let [user] = await db.select().from(users).limit(1);
    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          email: `serendipity-${runId}@curio.local`,
          username: `serendipity_${runId}`,
          displayName: "Serendipity Test",
        })
        .returning();
    }

    // 2. Insert items with shared stylistic keywords across different archetypes
    // (Auteur Cinema + Burgundy Wine + Modal Jazz)
    const sharedText = "poetic melancholic contemplative meditative atmospheric timeless";
    const emb1 = generateDeterministicEmbedding(`In the Mood for Love ${sharedText}`, 768);
    const emb2 = generateDeterministicEmbedding(`Vosne Romanee Burgundy ${sharedText}`, 768);
    const emb3 = generateDeterministicEmbedding(`Kind of Blue Miles Davis ${sharedText}`, 768);

    await db.insert(userSaves).values({
      userId: user.id,
      privateTitle: `Cinema Piece ${runId}`,
      typePath: "/media/film/auteur",
      privateEmbedding: emb1,
    });

    await db.insert(userSaves).values({
      userId: user.id,
      privateTitle: `Wine Bottle ${runId}`,
      typePath: "/product/beverage/wine",
      privateEmbedding: emb2,
    });

    await db.insert(userSaves).values({
      userId: user.id,
      privateTitle: `Vinyl LP ${runId}`,
      typePath: "/media/music/vinyl",
      privateEmbedding: emb3,
    });

    // 3. Query serendipity recommendations
    const recommendations = await findSerendipityRecommendations(user.id);
    expect(recommendations.length).toBeGreaterThan(0);

    for (const rec of recommendations) {
      expect(rec.cosineSimilarity).toBeGreaterThanOrEqual(0.65);
      expect(rec.sourceTypePath).not.toBe(rec.targetTypePath); // Cross-archetype
      expect(rec.serendipityScore).toBeGreaterThan(0);
    }
  });
});
