import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StatBadge,
  MeterGauge,
  SpecRow,
  PriceTag,
  ActionChecklist,
  RelationPill,
} from "../primitives";

describe("Composable UI Micro-Primitives (FR-3.2)", () => {
  it("renders StatBadge with value, unit, and label", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatBadge, {
        label: "ABV",
        value: "13.5%",
        unit: "Vol",
      })
    );
    expect(html).toContain('data-testid="stat-badge"');
    expect(html).toContain("ABV");
    expect(html).toContain("13.5%");
    expect(html).toContain("Vol");
  });

  it("renders MeterGauge with segmented score bar", () => {
    const html = renderToStaticMarkup(
      React.createElement(MeterGauge, {
        label: "Cupping Score",
        value: 8.5,
        max: 10,
        showScore: true,
      })
    );
    expect(html).toContain('data-testid="meter-gauge"');
    expect(html).toContain("Cupping Score");
    expect(html).toContain("8.5/10");
    expect(html).toContain('data-testid="meter-gauge-segment-1"');
    expect(html).toContain('data-testid="meter-gauge-segment-10"');
  });

  it("renders SpecRow with key-value typography", () => {
    const html = renderToStaticMarkup(
      React.createElement(SpecRow, {
        label: "Dimensions",
        value: "60x60cm",
        unit: "Unframed",
        mono: true,
      })
    );
    expect(html).toContain('data-testid="spec-row"');
    expect(html).toContain("Dimensions");
    expect(html).toContain("60x60cm");
    expect(html).toContain("Unframed");
  });

  it("renders PriceTag with currency formatting and price drop indicator", () => {
    const html = renderToStaticMarkup(
      React.createElement(PriceTag, {
        priceCents: 2400,
        currency: "USD",
        merchantCount: 3,
        originalPriceCents: 3000,
      })
    );
    expect(html).toContain('data-testid="price-tag"');
    expect(html).toContain("$24.00");
    expect(html).toContain("(3 stores)");
    expect(html).toContain("-20%");
  });

  it("renders ActionChecklist with checkable items", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionChecklist, {
        items: [
          { id: "item-1", label: "200g Guanciale", checked: true },
          { id: "item-2", label: "4 Egg Yolks", checked: false },
        ],
      })
    );
    expect(html).toContain('data-testid="action-checklist"');
    expect(html).toContain("200g Guanciale");
    expect(html).toContain("4 Egg Yolks");
    expect(html).toContain('data-testid="checklist-item-item-1"');
    expect(html).toContain('data-testid="checklist-item-item-2"');
  });

  it("renders RelationPill with synaptic chip formatting", () => {
    const html = renderToStaticMarkup(
      React.createElement(RelationPill, {
        relationType: "PAIRED_WITH",
        targetTitle: "Château Musar 2015",
        targetId: "musar-2015",
      })
    );
    expect(html).toContain('data-testid="relation-pill"');
    expect(html).toContain("PAIRED WITH:");
    expect(html).toContain("Château Musar 2015");
  });
});
