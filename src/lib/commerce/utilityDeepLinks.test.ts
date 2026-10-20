import { describe, expect, it } from "bun:test";
import {
  resolveCinemaLink,
  resolveMusicLink,
  resolveBookLink,
  resolvePlaceLink,
  resolveWineLink,
  resolveRecipeLink,
  resolveArtLink,
  resolveCardUtility,
  resolveTypeActionProviders,
  getCinemaSearchLinks,
  getDiscogsSearchLink,
} from "./utilityDeepLinks";

describe("Utility Deep-Link Engine", () => {
  describe("Cinema / Film Resolver", () => {
    it("returns direct MUBI URL if entity already has MUBI link", () => {
      const entity = { canonicalUrl: "https://mubi.com/films/in-the-mood-for-love", title: "In the Mood for Love" };
      expect(resolveCinemaLink(entity)).toBe("https://mubi.com/films/in-the-mood-for-love");
    });

    it("generates targeted JustWatch search query when canonicalUrl is Wikipedia or missing", () => {
      const entity = { canonicalUrl: "https://en.wikipedia.org/wiki/Yi_Yi", title: "Yi Yi" };
      expect(resolveCinemaLink(entity)).toBe("https://www.justwatch.com/us/search?q=Yi%20Yi");
    });

    it("generates full suite of streaming provider links", () => {
      const links = getCinemaSearchLinks("Chungking Express");
      expect(links.mubi).toBe("https://mubi.com/search?query=Chungking%20Express");
      expect(links.appleTv).toBe("https://tv.apple.com/search?term=Chungking%20Express");
      expect(links.justWatch).toBe("https://www.justwatch.com/us/search?q=Chungking%20Express");
    });
  });

  describe("Vinyl & Music Resolver", () => {
    it("returns Spotify canonical URL directly", () => {
      const entity = { canonicalUrl: "https://open.spotify.com/album/12345", title: "Kind of Blue" };
      expect(resolveMusicLink(entity)).toBe("https://open.spotify.com/album/12345");
    });

    it("generates targeted Spotify search with artist and album title", () => {
      const entity = {
        title: "A Love Supreme",
        coreStructuredData: { artist: "John Coltrane" },
      };
      expect(resolveMusicLink(entity)).toBe("https://open.spotify.com/search/John%20Coltrane%20A%20Love%20Supreme");
    });

    it("generates Discogs marketplace search", () => {
      expect(getDiscogsSearchLink("Bill Evans Trio Waltz for Debby")).toBe(
        "https://www.discogs.com/search/?q=Bill%20Evans%20Trio%20Waltz%20for%20Debby&type=release"
      );
    });
  });

  describe("Books Resolver", () => {
    it("returns OpenLibrary canonical URL if available", () => {
      const entity = { canonicalUrl: "https://openlibrary.org/works/OL123W", title: "Dune" };
      expect(resolveBookLink(entity)).toBe("https://openlibrary.org/works/OL123W");
    });

    it("constructs Google Books search query with author and title", () => {
      const entity = {
        title: "Norwegian Wood",
        coreStructuredData: { author: "Haruki Murakami" },
      };
      expect(resolveBookLink(entity)).toBe("https://books.google.com/books?q=Norwegian%20Wood%20Haruki%20Murakami");
    });
  });

  describe("Places & Cartography Resolver", () => {
    it("generates Google Maps query from coordinates or location", () => {
      const entity = {
        title: "Mount Tamalpais",
        coreStructuredData: { location: "Marin County, California" },
      };
      expect(resolvePlaceLink(entity)).toBe("https://www.google.com/maps/search/?api=1&query=Marin%20County%2C%20California");
    });
  });

  describe("Wine Resolver", () => {
    it("constructs Vivino search query with producer, cuvée, and vintage", () => {
      const entity = {
        title: "Barolo Monfortino",
        coreStructuredData: { producer: "Giacomo Conterno", vintage: "2013" },
      };
      expect(resolveWineLink(entity)).toBe(
        "https://www.vivino.com/search/wines?q=Giacomo%20Conterno%20Barolo%20Monfortino%202013"
      );
    });
  });

  describe("Fine Art & Prints Resolver", () => {
    it("uses heroImageUrl as high-res viewer target when present", () => {
      const entity = {
        title: "The Great Wave",
        heroImageUrl: "https://images.curio.app/hokusai-highres.jpg",
      };
      expect(resolveArtLink(entity)).toBe("https://images.curio.app/hokusai-highres.jpg");
    });

    it("falls back to Artsy search if no image URL", () => {
      const entity = {
        title: "Composition with Red Blue and Yellow",
        coreStructuredData: { artist: "Piet Mondrian" },
      };
      expect(resolveArtLink(entity)).toBe(
        "https://www.artsy.net/search?term=Piet%20Mondrian%20Composition%20with%20Red%20Blue%20and%20Yellow"
      );
    });
  });

  describe("Privacy Gate & Invariant Testing", () => {
    it("strictly isolates Private Memos from external search URLs", () => {
      const memoEntity = {
        title: "Secret Strategy Memo",
        coreType: "PRIVATE_MEMO",
        typePath: "/private/memo",
        canonicalUrl: "https://confidential.internal",
      };
      const result = resolveCardUtility({ entity: memoEntity });
      expect(result.href).toBe("#");
      expect(result.targetBlank).toBe(false);
      expect(result.iconName).toBe("lock");
    });

    it("resolves Wine archetype with Vivino and wine icon", () => {
      const wineEntity = {
        title: "Château Margaux 2015",
        coreType: "PRODUCT",
        typePath: "/product/beverage/wine",
      };
      const result = resolveCardUtility({ entity: wineEntity });
      expect(result.iconName).toBe("wine");
      expect(result.label).toBe("Vivino Review");
      expect(result.href).toContain("vivino.com");
    });

    it("resolves Music (/media/music/album) with coreType=MEDIA to Spotify and never JustWatch", () => {
      const albumEntity = {
        title: "Wish You Were Here",
        coreType: "MEDIA",
        typePath: "/media/music/album",
        brandOrCreator: "Pink Floyd",
      };
      const result = resolveCardUtility({ entity: albumEntity });
      expect(result.iconName).toBe("music");
      expect(result.label).toBe("Play on Spotify");
      expect(result.href).toContain("open.spotify.com/search/");
      expect(result.href).not.toContain("justwatch.com");
    });

    it("provides 3 action providers per type and never links buyAction to Wikipedia", () => {
      const filmProviders = resolveTypeActionProviders({
        title: "The Godfather",
        coreType: "MEDIA",
        typePath: "/media/film",
        canonicalUrl: "https://en.wikipedia.org/wiki/The_Godfather",
      });
      expect(filmProviders.infoAction.href).toBe("https://en.wikipedia.org/wiki/The_Godfather");
      expect(filmProviders.playAction?.href).toContain("justwatch.com");
      expect(filmProviders.buyAction?.href).toContain("amazon.com");
      expect(filmProviders.buyAction?.href).not.toContain("wikipedia.org");

      const watchProviders = resolveTypeActionProviders({
        title: "Rolex Submariner",
        coreType: "PRODUCT",
        typePath: "/product/watch",
        canonicalUrl: "https://en.wikipedia.org/wiki/Rolex_Submariner",
      });
      expect(watchProviders.buyAction?.label).toBe("Shop Chrono24");
      expect(watchProviders.buyAction?.href).toContain("chrono24.com");
      expect(watchProviders.buyAction?.href).not.toContain("wikipedia.org");
    });
  });
});

