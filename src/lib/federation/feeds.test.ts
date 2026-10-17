import { describe, it, expect } from "bun:test";
import { generateActivityPubCollection } from "./activitypub";
import { generateRssFeed } from "./rss";

describe("Federated Feeds Engine (ActivityPub & RSS)", () => {
  const mockList = {
    id: "list-fed-1",
    title: "Tokyo Vinyl & Coffee Bars",
    slug: "tokyo-vinyl-coffee",
    description: "Curated audiophile kissaten & micro-roasters in Shibuya & Shimokitazawa.",
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-17T12:00:00Z",
  };

  const mockOwner = {
    id: "user-audiophile",
    username: "kenji",
    displayName: "Kenji Sato",
  };

  const mockItems = [
    {
      save: { id: "save-1", isPrivateMemo: false, createdAt: "2026-10-02T10:00:00Z" },
      entity: {
        id: "ent-1",
        title: "Lion Kissaten (名曲喫茶ライオン)",
        summary: "Historic classical music cafe built in 1926 with massive custom speakers.",
        heroImageUrl: "https://example.com/lion.jpg",
        coreType: "PLACE",
      },
      listItem: {
        id: "li-1",
        curatorNote: "No talking allowed inside. Sit in front of the 3-meter horn speakers.",
        addedAt: "2026-10-02T11:00:00Z",
      },
    },
    {
      save: { id: "save-secret", isPrivateMemo: true, privateTitle: "My Personal Wi-Fi Password" },
      entity: {
        id: "ent-secret",
        title: "My Personal Wi-Fi Password",
        coreType: "PRIVATE_MEMO",
        isPrivateMemo: true,
      },
      listItem: {
        id: "li-secret",
        curatorNote: "Secret notes",
      },
    },
    {
      save: { id: "save-2", isPrivateMemo: false, createdAt: "2026-10-03T10:00:00Z" },
      entity: {
        id: "ent-2",
        title: "Bar Music Shibuya",
        summary: "Intimate audiophile record bar curated by Tomoaki Nakamura.",
        heroImageUrl: "https://example.com/barmusic.jpg",
        coreType: "PLACE",
      },
      listItem: {
        id: "li-2",
        curatorNote: "Order the signature rum drip coffee cocktail.",
        addedAt: "2026-10-03T11:00:00Z",
      },
    },
  ];

  describe("ActivityPub Generator", () => {
    it("generates a valid W3C ActivityStreams 2.0 OrderedCollection", () => {
      const collection = generateActivityPubCollection(
        mockList,
        mockItems,
        "https://curio.app",
        mockOwner
      );

      expect(collection["@context"]).toBe("https://www.w3.org/ns/activitystreams");
      expect(collection.type).toBe("OrderedCollection");
      expect(collection.id).toBe("https://curio.app/api/v1/federation/lists/tokyo-vinyl-coffee");
      expect(collection.name).toBe("Tokyo Vinyl & Coffee Bars");
      expect(collection.totalItems).toBe(2); // Secret memo must be excluded!
      expect(collection.orderedItems).toHaveLength(2);

      const first = collection.orderedItems[0];
      expect(first.type).toBe("Create");
      expect(first.actor).toBe("https://curio.app/@kenji");
      expect(first.to).toEqual(["https://www.w3.org/ns/activitystreams#Public"]);
      expect(first.object.type).toBe("Note");
      expect(first.object.name).toBe("Lion Kissaten (名曲喫茶ライオン)");
      expect(first.object.url).toBe("https://curio.app/card/save-1");
      expect(first.object.summary).toBe("No talking allowed inside. Sit in front of the 3-meter horn speakers.");
      expect(first.object.attachment?.[0]?.url).toBe("https://example.com/lion.jpg");
    });

    it("filters out private memos unconditionally", () => {
      const collection = generateActivityPubCollection(mockList, mockItems, "https://curio.app");
      const hasSecret = collection.orderedItems.some(
        (item: any) =>
          item.object.name.includes("Password") ||
          item.object.content.includes("Secret")
      );
      expect(hasSecret).toBe(false);
    });
  });

  describe("RSS 2.0 Generator", () => {
    it("generates valid RSS 2.0 XML with channel and enclosure tags", () => {
      const rss = generateRssFeed(mockList, mockItems, "https://curio.app", mockOwner);

      expect(rss.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
      expect(rss).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">');
      expect(rss).toContain("<title>Tokyo Vinyl &amp; Coffee Bars</title>");
      expect(rss).toContain("<link>https://curio.app/list/tokyo-vinyl-coffee</link>");
      expect(rss).toContain('<atom:link href="https://curio.app/api/v1/lists/tokyo-vinyl-coffee/feed.rss" rel="self" type="application/rss+xml"/>');
      expect(rss).toContain("<managingEditor>kenji@curio.app (Kenji Sato)</managingEditor>");

      // Check item 1
      expect(rss).toContain("<title>Lion Kissaten (名曲喫茶ライオン)</title>");
      expect(rss).toContain("<link>https://curio.app/card/save-1</link>");
      expect(rss).toContain('<enclosure url="https://example.com/lion.jpg" type="image/jpeg" length="0" />');
      expect(rss).toContain('<media:content url="https://example.com/lion.jpg" medium="image" />');

      // Check exclusion of private memo
      expect(rss).not.toContain("Password");
      expect(rss).not.toContain("Secret notes");
    });
  });

  describe("Feed API Route Handlers", () => {
    it("GET /api/v1/federation/lists/[slug] returns application/activity+json", async () => {
      const { GET } = await import("@/app/api/v1/federation/lists/[slug]/route");
      const { db, users } = await import("@/db");
      const { createList, addItemToList } = await import("@/lib/lists/service");
      const { globalEntities, userSaves } = await import("@/db");

      const timestamp = Date.now();
      const [user] = await db
        .insert(users)
        .values({
          email: `fed-route-${timestamp}@curio.local`,
          username: `fed_user_${timestamp}`,
          displayName: "Federated Curator",
        })
        .returning();

      const list = await createList(user.id, {
        title: `Federated Board ${timestamp}`,
        description: "Public board for ActivityPub",
        visibility: "PUBLIC",
      });

      const [entity] = await db
        .insert(globalEntities)
        .values({
          title: "Kind of Blue",
          canonicalUrl: "https://example.com/kind-of-blue",
          urlHash: `hash-${timestamp}`,
          entityKey: `key-${timestamp}`,
          coreType: "MEDIA",
          coreStructuredData: {},
        })
        .returning();

      const [save] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: entity.id,
          isPrivateMemo: false,
        })
        .returning();

      await addItemToList(list.id, save.id, { curatorNote: "Must have vinyl" });

      const req = new Request(`http://localhost:3000/api/v1/federation/lists/${list.slug}`);
      const res = await GET(req as any, { params: Promise.resolve({ slug: list.slug }) });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/activity+json");

      const data = await res.json();
      expect(data["@context"]).toBe("https://www.w3.org/ns/activitystreams");
      expect(data.type).toBe("OrderedCollection");
      expect(data.totalItems).toBe(1);
      expect(data.orderedItems[0].object.name).toBe("Kind of Blue");
    });

    it("GET /api/v1/lists/[slug]/feed.rss returns application/rss+xml", async () => {
      const { GET } = await import("@/app/api/v1/lists/[slug]/feed.rss/route");
      const { db, users, globalEntities, userSaves } = await import("@/db");
      const { createList, addItemToList } = await import("@/lib/lists/service");

      const timestamp = Date.now();
      const [user] = await db
        .insert(users)
        .values({
          email: `rss-route-${timestamp}@curio.local`,
          username: `rss_user_${timestamp}`,
          displayName: "RSS Curator",
        })
        .returning();

      const list = await createList(user.id, {
        title: `RSS Board ${timestamp}`,
        description: "Feed test board",
        visibility: "PUBLIC",
      });

      const [entity] = await db
        .insert(globalEntities)
        .values({
          title: "Solaris 1972",
          canonicalUrl: "https://example.com/solaris",
          urlHash: `hash-solaris-${timestamp}`,
          entityKey: `key-solaris-${timestamp}`,
          coreType: "MEDIA",
          coreStructuredData: {},
        })
        .returning();

      const [save] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: entity.id,
          isPrivateMemo: false,
        })
        .returning();

      await addItemToList(list.id, save.id);

      const req = new Request(`http://localhost:3000/api/v1/lists/${list.slug}/feed.rss`);
      const res = await GET(req as any, { params: Promise.resolve({ slug: list.slug }) });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/rss+xml");

      const xml = await res.text();
      expect(xml).toContain("<rss version=\"2.0\"");
      expect(xml).toContain("Solaris 1972");
    });

    it("returns 404 for non-existent list on both endpoints", async () => {
      const { GET: getAP } = await import("@/app/api/v1/federation/lists/[slug]/route");
      const { GET: getRSS } = await import("@/app/api/v1/lists/[slug]/feed.rss/route");

      const reqAP = new Request("http://localhost:3000/api/v1/federation/lists/does-not-exist");
      const resAP = await getAP(reqAP as any, { params: Promise.resolve({ slug: "does-not-exist" }) });
      expect(resAP.status).toBe(404);

      const reqRSS = new Request("http://localhost:3000/api/v1/lists/does-not-exist/feed.rss");
      const resRSS = await getRSS(reqRSS as any, { params: Promise.resolve({ slug: "does-not-exist" }) });
      expect(resRSS.status).toBe(404);
    });
  });
});

