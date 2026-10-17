import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { db, users, userSaves, globalEntities, entitySources } from "@/db";

describe("UCP Checkout Session API Route (/api/v1/commerce/checkout)", () => {
  it("POST resolves entity and curator, returning active UCP checkout session with attribution", async () => {
    const timestamp = Date.now();

    // 1. Create curator with affiliate tags
    const [curator] = await db
      .insert(users)
      .values({
        email: `curator-checkout-${timestamp}@curio.local`,
        username: `curator_checkout_${timestamp}`,
        displayName: "Curator Checkout",
        affiliateTags: {
          amazon: "curator-amz-20",
          bookshop: "curator-bk-aid",
        },
      })
      .returning();

    // 2. Create global entity
    const [entity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `hash_check_${timestamp}`,
        entityKey: `key_check_${timestamp}`,
        canonicalUrl: "https://www.amazon.com/dp/B000TEST123",
        coreType: "PRODUCT",
        title: "Vintage Mechanical Watch",
        priceCents: 25000,
        currency: "USD",
        coreStructuredData: {},
      })
      .returning();

    // 3. Create entity source
    const [source] = await db
      .insert(entitySources)
      .values({
        entityId: entity.id,
        sellerName: "Amazon",
        sourceUrl: "https://www.amazon.com/dp/B000TEST123",
        urlHash: `source_hash_${timestamp}`,
        priceCents: 24500,
        currency: "USD",
      })
      .returning();

    // 4. Create user save
    const [save] = await db
      .insert(userSaves)
      .values({
        userId: curator.id,
        entityId: entity.id,
        preferredSourceId: source.id,
      })
      .returning();

    // 5. Invoke checkout route
    const req = new NextRequest("http://localhost:3000/api/v1/commerce/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saveId: save.id }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.session).toBeDefined();
    expect(data.session.protocol).toBe("UCP/1.0");
    expect(data.session.attribution.curatorId).toBe(curator.id);
    expect(data.session.attribution.affiliateTags.amazon).toBe("curator-amz-20");
    expect(data.session.totalCents).toBe(24500);
    expect(data.checkoutUrl).toContain("tag=curator-amz-20");
  });

  it("POST returns 404 if saveId does not exist", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/commerce/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saveId: "nonexistent-save-id" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Save not found");
  });

  it("POST returns 400 if saveId is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/commerce/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.success).toBe(false);
  });
});
