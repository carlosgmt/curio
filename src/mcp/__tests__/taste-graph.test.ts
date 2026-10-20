import { describe, expect, it } from "bun:test";
import { db, users, userSaves } from "@/db";
import { handleGetUserTasteGraph } from "../server";

describe("MCP Taste Graph Tool (FR-5.5 / Privacy)", () => {
  it("calls get_user_taste_graph and strictly excludes private memos from AI response", async () => {
    const runId = Date.now();

    // 1. Create a fresh isolated user for this test run
    const [user] = await db
      .insert(users)
      .values({
        username: `mcp_user_${runId}`,
        email: `mcp-privacy-${runId}@curio.local`,
        displayName: "MCP Privacy Test",
      })
      .returning();

    // 2. Insert public save
    const [publicSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        isPrivateMemo: false,
        privateTitle: `Public Film Masterpiece (${runId})`,
        typePath: "/media/film/auteur",
      })
      .returning();

    // 3. Insert private memo (confidential vault item)
    const [privateSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        isPrivateMemo: true,
        privateTitle: `Secret Seed Phrase Diary (${runId})`,
        personalNotes: "enc:v1:confidential-private-content",
        typePath: "/memo/personal",
      })
      .returning();

    // 4. Call handleGetUserTasteGraph
    const result = await handleGetUserTasteGraph({ userId: user.id });

    expect(result.success).toBe(true);
    expect(result.nodes).toBeDefined();

    // 5. Assert public save is present
    const hasPublic = result.nodes.some((n) => n.saveId === publicSave.id);
    expect(hasPublic).toBe(true);

    // 6. Assert private memo is strictly absent (Zero cloud/AI leakage)
    const hasPrivate = result.nodes.some(
      (n) => n.saveId === privateSave.id || n.title.includes("Secret Seed Phrase")
    );
    expect(hasPrivate).toBe(false);

    // 7. Verify no nodes in the returned payload have isPrivateMemo = true
    for (const node of result.nodes) {
      expect(node.isPrivateMemo).toBe(false);
    }
  });
});
