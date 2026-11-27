import { describe, expect, it } from "bun:test";
import type { ConnectedItem } from "./service";
import {
  isAutoClosetCoWearConnection,
  isWearLogConnection,
  partitionConnections,
} from "./classify";

function makeConn(overrides: Partial<ConnectedItem>): ConnectedItem {
  return {
    connectionId: "c-1",
    connectionType: "PAIRED_WITH",
    direction: "outgoing",
    saveId: "save-2",
    title: "Target Item",
    coreType: "PRODUCT",
    ...overrides,
  };
}

describe("connections/classify", () => {
  it("identifies WORN_ON structural wear links", () => {
    const worn = makeConn({ connectionType: "WORN_ON", contextNote: "Worn in Outfit #12" });
    const paired = makeConn({ connectionType: "PAIRED_WITH", contextNote: null });
    expect(isWearLogConnection(worn)).toBe(true);
    expect(isWearLogConnection(paired)).toBe(false);
  });

  it("identifies current and legacy auto-synced Closet co-wear PAIRED_WITH edges", () => {
    const currentAuto = makeConn({
      connectionId: "c-auto-1",
      connectionType: "PAIRED_WITH",
      contextNote: "Worn in Casual Formula",
    });
    const legacyAuto = makeConn({
      connectionId: "c-auto-2",
      connectionType: "PAIRED_WITH",
      contextNote: "  co-worn together in Outfit #115",
    });
    const manualPairedNull = makeConn({
      connectionId: "c-manual-1",
      connectionType: "PAIRED_WITH",
      contextNote: null,
    });
    const manualPairedNote = makeConn({
      connectionId: "c-manual-2",
      connectionType: "PAIRED_WITH",
      contextNote: "Great pairing for autumn dinners",
    });
    const nonPairedWornNote = makeConn({
      connectionId: "c-other-1",
      connectionType: "INSPIRED_BY",
      contextNote: "Worn in Kyoto trip",
    });

    expect(isAutoClosetCoWearConnection(currentAuto)).toBe(true);
    expect(isAutoClosetCoWearConnection(legacyAuto)).toBe(true);
    expect(isAutoClosetCoWearConnection(manualPairedNull)).toBe(false);
    expect(isAutoClosetCoWearConnection(manualPairedNote)).toBe(false);
    expect(isAutoClosetCoWearConnection(nonPairedWornNote)).toBe(false);
  });

  it("partitions connections cleanly into wearLinks, autoCoWearPairs, and curatedPairs", () => {
    const connections: ConnectedItem[] = [
      makeConn({ connectionId: "w-1", connectionType: "WORN_ON", contextNote: "Worn in Outfit #1" }),
      makeConn({ connectionId: "a-1", connectionType: "PAIRED_WITH", contextNote: "Worn in Casual Formula" }),
      makeConn({ connectionId: "a-2", connectionType: "PAIRED_WITH", contextNote: "Co-worn together in Outfit #22" }),
      makeConn({ connectionId: "c-1", connectionType: "PAIRED_WITH", contextNote: "Pair with wine" }),
      makeConn({ connectionId: "c-2", connectionType: "SOUNDTRACK_TO", title: "Yumeji's Theme" }),
      makeConn({ connectionId: "c-3", connectionType: "CONSUMED_AT", title: "Bar Brutal" }),
    ];

    const res = partitionConnections(connections);
    expect(res.wearLinks.map((c) => c.connectionId)).toEqual(["w-1"]);
    expect(res.autoCoWearPairs.map((c) => c.connectionId)).toEqual(["a-1", "a-2"]);
    expect(res.curatedPairs.map((c) => c.connectionId)).toEqual(["c-1", "c-2", "c-3"]);
  });

  it("treats sanitized public edges with isAutoCoWear=true as autoCoWearPairs even when contextNote is null", () => {
    const sanitizedAuto = makeConn({
      connectionId: "san-auto-1",
      connectionType: "PAIRED_WITH",
      contextNote: null,
      isAutoCoWear: true,
    });
    const sanitizedCurated = makeConn({
      connectionId: "san-cur-1",
      connectionType: "PAIRED_WITH",
      contextNote: null,
    });

    const res = partitionConnections([sanitizedAuto, sanitizedCurated]);
    expect(isAutoClosetCoWearConnection(sanitizedAuto)).toBe(true);
    expect(isAutoClosetCoWearConnection(sanitizedCurated)).toBe(false);
    expect(res.autoCoWearPairs.map((c) => c.connectionId)).toEqual(["san-auto-1"]);
    expect(res.curatedPairs.map((c) => c.connectionId)).toEqual(["san-cur-1"]);
  });

  it("handles empty or missing input", () => {
    expect(partitionConnections([])).toEqual({
      wearLinks: [],
      autoCoWearPairs: [],
      curatedPairs: [],
    });
    expect(partitionConnections()).toEqual({
      wearLinks: [],
      autoCoWearPairs: [],
      curatedPairs: [],
    });
  });
});
