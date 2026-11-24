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

  it("matches suggestion typePath against custom curio_types and populates curioTypeId and custom badgeLabel", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `custom-type-${timestamp}@curio.local`,
        username: `cust_${timestamp}`,
        displayName: "Custom Type Tester",
      })
      .returning();

    const { curioTypes } = await import("@/db");
    const [customType] = await db
      .insert(curioTypes)
      .values({
        userId: user.id,
        name: "Specialty Coffee",
        typePath: `/product/beverage/coffee-${timestamp}`,
        rootArchetype: "PRODUCT",
        defaultSilhouette: "tall_portrait",
        jsonSchema: {},
        createdAt: new Date().toISOString(),
      })
      .returning();

    const [entity] = await db
      .insert(globalEntities)
      .values({
        title: `Geisha Filter Roast ${timestamp}`,
        canonicalUrl: `https://roasters.local/coffee-${timestamp}`,
        urlHash: `hash-${timestamp}`,
        entityKey: `key-${timestamp}`,
        coreType: "PRODUCT",
        typePath: `/product/beverage/coffee-${timestamp}`,
        brandOrCreator: "Sey Coffee",
        coreStructuredData: {},
      })
      .returning();

    await db.insert(userSaves).values({
      userId: user.id,
      entityId: entity.id,
      typePath: `/product/beverage/coffee-${timestamp}`,
      customTypeId: customType.id,
      isPrivateMemo: false,
    });

    const { token } = await createSession(user.id);
    const req = new NextRequest(`http://localhost:3000/api/v1/capture/suggest?q=Geisha`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.suggestions.length).toBeGreaterThan(0);

    const match = data.suggestions.find((s: any) => s.title.includes("Geisha"));
    expect(match).toBeDefined();
    expect(match.curioTypeId).toBe(customType.id);
    expect(match.badgeLabel).toBe("SPECIALTY COFFEE");
  });

  it("suggests [QUOTE] when quotation input with author is typed in omnibox", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `quote-sug-${timestamp}@curio.local`,
        username: `quote_${timestamp}`,
        displayName: "Quote Suggester",
      })
      .returning();

    const { token } = await createSession(user.id);
    const req = new NextRequest(
      `http://localhost:3000/api/v1/capture/suggest?q=${encodeURIComponent('"We suffer more often in imagination than in reality." - Seneca')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.suggestions.length).toBeGreaterThan(0);

    const quoteSug = data.suggestions.find((s: any) => s.badgeLabel === "QUOTE");
    expect(quoteSug).toBeDefined();
    expect(quoteSug.typePath).toBe("/quote");
    expect(quoteSug.title).toContain("We suffer more often");
    expect(quoteSug.subtitle).toContain("Seneca");
  });

  it("suggests local venues via OpenStreetMap Nominatim with venue category and location", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `venue-sug-${timestamp}@curio.local`,
        username: `venue_${timestamp}`,
        displayName: "Venue Explorer",
      })
      .returning();

    const { token } = await createSession(user.id);
    const req = new NextRequest(
      `http://localhost:3000/api/v1/capture/suggest?q=${encodeURIComponent("Federal Cafe")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.suggestions.length).toBeGreaterThan(0);

    const placeSug = data.suggestions.find((s: any) => s.typePath === "/place" && s.title.includes("Federal"));
    expect(placeSug).toBeDefined();
    expect(placeSug.typePath).toBe("/place");
    expect(placeSug.badgeLabel).toContain("PLACE");
    expect(placeSug.canonicalUrl).toContain("google.com/maps");
    expect(placeSug.title).toContain("Federal");
  });

  it("suggests [BOOK] via Apple Books for 'Plomo by Jose Luis Sastre' when Wikipedia/OpenLibrary miss", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `book-sug-${timestamp}@curio.local`,
        username: `booksug_${timestamp}`,
        displayName: "Book Reader",
      })
      .returning();

    const { token } = await createSession(user.id);
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("itunes.apple.com/search") && u.includes("media=ebook")) {
        return new Response(
          JSON.stringify({
            resultCount: 1,
            results: [
              {
                trackId: 6758959746,
                trackName: "Plomo",
                artistName: "José Luis Sastre",
                releaseDate: "2026-03-12T07:00:00Z",
                artworkUrl100:
                  "https://is1-ssl.mzstatic.com/image/thumb/Publication211/v4/9788401037115.jpg/100x100bb.jpg",
                description: "Novela de José Luis Sastre.",
                trackViewUrl: "https://books.apple.com/us/book/plomo/id6758959746",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ results: [], docs: [], query: { search: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/capture/suggest?q=${encodeURIComponent("Plomo by Jose Luis Sastre")}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.suggestions.length).toBeGreaterThan(0);
      const bookSug = data.suggestions.find((s: any) => s.title === "Plomo");
      expect(bookSug).toBeDefined();
      expect(bookSug.typePath).toBe("/product/book");
      expect(bookSug.creator).toBe("José Luis Sastre");
      expect(bookSug.year).toBe(2026);
      expect(bookSug.heroImageUrl).toContain("600x600bb.jpg");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
