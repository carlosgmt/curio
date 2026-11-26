import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { db, users } from "@/db";
import { createSession } from "@/lib/auth/session";
import { GET, HEAD } from "./route";

describe("Media Route HTTP Range Support (/api/v1/media/[...slug])", () => {
  it("supports HEAD, 206 Partial Content Range slices, and 416 out-of-bounds", async () => {
    const tmpMedia = fs.mkdtempSync(path.join(os.tmpdir(), "curio-range-"));
    const prevMediaPath = process.env.MEDIA_PATH;
    process.env.MEDIA_PATH = tmpMedia;

    try {
      const ts = Date.now();
      const [user] = await db
        .insert(users)
        .values({ email: `range-${ts}@curio.local`, username: `range_${ts}` })
        .returning();
      const session = await createSession(user.id);

      const relDir = path.join(tmpMedia, "instagram", "RANGE_TEST");
      fs.mkdirSync(relDir, { recursive: true });
      const payload = Buffer.from("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ");
      fs.writeFileSync(path.join(relDir, "video.mp4"), payload);

      const params = Promise.resolve({ slug: ["instagram", "RANGE_TEST", "video.mp4"] });

      // 1. HEAD
      const headReq = new Request("http://localhost:3000/api/v1/media/instagram/RANGE_TEST/video.mp4", {
        method: "HEAD",
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const headRes = await HEAD(headReq as any, { params });
      expect(headRes.status).toBe(200);
      expect(headRes.headers.get("accept-ranges")).toBe("bytes");
      expect(headRes.headers.get("content-length")).toBe(String(payload.length));
      expect(headRes.headers.get("content-type")).toBe("video/mp4");

      // 2. Partial Range GET
      const rangeReq = new Request("http://localhost:3000/api/v1/media/instagram/RANGE_TEST/video.mp4", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
          Range: "bytes=0-9",
        },
      });
      const rangeRes = await GET(rangeReq as any, { params });
      expect(rangeRes.status).toBe(206);
      expect(rangeRes.headers.get("accept-ranges")).toBe("bytes");
      expect(rangeRes.headers.get("content-range")).toBe(`bytes 0-9/${payload.length}`);
      expect(rangeRes.headers.get("content-length")).toBe("10");
      expect(await rangeRes.text()).toBe("0123456789");

      // 3. Out-of-bounds Range -> 416
      const oobReq = new Request("http://localhost:3000/api/v1/media/instagram/RANGE_TEST/video.mp4", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
          Range: "bytes=999-1050",
        },
      });
      const oobRes = await GET(oobReq as any, { params });
      expect(oobRes.status).toBe(416);
      expect(oobRes.headers.get("content-range")).toBe(`bytes */${payload.length}`);
    } finally {
      if (prevMediaPath === undefined) delete process.env.MEDIA_PATH;
      else process.env.MEDIA_PATH = prevMediaPath;
      fs.rmSync(tmpMedia, { recursive: true, force: true });
    }
  });
});
