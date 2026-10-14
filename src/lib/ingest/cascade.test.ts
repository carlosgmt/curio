import { describe, expect, it } from "bun:test";
import { executeIngestionCascade } from "./cascade";
import { swapCandidateFallback } from "./disambiguation";

describe("Deterministic Ingestion Cascade E2E", () => {
  it("isolates private memo: does not touch global_entities and returns entity_id: null", async () => {
    const input = "Met Sarah about Q3 funding";
    const result = await executeIngestionCascade({ input });

    expect(result.status).toBe("created");
    expect(result.is_private_memo).toBe(true);
    expect(result.entity_id).toBeNull();
    expect(result.entity).toBeNull();
    expect(result.save.isPrivateMemo).toBe(true);
    expect(result.save.personalNotes).toBe(input);
    expect(result.candidate_fallbacks).toHaveLength(0);
  });

  it("enriches public entity: populates global entity and candidate fallbacks buffer", async () => {
    const input = "Dune 1965 book";
    const result = await executeIngestionCascade({ input });

    expect(result.status).toBe("created");
    expect(result.is_private_memo).toBe(false);
    expect(result.entity_id).not.toBeNull();
    expect(result.entity).not.toBeNull();
    expect(result.entity?.title).toContain("Dune");
    expect(result.entity?.coreType).toBe("BOOK");

    // FR-2.3: Candidate fallback buffer
    expect(result.candidate_fallbacks).toBeDefined();
    expect(result.candidate_fallbacks!.length).toBeGreaterThanOrEqual(1);

    const firstFallback = result.candidate_fallbacks![0];
    expect(firstFallback.url).toBeDefined();
    expect(firstFallback.title).toBeDefined();
  });

  it("handles 1-tap candidate disambiguation swap (FR-2.3)", async () => {
    const input = "Dune 1965 book";
    const result = await executeIngestionCascade({ input });
    const saveId = result.save.id;
    const fallbackTarget = result.candidate_fallbacks![0].url;

    const swapResult = await swapCandidateFallback(saveId, fallbackTarget);
    expect(swapResult.success).toBe(true);
    expect(swapResult.selectedCandidate?.url).toBe(fallbackTarget);
  });
});
