import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db, globalEntities, listItems, smartLists, users, userSaves } from "@/db";
import { areSameBook, isTravelGuideOrStudyBook, normalizeBookTitleKey, sanitizeGoodreadsNote } from "../identity";
import { deduplicateUserBooks } from "../deduplicate";
import { resolveBookSources } from "../library";
import { syncPurchaseHubWithCurio } from "@/lib/sync/purchaseHub";
import { clearAdapterSyncCache } from "@/lib/sync/engine";

describe("Canonical Book Deduplication", () => {
  it("normalizes noisy commercial titles while preserving distinct volumes/series books", () => {
    expect(
      normalizeBookTitleKey("Yellowface de Rebecca, F. Kuang")
    ).toBe("yellowface");
    expect(
      normalizeBookTitleKey(
        "Yellowface: The instant #1 Sunday Times bestseller and Reese Witherspoon Book…"
      )
    ).toBe("yellowface");

    expect(
      areSameBook(
        {
          title: "Yellowface de Rebecca, F. Kuang",
          author: "R. F. Kuang",
        },
        {
          title: "Yellowface: The instant #1 Sunday Times bestseller and Reese Witherspoon Book…",
          author: "R. F. Kuang",
        }
      )
    ).toBe(true);

    expect(
      areSameBook(
        {
          title: "Algún día, hoy: Premio de Novela Fernando Lara 2019",
          author: "Ángela Becerra",
        },
        {
          title: "Algun dia, hoy",
          author: "Angela Becerra",
        }
      )
    ).toBe(true);

    // Must never collapse different volumes of Elena Ferrante's series
    expect(
      areSameBook(
        {
          title: "Un mal nombre (Dos amigas 2)",
          author: "Elena Ferrante",
        },
        {
          title: "Las deudas del cuerpo (Dos amigas 3)",
          author: "Elena Ferrante",
        }
      )
    ).toBe(false);

    // Must never collapse Dune #1 and Dune #2
    expect(
      areSameBook(
        { title: "Dune #1", author: "Frank Herbert" },
        { title: "Dune #2", author: "Frank Herbert" }
      )
    ).toBe(false);
  });

  it("merges duplicate book saves losslessly and prevents Purchase Hub re-duplication", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `dedup-${ts}@curio.local`, username: `dedup_${ts}` })
      .returning();

    const [booksBoard] = await db
      .insert(smartLists)
      .values({
        userId: user.id,
        title: "Books",
        slug: "books",
        autoRules: { coreType: "BOOK" },
        defaultLayout: "shelf",
      })
      .returning();

    const pid1 = `prd_yf_home_${ts}`;
    const pid2 = `prd_yf_pers_${ts}`;
    const cover = "https://example.com/yellowface.jpg";

    const [ent1] = await db
      .insert(globalEntities)
      .values({
        urlHash: `uh1-${ts}`,
        entityKey: `purchase-hub:${pid1}`,
        canonicalExternalId: `purchase-hub:${pid1}`,
        canonicalUrl: `https://example.com/yf1-${ts}`,
        coreType: "BOOK",
        typePath: "/product/book",
        brandOrCreator: "R. F. Kuang",
        title: "Yellowface de Rebecca, F. Kuang",
        heroImageUrl: cover,
        coreStructuredData: { author: "R. F. Kuang", pageCount: 336 },
        extendedAttributes: { source: "purchase-hub", purchaseHubProductId: pid1, owned: true },
      })
      .returning();

    const [ent2] = await db
      .insert(globalEntities)
      .values({
        urlHash: `uh2-${ts}`,
        entityKey: `purchase-hub:${pid2}`,
        canonicalExternalId: `purchase-hub:${pid2}`,
        canonicalUrl: `https://example.com/yf2-${ts}`,
        coreType: "BOOK",
        typePath: "/product/book",
        brandOrCreator: "R. F. Kuang",
        title: "Yellowface: The instant #1 Sunday Times bestseller and Reese Witherspoon Book…",
        heroImageUrl: cover,
        summary: "Satirical literary thriller.",
        coreStructuredData: { author: "R. F. Kuang", isbn: "9780063250840" },
        extendedAttributes: { source: "purchase-hub", purchaseHubProductId: pid2, owned: true },
      })
      .returning();

    const [save1] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: ent1.id,
        typePath: "/product/book",
        hasConvertedPurchase: true,
        wishlist: false,
        personalNotes: "Biting satire.",
        autoTags: ["book", "fiction", "owner:home"],
        userCustomValues: {
          readingStatus: "FINISHED",
          shelf: "read",
          rating: 5,
          goodreadsShelves: ["read-2025"],
        },
      })
      .returning();

    const [save2] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: ent2.id,
        typePath: "/product/book",
        hasConvertedPurchase: true,
        wishlist: false,
        personalNotes: "Loved the unreliable narrator.",
        autoTags: ["book", "bestseller", "owner:personal"],
        userCustomValues: {
          readingStatus: "WANT_TO_READ",
          shelf: "to-read",
          marginQuotes: ["Writing is the closest thing we have to real magic."],
        },
      })
      .returning();

    await db.insert(listItems).values([
      { listId: booksBoard.id, saveId: save1.id, positionIndex: 0 },
      { listId: booksBoard.id, saveId: save2.id, positionIndex: 1 },
    ]);

    const res = await deduplicateUserBooks(user.id);
    expect(res.duplicateGroups).toBe(1);
    expect(res.mergedSavesRemoved).toBe(1);
    expect(res.mergedTitles[0].toLowerCase()).toContain("yellowface");

    const remainingSaves = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    expect(remainingSaves).toHaveLength(1);
    const merged = remainingSaves[0];
    expect(merged.personalNotes).toContain("Biting satire.");
    expect(merged.personalNotes).toContain("Loved the unreliable narrator.");
    expect(merged.autoTags).toEqual(
      expect.arrayContaining(["book", "fiction", "bestseller", "owner:home", "owner:personal"])
    );
    const cv = merged.userCustomValues as Record<string, any>;
    expect(cv.readingStatus).toBe("FINISHED");
    expect(cv.rating).toBe(5);
    expect(cv.marginQuotes).toEqual(["Writing is the closest thing we have to real magic."]);

    const [mergedEnt] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, merged.entityId!));
    expect(mergedEnt.title).toBe("Yellowface");
    const mergedExt = mergedEnt.extendedAttributes as Record<string, any>;
    expect(mergedExt.mergedPurchaseHubIds).toEqual(expect.arrayContaining([pid1, pid2]));

    const boardItems = await db
      .select()
      .from(listItems)
      .where(eq(listItems.listId, booksBoard.id));
    expect(boardItems).toHaveLength(1);

    // Subsequent Purchase Hub sync with both product IDs must NOT recreate the duplicate
    const syncRes = await syncPurchaseHubWithCurio(user.id, {
      force: true,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            digest: `dedup-ph-${ts}`,
            items: [
              {
                product_id: pid1,
                canonical_name: "Yellowface de Rebecca, F. Kuang",
                brand: "R. F. Kuang",
                category: "Books & Media",
                image_url: cover,
              },
              {
                product_id: pid2,
                canonical_name: "Yellowface: The instant #1 Sunday Times bestseller",
                brand: "R. F. Kuang",
                category: "Books & Media",
                image_url: cover,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
    });

    expect(syncRes.synced).toBe(true);
    const postSyncSaves = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    expect(postSyncSaves).toHaveLength(1);

    clearAdapterSyncCache("purchase-hub", user.id);
  });

  it("sanitizes Goodreads empty note placeholders, filters travel/study books, and resolves multi-source labels", async () => {
    expect(
      sanitizeGoodreadsNote("review\n Write a review\n\nnotes\n None\n [edit]")
    ).toBeNull();
    expect(sanitizeGoodreadsNote("my comment")).toBeNull();
    expect(
      sanitizeGoodreadsNote("review\n Captivating prose.\n [edit]\nnotes\n None")
    ).toBe("Captivating prose.");

    expect(isTravelGuideOrStudyBook("Guía de viaje National Geographic: Roma")).toBe(true);
    expect(isTravelGuideOrStudyBook("Spektrum Deutsch A1+")).toBe(true);
    expect(isTravelGuideOrStudyBook("La Palma (Guiarama Compact - España)")).toBe(true);
    expect(isTravelGuideOrStudyBook("Babel by R. F. Kuang")).toBe(false);
    expect(isTravelGuideOrStudyBook("Un mal nombre (Dos amigas 2)")).toBe(false);

    expect(
      resolveBookSources(
        {
          hasConvertedPurchase: true,
          userCustomValues: { goodreadsBookId: "1234", goodreadsShelves: ["2026"] },
          autoTags: ["book", "goodreads"],
        },
        { canonicalExternalId: "purchase-hub:prd_1" } as any
      )
    ).toEqual(["MY_STUFF", "GOODREADS"]);

    expect(
      resolveBookSources(
        {
          hasConvertedPurchase: false,
          userCustomValues: { bookSource: "READ_ONLINE" },
          autoTags: ["book"],
        },
        { canonicalExternalId: "openlibrary:OL1" } as any
      )
    ).toEqual(["MANUAL"]);

    const ts = Date.now() + 1;
    const [user] = await db
      .insert(users)
      .values({ email: `hygiene-${ts}@curio.local`, username: `hygiene_${ts}` })
      .returning();

    const [booksBoard] = await db
      .insert(smartLists)
      .values({
        userId: user.id,
        title: "Books",
        slug: "books",
        autoRules: { coreType: "BOOK" },
      })
      .returning();

    const [guideEnt] = await db
      .insert(globalEntities)
      .values({
        urlHash: `guide-${ts}`,
        entityKey: `purchase-hub:prd_guide_${ts}`,
        canonicalExternalId: `purchase-hub:prd_guide_${ts}`,
        canonicalUrl: `https://example.com/guide-${ts}`,
        coreType: "BOOK",
        typePath: "/product/book",
        title: "Lonely Planet: Borgoña",
        coreStructuredData: {},
        extendedAttributes: { source: "purchase-hub", purchaseHubProductId: `prd_guide_${ts}` },
      })
      .returning();

    const [guideSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: guideEnt.id,
        typePath: "/product/book",
        autoTags: ["travel guide", "lonely planet"],
      })
      .returning();

    const [junkBookEnt] = await db
      .insert(globalEntities)
      .values({
        urlHash: `junk-${ts}`,
        entityKey: `goodreads:999_${ts}`,
        canonicalExternalId: `goodreads:999_${ts}`,
        canonicalUrl: `https://www.goodreads.com/book/show/999`,
        coreType: "BOOK",
        typePath: "/product/book",
        title: "Ordesa",
        brandOrCreator: "Manuel Vilas",
        coreStructuredData: { author: "Manuel Vilas", goodreadsId: `999_${ts}` },
        extendedAttributes: {},
      })
      .returning();

    const [junkSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: junkBookEnt.id,
        typePath: "/product/book",
        personalNotes: "review\n Write a review\n\nnotes\n None\n [edit]",
        autoTags: ["book", "goodreads", "read", "[edit]"],
        userCustomValues: { goodreadsShelves: ["gemini", "[edit]"] },
      })
      .returning();

    await db.insert(listItems).values([
      { listId: booksBoard.id, saveId: guideSave.id, positionIndex: 0 },
      { listId: booksBoard.id, saveId: junkSave.id, positionIndex: 1 },
    ]);

    const res = await deduplicateUserBooks(user.id);
    expect(res.reclassifiedReferenceCount).toBe(1);
    expect(res.cleanedNotesCount).toBe(1);

    const [updatedGuide] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, guideEnt.id));
    expect(updatedGuide.coreType).toBe("PRODUCT");
    expect(updatedGuide.typePath).toBe("/product/reference");

    const [cleanedBook] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.id, junkSave.id));
    expect(cleanedBook.personalNotes).toBeNull();
    expect(cleanedBook.autoTags).not.toContain("[edit]");
  });
});
