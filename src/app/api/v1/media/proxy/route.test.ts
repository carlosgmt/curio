import { describe, it, expect } from "bun:test";
import { handleMediaProxy } from "./route";
import { db, users, globalEntities, userSaves } from "@/db";
import { createSession } from "@/lib/auth/session";

describe("Media Proxy API Route (/api/v1/media/proxy)", () => {
  it("rejects non-HTTPS, missing URL, and credentialed URLs", async () => {
    const reqHttp = new Request("http://localhost:3000/api/v1/media/proxy?url=http%3A%2F%2Fexample.com%2Fa.jpg");
    const resHttp = await handleMediaProxy(reqHttp as any);
    expect(resHttp.status).toBe(400);

    const reqEmpty = new Request("http://localhost:3000/api/v1/media/proxy");
    const resEmpty = await handleMediaProxy(reqEmpty as any);
    expect(resEmpty.status).toBe(400);

    const reqCreds = new Request("http://localhost:3000/api/v1/media/proxy?url=https%3A%2F%2Fuser%3Apass%40example.com%2Fa.jpg");
    const resCreds = await handleMediaProxy(reqCreds as any);
    expect(resCreds.status).toBe(400);
  });

  it("rejects unauthenticated requests for arbitrary URLs", async () => {
    const req = new Request(
      "http://localhost:3000/api/v1/media/proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F9999999-L.jpg",
      { headers: { "x-strict-auth": "true" } }
    );
    const res = await handleMediaProxy(req as any);
    expect(res.status).toBe(401);
  });

  it("blocks private/loopback/metadata IPs via SSRF protection", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `proxy-ssrf-${ts}@curio.local`, username: `proxy_ssrf_${ts}` })
      .returning();
    const session = await createSession(user.id);

    const reqLoopback = new Request(
      "http://localhost:3000/api/v1/media/proxy?url=https%3A%2F%2F127.0.0.1%2Fsecret.png",
      { headers: { Authorization: `Bearer ${session.token}` } }
    );
    const resLoopback = await handleMediaProxy(reqLoopback as any);
    expect(resLoopback.status).toBe(403);

    const reqInternalDns = new Request(
      "http://localhost:3000/api/v1/media/proxy?url=https%3A%2F%2Fevil.example.com%2Fimg.jpg",
      { headers: { Authorization: `Bearer ${session.token}` } }
    );
    const resDns = await handleMediaProxy(reqInternalDns as any, {
      dnsLookup: async () => [{ address: "169.254.169.254", family: 4 }],
    });
    expect(resDns.status).toBe(403);
  });

  it("proxies valid public raster images for authenticated users and blocks SVG", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `proxy-ok-${ts}@curio.local`, username: `proxy_ok_${ts}` })
      .returning();
    const session = await createSession(user.id);

    const reqSvg = new Request(
      "http://localhost:3000/api/v1/media/proxy?url=https%3A%2F%2Fcdn.example.com%2Fbad.svg",
      { headers: { Authorization: `Bearer ${session.token}` } }
    );
    const resSvg = await handleMediaProxy(reqSvg as any, {
      dnsLookup: async () => [{ address: "93.184.216.34", family: 4 }],
      fetchFn: (async () =>
        new Response("<svg onload=alert(1)/>", {
          status: 200,
          headers: { "content-type": "image/svg+xml" },
        })) as unknown as typeof fetch,
    });
    expect(resSvg.status).toBe(403);

    const reqOk = new Request(
      "http://localhost:3000/api/v1/media/proxy?url=https%3A%2F%2Fcovers.example.com%2Fcover.jpg",
      { headers: { Authorization: `Bearer ${session.token}` } }
    );
    const fakeJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const resOk = await handleMediaProxy(reqOk as any, {
      dnsLookup: async () => [{ address: "93.184.216.34", family: 4 }],
      fetchFn: (async () =>
        new Response(fakeJpg, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        })) as unknown as typeof fetch,
    });
    expect(resOk.status).toBe(200);
    expect(resOk.headers.get("content-type")).toBe("image/jpeg");
    expect(resOk.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await resOk.arrayBuffer())).toEqual(fakeJpg);
  });

  it("allows anonymous proxy when the URL matches a PUBLIC save heroImageUrl", async () => {
    const ts = Date.now();
    const publicUrl = `https://covers.example.com/public-${ts}.png`;
    const [user] = await db
      .insert(users)
      .values({ email: `proxy-pub-${ts}@curio.local`, username: `proxy_pub_${ts}` })
      .returning();
    const [entity] = await db
      .insert(globalEntities)
      .values({
        title: "Public Shelf Book",
        coreType: "BOOK",
        typePath: "/product/book",
        heroImageUrl: publicUrl,
        urlHash: `pub-hash-${ts}`,
        entityKey: `pub-key-${ts}`,
        canonicalUrl: `https://example.com/${ts}`,
        coreStructuredData: {},
      })
      .returning();
    await db.insert(userSaves).values({
      userId: user.id,
      entityId: entity.id,
      isPrivateMemo: false,
      visibility: "PUBLIC",
    });

    const req = new Request(
      `http://localhost:3000/api/v1/media/proxy?url=${encodeURIComponent(publicUrl)}`,
      { headers: { "x-strict-auth": "true" } }
    );
    const res = await handleMediaProxy(req as any, {
      dnsLookup: async () => [{ address: "93.184.216.34", family: 4 }],
      fetchFn: (async () =>
        new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
          status: 200,
          headers: { "content-type": "image/png" },
        })) as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });
});
