import { afterEach, describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("Purchase Hub Sync Route Internal Secret Auth", () => {
  const prevSecret = process.env.CURIO_SYNC_SECRET;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevAnon = process.env.CURIO_ALLOW_ANON;

  afterEach(() => {
    process.env.CURIO_SYNC_SECRET = prevSecret;
    (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
    process.env.CURIO_ALLOW_ANON = prevAnon;
  });

  it("authorizes default user when X-Curio-Sync-Secret matches CURIO_SYNC_SECRET", async () => {
    process.env.CURIO_SYNC_SECRET = "test-sync-secret-123";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.CURIO_ALLOW_ANON = "false";

    const req = new NextRequest("http://localhost:3000/curio/api/v1/sync/purchase-hub", {
      method: "GET",
      headers: {
        "x-curio-sync-secret": "test-sync-secret-123",
        "x-strict-auth": "true",
      },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("rejects mismatched X-Curio-Sync-Secret with 401", async () => {
    process.env.CURIO_SYNC_SECRET = "test-sync-secret-123";
    const req = new NextRequest("http://localhost:3000/curio/api/v1/sync/purchase-hub", {
      method: "GET",
      headers: {
        "x-curio-sync-secret": "wrong-secret",
      },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("falls back to requireAuth when header is omitted in strict production", async () => {
    process.env.CURIO_SYNC_SECRET = "test-sync-secret-123";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.CURIO_ALLOW_ANON = "false";

    const req = new NextRequest("http://localhost:3000/curio/api/v1/sync/purchase-hub", {
      method: "GET",
      headers: { "x-strict-auth": "true" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
