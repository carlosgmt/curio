import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { POST as splitCheckoutPost, GET as splitCheckoutGet } from "../split-checkout/route";
import { GET as redirectGet } from "../redirect/route";
import { POST as purchasePost } from "../../lists/[slug]/purchase/route";
import { getListBySlugWithItems } from "@/lib/lists/service";
import { db, users, smartLists, listItems, userSaves, globalEntities, auditLogs } from "@/db";
import { eq, sql } from "drizzle-orm";

describe("Commerce API Routes (Phase 6 / Split Checkout, Redirect, Paywall Purchase)", () => {
  it("POST & GET /api/v1/commerce/split-checkout manages persistent split sessions", async () => {
    const timestamp = Date.now();

    const [curator] = await db
      .insert(users)
      .values({
        email: `split-api-curator-${timestamp}@curio.local`,
        username: `split_curator_${timestamp}`,
        displayName: "API Curator",
      })
      .returning();

    const [board] = await db
      .insert(smartLists)
      .values({
        userId: curator.id,
        title: "Split API Test Board",
        slug: `split-api-${timestamp}`,
        visibility: "PUBLIC",
      })
      .returning();

    // 1. Test POST split checkout
    const postReq = new NextRequest("http://localhost:3000/api/v1/commerce/split-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: board.id }),
    });

    const postRes = await splitCheckoutPost(postReq);
    expect(postRes.status).toBe(200);

    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.session).toBeDefined();
    expect(postData.session.boardId).toBe(board.id);
    expect(postData.session.id).toBeDefined();

    // 2. Test GET split checkout
    const getReq = new NextRequest(
      `http://localhost:3000/api/v1/commerce/split-checkout?sessionId=${postData.session.id}`
    );
    const getRes = await splitCheckoutGet(getReq);
    expect(getRes.status).toBe(200);

    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.session.id).toBe(postData.session.id);
  });

  it("GET /api/v1/commerce/redirect logs audit click event and returns 302 redirect", async () => {
    const timestamp = Date.now();
    const [clickUser] = await db
      .insert(users)
      .values({
        email: `click-curator-${timestamp}@curio.local`,
        username: `click_curator_${timestamp}`,
        displayName: "Click Curator",
      })
      .returning();

    const destination = "https://www.bookshop.org/books/art-of-travel?aid=curio";
    const req = new NextRequest(
      `http://localhost:3000/api/v1/commerce/redirect?url=${encodeURIComponent(
        destination
      )}&seller=Bookshop&curatorId=${clickUser.id}&saveId=sav_${timestamp}`
    );

    const res = await redirectGet(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(destination);

    // Verify audit log row
    const [log] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "COMMERCE_OUTBOUND_CLICK"))
      .orderBy(sql`created_at DESC`)
      .limit(1);

    expect(log).toBeDefined();
    expect(log.action).toBe("COMMERCE_OUTBOUND_CLICK");
    expect(log.operatorUserId).toBe(clickUser.id);
  });

  it("POST /api/v1/lists/[slug]/purchase handles paywall gating and grants access", async () => {
    const timestamp = Date.now();

    // Curator creates a paywalled list
    const [curator] = await db
      .insert(users)
      .values({
        email: `paywall-curator-${timestamp}@curio.local`,
        username: `curator_pw_${timestamp}`,
        displayName: "Curator Paywall",
      })
      .returning();

    const [buyer] = await db
      .insert(users)
      .values({
        email: `paywall-buyer-${timestamp}@curio.local`,
        username: `buyer_pw_${timestamp}`,
        displayName: "Buyer Paywall",
      })
      .returning();

    const [paywalledBoard] = await db
      .insert(smartLists)
      .values({
        userId: curator.id,
        title: "Exclusive Private Sommelier Cellar",
        slug: `cellar-exclusive-${timestamp}`,
        isPaywalled: true,
        accessPriceCents: 5000,
        visibility: "PUBLIC",
      })
      .returning();

    // 1. Unpurchased buyer should be blocked by PAYWALL_REQUIRED
    let errorCaught: any = null;
    try {
      await getListBySlugWithItems(paywalledBoard.slug, buyer.id);
    } catch (err) {
      errorCaught = err;
    }
    expect(errorCaught).toBeDefined();
    expect(errorCaught.message).toContain("PAYWALL_REQUIRED");

    // 2. Buyer purchases list with simulateSuccess
    const purchaseReq = new NextRequest(
      `http://localhost:3000/api/v1/lists/${paywalledBoard.slug}/purchase`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerUserId: buyer.id,
          simulateSuccess: true,
        }),
      }
    );

    const purchaseRes = await purchasePost(purchaseReq, {
      params: Promise.resolve({ slug: paywalledBoard.slug }),
    });

    expect(purchaseRes.status).toBe(200);
    const purchaseData = await purchaseRes.json();
    expect(purchaseData.success).toBe(true);
    expect(purchaseData.accessGranted).toBe(true);
    expect(purchaseData.session.status).toBe("COMPLETED");

    // 3. Buyer now accesses list successfully without error
    const accessedList = await getListBySlugWithItems(paywalledBoard.slug, buyer.id);
    expect(accessedList).toBeDefined();
    expect(accessedList?.list.title).toBe("Exclusive Private Sommelier Cellar");
  });
});
