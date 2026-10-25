import { describe, expect, it, beforeAll } from "bun:test";
import { db, curioTypes, users } from "@/db";
import { seedCanonicalArchetypes } from "@/db/seed";
import { registerCustomType } from "./attributes";
import { eq } from "drizzle-orm";

describe("Dynamic Ontology Grafting Service (FR-3.1)", () => {
  let testUserId: string;

  beforeAll(async () => {
    await seedCanonicalArchetypes();

    const runId = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `grafting-test-${runId}@curio.app`,
        username: `graftinguser_${runId}`,
      })
      .returning();

    testUserId = user.id;
  });

  it("grafts synonym alias on existing archetype when similarity > 0.92 without creating duplicate", async () => {
    // "Feature Film" or exact match "Feature Film" / "Movie"
    // Cinema archetype has name "Feature Film" or "Cinema"
    const typesBefore = await db.select().from(curioTypes);

    const res = await registerCustomType(testUserId, {
      name: "Movie", // Exact synonym match for Film / Cinema (/media/film)
      parentTypePath: "/media",
      fields: [
        { key: "custom_notes", label: "Custom Notes", type: "string" },
      ],
    });

    expect(res.isSynonymConvergence).toBe(true);
    expect(res.typePath).toBe("/media/film");

    const typesAfter = await db.select().from(curioTypes);
    expect(typesAfter.length).toBe(typesBefore.length); // No new row created!
  });

  it("computes delta schemas when registering novel subtype (similarity <= 0.92)", async () => {
    const typesBefore = await db.select().from(curioTypes);

    const uniqueName = "Handmade Ceramic Mug " + Date.now();
    const res = await registerCustomType(testUserId, {
      name: uniqueName,
      parentTypePath: "/product",
      fields: [
        { key: "clay_body", label: "Clay Body", type: "string" },
        { key: "glaze_finish", label: "Glaze Finish", type: "select", options: ["matte", "glossy"] },
        { key: "kiln_temperature_c", label: "Kiln Temperature (C)", type: "number" },
      ],
      extractionPrompt: "Extract ceramic pottery attributes.",
    });

    expect(res.isSynonymConvergence).toBe(false);
    expect(res.userId).toBe(testUserId);
    expect(res.name).toBe(uniqueName);

    // Verify delta schema: ownJsonSchema vs effectiveJsonSchema
    const ownSchema = res.ownJsonSchema as any;
    expect(ownSchema).toBeDefined();
    expect(ownSchema.properties.clay_body).toBeDefined();
    expect(ownSchema.properties.glaze_finish.enum).toEqual(["matte", "glossy"]);
    expect(ownSchema.properties.kiln_temperature_c.type).toBe("number");

    const effectiveSchema = res.effectiveJsonSchema as any;
    expect(effectiveSchema).toBeDefined();
    expect(effectiveSchema.properties.clay_body).toBeDefined();

    // Verify 768-d embedding was stored
    expect(res.typeEmbedding).toBeDefined();
    if (res.typeEmbedding) {
      expect(res.typeEmbedding.length).toBe(768);
    }

    const typesAfter = await db.select().from(curioTypes);
    expect(typesAfter.length).toBe(typesBefore.length + 1);
  });
});
