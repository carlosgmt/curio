import { describe, expect, it } from "bun:test";
import { buildAffiliateUrl } from "./CardFooterWaterfall";

describe("CardFooterWaterfall Affiliate Routing", () => {
  it("injects Amazon Associates affiliate tag", () => {
    const url = "https://www.amazon.com/dp/B08N5WRWNW";
    const affiliateUrl = buildAffiliateUrl(url, "Amazon");
    expect(affiliateUrl).toContain("tag=curio-20");
  });

  it("injects Bookshop.org affiliate aid parameter", () => {
    const url = "https://bookshop.org/books/dune/9780441172719";
    const affiliateUrl = buildAffiliateUrl(url, "Bookshop.org");
    expect(affiliateUrl).toContain("aid=curio");
  });

  it("injects Discogs curation referral tag", () => {
    const url = "https://www.discogs.com/release/12345";
    const affiliateUrl = buildAffiliateUrl(url, "Discogs");
    expect(affiliateUrl).toContain("ev=curio_curate");
  });

  it("injects universal ref=curio on other merchants", () => {
    const url = "https://store.steampowered.com/app/12345";
    const affiliateUrl = buildAffiliateUrl(url, "Steam");
    expect(affiliateUrl).toContain("ref=curio");
  });

  it("supports custom affiliate template interpolation", () => {
    const template = "https://redirect.network.com/?partner=curio&dest={url}";
    const url = "https://boutique.com/art-print";
    const affiliateUrl = buildAffiliateUrl(url, "Boutique", template);
    expect(affiliateUrl).toBe("https://redirect.network.com/?partner=curio&dest=https%3A%2F%2Fboutique.com%2Fart-print");
  });
});
