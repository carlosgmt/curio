import { describe, it, expect } from "bun:test";
import {
  cosineSimilarity,
  dotProduct,
  generateDeterministicEmbedding,
  generateEmbedding,
  computeLexicalScore,
  hybridSearch,
} from "./vector";
import { db, users, userSaves, globalEntities } from "@/db";

describe("Vector Embedding & Hybrid Search Engine", () => {
  describe("Vector Mathematics", () => {
    it("computes accurate dot product", () => {
      expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
      expect(dotProduct([1, 0], [0, 1])).toBe(0);
      expect(dotProduct([1, 2], [1])).toBe(0);
    });

    it("computes cosine similarity accurately", () => {
      // Parallel vectors: 1.0
      expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1.0);
      // Orthogonal vectors: 0.0
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
      // Opposite vectors: -1.0
      expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1.0);
      // Zero vector: 0.0
      expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    });
  });

  describe("Deterministic Dense Fallback Embeddings", () => {
    it("generates 384-dimensional unit vector deterministically", () => {
      const v1 = generateDeterministicEmbedding("tokyo pour over coffee");
      const v2 = generateDeterministicEmbedding("tokyo pour over coffee");

      expect(v1).toHaveLength(384);
      expect(v1).toEqual(v2);

      // Verify unit norm (length = 1.0)
      const norm = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
      expect(norm).toBeCloseTo(1.0);
    });

    it("gives higher similarity for semantically related phrases than unrelated", () => {
      const coffeeA = generateDeterministicEmbedding("single origin ethiopian pour over coffee");
      const coffeeB = generateDeterministicEmbedding("ethiopia specialty drip coffee beans");
      const astronomy = generateDeterministicEmbedding("james webb space telescope deep cosmic infrared astronomy");

      const simCoffee = cosineSimilarity(coffeeA, coffeeB);
      const simAstronomy = cosineSimilarity(coffeeA, astronomy);

      expect(simCoffee).toBeGreaterThan(0.25);
      expect(simCoffee).toBeGreaterThan(simAstronomy);
    });

    it("returns zero vector for empty or whitespace string", () => {
      const v = generateDeterministicEmbedding("   ");
      expect(v).toHaveLength(384);
      expect(v.every((x) => x === 0)).toBe(true);
    });
  });

  describe("Graceful Ollama Embedding Fallback", () => {
    it("falls back to deterministic embedding when Ollama is offline", async () => {
      const embedding = await generateEmbedding("Dune science fiction novel");
      expect(embedding).toHaveLength(384);
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      expect(norm).toBeCloseTo(1.0);
    });
  });

  describe("Lexical Scoring", () => {
    it("scores exact title and tag matches highly", () => {
      const doc = {
        title: "Kissa Satei Coffee Roaster",
        summary: "Specialty dark roast kissaten in Shibuya",
        personalNotes: "Amazing hand drip",
        autoTags: ["coffee", "tokyo", "kissaten"],
        brandOrCreator: "Satei",
      };

      const highMatch = computeLexicalScore("coffee tokyo", doc);
      const lowMatch = computeLexicalScore("pasta wine", doc);

      expect(highMatch).toBeGreaterThan(0.4);
      expect(lowMatch).toBe(0);
    });
  });

  describe("Hybrid Search Service E2E", () => {
    it("searches user saves with blended semantic and lexical scores", async () => {
      const timestamp = Date.now();
      const [user] = await db
        .insert(users)
        .values({
          email: `search-test-${timestamp}@curio.local`,
          username: `search_user_${timestamp}`,
        })
        .returning();

      // Create 3 diverse saves for the user
      // 1. Film save
      const [entFilm] = await db
        .insert(globalEntities)
        .values({
          title: "Stalker 1979",
          summary: "Philosophical sci-fi film directed by Andrei Tarkovsky.",
          coreType: "MEDIA",
          typePath: "/media/film",
          urlHash: `hash-film-${timestamp}`,
          entityKey: `key-film-${timestamp}`,
          canonicalUrl: "https://example.com/stalker",
          coreStructuredData: { director: "Andrei Tarkovsky" },
        })
        .returning();

      await db.insert(userSaves).values({
        userId: user.id,
        entityId: entFilm.id,
        autoTags: ["cinema", "tarkovsky", "sci-fi"],
        personalNotes: "Favorite film of all time",
        isPrivateMemo: false,
      });

      // 2. Vinyl save
      const [entVinyl] = await db
        .insert(globalEntities)
        .values({
          title: "A Love Supreme",
          summary: "Spiritual jazz album by John Coltrane recorded at Van Gelder Studio.",
          coreType: "MEDIA",
          typePath: "/media/music/vinyl",
          urlHash: `hash-vinyl-${timestamp}`,
          entityKey: `key-vinyl-${timestamp}`,
          canonicalUrl: "https://example.com/love-supreme",
          coreStructuredData: { artist: "John Coltrane" },
        })
        .returning();

      await db.insert(userSaves).values({
        userId: user.id,
        entityId: entVinyl.id,
        autoTags: ["jazz", "vinyl", "coltrane"],
        isPrivateMemo: false,
      });

      // 3. Private Memo
      await db.insert(userSaves).values({
        userId: user.id,
        privateTitle: "Meeting about quantum computing paper",
        personalNotes: "Review Shor's algorithm and NISQ hardware constraints",
        isPrivateMemo: true,
      });

      // Query 1: "spiritual jazz coltrane"
      const jazzResults = await hybridSearch({
        query: "spiritual jazz coltrane",
        userId: user.id,
        limit: 10,
        semanticWeight: 0.5,
      });

      expect(jazzResults.length).toBeGreaterThan(0);
      expect(jazzResults[0].title).toBe("A Love Supreme");
      expect(jazzResults[0].score).toBeGreaterThan(0.3);

      // Query 2: "quantum computing" -> finds the private memo
      const memoResults = await hybridSearch({
        query: "quantum computing",
        userId: user.id,
        limit: 10,
      });

      expect(memoResults.length).toBeGreaterThan(0);
      expect(memoResults[0].title).toBe("Meeting about quantum computing paper");
      expect(memoResults[0].isPrivateMemo).toBe(true);

      // Query 3: empty query returns all user saves
      const allResults = await hybridSearch({
        query: "",
        userId: user.id,
        limit: 10,
      });

      expect(allResults.length).toBe(3);
    });
  });
});
