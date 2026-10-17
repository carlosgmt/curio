import { describe, it, expect } from "bun:test";
import { GET } from "./route";
import { db, users, userSaves, globalEntities } from "@/db";
import { createSession } from "@/lib/auth/session";

describe("Search API Route (/api/v1/search)", () => {
  it("returns 401 Unauthorized when invalid token is provided", async () => {
    const req = new Request("http://localhost:3000/api/v1/search?q=test", {
      headers: {
        Authorization: "Bearer invalid-token",
        "x-strict-auth": "true",
      },
    });

    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it("returns ranked search results with score metrics for authenticated user", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `api-search-${timestamp}@curio.local`,
        username: `api_search_${timestamp}`,
      })
      .returning();

    const session = await createSession(user.id);

    // Insert entity & save
    const [entity] = await db
      .insert(globalEntities)
      .values({
        title: "Kogei Japanese Craft",
        summary: "Traditional Japanese lacquerware and ceramics craft guide.",
        coreType: "PRODUCT",
        typePath: "/product/art",
        urlHash: `hash-craft-${timestamp}`,
        entityKey: `key-craft-${timestamp}`,
        canonicalUrl: "https://example.com/kogei",
        coreStructuredData: {},
      })
      .returning();

    await db.insert(userSaves).values({
      userId: user.id,
      entityId: entity.id,
      autoTags: ["japan", "craft", "ceramics"],
      isPrivateMemo: false,
    });

    const req = new Request("http://localhost:3000/api/v1/search?q=japanese+craft&semantic=true&limit=10", {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    const res = await GET(req as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.query).toBe("japanese craft");
    expect(data.count).toBeGreaterThan(0);
    expect(data.results[0].title).toBe("Kogei Japanese Craft");
    expect(data.results[0].score).toBeGreaterThan(0);
    expect(typeof data.results[0].semanticScore).toBe("number");
    expect(typeof data.results[0].lexicalScore).toBe("number");
  });
});
