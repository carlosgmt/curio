import { describe, expect, it } from "bun:test";
import { buildAffiliateUrl, PLATFORM_AFFILIATE_DEFAULTS } from "./affiliate";

describe("Dynamic Creator Affiliate Attribution Engine", () => {
  describe("Platform Defaults", () => {
    it("falls back to platform default tag for Amazon", () => {
      const url = "https://www.amazon.com/dp/B08N5WRWNW";
      const result = buildAffiliateUrl(url, "Amazon");
      expect(result).toBe(`https://www.amazon.com/dp/B08N5WRWNW?tag=${PLATFORM_AFFILIATE_DEFAULTS.amazon}`);
    });

    it("falls back to platform default aid for Bookshop.org", () => {
      const url = "https://bookshop.org/books/dune/9780441172719";
      const result = buildAffiliateUrl(url, "Bookshop.org");
      expect(result).toBe(`https://bookshop.org/books/dune/9780441172719?aid=${PLATFORM_AFFILIATE_DEFAULTS.bookshop}`);
    });

    it("falls back to platform default ev for Discogs", () => {
      const url = "https://www.discogs.com/release/12345";
      const result = buildAffiliateUrl(url, "Discogs");
      expect(result).toBe(`https://www.discogs.com/release/12345?ev=${PLATFORM_AFFILIATE_DEFAULTS.discogs}`);
    });

    it("falls back to platform default ref for generic merchants", () => {
      const url = "https://store.steampowered.com/app/12345";
      const result = buildAffiliateUrl(url, "Steam");
      expect(result).toBe(`https://store.steampowered.com/app/12345?ref=${PLATFORM_AFFILIATE_DEFAULTS.customRef}`);
    });
  });

  describe("Creator Affiliate Overrides", () => {
    it("injects creator Amazon Associates tag when provided", () => {
      const url = "https://www.amazon.com/dp/B08N5WRWNW";
      const result = buildAffiliateUrl(url, "Amazon", null, { amazon: "mycreator-20" });
      expect(result).toBe("https://www.amazon.com/dp/B08N5WRWNW?tag=mycreator-20");
    });

    it("injects creator Bookshop.org affiliate aid when provided", () => {
      const url = "https://bookshop.org/books/dune/9780441172719";
      const result = buildAffiliateUrl(url, "Bookshop.org", null, { bookshop: "curator-reads" });
      expect(result).toBe("https://bookshop.org/books/dune/9780441172719?aid=curator-reads");
    });

    it("injects creator customRef for generic merchants", () => {
      const url = "https://store.steampowered.com/app/12345";
      const result = buildAffiliateUrl(url, "Steam", null, { customRef: "curator-games" });
      expect(result).toBe("https://store.steampowered.com/app/12345?ref=curator-games");
    });

    it("wraps third-party merchant URLs in Skimlinks redirect", () => {
      const url = "https://www.ssense.com/en-us/men/product/maison-margiela/shoes/123";
      const result = buildAffiliateUrl(url, "SSENSE", null, { skimlinks: "12345X67890" });
      expect(result).toContain("https://go.skimresources.com/?id=12345X67890&url=");
      expect(result).toContain(encodeURIComponent("https://www.ssense.com/en-us/men/product/maison-margiela/shoes/123?ref=curio"));
    });

    it("wraps third-party merchant URLs in LTK redirect", () => {
      const url = "https://shop.nordstrom.com/s/cashmere-sweater/999";
      const result = buildAffiliateUrl(url, "Nordstrom", null, { ltk: "fashion_curator" });
      expect(result).toContain("https://liketk.it/open?creator=fashion_curator&url=");
      expect(result).toContain(encodeURIComponent("https://shop.nordstrom.com/s/cashmere-sweater/999?ref=curio"));
    });
  });

  describe("Template & Resilience", () => {
    it("supports custom affiliate template interpolation", () => {
      const template = "https://redirect.network.com/?partner=curio&dest={url}";
      const url = "https://boutique.com/art-print";
      const result = buildAffiliateUrl(url, "Boutique", template);
      expect(result).toBe("https://redirect.network.com/?partner=curio&dest=https%3A%2F%2Fboutique.com%2Fart-print");
    });

    it("returns original URL if URL is malformed", () => {
      const invalidUrl = "not-a-valid-url";
      const result = buildAffiliateUrl(invalidUrl, "Unknown");
      expect(result).toBe("not-a-valid-url");
    });
  });
});
