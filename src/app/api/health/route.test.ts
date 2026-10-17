import { describe, expect, it } from "bun:test";
import { GET } from "./route";

describe("Container Health Check Endpoint", () => {
  it("GET /api/health returns 200 OK with status ok and valid ISO timestamp", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(typeof data.timestamp).toBe("string");
    expect(new Date(data.timestamp).getTime()).not.toBeNaN();
  });

  it("GET /api/health?deep=true verifies SQLite database and WAL mode", async () => {
    const req = {
      nextUrl: {
        searchParams: new URLSearchParams("deep=true"),
      },
    } as any;

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("healthy");
    expect(data.database).toBe("ok");
    expect(typeof data.walMode).toBe("boolean");
    expect(["online", "degraded"]).toContain(data.ollama);
    expect(typeof data.timestamp).toBe("string");
  });
});
