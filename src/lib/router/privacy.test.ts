import { describe, expect, it } from "bun:test";
import {
  classifyPrivacyAndModality,
  classifyWithHeuristics,
} from "./privacy";

describe("Step 0 Privacy & Modality Router", () => {
  describe("Heuristic Classification", () => {
    it("isolates private memos from external search", () => {
      const inputs = [
        "Met Sarah about Q3 funding",
        "Note to self: review investor pitch deck",
        "Todo: buy groceries tomorrow",
        "Call doctor for appointment",
        "Meeting with Alex regarding team budget",
        "My thoughts on the new strategy",
      ];

      for (const input of inputs) {
        const result = classifyWithHeuristics(input);
        expect(result.intent).toBe("PRIVATE_MEMO");
        expect(result.isPrivate).toBe(true);
        expect(result.extractedQuery).toBeUndefined();
      }
    });

    it("identifies public entities and attaches search query", () => {
      const inputs = [
        { text: "Dune 1965 book", type: "BOOK" },
        { text: "Sony WH-1000XM5 headphones", type: "PRODUCT" },
        { text: "Blue Bottle Coffee Tokyo", type: "PLACE" },
        { text: "Interstellar movie", type: "MEDIA" },
      ];

      for (const { text, type } of inputs) {
        const result = classifyWithHeuristics(text);
        expect(result.intent).toBe("PUBLIC_ENTITY");
        expect(result.isPrivate).toBe(false);
        expect(result.extractedQuery).toBe(text);
        expect(result.detectedType).toBe(type as any);
      }
    });

    it("identifies URLs as public entities", () => {
      const url = "https://www.amazon.com/dp/B08N5WRWNW";
      const result = classifyWithHeuristics(url);
      expect(result.intent).toBe("PUBLIC_ENTITY");
      expect(result.isPrivate).toBe(false);
      expect(result.extractedQuery).toBe(url);
    });

    it("identifies multi-item roundups", () => {
      const inputs = [
        "Top 10 minimalist desks for small spaces",
        "5 best coffee makers of 2026",
        "https://www.youtube.com/playlist?list=PL12345",
      ];

      for (const input of inputs) {
        const result = classifyWithHeuristics(input);
        expect(result.intent).toBe("MULTI_ITEM_SOURCE");
        expect(result.isPrivate).toBe(false);
      }
    });
  });

  describe("API Client with Mocked Gemini Flash-Lite", () => {
    it("handles simulated Gemini Flash-Lite response for private memos", async () => {
      const mockFetch = (async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        intent: "PRIVATE_MEMO",
                        confidence: 0.99,
                        reasoning: "Personal confidential note",
                        suggestedTitle: "Meeting Notes with Sarah",
                        detectedType: "NOTE",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )) as unknown as typeof fetch;

      const result = await classifyPrivacyAndModality("Met Sarah about Q3 funding", {
        apiKey: "test-fake-key",
        fetchFn: mockFetch,
      });

      expect(result.intent).toBe("PRIVATE_MEMO");
      expect(result.isPrivate).toBe(true);
      expect(result.extractedQuery).toBeUndefined();
      expect(result.suggestedTitle).toBe("Meeting Notes with Sarah");
    });

    it("handles simulated Gemini Flash-Lite response for public entity", async () => {
      const mockFetch = (async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        intent: "PUBLIC_ENTITY",
                        confidence: 0.97,
                        reasoning: "Iconic sci-fi novel",
                        suggestedTitle: "Dune (1965)",
                        detectedType: "BOOK",
                        extractedQuery: "Dune Frank Herbert 1965",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )) as unknown as typeof fetch;

      const result = await classifyPrivacyAndModality("Dune 1965 book", {
        apiKey: "test-fake-key",
        fetchFn: mockFetch,
      });

      expect(result.intent).toBe("PUBLIC_ENTITY");
      expect(result.isPrivate).toBe(false);
      expect(result.detectedType).toBe("BOOK");
      expect(result.extractedQuery).toBe("Dune Frank Herbert 1965");
    });
  });
});
