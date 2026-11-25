import { describe, expect, it, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import type { ConnectedItem } from "@/lib/connections/service";

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const DOM_GLOBALS = [
  "window",
  "document",
  "navigator",
  "localStorage",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLButtonElement",
  "Event",
  "InputEvent",
  "KeyboardEvent",
  "MouseEvent",
  "MutationObserver",
  "getComputedStyle",
] as const;

describe("Curio Card Declutter & Tag Explosion Guardrails", () => {
  it("separates WORN_ON & Closet co-wear PAIRED_WITH from curated pairs, caps inline pills at 2 + overflow, hides in compact, and folds wear count onto GarmentCard", async () => {
    const { PolymorphicCard } = await import("../PolymorphicCard");

    const wearConnections: ConnectedItem[] = Array.from({ length: 49 }, (_, i) => ({
      connectionId: `worn-${i}`,
      connectionType: "WORN_ON",
      contextNote: `Worn in Outfit #${i + 1}`,
      direction: "outgoing",
      saveId: `outfit-save-${i}`,
      title: `Outfit #${i + 1}`,
      coreType: "PRODUCT",
      typePath: "/style/outfit",
    }));

    const autoCoWearConnections: ConnectedItem[] = [
      {
        connectionId: "auto-cw-1",
        connectionType: "PAIRED_WITH",
        contextNote: "Worn in Casual Formula",
        direction: "outgoing",
        saveId: "garment-save-a",
        title: "Uniqlo Chinos",
        coreType: "PRODUCT",
      },
      {
        connectionId: "auto-cw-2",
        connectionType: "PAIRED_WITH",
        contextNote: "Co-worn together in Outfit #115",
        direction: "incoming",
        saveId: "garment-save-b",
        title: "New Balance Sneakers",
        coreType: "PRODUCT",
      },
    ];

    const curatedConnections: ConnectedItem[] = [
      {
        connectionId: "curated-1",
        connectionType: "PAIRED_WITH",
        contextNote: "Rainy commute pairing",
        direction: "outgoing",
        saveId: "curated-save-1",
        title: "Curated Pairing Alpha",
        coreType: "PRODUCT",
      },
      {
        connectionId: "curated-2",
        connectionType: "SOUNDTRACK_TO",
        direction: "outgoing",
        saveId: "curated-save-2",
        title: "Curated Soundtrack Beta",
        coreType: "MEDIA",
      },
      {
        connectionId: "curated-3",
        connectionType: "INSPIRED_BY",
        direction: "outgoing",
        saveId: "curated-save-3",
        title: "Curated Inspiration Gamma",
        coreType: "MEDIA",
      },
      {
        connectionId: "curated-4",
        connectionType: "CONSUMED_AT",
        direction: "outgoing",
        saveId: "curated-save-4",
        title: "Curated Spot Delta",
        coreType: "PLACE",
      },
    ];

    const garmentItem = {
      save: {
        id: "garment-save-main",
        isPrivateMemo: false,
        typePath: "/product/garment",
        autoTags: ["closet", "outerwear"],
        userCustomValues: { size: "L", timesWorn: 12 },
        createdAt: "2026-10-01T12:00:00Z",
      },
      entity: {
        id: "garment-ent-main",
        title: "ARC'TERYX Waterproof Parka",
        coreType: "PRODUCT",
        typePath: "/product/garment",
        brandOrCreator: "Arc'teryx",
        canonicalUrl: "https://mini.orca-banjo.ts.net/closet/#garment-7",
        coreStructuredData: {
          closetId: 7,
          closetUrl: "/closet/#garment-7",
          category: "Outerwear",
          size: "L",
          timesWorn: 12,
        },
      },
      connections: [...wearConnections, ...autoCoWearConnections, ...curatedConnections],
    };

    const standardHtml = renderToStaticMarkup(
      React.createElement(PolymorphicCard, {
        item: garmentItem,
        density: "standard",
        onConnect: () => {},
      })
    );

    // Structural WORN_ON and Closet auto co-wear links must NOT leak onto the card face
    expect(standardHtml).not.toContain("Outfit #1");
    expect(standardHtml).not.toContain("Uniqlo Chinos");
    expect(standardHtml).not.toContain("New Balance Sneakers");

    // Curated pairs are capped at 2 inline pills + "+2 more" overflow indicator
    expect(standardHtml).toContain("Curated Pairing Alpha");
    expect(standardHtml).toContain("Curated Soundtrack Beta");
    expect(standardHtml).not.toContain("Curated Inspiration Gamma");
    expect(standardHtml).not.toContain("Curated Spot Delta");
    expect(standardHtml).toContain('data-testid="synapse-overflow-pill"');
    expect(standardHtml).toContain("+2 more");

    // WORN_ON count (49) folds onto GarmentCard wear readout (>= timesWorn 12)
    expect(standardHtml).toContain('data-testid="garment-wear-count"');
    expect(standardHtml).toContain("Worn 49×");

    // Compact density renders 0 inline pills and omits + Pair + toolbar
    const compactHtml = renderToStaticMarkup(
      React.createElement(PolymorphicCard, {
        item: garmentItem,
        density: "compact",
        onConnect: () => {},
      })
    );

    expect(compactHtml).toContain('data-testid="compact-shell"');
    expect(compactHtml).not.toContain("Curated Pairing Alpha");
    expect(compactHtml).not.toContain("synapse-overflow-pill");
    expect(compactHtml).not.toContain("pair-card-btn");
    expect(compactHtml).not.toContain("wish-toggle");
    expect(compactHtml).toContain("49×");
  });

  it("renders Closet Wear History collapsed by default in CardLightboxModal while keeping curated pairs visible", async () => {
    const win = new Window({ url: "http://localhost:3000/curio" });
    const prevGlobals: Record<string, unknown> = {};
    for (const key of DOM_GLOBALS) {
      prevGlobals[key] = (globalThis as any)[key];
      const val = (win as any)[key];
      if (val !== undefined) {
        (globalThis as any)[key] =
          typeof val === "function" && key === "getComputedStyle" ? val.bind(win) : val;
      }
    }
    (globalThis as any).window = win;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const prevFetch = globalThis.fetch;

    const mockFetch = (async () =>
      new Response(JSON.stringify({ boards: [], types: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;
    (win as any).fetch = mockFetch;

    const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");

    try {
      const { CardLightboxModal } = await import("../../lightbox/CardLightboxModal");

      const container = win.document.createElement("div") as unknown as HTMLElement;
      win.document.body.appendChild(container as any);

      const view = render(
        React.createElement(CardLightboxModal, {
          isOpen: true,
          onClose: () => {},
          onConnect: () => {},
          card: {
            save: {
              id: "garment-lb-1",
              isPrivateMemo: false,
              typePath: "/product/garment",
              createdAt: "2026-10-01T12:00:00Z",
            },
            entity: {
              id: "garment-ent-lb-1",
              title: "Barbour Waxed Jacket",
              coreType: "PRODUCT",
              typePath: "/product/garment",
              canonicalUrl: "https://mini.orca-banjo.ts.net/closet/#garment-9",
              coreStructuredData: { closetId: 9, closetUrl: "/closet/#garment-9" },
            },
            connections: [
              {
                connectionId: "w-1",
                connectionType: "WORN_ON",
                contextNote: "Worn in Autumn Walk",
                direction: "outgoing",
                saveId: "outfit-1",
                title: "Autumn Walk",
                coreType: "PRODUCT",
              },
              {
                connectionId: "cw-1",
                connectionType: "PAIRED_WITH",
                contextNote: "Worn in Casual Formula",
                direction: "outgoing",
                saveId: "garment-2",
                title: "Selvedge Jeans",
                coreType: "PRODUCT",
              },
              {
                connectionId: "man-1",
                connectionType: "INSPIRED_BY",
                direction: "outgoing",
                saveId: "film-1",
                title: "Withnail and I",
                coreType: "MEDIA",
              },
            ],
          },
        }),
        { container }
      );

      // Curated pair is directly visible
      expect(container.textContent).toContain("Synaptic Memory Pairs (1)");
      expect(container.textContent).toContain("Withnail and I");

      // Closet Wear History drawer is present and collapsed by default
      const toggle = view.getByTestId("closet-wear-history-toggle");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(toggle.textContent).toContain("1 outfit");
      expect(toggle.textContent).toContain("1 co-worn piece");
      expect(container.textContent).not.toContain("Autumn Walk");
      expect(container.textContent).not.toContain("Selvedge Jeans");

      // Expanding reveals both wear links and auto co-wear links
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(container.textContent).toContain("Autumn Walk");
      expect(container.textContent).toContain("Selvedge Jeans");

      cleanup();
    } finally {
      cleanup();
      globalThis.fetch = prevFetch;
      for (const key of DOM_GLOBALS) {
        if (prevGlobals[key] === undefined) {
          delete (globalThis as any)[key];
        } else {
          (globalThis as any)[key] = prevGlobals[key];
        }
      }
      await win.happyDOM.close();
    }
  });

  it("filters internal Purchase Hub and Closet metadata keys in CustomFieldsSection while rendering real user fields with formatted labels", async () => {
    const { CustomFieldsSection, hasVisibleCustomFields } = await import("../CustomFieldsSection");

    const extAttrs = {
      source: "purchase-hub",
      purchaseHubProductId: "prd_abc123",
      ownerScope: "home",
      category: "Office & Tech",
      hasManual: false,
      wardrobeId: 42,
      closetId: 7,
      lastSyncedClosetNotes: "notes",
      hasCutout: true,
      wikidataUri: "http://www.wikidata.org/entity/Q1",
    };
    const userCustom = {
      roastLevel: "Light",
      origin_region: "Ethiopia",
    };

    expect(hasVisibleCustomFields({}, extAttrs)).toBe(false);
    expect(hasVisibleCustomFields(userCustom, extAttrs)).toBe(true);

    const html = renderToStaticMarkup(
      React.createElement(CustomFieldsSection, {
        saveId: "save-cf-1",
        readOnly: true,
        extendedAttributes: extAttrs,
        userCustomValues: userCustom,
      })
    );

    expect(html).not.toContain("purchase-hub");
    expect(html).not.toContain("prd_abc123");
    expect(html).not.toContain("ownerScope");
    expect(html).not.toContain("Office &amp; Tech");
    expect(html).not.toContain("wardrobeId");
    expect(html).not.toContain("hasCutout");
    expect(html).toContain("Roast Level:");
    expect(html).toContain("Light");
    expect(html).toContain("Origin Region:");
    expect(html).toContain("Ethiopia");
  });

  it("omits fabricated fallback specs in ElectronicsCard, ProductCard, and BookJacketCard", async () => {
    const { ElectronicsCard } = await import("../silhouettes/ElectronicsCard");
    const { ProductCard } = await import("../silhouettes/ProductCard");
    const { BookJacketCard } = await import("../silhouettes/BookJacketCard");

    const elecHtml = renderToStaticMarkup(
      React.createElement(ElectronicsCard, {
        save: { id: "s-el", createdAt: "2026-10-01T00:00:00Z" },
        entity: {
          id: "e-el",
          title: "Sonoff SNZB-02DR2 Sensor",
          coreType: "PRODUCT",
          typePath: "/product/electronics",
          brandOrCreator: "Sonoff",
          canonicalUrl: "https://mini.orca-banjo.ts.net/my-stuff/#product-prd_1",
          priceCents: 2490,
          currency: "CHF",
          coreStructuredData: { modelNumber: "SNZB-02DR2", retailer: "amazon" },
          extendedAttributes: { source: "purchase-hub", purchaseHubProductId: "prd_1", retailers: "amazon" },
        },
      })
    );
    expect(elecHtml).not.toContain("Dual ESS");
    expect(elecHtml).not.toContain("65W GaN");
    expect(elecHtml).not.toContain("18h");
    expect(elecHtml).not.toContain("Bluetooth 5.3 LDAC");
    expect(elecHtml).not.toContain("USB-C PD 3.0");
    expect(elecHtml).toContain("SNZB-02DR2");
    expect(elecHtml).toContain("Open in My Stuff");

    const prodHtml = renderToStaticMarkup(
      React.createElement(ProductCard, {
        save: { id: "s-pr", createdAt: "2026-10-01T00:00:00Z" },
        entity: {
          id: "e-pr",
          title: "Silicone Watch Strap",
          coreType: "PRODUCT",
          typePath: "/product",
          canonicalUrl: "https://example.com/strap",
          priceCents: 1500,
          currency: "CHF",
          coreStructuredData: {},
          extendedAttributes: {},
        },
      })
    );
    expect(prodHtml).not.toContain("IN STOCK");
    expect(prodHtml).not.toContain("Wrong entity?");
    // Single price placement (not repeated in both card body and footer)
    const priceMatches = prodHtml.match(/CHF\s*15|\$15/g) || [];
    expect(priceMatches.length).toBe(1);

    const bookHtml = renderToStaticMarkup(
      React.createElement(BookJacketCard, {
        save: { id: "s-bk", createdAt: "2026-10-01T00:00:00Z" },
        entity: {
          id: "e-bk",
          title: "The Goldfinch",
          coreType: "BOOK",
          typePath: "/product/book",
          brandOrCreator: "Donna Tartt",
          summary: "Pulitzer-winning novel set in New York and Amsterdam.",
          canonicalUrl: "https://example.com/goldfinch",
          coreStructuredData: {},
        },
      })
    );
    expect(bookHtml).not.toContain("FIRST EDITION");
    expect(bookHtml).not.toContain("defining work of literary resonance");
    expect(bookHtml).toContain("by Donna Tartt");
    expect(bookHtml).not.toContain("by Pulitzer-winning");
  });

  it("suppresses Goodreads review boilerplate on BookJacketCard, legacy placeholders on MoviePosterCard, and fabricated fallbacks in Book/Cinema Cultural Modes", async () => {
    const { BookJacketCard } = await import("../silhouettes/BookJacketCard");
    const { MoviePosterCard } = await import("../silhouettes/MoviePosterCard");
    const { BookCulturalMode } = await import("../../lightbox/modes/BookCulturalMode");
    const { CinemaCulturalMode } = await import("../../lightbox/modes/CinemaCulturalMode");

    const goodreadsGarbageBook = renderToStaticMarkup(
      React.createElement(BookJacketCard, {
        save: {
          id: "s-gr-garbage",
          createdAt: "2026-10-01T00:00:00Z",
          personalNotes: "review\n Write a review",
        },
        entity: {
          id: "e-gr-garbage",
          title: "Kafka on the Shore",
          coreType: "BOOK",
          typePath: "/product/book",
          brandOrCreator: "Haruki Murakami",
          canonicalUrl: "https://www.goodreads.com/book/show/4929",
          coreStructuredData: {
            author: "Haruki Murakami",
            obiText: "review\n Write a review",
          },
        },
      })
    );
    expect(goodreadsGarbageBook).not.toContain("Write a review");
    expect(goodreadsGarbageBook).not.toContain("Curator Note");

    const genericObiBook = renderToStaticMarkup(
      React.createElement(BookJacketCard, {
        save: { id: "s-gr-generic", createdAt: "2026-10-01T00:00:00Z" },
        entity: {
          id: "e-gr-generic",
          title: "Untitled Monograph",
          coreType: "BOOK",
          typePath: "/product/book",
          canonicalUrl: "https://example.com/book",
          coreStructuredData: { obiText: "A definitive work by Unknown Author." },
        },
      })
    );
    expect(genericObiBook).not.toContain("A definitive work by");
    expect(genericObiBook).not.toContain("Curator Note");

    const realNoteBook = renderToStaticMarkup(
      React.createElement(BookJacketCard, {
        save: {
          id: "s-gr-real",
          createdAt: "2026-10-01T00:00:00Z",
          personalNotes: "Recommended by friend for summer reading",
        },
        entity: {
          id: "e-gr-real",
          title: "Solaris",
          coreType: "BOOK",
          typePath: "/product/book",
          brandOrCreator: "Stanislaw Lem",
          canonicalUrl: "https://example.com/solaris",
          coreStructuredData: { obiText: "review\n Write a review" },
        },
      })
    );
    expect(realNoteBook).toContain("Recommended by friend for summer reading");

    const legacyPosterHtml = renderToStaticMarkup(
      React.createElement(MoviePosterCard, {
        save: { id: "s-film-1", createdAt: "2026-10-01T00:00:00Z" },
        entity: {
          id: "e-film-1",
          title: "Drive My Car",
          coreType: "MEDIA",
          typePath: "/media/film",
          canonicalUrl: "https://letterboxd.com/film/drive-my-car/",
          coreStructuredData: {
            director: "Ryusuke Hamaguchi",
            releaseYear: 2021,
            runtimeMinutes: 179,
            cinematographer: "35MM COLOR",
            distributor: "Curio Cinematheque",
          },
        },
      })
    );
    expect(legacyPosterHtml).toContain("DIR. Ryusuke Hamaguchi");
    expect(legacyPosterHtml).toContain("179 MIN");
    expect(legacyPosterHtml).not.toContain("35MM COLOR");
    expect(legacyPosterHtml).not.toContain("Curio Cinematheque");

    const bookCulturalHtml = renderToStaticMarkup(
      React.createElement(BookCulturalMode, {
        save: { id: "s-bc-1", wishlist: false, userCustomValues: {} },
        entity: {
          id: "e-bc-1",
          title: "Minimal Book",
          coreType: "BOOK",
          canonicalUrl: "https://example.com/minimal-book",
          coreStructuredData: {},
        },
      })
    );
    expect(bookCulturalHtml).not.toContain("Curio Editions");
    expect(bookCulturalHtml).not.toContain("320 PAGES");
    expect(bookCulturalHtml).not.toContain("Unknown Author");
    expect(bookCulturalHtml).not.toContain("A resonant cultural work");

    const cinemaCulturalHtml = renderToStaticMarkup(
      React.createElement(CinemaCulturalMode, {
        save: { id: "s-cc-1", wishlist: false, userCustomValues: {} },
        entity: {
          id: "e-cc-1",
          title: "Minimal Film",
          coreType: "MEDIA",
          canonicalUrl: "https://letterboxd.com/film/minimal/",
          coreStructuredData: {},
        },
      })
    );
    expect(cinemaCulturalHtml).not.toContain("Visionary Director");
    expect(cinemaCulturalHtml).not.toContain("35mm Color");
    expect(cinemaCulturalHtml).not.toContain("118 MIN");
    expect(cinemaCulturalHtml).not.toContain("CURIO CINEMATHEQUE");
    expect(cinemaCulturalHtml).not.toContain("8.4 TMDB");
    expect(cinemaCulturalHtml).not.toContain("Watch Trailer");
  });

  it("filters Goodreads, Letterboxd, FilmAffinity, location, and mergedPurchaseHubIds internal keys in CustomFieldsSection", async () => {
    const { CustomFieldsSection, hasVisibleCustomFields } = await import("../CustomFieldsSection");

    const extAttrs = {
      mergedPurchaseHubIds: "prd_1,prd_2",
      bookSource: "GOODREADS",
      filmSource: "LETTERBOXD",
      colorHex: "#112233",
      availability: "in_stock",
      priceCents: 2499,
      currency: "EUR",
      brandOrCreator: "A24",
      heroImageUrl: "https://example.com/poster.jpg",
      summary: "Internal copy",
    };
    const userCustom = {
      goodreadsBookId: "12345",
      readingStatus: "FINISHED",
      shelf: "read",
      owned: true,
      dateAdded: "2026-01-01",
      dateRead: "2026-02-01",
      dateStarted: "2026-01-10",
      letterboxdId: "lb-9",
      letterboxdUri: "https://letterboxd.com/film/x/",
      filmaffinityId: "fa-4",
      tmdbId: "550",
      imdbId: "tt0137523",
      watchStatus: "WATCHED",
      rewatch: false,
      watchedDate: "2026-03-01",
      dateWatched: "2026-03-01",
      myRating: 4,
      latitude: 47.3769,
      longitude: 8.5417,
      extractedAt: "2026-03-01T00:00:00Z",
    };

    expect(hasVisibleCustomFields(userCustom, extAttrs)).toBe(false);

    const html = renderToStaticMarkup(
      React.createElement(CustomFieldsSection, {
        saveId: "save-cf-sync",
        readOnly: true,
        extendedAttributes: extAttrs,
        userCustomValues: { ...userCustom, editionNote: "First UK Printing" },
      })
    );
    expect(html).not.toContain("prd_1,prd_2");
    expect(html).not.toContain("12345");
    expect(html).not.toContain("lb-9");
    expect(html).not.toContain("fa-4");
    expect(html).not.toContain("47.3769");
    expect(html).toContain("Edition Note:");
    expect(html).toContain("First UK Printing");
  });

  it("hides density switcher buttons on 3D Shelf & Posters views while keeping them on Masonry/Grid/Timeline", async () => {
    const { ViewModeSwitcher } = await import("../../layout/ViewModeSwitcher");

    const shelfHtml = renderToStaticMarkup(
      React.createElement(ViewModeSwitcher, {
        layout: "shelf",
        density: "standard",
        onLayoutChange: () => {},
        onDensityChange: () => {},
      })
    );
    expect(shelfHtml).toContain('data-testid="switch-shelf"');
    expect(shelfHtml).toContain('data-testid="switch-posters"');
    expect(shelfHtml).not.toContain("switch-density-compact");
    expect(shelfHtml).not.toContain("switch-density-standard");
    expect(shelfHtml).not.toContain("switch-density-expanded");

    const postersHtml = renderToStaticMarkup(
      React.createElement(ViewModeSwitcher, {
        layout: "posters",
        density: "compact",
        onLayoutChange: () => {},
        onDensityChange: () => {},
      })
    );
    expect(postersHtml).not.toContain("switch-density-compact");

    const masonryHtml = renderToStaticMarkup(
      React.createElement(ViewModeSwitcher, {
        layout: "masonry",
        density: "standard",
        onLayoutChange: () => {},
        onDensityChange: () => {},
      })
    );
    expect(masonryHtml).toContain('data-testid="switch-density-compact"');
    expect(masonryHtml).toContain('data-testid="switch-density-standard"');
    expect(masonryHtml).toContain('data-testid="switch-density-expanded"');
  });
});
