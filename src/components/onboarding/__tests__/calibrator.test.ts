import { describe, expect, it } from "bun:test";
import { GET, calculateTasteVector, getCuratedDeckWithEmbeddings } from "@/app/api/v1/onboarding/calibrate/route";

describe("Cold-Start Taste Calibrator (FR-4.1)", () => {
  it("GET /api/v1/onboarding/calibrate returns exactly 15 curated cultural cards with 768-d embeddings", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.cards).toBeDefined();
    expect(Array.isArray(data.cards)).toBe(true);
    expect(data.cards.length).toBe(15);

    // Verify each card contains required metadata and 768-dim float array
    for (const card of data.cards) {
      expect(card.id).toBeDefined();
      expect(typeof card.title).toBe("string");
      expect(typeof card.coreType).toBe("string");
      expect(typeof card.typePath).toBe("string");
      expect(Array.isArray(card.embedding)).toBe(true);
      expect(card.embedding.length).toBe(768);

      // Verify embedding has non-zero components
      const magnitude = Math.sqrt(
        card.embedding.reduce((acc: number, val: number) => acc + val * val, 0)
      );
      expect(magnitude).toBeGreaterThan(0);
    }
  });

  it("computes unit-length 768-dim taste vector across accepted items", () => {
    const deck = getCuratedDeckWithEmbeddings();
    expect(deck.length).toBe(15);

    // Select 3 diverse cards (e.g., Wong Kar-wai, Miles Davis, Le Corbusier)
    const selected = [deck[0], deck[6], deck[13]];
    const selectedEmbeddings = selected.map((s) => s.embedding);

    const tasteVector = calculateTasteVector(selectedEmbeddings, 768);
    expect(tasteVector).toBeInstanceOf(Float32Array);
    expect(tasteVector.length).toBe(768);

    // Verify unit length (L2 norm = 1.0)
    let sumSq = 0;
    for (let i = 0; i < tasteVector.length; i++) {
      sumSq += tasteVector[i] * tasteVector[i];
    }
    const l2Norm = Math.sqrt(sumSq);
    expect(Math.abs(l2Norm - 1.0)).toBeLessThan(1e-4);
  });
});
