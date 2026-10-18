import { describe, expect, it } from "bun:test";
import { db, users, userSaves } from "@/db";
import { POST, GET } from "./route";
import { GET as GET_INTENT } from "./intent/route";
import { NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

describe("Capture API & Intent Execution (/api/v1/capture)", () => {
  it("creates new cards on add intent and mutates existing cards on edit intent without creating duplicates", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `capture-test-${timestamp}@curio.local`,
        username: `capture_test_${timestamp}`,
        displayName: "Capture Tester",
      })
      .returning();

    const { token } = await createSession(user.id);
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 1. Initial capture creates a new card (HTTP 201)
    const createReq = new NextRequest("http://localhost:3000/api/v1/capture", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: "Past Lives movie Celine Song" }),
    });
    const createRes = await POST(createReq);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.status).toBe("created");
    expect(createData.save).toBeDefined();
    const initialSaveId = createData.save.id;

    // Verify exactly 1 save exists
    let userSaveCount = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    expect(userSaveCount.length).toBe(1);

    // 2. Keystroke preview returns non-mutating preview without saving
    const previewReq = new NextRequest("http://localhost:3000/api/v1/capture?preview=true", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: "Change rating to 5 stars for Past Lives" }),
    });
    const previewRes = await POST(previewReq);
    expect(previewRes.status).toBe(200);
    const previewData = await previewRes.json();
    expect(previewData.preview).toBe(true);
    expect(previewData.intent).toBe("EDIT_SAVE");
    expect(previewData.action).toBe("RATING");
    expect(previewData.targetSave.saveId).toBe(initialSaveId);

    // Also test GET /api/v1/capture/intent?q=...
    const getIntentReq = new NextRequest(
      "http://localhost:3000/api/v1/capture/intent?q=" +
        encodeURIComponent("Change rating to 5 stars for Past Lives"),
      {
        method: "GET",
        headers: authHeaders,
      }
    );
    const getIntentRes = await GET_INTENT(getIntentReq);
    expect(getIntentRes.status).toBe(200);
    const getIntentData = await getIntentRes.json();
    expect(getIntentData.intent).toBe("EDIT_SAVE");

    // Verify still exactly 1 save exists after preview
    userSaveCount = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    expect(userSaveCount.length).toBe(1);

    // 3. Executing edit intent updates existing card in-place with HTTP 200 (Zero duplicates)
    const editReq = new NextRequest("http://localhost:3000/api/v1/capture", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: "Change rating to 5 stars for Past Lives" }),
    });
    const editRes = await POST(editReq);
    expect(editRes.status).toBe(200);
    const editData = await editRes.json();
    expect(editData.status).toBe("edited");
    expect(editData.action).toBe("edited");
    expect(editData.save.id).toBe(initialSaveId);
    expect(editData.save.userCustomValues.rating).toBe(5);

    // Verify still strictly 1 save exists (ZERO unwanted duplicates!)
    userSaveCount = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    expect(userSaveCount.length).toBe(1);
  });
});
