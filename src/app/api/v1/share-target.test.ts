import { describe, expect, it } from "bun:test";
import { POST } from "./share-target/route";
import { NextRequest } from "next/server";
import { db, userSaves } from "@/db";
import { desc } from "drizzle-orm";

describe("PWA Web Share Target Route (/api/v1/share-target)", () => {
  it("accepts multipart form data with image file, creates save, and returns HTTP 303 redirect", async () => {
    const formData = new FormData();
    formData.append("title", "Aesthetically Pleasing Architecture");
    formData.append("text", "Check out this minimalist brutalist pavilion");
    formData.append("url", "https://example.com/pavilion-" + Date.now());

    // Create a dummy image file
    const fakeImage = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "pavilion.jpg", {
      type: "image/jpeg",
    });
    formData.append("image", fakeImage);

    const req = new NextRequest("http://localhost:3000/api/v1/share-target", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);

    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/?shared=success");

    // Verify save was created in SQLite
    const [latestSave] = await db
      .select()
      .from(userSaves)
      .orderBy(desc(userSaves.createdAt))
      .limit(1);

    expect(latestSave).toBeDefined();
  });
});
