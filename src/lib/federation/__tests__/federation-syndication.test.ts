import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { db, users, smartLists, listItems, userSaves, globalEntities } from "@/db";
import { generateActivityPubActor } from "../activitypub";
import { buildBlueskyCurationPost, CURIO_CURATION_LEXICON } from "../atproto";
import { GET as webfingerGet } from "@/app/.well-known/webfinger/route";
import { GET as actorGet } from "@/app/api/v1/federation/actors/[username]/route";
import { middleware } from "@/middleware";

describe("Federation, Syndication & Public Vitrines (Phase 7 / FR-4)", () => {
  it("WebFinger RFC 7033 resolves user handle and returns ActivityStreams actor links", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `wf-${timestamp}@curio.local`,
        username: `curator_wf_${timestamp}`,
        displayName: "WebFinger Curator",
      })
      .returning();

    const req = new NextRequest(
      `http://localhost:3000/curio/.well-known/webfinger?resource=acct:${user.username}@curio.local`,
      {
        headers: { host: "localhost:3000" },
      }
    );

    const res = await webfingerGet(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.subject).toBe(`acct:${user.username}@localhost:3000`);
    expect(data.aliases).toContain(`http://localhost:3000/curio/@${user.username}`);

    const selfLink = data.links.find((l: any) => l.rel === "self");
    expect(selfLink).toBeDefined();
    expect(selfLink.type).toBe("application/activity+json");
    expect(selfLink.href).toContain(`/api/v1/federation/actors/${user.username}`);
  });

  it("ActivityPub Actor endpoint returns W3C ActivityStreams 2.0 Person profile with public key", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `ap-${timestamp}@curio.local`,
        username: `ap_actor_${timestamp}`,
        displayName: "ActivityPub Actor",
      })
      .returning();

    const req = new NextRequest(
      `http://localhost:3000/curio/api/v1/federation/actors/${user.username}`
    );

    const res = await actorGet(req, {
      params: Promise.resolve({ username: user.username }),
    });

    expect(res.status).toBe(200);
    const actor = await res.json();

    expect(actor.type).toBe("Person");
    expect(actor.preferredUsername).toBe(user.username);
    expect(actor.name).toBe("ActivityPub Actor");
    expect(actor.summary).toBe("Curio taste profile of ActivityPub Actor");
    expect(actor.inbox).toContain(`/api/v1/federation/actors/${user.username}/inbox`);
    expect(actor.publicKey?.publicKeyPem).toContain("BEGIN PUBLIC KEY");
  });

  it("AT Protocol (Bluesky) syndication generates app.curio.curation records with UTF-8 byte facets", () => {
    const post = buildBlueskyCurationPost({
      $type: CURIO_CURATION_LEXICON,
      title: "Dieter Rams: Ten Principles for Good Design",
      url: "https://curio.app/card/rams-ten-principles",
      description: "Less, but better. The seminal manifesto on functional minimalism.",
      tags: ["design", "minimalism", "braun"],
      curatorHandle: "carlos",
    });

    expect(post.$type).toBe("app.bsky.feed.post");
    expect(post.text).toContain("Curated on @curio: Dieter Rams");
    expect(post.text).toContain("#design #minimalism #braun");

    // Verify facets are computed with byte offsets
    expect(post.facets.length).toBe(3);
    expect(post.facets[0].features[0].$type).toBe("app.bsky.richtext.facet#tag");
    expect(post.facets[0].features[0].tag).toBe("design");
    expect(post.facets[0].index.byteEnd).toBeGreaterThan(post.facets[0].index.byteStart);

    // Verify external embed card
    expect(post.embed?.$type).toBe("app.bsky.embed.external");
    expect(post.embed?.external.title).toBe("Dieter Rams: Ten Principles for Good Design");
    expect(post.embed?.external.uri).toBe("https://curio.app/card/rams-ten-principles");
  });

  it("Vanity @handle middleware rewrites /@handle/:slug and /@handle cleanly", () => {
    // 1. Board URL rewrite: /@carlos/japan-spots -> /list/japan-spots?curator=carlos
    const boardReq = new NextRequest("http://localhost:3000/@carlos/japan-spots");
    const boardRes = middleware(boardReq);
    expect(boardRes.headers.get("x-middleware-rewrite")).toContain("/list/japan-spots?curator=carlos");

    // 2. User profile rewrite: /@carlos -> /user/carlos
    const userReq = new NextRequest("http://localhost:3000/@carlos");
    const userRes = middleware(userReq);
    expect(userRes.headers.get("x-middleware-rewrite")).toContain("/user/carlos");

    // 3. Regular path passes through
    const passReq = new NextRequest("http://localhost:3000/explore");
    const passRes = middleware(passReq);
    expect(passRes.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
