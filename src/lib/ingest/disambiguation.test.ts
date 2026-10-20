import { describe, expect, it } from "bun:test";
import { db, users, userSaves, globalEntities } from "@/db";
import { swapCandidateFallback } from "./disambiguation";
import { eq } from "drizzle-orm";

describe("Candidate Disambiguation Swapper (FR-2.3)", () => {
  it("swaps save entity from Dune movie to Dune book when fallback candidate is selected", async () => {
    const runId = Date.now();

    // 1. Ensure user exists
    let [user] = await db.select().from(users).limit(1);
    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          email: `disambig-${runId}@curio.local`,
          username: `disambig_${runId}`,
          displayName: "Disambig Test",
        })
        .returning();
    }

    // 2. Create initial movie entity
    const [movieEntity] = await db
      .insert(globalEntities)
      .values({
        entityKey: `dune-movie-${runId}`,
        canonicalUrl: `https://www.imdb.com/title/tt1160419/?run=${runId}`,
        urlHash: `hash-dune-movie-${runId}`,
        title: `Dune (2021 Film) ${runId}`,
        coreType: "MEDIA",
        summary: "A noble family becomes embroiled in a war for control...",
        coreStructuredData: { director: "Denis Villeneuve", releaseYear: 2021 },
      })
      .returning();

    // 3. Create user save referencing the movie entity with candidate fallbacks
    const bookTitle = `Dune Novel Frank Herbert ${runId}`;
    const bookUrl = `https://www.goodreads.com/book/show/44767458-dune-${runId}`;
    const [initialSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: movieEntity.id,
        typePath: "/media/film",
        candidateFallbacks: [
          {
            title: bookTitle,
            url: bookUrl,
            snippet: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides...",
            coreType: "BOOK",
          },
        ],
      })
      .returning();

    expect(initialSave.entityId).toBe(movieEntity.id);

    // 4. Swap to the book candidate without passing newEntityId
    const swapResult = await swapCandidateFallback(initialSave.id, bookUrl);

    expect(swapResult.success).toBe(true);
    expect(swapResult.save.entityId).not.toBe(movieEntity.id);
    expect(swapResult.save.entityId).toBeDefined();

    // 5. Query user save from DB to verify persistence
    const [savedInDb] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.id, initialSave.id))
      .limit(1);

    expect(savedInDb.entityId).not.toBe(movieEntity.id);
    expect(savedInDb.entityId).toBe(swapResult.save.entityId);

    // 6. Verify new entity is the book
    const [bookEntity] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, savedInDb.entityId!))
      .limit(1);

    expect(bookEntity).toBeDefined();
    expect(bookEntity.title).toBe(bookTitle);
    expect(bookEntity.canonicalUrl).toBe(bookUrl);

    // 7. Verify previous movie was pushed into candidate fallbacks
    const updatedFallbacks = savedInDb.candidateFallbacks as Array<{ title: string; url: string }>;
    expect(updatedFallbacks.some((f) => f.title === `Dune (2021 Film) ${runId}`)).toBe(true);
  });
});
