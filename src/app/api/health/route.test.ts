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
});
