import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TimelineLayout } from "../TimelineLayout";

describe("TimelineLayout Engine (FR-2.0 / Layouts)", () => {
  it("mounts TimelineLayout and asserts sticky date markers sort chronologically", () => {
    const items = [
      { id: "item-old", createdAt: "1959-08-17T00:00:00Z", title: "Kind of Blue (1959)" },
      { id: "item-mid", createdAt: "2024-05-12T00:00:00Z", title: "May 2024 Note" },
      { id: "item-new", createdAt: "2026-10-18T00:00:00Z", title: "October 2026 Cap" },
    ];

    // 1. Descending sort (newest first)
    const htmlDesc = renderToStaticMarkup(
      React.createElement(TimelineLayout, {
        items,
        sortOrder: "desc",
        renderItem: (item: any) => React.createElement("div", null, item.title),
      })
    );

    expect(htmlDesc).toContain('data-testid="timeline-layout"');
    const descMatches = Array.from(htmlDesc.matchAll(/data-period="([^"]+)"/g)).map((m) => m[1]);
    expect(descMatches).toEqual(["2026-10", "2024-05", "1959-08"]);

    const octIndex = htmlDesc.indexOf("October 2026");
    const mayIndex = htmlDesc.indexOf("May 2024");
    const augIndex = htmlDesc.indexOf("August 1959");

    expect(octIndex).toBeGreaterThan(-1);
    expect(mayIndex).toBeGreaterThan(-1);
    expect(augIndex).toBeGreaterThan(-1);
    expect(octIndex).toBeLessThan(mayIndex);
    expect(mayIndex).toBeLessThan(augIndex);

    // 2. Ascending sort (oldest first)
    const htmlAsc = renderToStaticMarkup(
      React.createElement(TimelineLayout, {
        items,
        sortOrder: "asc",
        renderItem: (item: any) => React.createElement("div", null, item.title),
      })
    );

    const ascMatches = Array.from(htmlAsc.matchAll(/data-period="([^"]+)"/g)).map((m) => m[1]);
    expect(ascMatches).toEqual(["1959-08", "2024-05", "2026-10"]);
  });
});
