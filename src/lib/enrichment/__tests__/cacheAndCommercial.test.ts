import { describe, it, expect } from "bun:test";
import { executeIngestionCascade } from "../../ingest/cascade";
import { detectAndParseCommercialSku, resolveCommercialProduct } from "../providers/commercial";
import { db, globalEntities } from "@/db";
import { eq } from "drizzle-orm";

describe("4-Layer Cache-First Funnel & Commercial SKU Resolution", () => {
  it("Layer 0 Instant Cache Hit: second capture of known entity makes 0 network calls and reuses entity_id", async () => {
    const uniqueSuffix = Date.now();
    const movieTitle = `My Life Without Me ${uniqueSuffix}`;
    const qid = `Q83630_${uniqueSuffix}`;

    let fetchCount = 0;
    const mockFetch: any = async (input: RequestInfo | URL) => {
      fetchCount++;
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("wikidata.org")) {
        return new Response(
          JSON.stringify({
            search: [
              {
                id: qid,
                label: movieTitle,
                description: "2003 film directed by Isabel Coixet",
                concepturi: `http://www.wikidata.org/entity/${qid}`,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          title: movieTitle,
          extract: "A 2003 drama film written and directed by Isabel Coixet.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    // First capture -> Cache miss -> Calls external discovery
    const first = await executeIngestionCascade({
      input: movieTitle,
      skipLocalLlm: true,
      forceNew: true,
      fetchFn: mockFetch,
    });

    expect(first.entity_id).not.toBeNull();
    expect(first.entity?.typePath).toBe("/media/film");
    expect(fetchCount).toBeGreaterThan(0);

    // Reset fetch counter and capture the exact same title again
    fetchCount = 0;
    const second = await executeIngestionCascade({
      input: movieTitle,
      skipLocalLlm: true,
      forceNew: true,
      fetchFn: mockFetch,
    });

    // Must hit Layer 0 local cache with ZERO external network calls!
    expect(fetchCount).toBe(0);
    expect(second.entity_id).toBe(first.entity_id);
  });

  it("Layer 1.5 Cross-Lingual Deduplication: 'Mi vida sin mi' resolves to existing 'My Life Without Me' via Wikidata Q-ID without duplicating global_entities", async () => {
    const uniqueSuffix = Date.now() + 1;
    const englishTitle = `My Life Without Me ${uniqueSuffix}`;
    const spanishAlias = `Mi vida sin mi ${uniqueSuffix}`;
    const qid = `Q83630${uniqueSuffix}`;

    let specialistCalls = 0;
    let totalFetchCalls = 0;

    const mockFetch: any = async (input: RequestInfo | URL) => {
      totalFetchCalls++;
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("wikidata.org")) {
        return new Response(
          JSON.stringify({
            search: [
              {
                id: qid,
                label: englishTitle,
                description: "2003 film by Isabel Coixet",
                concepturi: `http://www.wikidata.org/entity/${qid}`,
                match: { type: "alias", language: "es", text: spanishAlias },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("api/rest_v1/page/summary")) {
        specialistCalls++;
        return new Response(
          JSON.stringify({
            title: englishTitle,
            extract: "2003 drama film written and directed by Isabel Coixet.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    };

    // 1. Capture in English -> creates canonical GlobalEntity with wikidata Q-ID
    const enRes = await executeIngestionCascade({
      input: englishTitle,
      skipLocalLlm: true,
      forceNew: true,
      fetchFn: mockFetch,
    });
    expect(enRes.entity_id).not.toBeNull();
    const initialSpecialistCalls = specialistCalls;

    // 2. Capture in Spanish ("Mi vida sin mi ...") -> Layer 1 discovers Q-ID, Layer 1.5 hits existing entity and skips specialist!
    const esRes = await executeIngestionCascade({
      input: spanishAlias,
      skipLocalLlm: true,
      forceNew: true,
      fetchFn: mockFetch,
    });

    expect(esRes.entity_id).toBe(enRes.entity_id);
    // Specialist hydration (Wikipedia summary / TMDB) must NOT have been called on Layer 1.5 hit!
    expect(specialistCalls).toBe(initialSpecialistCalls);

    // 3. Third capture using the Spanish alias again -> hits Layer 0 directly with 0 network calls!
    totalFetchCalls = 0;
    const esSecondRes = await executeIngestionCascade({
      input: spanishAlias,
      skipLocalLlm: true,
      forceNew: true,
      fetchFn: mockFetch,
    });
    expect(totalFetchCalls).toBe(0);
    expect(esSecondRes.entity_id).toBe(enRes.entity_id);
  });

  it("Commercial Garment SKU ('Reiss tshirt mint xyz'): parses brand, garment type, Mint hex swatch, and SKU into /product/garment", async () => {
    const skuAnalysis = detectAndParseCommercialSku("Reiss tshirt mint xyz");
    expect(skuAnalysis).not.toBeNull();
    expect(skuAnalysis?.category).toBe("garment");
    expect(skuAnalysis?.typePath).toBe("/product/garment");
    expect(skuAnalysis?.brand).toBe("Reiss");
    expect(skuAnalysis?.model).toBe("T-Shirt");
    expect(skuAnalysis?.color).toBe("Mint");
    expect(skuAnalysis?.colorHex).toBe("#98e2c6");
    expect(skuAnalysis?.sku).toBe("xyz");

    let fetchCalled = 0;
    const spyFetch: any = async () => {
      fetchCalled++;
      return new Response("{}", { status: 200 });
    };

    const cascadeRes = await executeIngestionCascade({
      input: "Reiss tshirt mint xyz",
      skipLocalLlm: true,
      forceNew: true,
      fetchFn: spyFetch,
    });

    // Garment SKU resolution should not make external Wikipedia calls
    expect(fetchCalled).toBe(0);
    expect(cascadeRes.entity).not.toBeNull();
    expect(cascadeRes.entity?.typePath).toBe("/product/garment");
    expect(cascadeRes.entity?.brandOrCreator).toBe("Reiss");

    const structured = cascadeRes.entity?.coreStructuredData as Record<string, any>;
    expect(structured.brand).toBe("Reiss");
    expect(structured.color).toBe("Mint");
    expect(structured.colorHex).toBe("#98e2c6");
    expect(structured.sku).toBe("xyz");
  });

  it("Commercial Watch SKU ('Rolex Explorer 2 226570', 'Rolex Explorer 2 xyz', and bare 'Rolex'): parses Rolex into /product/watch", async () => {
    const refAnalysis = detectAndParseCommercialSku("Rolex Explorer 2 226570");
    expect(refAnalysis).not.toBeNull();
    expect(refAnalysis?.category).toBe("watch_luxury");
    expect(refAnalysis?.typePath).toBe("/product/watch");
    expect(refAnalysis?.brand).toBe("Rolex");
    expect(refAnalysis?.model).toBe("Explorer II");
    expect(refAnalysis?.referenceCode).toBe("226570");
    expect(refAnalysis?.sku).toBe("226570");

    const bareRolex = detectAndParseCommercialSku("Rolex");
    expect(bareRolex).not.toBeNull();
    expect(bareRolex?.typePath).toBe("/product/watch");
    expect(bareRolex?.canonicalTitle).toBe("Rolex");

    const xyzAnalysis = detectAndParseCommercialSku("Rolex Explorer 2 xyz");
    expect(xyzAnalysis).not.toBeNull();
    expect(xyzAnalysis?.brand).toBe("Rolex");
    expect(xyzAnalysis?.model).toBe("Explorer II");
    expect(xyzAnalysis?.referenceCode).toBe("xyz");
    expect(xyzAnalysis?.sku).toBe("xyz");

    const mockWikiFetch: any = async () =>
      new Response(
        JSON.stringify({
          pages: [
            {
              id: 123,
              key: "Rolex_Explorer_II",
              title: "Rolex Explorer II",
              description: "Self-winding wristwatch introduced by Rolex in 1971",
              thumbnail: { url: "//upload.wikimedia.org/wikipedia/commons/rolex_explorer_ii.jpg" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    const watchRes = await executeIngestionCascade({
      input: "Rolex Explorer 2 226570",
      skipLocalLlm: true,
      forceNew: true,
      fetchFn: mockWikiFetch,
    });

    expect(watchRes.entity).not.toBeNull();
    expect(watchRes.entity?.typePath).toBe("/product/watch");
    expect(watchRes.entity?.brandOrCreator).toBe("Rolex");
    expect(watchRes.entity?.title).toContain("Explorer II");
    expect(watchRes.entity?.title).toContain("226570");
    expect(watchRes.entity?.heroImageUrl).toBe("https://upload.wikimedia.org/wikipedia/commons/rolex_explorer_ii.jpg");

    const structured = watchRes.entity?.coreStructuredData as Record<string, any>;
    expect(structured.model).toBe("Explorer II");
    expect(structured.sku).toBe("226570");
    expect(structured.referenceCode).toBe("226570");
  });

  it("Distinguisher Guard: 'Rolex Explorer 2 16570' does NOT collide with cached 'Rolex Explorer 2 226570'", async () => {
    const mockFetch: any = async () =>
      new Response(JSON.stringify({ pages: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const ref226570 = await executeIngestionCascade({
      input: "Rolex Explorer 2 226570",
      skipLocalLlm: true,
      forceNew: true,
      fetchFn: mockFetch,
    });

    const ref16570 = await executeIngestionCascade({
      input: "Rolex Explorer 2 16570",
      skipLocalLlm: true,
      forceNew: true,
      fetchFn: mockFetch,
    });

    expect(ref226570.entity_id).not.toBeNull();
    expect(ref16570.entity_id).not.toBeNull();
    expect(ref16570.entity_id).not.toBe(ref226570.entity_id);
    expect((ref16570.entity?.coreStructuredData as any).referenceCode).toBe("16570");

    // Re-capturing "Rolex Explorer II Ref. 226570" (Roman numeral II instead of 2) hits the 226570 entity at Layer 0!
    let fetchCount = 0;
    const zeroFetch: any = async () => {
      fetchCount++;
      return new Response("{}", { status: 200 });
    };
    const romanHit = await executeIngestionCascade({
      input: "Rolex Explorer II Ref. 226570",
      skipLocalLlm: true,
      forceNew: true,
      fetchFn: zeroFetch,
    });
    expect(fetchCount).toBe(0);
    expect(romanHit.entity_id).toBe(ref226570.entity_id);
  });
});
