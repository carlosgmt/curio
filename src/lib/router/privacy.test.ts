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

    it("identifies quotation inputs as entities rather than private memos", () => {
      const quoteInput = '"We suffer more often in imagination than in reality." - Seneca';
      const result = classifyWithHeuristics(quoteInput);
      expect(result.intent).toBe("PUBLIC_ENTITY");
      expect(result.isPrivate).toBe(false);
      expect(result.suggestedTitle).toBe("We suffer more often in imagination than in reality.");
      expect(result.extractedQuery).toContain("Seneca");
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

  describe("Local LLM & Heuristics Fallback", () => {
    it("falls back gracefully to heuristics when local LLM is skipped", async () => {
      const result = await classifyPrivacyAndModality("Met Alex for coffee", {
        skipLocalLlm: true,
      });
      expect(result.intent).toBe("PRIVATE_MEMO");
      expect(result.isPrivate).toBe(true);
    });

    it("parses local Ollama LLM response correctly", async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async (url: string | URL) => {
          if (String(url).includes("/chat/completions")) {
            return new Response(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: JSON.stringify({
                        intent: "PUBLIC_ENTITY",
                        confidence: 0.98,
                        reasoning: "Classic novel by Haruki Murakami",
                        suggestedTitle: "Norwegian Wood",
                        detectedType: "BOOK",
                        extractedQuery: "Norwegian Wood",
                      }),
                    },
                  },
                ],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
          return originalFetch(url);
        }) as typeof fetch;

        const result = await classifyPrivacyAndModality("Norwegian Wood by Haruki Murakami");
        expect(result.intent).toBe("PUBLIC_ENTITY");
        expect(result.isPrivate).toBe(false);
        expect(result.detectedType).toBe("BOOK");
        expect(result.extractedQuery).toBe("Norwegian Wood");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back to heuristics if local LLM fetch fails or is offline", async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async () => {
          throw new Error("Connection refused (Ollama offline)");
        }) as unknown as typeof fetch;

        const result = await classifyPrivacyAndModality("Todo: buy groceries tomorrow");
        expect(result.intent).toBe("PRIVATE_MEMO");
        expect(result.isPrivate).toBe(true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
