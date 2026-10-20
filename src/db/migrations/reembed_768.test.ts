import { describe, expect, it } from "bun:test";
import { db, curioTypes, userSaves, users } from "@/db";
import { runReembed768Migration } from "./reembed_768";
import { eq } from "drizzle-orm";

describe("Database Migration: Re-embed 768 Dimensions", () => {
  it("upgrades legacy vectors to standardized 768 dimensions", async () => {
    // 1. Ensure a user exists
    const [user] = await db
      .insert(users)
      .values({
        email: "migration-test-" + Date.now() + "@curio.app",
        username: "migrator" + Date.now(),
      })
      .returning();

    // 2. Insert a test save with private notes
    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        isPrivateMemo: true,
        privateTitle: "Quantum Teleportation Notes",
        personalNotes: "Bell state measurements and EPR pairs",
      })
      .returning();

    // 3. Run migration
    const result = await runReembed768Migration();
    expect(result.typesMigrated).toBeGreaterThan(0);
    expect(result.savesMigrated).toBeGreaterThan(0);

    // 4. Verify curioTypes all have 768-d vectors
    const types = await db.select().from(curioTypes);
    for (const t of types) {
      if (t.typeEmbedding && Array.isArray(t.typeEmbedding)) {
        expect(t.typeEmbedding.length).toBe(768);
      }
    }

    // 5. Verify userSave has 768-d vector
    const [updatedSave] = await db.select().from(userSaves).where(eq(userSaves.id, save.id));
    expect(updatedSave.privateEmbedding).toBeDefined();
    if (updatedSave.privateEmbedding && Array.isArray(updatedSave.privateEmbedding)) {
      expect(updatedSave.privateEmbedding.length).toBe(768);
    }
  });
});
