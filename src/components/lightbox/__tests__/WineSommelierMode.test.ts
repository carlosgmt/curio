import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WineSommelierMode } from "../modes/WineSommelierMode";

describe("WineSommelierMode Cultural Lightbox Stage", () => {
  it("renders sommelier tasting radar, decanting guide, and serving temperature for wine saves", () => {
    const mockSave = {
      id: "save-wine-1",
      createdAt: new Date().toISOString(),
    };

    const mockEntity = {
      id: "entity-wine-1",
      title: "Château Rayas Reserve",
      brandOrCreator: "Château Rayas",
      coreType: "PRODUCT",
      canonicalUrl: "https://rayas.local/wine",
      coreStructuredData: {
        producer: "Château Rayas",
        cuvee: "Châteauneuf-du-Pape Réserve",
        vintage: "2010",
        appellation: "Châteauneuf-du-Pape",
        region: "Rhône",
        country: "France",
        servingTemp: "16°C – 18°C (61°F – 64°F)",
        decantingMinutes: 60,
        drinkingWindow: "2024 – 2040",
        tastingRadar: {
          tannin: 8,
          acidity: 7,
          body: 9,
          fruit: 8,
          minerality: 9,
          oak: 6,
        },
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(WineSommelierMode, {
        save: mockSave,
        entity: mockEntity,
      })
    );

    // Verify Sommelier Tasting Radar
    expect(html).toContain('data-testid="wine-sommelier-mode"');
    expect(html).toContain("Sommelier Tasting Radar");
    expect(html).toContain('data-testid="tasting-radar-grid"');
    expect(html).toContain("tannin");
    expect(html).toContain("8/10");

    // Verify Decanting Guide & Timer
    expect(html).toContain('data-testid="decanting-guide"');
    expect(html).toContain("Decanting Guide");
    expect(html).toContain("60 mins");

    // Verify Serving Temperature
    expect(html).toContain('data-testid="serving-temperature"');
    expect(html).toContain("Serving Temp");
    expect(html).toContain("16°C – 18°C (61°F – 64°F)");

    // Verify Cellar Drinking Window
    expect(html).toContain('data-testid="drinking-window"');
    expect(html).toContain("2024 – 2040");
  });
});
