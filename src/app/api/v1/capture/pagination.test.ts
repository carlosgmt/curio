import { describe, expect, it } from "bun:test";
import { db, users, userSaves } from "@/db";
import { GET } from "./route";
import { NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";

describe("Cursor Pagination on GET /api/v1/capture", () => {
  it("paginates through 100+ saves with cursor, limit, and accurate totalCount", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `pagination-${timestamp}@curio.local`,
        username: `pager_${timestamp}`,
        displayName: "Pagination Tester",
      })
      .returning();

    const { token } = await createSession(user.id);

    // Create 105 user saves with distinct timestamps
    const totalItems = 105;
    const savesData = [];
    for (let i = 0; i < totalItems; i++) {
      // Millisecond offset for predictable createdAt ordering
      const createdAt = new Date(timestamp - i * 1000).toISOString();
      savesData.push({
        userId: user.id,
        isPrivateMemo: true,
        privateTitle: `Memo #${i.toString().padStart(3, "0")}`,
        createdAt,
      });
    }
    await db.insert(userSaves).values(savesData);

    // Fetch page 1 (limit 25)
    const req1 = new NextRequest("http://localhost:3000/api/v1/capture?limit=25", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();

    expect(data1.totalCount).toBe(totalItems);
    expect(data1.saves.length).toBe(25);
    expect(data1.nextCursor).toBeDefined();
    expect(data1.saves[0].save.privateTitle).toBe("Memo #000");
    expect(data1.saves[24].save.privateTitle).toBe("Memo #024");

    // Fetch page 2 (limit 25, using nextCursor from page 1)
    const req2 = new NextRequest(
      `http://localhost:3000/api/v1/capture?limit=25&cursor=${data1.nextCursor}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const res2 = await GET(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();

    expect(data2.totalCount).toBe(totalItems);
    expect(data2.saves.length).toBe(25);
    expect(data2.nextCursor).toBeDefined();
    expect(data2.saves[0].save.privateTitle).toBe("Memo #025");
    expect(data2.saves[24].save.privateTitle).toBe("Memo #049");

    // Fetch page 3 (limit 50 from cursor 2)
    const req3 = new NextRequest(
      `http://localhost:3000/api/v1/capture?limit=50&cursor=${data2.nextCursor}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const res3 = await GET(req3);
    expect(res3.status).toBe(200);
    const data3 = await res3.json();

    expect(data3.totalCount).toBe(totalItems);
    expect(data3.saves.length).toBe(50);
    expect(data3.nextCursor).toBeDefined();
    expect(data3.saves[0].save.privateTitle).toBe("Memo #050");
    expect(data3.saves[49].save.privateTitle).toBe("Memo #099");

    // Fetch page 4 (last page, limit 25)
    const req4 = new NextRequest(
      `http://localhost:3000/api/v1/capture?limit=25&cursor=${data3.nextCursor}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const res4 = await GET(req4);
    expect(res4.status).toBe(200);
    const data4 = await res4.json();

    expect(data4.totalCount).toBe(totalItems);
    expect(data4.saves.length).toBe(5);
    expect(data4.nextCursor).toBeNull(); // Terminal page!
    expect(data4.saves[0].save.privateTitle).toBe("Memo #100");
    expect(data4.saves[4].save.privateTitle).toBe("Memo #104");
  });
});
