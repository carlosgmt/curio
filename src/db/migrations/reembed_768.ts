import { db, curioTypes, userSaves } from "@/db";
import { generateDeterministicEmbedding } from "@/lib/search/vector";
import { eq } from "drizzle-orm";

export async function runReembed768Migration(): Promise<{ typesMigrated: number; savesMigrated: number }> {
  let typesMigrated = 0;
  let savesMigrated = 0;

  // 1. Re-embed curioTypes
  const types = await db.select().from(curioTypes);
  for (const t of types) {
    const aliasText = t.localizedAliases
      ? Object.values(t.localizedAliases as Record<string, string>).join(" ")
      : "";
    const textToEmbed = `${t.name} ${t.typePath} ${t.rootArchetype} ${t.extractionPrompt ?? ""} ${aliasText}`.trim();
    const vec768 = generateDeterministicEmbedding(textToEmbed, 768);

    await db
      .update(curioTypes)
      .set({
        typeEmbedding: vec768,
      })
      .where(eq(curioTypes.id, t.id));

    typesMigrated++;
  }

  // 2. Re-embed userSaves (privateEmbedding)
  const saves = await db.select().from(userSaves);
  for (const s of saves) {
    if (s.isPrivateMemo || s.privateTitle || s.personalNotes) {
      const textToEmbed = `${s.privateTitle ?? ""} ${s.personalNotes ?? ""}`.trim();
      if (textToEmbed) {
        const vec768 = generateDeterministicEmbedding(textToEmbed, 768);
        await db
          .update(userSaves)
          .set({
            privateEmbedding: vec768,
          })
          .where(eq(userSaves.id, s.id));
        savesMigrated++;
      }
    }
  }

  return { typesMigrated, savesMigrated };
}

// Allow CLI execution directly
if (import.meta.main) {
  runReembed768Migration()
    .then((res) => {
      console.log(`Re-embed migration complete. Types: ${res.typesMigrated}, Saves: ${res.savesMigrated}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Re-embed migration failed:", err);
      process.exit(1);
    });
}
