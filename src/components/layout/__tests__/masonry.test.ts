import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MasonryLayout } from "../MasonryLayout";

describe("MasonryLayout Engine (FR-2.0 / Layouts)", () => {
  it("mounts MasonryLayout with 10 cards of mixed heights and asserts all containers have break-inside-avoid", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i}`,
      height: 100 + (i % 3) * 80,
      title: `Item ${i}`,
    }));

    const html = renderToStaticMarkup(
      React.createElement(MasonryLayout, {
        items,
        renderItem: (item: any) =>
          React.createElement("div", { style: { height: `${item.height}px` } }, item.title),
      })
    );

    expect(html).toContain('data-testid="masonry-layout"');
    expect(html).toContain("columns-1 sm:columns-2 lg:columns-3 min-[1440px]:columns-4");

    // Count item containers and verify each has break-inside-avoid
    const containerMatches = html.match(/class="[^"]*break-inside-avoid[^"]*"/g);
    expect(containerMatches).not.toBeNull();
    expect(containerMatches?.length).toBe(10);
  });
});
