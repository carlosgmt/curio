import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db, entitySources, globalEntities, listItems, smartLists, users, userSaves } from "@/db";
import { matchesAutoRules } from "@/lib/lists/service";
import {
  clearInstagramAuthRecord,
  getInstagramAuthRecord,
  mergeInstagramSetCookieHeaders,
  parseInstagramCookieString,
  setInstagramAuthRecord,
} from "../instagramAuthStore";
import {
  extractExternalLinks,
  fetchInstagramSavedPosts,
  InstagramAuthExpiredError,
  InstagramChallengeError,
} from "../instagramClient";
import { archiveInstagramPostMedia } from "../instagramMedia";
import { classifyInstagramPostHeuristic } from "../instagramClassifier";
import { instagramSyncAdapter } from "../instagram";

describe("Instagram Auth, Client, Media, Classifier & SyncAdapter", () => {
  it("parses cookie strings and persists 0600 auth records", () => {
    const parsed = parseInstagramCookieString(
      "Cookie: csrftoken=abc123; sessionid=99999%3Asecret%3A1; ds_user_id=99999; other=ignored"
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.sessionId).toBe("99999%3Asecret%3A1");
    expect(parsed?.csrfToken).toBe("abc123");
    expect(parsed?.dsUserId).toBe("99999");

    const uid = `ig-auth-test-${Date.now()}`;
    setInstagramAuthRecord(uid, {
      cookie: "sessionid=12345%3Atoken; csrftoken=xyz",
      igUsername: "carlosgmt",
    });
    const rec = getInstagramAuthRecord(uid);
    expect(rec?.sessionId).toBe("12345%3Atoken");
    expect(rec?.igUsername).toBe("carlosgmt");

    clearInstagramAuthRecord(uid);
    expect(getInstagramAuthRecord(uid)).toBeNull();
  });

  it("extracts deduplicated external URLs while filtering Instagram links and tracking params", () => {
    const text = `Check https://www.bodega.example/wine?utm_source=ig&fbclid=123 and https://instagram.com/p/ABC/ plus https://bodega.example/wine?utm_medium=social and https://maps.app.goo.gl/xyz123.`;
    const links = extractExternalLinks(text);
    expect(links).toEqual([
      "https://www.bodega.example/wine",
      "https://bodega.example/wine",
      "https://maps.app.goo.gl/xyz123",
    ]);
  });

  it("paginates saved posts, maps collections, stops early on known items, and aborts immediately on 401/429", async () => {
    const auth = {
      cookie: "sessionid=1%3Aabc; csrftoken=tok",
      sessionId: "1%3Aabc",
      csrfToken: "tok",
      updatedAt: new Date().toISOString(),
    };

    const mockFetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/collections/list/")) {
        return new Response(
          JSON.stringify({
            items: [
              { collection_id: "col_1", collection_name: "Recipes" },
              { collection_id: "col_2", collection_name: "Design" },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/api/v1/feed/saved/posts/") && !url.includes("max_id=")) {
        return new Response(
          JSON.stringify({
            more_available: true,
            next_max_id: "page_2",
            items: [
              {
                media: {
                  code: "NEW_POST_1",
                  pk: "101",
                  media_type: 2,
                  product_type: "clips",
                  caption: { text: "Crispy chili oil recipe https://seriouseats.com/chili?utm_source=ig" },
                  user: { username: "chef_uno", full_name: "Chef Uno" },
                  saved_collection_ids: ["col_1"],
                  image_versions2: { candidates: [{ url: "https://cdn.example/cover1.jpg", width: 1080, height: 1920 }] },
                  video_versions: [{ url: "https://cdn.example/video1.mp4", width: 1080, height: 1920 }],
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("max_id=page_2")) {
        return new Response(
          JSON.stringify({
            more_available: true,
            next_max_id: "page_3",
            items: [
              {
                media: {
                  code: "KNOWN_POST_2",
                  pk: "102",
                  media_type: 1,
                  caption: { text: "Old known item" },
                  user: { username: "arch" },
                  saved_collection_ids: ["col_2"],
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("unexpected", { status: 500 });
    };

    const res = await fetchInstagramSavedPosts(auth, {
      knownShortcodes: new Set(["KNOWN_POST_2"]),
      incremental: true,
      maxPages: 10,
      fetchFn: mockFetch,
      delayFn: async () => {},
    });

    expect(res.pagesFetched).toBe(2);
    expect(res.stoppedEarly).toBe(true);
    expect(res.posts).toHaveLength(2);
    expect(res.posts[0].collections.map((c) => c.name)).toEqual(["Recipes"]);
    expect(res.posts[0].externalLinks).toEqual(["https://seriouseats.com/chili"]);

    // 401 -> InstagramAuthExpiredError
    await expect(
      fetchInstagramSavedPosts(auth, {
        fetchFn: async () => new Response(JSON.stringify({ message: "login_required" }), { status: 401 }),
        delayFn: async () => {},
      })
    ).rejects.toBeInstanceOf(InstagramAuthExpiredError);

    // 429 -> InstagramChallengeError with zero retries
    let calls = 0;
    await expect(
      fetchInstagramSavedPosts(auth, {
        fetchFn: async () => {
          calls++;
          return new Response(JSON.stringify({ message: "challenge_required" }), { status: 429 });
        },
        delayFn: async () => {},
      })
    ).rejects.toBeInstanceOf(InstagramChallengeError);
    expect(calls).toBe(1);
  });

  it("archives Reel MP4 and carousel slides atomically & idempotently", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "curio-ig-media-"));
    let fetchCount = 0;
    const mockFetch = async () => {
      fetchCount++;
      return new Response(Uint8Array.from([1, 2, 3, 4, 5]), { status: 200 });
    };

    const post = {
      shortcode: "REEL_99",
      mediaPk: "99",
      permalink: "https://www.instagram.com/reel/REEL_99/",
      mediaType: "carousel" as const,
      authorUsername: "tester",
      caption: "",
      collections: [],
      externalLinks: [],
      coverUrl: "https://cdn.example/cover.jpg",
      videoUrl: "https://cdn.example/reel.mp4",
      carouselAssets: [
        { kind: "image" as const, url: "https://cdn.example/s1.jpg" },
        { kind: "video" as const, url: "https://cdn.example/s2.mp4" },
      ],
    };

    const first = await archiveInstagramPostMedia(post, { fetchFn: mockFetch, baseDir: tmpBase });
    expect(first.coverUrl).toBe("/curio/api/v1/media/instagram/REEL_99/cover.jpg");
    expect(first.videoUrl).toBe("/curio/api/v1/media/instagram/REEL_99/video.mp4");
    expect(first.carouselItems).toHaveLength(2);
    expect(first.bytesWritten).toBe(20);
    expect(fetchCount).toBe(4);

    // Second run skips existing non-empty files
    const second = await archiveInstagramPostMedia(post, { fetchFn: mockFetch, baseDir: tmpBase });
    expect(second.bytesWritten).toBe(0);
    expect(fetchCount).toBe(4);

    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  it("classifies recipes with 'recipe' tag and garments as wishlist without polluting Closet", () => {
    const recipe = classifyInstagramPostHeuristic({
      shortcode: "REC1",
      mediaPk: "1",
      permalink: "https://www.instagram.com/reel/REC1/",
      mediaType: "video",
      authorUsername: "cook",
      caption: "Easy pasta receta with garlic and olive oil #dinner",
      collections: [{ id: "1", name: "Cooking" }],
      externalLinks: [],
      carouselAssets: [],
    });
    expect(recipe.typePath).toBe("/culinary/recipe");
    expect(recipe.tags).toContain("instagram");
    expect(recipe.tags).toContain("recipe");
    expect(recipe.wishlist).toBe(false);

    const outfit = classifyInstagramPostHeuristic(
      {
        shortcode: "FIT1",
        mediaPk: "2",
        permalink: "https://www.instagram.com/p/FIT1/",
        mediaType: "image",
        authorUsername: "menswear",
        caption: "Autumn selvedge jacket outfit lookbook #closet #outfit #granada",
        collections: [{ id: "2", name: "Style" }],
        externalLinks: [],
        carouselAssets: [],
      },
      [{ slug: "granada", title: "Granada" }]
    );
    expect(outfit.typePath).toBe("/style/outfit");
    expect(outfit.wishlist).toBe(true);
    expect(outfit.tags).toContain("instagram");
    expect(outfit.tags).not.toContain("closet");
    expect(outfit.tags).not.toContain("outfit");
    expect(outfit.suggestedBoardSlug).toBe("granada");
  });

  it("syncs Instagram saves into permanent smart board + collection sub-boards without pruning unsaved items", async () => {
    const ts = Date.now();
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "curio-ig-sync-"));
    const [user] = await db
      .insert(users)
      .values({ email: `ig-${ts}@curio.local`, username: `ig_${ts}` })
      .returning();

    setInstagramAuthRecord(user.id, {
      cookie: "sessionid=abc%3A123; csrftoken=csrf1",
      igUsername: "carlos_test",
    });

    const page1Mock = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/collections/list/")) {
        return new Response(
          JSON.stringify({
            items: [{ collection_id: "c1", collection_name: "Madrid Spots" }],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/api/v1/feed/saved/posts/")) {
        return new Response(
          JSON.stringify({
            more_available: false,
            items: [
              {
                media: {
                  code: `SPOT_${ts}`,
                  pk: "501",
                  media_type: 1,
                  caption: { text: "Great espresso cafe in Madrid https://cafe.example/menu" },
                  user: { username: "madridcoffee" },
                  location: { name: "Hola Coffee", city: "Madrid", lat: 40.41, lng: -3.7 },
                  saved_collection_ids: ["c1"],
                  image_versions2: { candidates: [{ url: "https://cdn.example/cafe.jpg", width: 800, height: 800 }] },
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response(Uint8Array.from([9, 8, 7]), { status: 200 });
    };

    const firstRun = await instagramSyncAdapter.run!(user.id, {
      fetchFn: page1Mock,
      mediaFetchFn: async () => new Response(Uint8Array.from([9, 8, 7]), { status: 200 }),
      mediaBaseDir: tmpBase,
      delayFn: async () => {},
    });

    expect(firstRun.synced).toBe(true);
    expect(firstRun.createdSaves).toBe(1);

    // Root smart board exists with tagsInclude: ["instagram"]
    const boards = await db
      .select()
      .from(smartLists)
      .where(eq(smartLists.userId, user.id));
    const rootBoard = boards.find((b) => !b.parentId && b.title === "Instagram Saves");
    const subBoard = boards.find((b) => b.parentId === rootBoard?.id && b.title === "Madrid Spots");
    expect(rootBoard).toBeDefined();
    expect(rootBoard?.autoRules).toEqual({ tagsInclude: ["instagram"] });
    expect(subBoard).toBeDefined();
    expect(subBoard?.parentId).toBe(rootBoard?.id);

    const [savedEntity] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.entityKey, `instagram:SPOT_${ts}`));
    expect(savedEntity).toBeDefined();
    expect(savedEntity.typePath).toBe("/place");

    const [userSave] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.entityId, savedEntity.id));
    expect(matchesAutoRules(rootBoard!.autoRules, { save: userSave, entity: savedEntity })).toBe(true);

    const sources = await db
      .select()
      .from(entitySources)
      .where(eq(entitySources.entityId, savedEntity.id));
    expect(sources.map((s) => s.sourceUrl)).toContain("https://cafe.example/menu");
    expect(sources.map((s) => s.sourceUrl)).toContain(`https://www.instagram.com/p/SPOT_${ts}/`);

    // Second run where upstream feed is empty must NOT prune archived save
    const emptyMock = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/collections/list/")) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ more_available: false, items: [] }), { status: 200 });
    };

    const secondRun = await instagramSyncAdapter.run!(user.id, {
      fetchFn: emptyMock,
      mediaBaseDir: tmpBase,
      delayFn: async () => {},
    });
    expect(secondRun.prunedSaves).toBe(0);

    const remainingSaves = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    expect(remainingSaves).toHaveLength(1);

    const subMembers = await db
      .select()
      .from(listItems)
      .where(eq(listItems.listId, subBoard!.id));
    expect(subMembers).toHaveLength(1);

    clearInstagramAuthRecord(user.id);
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  it("merges Set-Cookie rotations, ignores deletions, and persists rotated tokens during paginated sync", async () => {
    const current = {
      cookie: "sessionid=1%3Asess_old; csrftoken=csrf_old; ds_user_id=1",
      sessionId: "1%3Asess_old",
      csrfToken: "csrf_old",
      dsUserId: "1",
    };

    const ignored = mergeInstagramSetCookieHeaders(current, [
      'csrftoken=""; Max-Age=0; Path=/',
      "rur=deleted; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "csrftoken=csrf_old; Path=/",
    ]);
    expect(ignored.updated).toBe(false);
    expect(ignored.csrfToken).toBe("csrf_old");

    const rotated = mergeInstagramSetCookieHeaders(current, [
      "csrftoken=csrf_new; Path=/; Secure",
      'rur="VLL\\0541\\054179:abc"; Path=/',
    ]);
    expect(rotated.updated).toBe(true);
    expect(rotated.csrfToken).toBe("csrf_new");
    expect(rotated.cookie).toContain("csrftoken=csrf_new");
    expect(rotated.cookie).toContain("rur=");

    const ts = Date.now();
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "curio-ig-rot-"));
    const [user] = await db
      .insert(users)
      .values({ email: `ig-rot-${ts}@curio.local`, username: `ig_rot_${ts}` })
      .returning();

    setInstagramAuthRecord(user.id, {
      cookie: current.cookie,
      igUsername: "rot_tester",
    });

    let page2SeenCsrf = "";
    const rotatingFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const reqHeaders = new Headers(init?.headers);
      if (url.includes("/api/v1/collections/list/")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: {
            "set-cookie": "csrftoken=csrf_rotated_1; Path=/; Secure",
          },
        });
      }
      if (url.includes("/api/v1/feed/saved/posts/") && !url.includes("max_id=")) {
        return new Response(
          JSON.stringify({
            more_available: true,
            next_max_id: "p2",
            items: [],
          }),
          { status: 200 }
        );
      }
      page2SeenCsrf = reqHeaders.get("x-csrf-token") || reqHeaders.get("X-CSRFToken") || "";
      return new Response(
        JSON.stringify({
          more_available: false,
          items: [],
        }),
        { status: 200 }
      );
    };

    await instagramSyncAdapter.run!(user.id, {
      fetchFn: rotatingFetch,
      mediaBaseDir: tmpBase,
      delayFn: async () => {},
    });

    expect(page2SeenCsrf).toBe("csrf_rotated_1");
    const updatedAuth = getInstagramAuthRecord(user.id);
    expect(updatedAuth?.csrfToken).toBe("csrf_rotated_1");

    clearInstagramAuthRecord(user.id);
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  it("falls back gracefully when collections/list returns 404 HTML and still fetches saved posts", async () => {
    const auth = {
      cookie: "sessionid=1%3Aabc; csrftoken=tok",
      sessionId: "1%3Aabc",
      csrfToken: "tok",
      updatedAt: new Date().toISOString(),
    };

    let sawCorsHeaders = false;
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const hdrs = new Headers(init?.headers);
      if (
        hdrs.get("sec-fetch-site") === "same-origin" &&
        hdrs.get("origin") === "https://www.instagram.com" &&
        hdrs.get("x-asbd-id") === "129477"
      ) {
        sawCorsHeaders = true;
      }
      if (url.includes("/api/v1/collections/list/")) {
        return new Response("<!DOCTYPE html><html><body>Not Found</body></html>", {
          status: 404,
          headers: { "Content-Type": "text/html" },
        });
      }
      return new Response(
        JSON.stringify({
          more_available: false,
          items: [
            {
              media: {
                code: "FALLBACK_POST_1",
                pk: "777",
                media_type: 1,
                caption: { text: "Saved without collections endpoint" },
                user: { username: "creator_fb" },
              },
            },
          ],
        }),
        { status: 200 }
      );
    };

    const res = await fetchInstagramSavedPosts(auth, {
      fetchFn: mockFetch,
      delayFn: async () => {},
    });

    expect(sawCorsHeaders).toBe(true);
    expect(res.collections).toEqual([]);
    expect(res.posts).toHaveLength(1);
    expect(res.posts[0].shortcode).toBe("FALLBACK_POST_1");
  });
});
