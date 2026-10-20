import { describe, expect, it } from "bun:test";
import { db, users, userSaves, globalEntities } from "@/db";
import { GET } from "./route";
import { NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";

describe("Live Omnibox Typeahead / Autocomplete API (/api/v1/capture/suggest)", () => {
  it("returns empty suggestions for short queries", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `suggest-${timestamp}@curio.local`,
        username: `sug_${timestamp}`,
        displayName: "Suggest Tester",
      })
      .returning();

    const { token } = await createSession(user.id);
    const req = new NextRequest("http://localhost:3000/api/v1/capture/suggest?q=a", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.suggestions).toBeDefined();
    expect(data.suggestions.length).toBe(0);
  });

  it("prioritizes existing user saves and merges universal discovery candidates", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `suggest2-${timestamp}@curio.local`,
        username: `sug2_${timestamp}`,
        displayName: "Suggest Tester 2",
      })
      .returning();

    const { generateEntityKey } = await import("@/lib/ingest/cascade");
    const testUrl = `https://curio.local/item/omega-morente-${timestamp}`;
    const { urlHash, entityKey } = generateEntityKey(testUrl);

    const [entity] = await db
      .insert(globalEntities)
      .values({
        title: "Omega Morente Vault Item",
        canonicalUrl: testUrl,
        urlHash,
        entityKey,
        coreType: "MEDIA",
        typePath: "/media/music/album",
        brandOrCreator: "Enrique Morente",
        coreStructuredData: {},
      })
      .returning();

    await db.insert(userSaves).values({
      userId: user.id,
      entityId: entity.id,
      typePath: "/media/music/album",
      isPrivateMemo: false,
    });

    const { token } = await createSession(user.id);
    const req = new NextRequest("http://localhost:3000/api/v1/capture/suggest?q=Morente", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.suggestions).toBeDefined();
    expect(data.suggestions.length).toBeGreaterThan(0);

    const first = data.suggestions[0];
    expect(first.isExistingSave).toBe(true);
    expect(first.title).toBe("Omega Morente Vault Item");
    expect(first.badgeLabel).toBe("ALBUM");
  });
});
