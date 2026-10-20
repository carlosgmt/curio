import { describe, expect, it } from "bun:test";
import { generateDeterministicEmbedding, generateEmbedding } from "./vector";

describe("Vector Dimension Standardization (768-d)", () => {
  it("generates deterministic 768-d embeddings with non-zero magnitude for regular text", () => {
    const text = "Miles Davis Kind of Blue jazz album";
    const vec = generateDeterministicEmbedding(text, 768);

    expect(vec.length).toBe(768);

    let sumSq = 0;
    for (const v of vec) sumSq += v * v;
    const mag = Math.sqrt(sumSq);

    expect(mag).toBeGreaterThan(0.99);
    expect(mag).toBeLessThan(1.01);
  });

  it("handles short strings (< 3 chars) like 'AI', '4K', 'CD', 'Go' with non-zero unit vectors", () => {
    const shortStrings = ["AI", "4K", "CD", "Go", "X", "1"];

    for (const s of shortStrings) {
      const vec = generateDeterministicEmbedding(s, 768);
      expect(vec.length).toBe(768);

      let sumSq = 0;
      for (const v of vec) sumSq += v * v;
      const mag = Math.sqrt(sumSq);

      expect(mag).toBeGreaterThan(0.99);
      expect(mag).toBeLessThan(1.01);
      // Non-zero elements check
      expect(vec.some((v) => v !== 0)).toBe(true);
    }
  });

  it("returns zero vector for empty strings", () => {
    const vec = generateDeterministicEmbedding("", 768);
    expect(vec.length).toBe(768);
    expect(vec.every((v) => v === 0)).toBe(true);
  });

  it("generateEmbedding returns 768 dimensions across fallbacks", async () => {
    const vec = await generateEmbedding("Contemporary French Cinema");
    expect(vec.length).toBe(768);

    let sumSq = 0;
    for (const v of vec) sumSq += v * v;
    const mag = Math.sqrt(sumSq);
    expect(mag).toBeGreaterThan(0.99);
    expect(mag).toBeLessThan(1.01);
  });
});
