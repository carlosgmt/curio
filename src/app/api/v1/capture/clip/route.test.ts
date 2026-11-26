import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, globalEntities, users, userSaves } from "@/db";
import { createSession } from "@/lib/auth/session";
import { POST } from "./route";

describe("Universal Clip Capture API (/api/v1/capture/clip)", () => {
  it("saves clipped garment & recipe snapshots cleanly, sets wishlist for gear/closet, and deduplicates by URL", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `clip-test-${ts}@curio.local`,
        username: `clip_tester_${ts}`,
        displayName: "Clip Tester",
      })
      .returning();

    const { token } = await createSession(user.id);
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const garmentUrl = `https://www.cos.com/en-ch/men/coats/wool-coat-${ts}.html`;
    const firstReq = new NextRequest("http://localhost:3000/curio/api/v1/capture/clip", {
      method: "POST",
      headers,
      body: JSON.stringify({
        url: garmentUrl,
        name: "Relaxed Wool Coat",
        brand: "COS",
        color: "Navy Blue",
        materialText: "80% Wool, 20% Polyamide",
        price: "250,00 €",
        images: [`https://cdn.cos.com/wool-coat-${ts}.jpg`],
        schemaTypes: ["Product"],
      }),
    });

    const firstRes = await POST(firstReq);
    expect(firstRes.status).toBe(201);
    const firstData = await firstRes.json();
    expect(firstData.ok).toBe(true);
    expect(firstData.status).toBe("created");
    expect(firstData.routing.destination).toBe("closet");
    expect(firstData.routing.targetPath).toBe("/closet/");
    expect(firstData.save.wishlist).toBe(true);
    expect(firstData.entity.priceCents).toBe(25000);
    expect(firstData.entity.currency).toBe("EUR");
    expect(firstData.entity.heroImageUrl).toBe(`https://cdn.cos.com/wool-coat-${ts}.jpg`);

    // Second POST with same URL deduplicates instead of creating a second save/entity
    const secondReq = new NextRequest("http://localhost:3000/curio/api/v1/capture/clip", {
      method: "POST",
      headers,
      body: JSON.stringify({
        url: garmentUrl,
        name: "Relaxed Wool Coat",
        selection: "Check size 48 in store",
      }),
    });
    const secondRes = await POST(secondReq);
    expect(secondRes.status).toBe(200);
    const secondData = await secondRes.json();
    expect(secondData.status).toBe("existing");
    expect(secondData.save.id).toBe(firstData.save.id);
    expect(secondData.save.personalNotes).toContain("Check size 48 in store");

    const userRows = await db.select().from(userSaves).where(eq(userSaves.userId, user.id));
    expect(userRows.length).toBe(1);

    // Recipe clip saves with destination = chef and wishlist = false
    const recipeUrl = `https://www.seriouseats.com/risotto-${ts}`;
    const recipeRes = await POST(
      new NextRequest("http://localhost:3000/curio/api/v1/capture/clip", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: recipeUrl,
          name: "Mushroom Risotto",
          schemaTypes: ["Recipe"],
          recipe: { ingredients: ["300g Arborio rice", "250g cremini mushrooms"] },
        }),
      })
    );
    expect(recipeRes.status).toBe(201);
    const recipeData = await recipeRes.json();
    expect(recipeData.routing.destination).toBe("chef");
    expect(recipeData.routing.targetPath).toBe("/chef/");
    expect(recipeData.save.wishlist).toBe(false);

    // Invalid URL rejected with 400
    const badRes = await POST(
      new NextRequest("http://localhost:3000/curio/api/v1/capture/clip", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: "javascript:alert(1)" }),
      })
    );
    expect(badRes.status).toBe(400);

    // Verify canonical entity exists cleanly
    const [storedEntity] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, firstData.entity.id))
      .limit(1);
    expect(storedEntity?.canonicalUrl).toBe(garmentUrl);
  });
});
