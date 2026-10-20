import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlaceMapPreview } from "./PlaceMapPreview";
import { PlaceSpotCard } from "./PlaceSpotCard";
import type { GlobalEntity, UserSave } from "@/lib/types";

describe("PlaceMapPreview Component", () => {
  it("renders Slippy Map tile grid and glowing Curio pin centered on Tate Modern", () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceMapPreview, {
        latitude: 51.5076,
        longitude: -0.0994,
        spotName: "Tate Modern",
        address: "Bankside, London SE1 9TG",
      })
    );

    expect(html).toContain('data-testid="place-map-preview"');
    expect(html).toContain("51.5076°, -0.0994°");
    expect(html).toContain("Open in Maps");
    expect(html).toContain("CARTO");
    expect(html).toContain("OpenStreetMap");
    // Contains CartoDB Voyager and Dark Matter tile URLs
    expect(html).toContain("basemaps.cartocdn.com/rastertiles/voyager/15/");
    expect(html).toContain("basemaps.cartocdn.com/dark_all/15/");
  });

  it("renders clickable anchor targeting Google Maps when interactive", () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceMapPreview, {
        latitude: 48.8541,
        longitude: 2.3325,
        spotName: "Café de Flore",
        interactive: true,
      })
    );

    expect(html).toContain('href="https://www.google.com/maps/search/?api=1&amp;query=Caf%C3%A9%20de%20Flore"');
    expect(html).toContain('target="_blank"');
  });
});

describe("PlaceSpotCard with Photo/Map Switcher", () => {
  const baseSave: UserSave = {
    id: "save-123",
    userId: "user-1",
    entityId: "entity-123",
    typePath: "/place",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const baseEntity: GlobalEntity = {
    id: "entity-123",
    title: "Café de Flore",
    typePath: "/place",
    coreType: "PLACE",
    summary: "Historic Parisian café on Boulevard Saint-Germain",
    brandOrCreator: "Paris, France",
    heroImageUrl: "https://images.unsplash.com/cafe-de-flore.jpg",
    coreStructuredData: {
      latitude: 48.8541,
      longitude: 2.3325,
      city: "Paris",
      country: "France",
    },
    provenanceSources: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("renders Photo view with switcher pills when both photo and coordinates exist", () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceSpotCard, {
        save: baseSave,
        entity: baseEntity,
      })
    );

    expect(html).toContain('data-testid="place-spot-card"');
    expect(html).toContain('data-testid="place-view-switcher"');
    expect(html).toContain('data-testid="switcher-photo-btn"');
    expect(html).toContain('data-testid="switcher-map-btn"');
    expect(html).toContain("https://images.unsplash.com/cafe-de-flore.jpg");
  });

  it("renders Map preview by default when photo is missing but coordinates exist", () => {
    const noPhotoEntity: GlobalEntity = {
      ...baseEntity,
      heroImageUrl: undefined,
    };

    const html = renderToStaticMarkup(
      React.createElement(PlaceSpotCard, {
        save: baseSave,
        entity: noPhotoEntity,
      })
    );

    expect(html).toContain('data-testid="place-spot-card"');
    // Shows map preview automatically
    expect(html).toContain('data-testid="place-map-preview"');
    expect(html).toContain("48.8541°, 2.3325°");
    // No switcher needed since only map is available
    expect(html).not.toContain('data-testid="place-view-switcher"');
  });
});
