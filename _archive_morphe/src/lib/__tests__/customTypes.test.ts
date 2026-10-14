import { describe, it, expect } from "bun:test";
import {
  parseInlineTypeDefinition,
  matchCustomType,
  inferFieldKind,
  type CustomTypeDefinition,
} from "../customTypes";

describe("customTypes", () => {
  it("infers field kinds correctly", () => {
    expect(inferFieldKind("rating")).toBe("rating");
    expect(inferFieldKind("due_date")).toBe("date");
    expect(inferFieldKind("sets")).toBe("number");
    expect(inferFieldKind("tags")).toBe("tag");
    expect(inferFieldKind("favorite")).toBe("checkbox");
    expect(inferFieldKind("notes")).toBe("text");
  });

  it("parses inline syntax 'new type: Name (fields)'", () => {
    const res = parseInlineTypeDefinition(
      "new type: Wine (vintage, winery, region, rating)"
    );
    expect(res).not.toBeNull();
    expect(res?.id).toBe("wine");
    expect(res?.name).toBe("Wine");
    expect(res?.fields).toHaveLength(4);
    expect(res?.fields[0]).toEqual({ key: "vintage", label: "Vintage", kind: "text" });
    expect(res?.fields[3]).toEqual({ key: "rating", label: "Rating", kind: "rating" });
    expect(res?.patterns).toContain("wine");
  });

  it("parses inline syntax without fields", () => {
    const res = parseInlineTypeDefinition("create type: Podcast");
    expect(res).not.toBeNull();
    expect(res?.id).toBe("podcast");
    expect(res?.name).toBe("Podcast");
    expect(res?.fields.length).toBeGreaterThan(0);
  });

  it("matches custom type patterns against incoming text", () => {
    const types: CustomTypeDefinition[] = [
      {
        id: "wine",
        name: "Wine",
        icon: "Wine",
        color: "oklch(0.6 0.2 15)",
        fields: [
          { key: "vintage", label: "Vintage", kind: "text" },
          { key: "rating", label: "Rating", kind: "rating" },
        ],
        patterns: ["wine", "cabernet", "chardonnay", "pinot"],
      },
    ];

    const match = matchCustomType("2018 Cabernet Sauvignon from Napa Valley", types);
    expect(match).not.toBeNull();
    expect(match?.type.id).toBe("wine");
  });

  it("returns null when no pattern matches", () => {
    const types: CustomTypeDefinition[] = [
      {
        id: "wine",
        name: "Wine",
        icon: "Wine",
        color: "oklch(0.6 0.2 15)",
        fields: [],
        patterns: ["wine", "cabernet"],
      },
    ];

    const match = matchCustomType("Call mom tomorrow", types);
    expect(match).toBeNull();
  });
});
