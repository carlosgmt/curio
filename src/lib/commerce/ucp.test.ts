import { describe, expect, it } from "bun:test";
import { createUcpCheckoutSession, getUcpSession } from "./ucp";
import { PLATFORM_AFFILIATE_DEFAULTS } from "./affiliate";

describe("Universal Commerce Protocol (UCP) Adapter & Session Builder", () => {
  it("generates a standard UCP session with creator attribution and line items", () => {
    const session = createUcpCheckoutSession({
      saveId: "save_abc_123",
      entity: {
        id: "ent_dune_book",
        title: "Dune (Deluxe Hardcover)",
        brandOrCreator: "Frank Herbert",
        priceCents: 4500,
        bestPriceCents: 4000,
        currency: "USD",
        canonicalUrl: "https://bookshop.org/books/dune/9780441172719",
      },
      primarySource: {
        sellerName: "Bookshop.org",
        sourceUrl: "https://bookshop.org/books/dune/9780441172719",
        priceCents: 4000,
        currency: "USD",
      },
      curator: {
        id: "usr_curator_1",
        username: "desert_reader",
        affiliateTags: {
          bookshop: "desert-reads",
        },
      },
      buyerUserId: "usr_buyer_99",
    });

    expect(session.protocol).toBe("UCP/1.0");
    expect(session.status).toBe("READY");
    expect(session.sessionId).toStartWith("ucp_ses_");
    expect(session.totalCents).toBe(4000);
    expect(session.currency).toBe("USD");
    expect(session.buyerUserId).toBe("usr_buyer_99");

    // Line item verification
    expect(session.lineItems.length).toBe(1);
    const item = session.lineItems[0];
    expect(item.saveId).toBe("save_abc_123");
    expect(item.title).toBe("Dune (Deluxe Hardcover)");
    expect(item.priceCents).toBe(4000);
    expect(item.currency).toBe("USD");

    // Creator attribution verification
    expect(session.attribution.curatorId).toBe("usr_curator_1");
    expect(session.attribution.curatorUsername).toBe("desert_reader");
    expect(session.attribution.attributedCommissionRate).toBe(1.0);
    expect(session.attribution.affiliateTags?.bookshop).toBe("desert-reads");

    // Outbound checkout URL should include curator's affiliate tag
    expect(session.checkoutUrl).toContain("aid=desert-reads");

    // Session cache lookup
    const cached = getUcpSession(session.sessionId);
    expect(cached).toBeDefined();
    expect(cached?.sessionId).toBe(session.sessionId);
  });

  it("routes to instant Google UCP / Pay endpoint when ucpSkuId is present", () => {
    const session = createUcpCheckoutSession({
      saveId: "save_ucp_item",
      entity: {
        id: "ent_gadget_1",
        title: "Mechanical Keyboard",
        ucpSkuId: "google_ucp_sku_998877",
        priceCents: 15000,
        currency: "USD",
      },
      curator: {
        id: "usr_tech_curator",
        username: "keymaster",
      },
    });

    expect(session.checkoutUrl).toContain("https://pay.google.com/gp/p/ui/pay");
    expect(session.checkoutUrl).toContain(`session=${session.sessionId}`);
    expect(session.checkoutUrl).toContain("sku=google_ucp_sku_998877");
    expect(session.metadata?.hasDirectUcp).toBe(true);
  });

  it("falls back to platform defaults when curator has no custom tags", () => {
    const session = createUcpCheckoutSession({
      saveId: "save_amazon_item",
      entity: {
        title: "Amazon Echo Spot",
        canonicalUrl: "https://www.amazon.com/dp/B08N5WRWNW",
        priceCents: 8999,
        currency: "USD",
      },
      primarySource: {
        sellerName: "Amazon",
        sourceUrl: "https://www.amazon.com/dp/B08N5WRWNW",
      },
      curator: {
        id: "usr_no_tags",
        username: "notags",
        affiliateTags: null,
      },
    });

    expect(session.checkoutUrl).toContain(`tag=${PLATFORM_AFFILIATE_DEFAULTS.amazon}`);
  });
});
