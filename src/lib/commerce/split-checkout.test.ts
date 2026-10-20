import { describe, expect, it } from "bun:test";
import { db, users, smartLists, listItems, userSaves, globalEntities, entitySources, checkoutSessions } from "@/db";
import { createBoardSplitCheckoutSession, getCheckoutSession } from "./splitCheckout";
import { recordPriceSnapshot, getPriceHistoryForEntity } from "./pricing";

describe("Universal Commerce Protocol - Board-Level Split Checkout (Phase 6 / FR-7)", () => {
  it("partitions board items into UCP and affiliate items with creator attribution", async () => {
    const timestamp = Date.now();

    // 1. Create curator
    const [curator] = await db
      .insert(users)
      .values({
        email: `curator-split-${timestamp}@curio.local`,
        username: `curator_split_${timestamp}`,
        displayName: "Curator Split",
        affiliateTags: {
          amazon: "curator-split-20",
          bookshop: "curator-book-tag",
        },
      })
      .returning();

    // 2. Create board
    const [board] = await db
      .insert(smartLists)
      .values({
        userId: curator.id,
        title: "Hi-Fi Audio & Vinyl Sanctuary",
        slug: `hifi-sanctuary-${timestamp}`,
        visibility: "PUBLIC",
      })
      .returning();

    // 3. Create Entity A (Native UCP item with ucpSkuId)
    const [ucpEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `hash_ucp_${timestamp}`,
        entityKey: `key_ucp_${timestamp}`,
        canonicalUrl: "https://audiophile.store/turntable",
        coreType: "PRODUCT",
        title: "Audiophile Turntable Reference",
        ucpSkuId: `sku_turntable_${timestamp}`,
        priceCents: 120000,
        currency: "USD",
        coreStructuredData: {},
      })
      .returning();

    const [ucpSave] = await db
      .insert(userSaves)
      .values({
        userId: curator.id,
        entityId: ucpEntity.id,
      })
      .returning();

    await db.insert(listItems).values({
      listId: board.id,
      saveId: ucpSave.id,
      positionIndex: 0,
    });

    // 4. Create Entity B (Affiliate item from Amazon, no ucpSkuId)
    const [affiliateEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `hash_aff_${timestamp}`,
        entityKey: `key_aff_${timestamp}`,
        canonicalUrl: "https://www.amazon.com/dp/B000VINYL",
        coreType: "VINYL",
        title: "Kind of Blue (180g Vinyl)",
        priceCents: 3500,
        currency: "USD",
        coreStructuredData: {},
      })
      .returning();

    const [affiliateSource] = await db
      .insert(entitySources)
      .values({
        entityId: affiliateEntity.id,
        sellerName: "Amazon",
        sourceUrl: "https://www.amazon.com/dp/B000VINYL",
        urlHash: `hash_src_${timestamp}`,
        priceCents: 3500,
        currency: "USD",
      })
      .returning();

    const [affiliateSave] = await db
      .insert(userSaves)
      .values({
        userId: curator.id,
        entityId: affiliateEntity.id,
        preferredSourceId: affiliateSource.id,
      })
      .returning();

    await db.insert(listItems).values({
      listId: board.id,
      saveId: affiliateSave.id,
      positionIndex: 1,
    });

    // 5. Run split checkout session creation
    const result = await createBoardSplitCheckoutSession({
      boardId: board.id,
    });

    expect(result.boardId).toBe(board.id);
    expect(result.curatorId).toBe(curator.id);
    expect(result.status).toBe("READY");

    // Check UCP line items
    expect(result.ucpLineItems.length).toBe(1);
    expect(result.ucpLineItems[0].skuId).toBe(ucpEntity.ucpSkuId!);
    expect(result.ucpLineItems[0].priceCents).toBe(120000);
    expect(result.totalCents).toBe(120000);
    expect(result.checkoutUrl).toContain("https://pay.google.com/gp/p/ui/pay?session=");

    // Check affiliate items with creator attribution
    expect(result.affiliateItems.length).toBe(1);
    expect(result.affiliateItems[0].title).toBe("Kind of Blue (180g Vinyl)");
    expect(result.affiliateItems[0].sellerName).toBe("Amazon");
    expect(result.affiliateItems[0].affiliateAttributedUrl).toContain("tag=curator-split-20");

    // 6. Verify session persisted in DB
    const fetchedSession = await getCheckoutSession(result.id);
    expect(fetchedSession).toBeDefined();
    expect(fetchedSession?.id).toBe(result.id);
    expect(fetchedSession?.totalCents).toBe(120000);
  });

  it("records time-series price snapshots and retrieves price history", async () => {
    const timestamp = Date.now();

    const [entity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `price_ent_${timestamp}`,
        entityKey: `price_key_${timestamp}`,
        canonicalUrl: `https://bestbuy.com/speaker-${timestamp}`,
        title: "Smart Speaker Pro",
        coreType: "ELECTRONICS",
        priceCents: 19900,
        currency: "USD",
        coreStructuredData: {},
      })
      .returning();

    // Record two snapshots over time
    recordPriceSnapshot({
      entityId: entity.id,
      sellerName: "BestBuy",
      priceCents: 19900,
      currency: "USD",
      recordedAt: new Date(Date.now() - 3600000).toISOString(),
    });

    recordPriceSnapshot({
      entityId: entity.id,
      sellerName: "BestBuy",
      priceCents: 17900,
      currency: "USD",
      recordedAt: new Date().toISOString(),
    });

    const history = await getPriceHistoryForEntity(entity.id);
    expect(history.length).toBe(2);
    // Ordered descending by recordedAt: latest first
    expect(history[0].priceCents).toBe(17900);
    expect(history[1].priceCents).toBe(19900);
  });
});
