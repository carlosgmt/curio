import { describe, expect, it } from "bun:test";
import { parseLetterboxdCSV } from "./letterboxd";
import { parseGoodreadsCSV } from "./goodreads";
import { ingestImportedItems } from "./batchIngest";

describe("Day-0 Cold-Start CSV Importers", () => {
  describe("Letterboxd CSV Parser", () => {
    it("parses Letterboxd watched.csv with quoted titles and ratings", () => {
      const csv = `Date,Name,Year,Letterboxd URI,Rating
2026-03-14,Dune: Part Two,2024,https://boxd.it/mXQk,4.5
2026-02-10,"Everything Everywhere All at Once",2022,https://boxd.it/l78u,5.0
2026-01-05,Past Lives,2023,https://boxd.it/xK24,4.0`;

      const films = parseLetterboxdCSV(csv);
      expect(films.length).toBe(3);

      const dune = films[0];
      expect(dune.title).toBe("Dune: Part Two");
      expect(dune.releaseYear).toBe(2024);
      expect(dune.rating).toBe(4.5);
      expect(dune.typePath).toBe("/media/film");
      expect(dune.coreType).toBe("MEDIA");
      expect(dune.canonicalExternalId).toBe("letterboxd:dune-part-two-2024");

      const eeaao = films[1];
      expect(eeaao.title).toBe("Everything Everywhere All at Once");
      expect(eeaao.releaseYear).toBe(2022);
      expect(eeaao.rating).toBe(5.0);
    });
  });

  describe("Goodreads CSV Parser", () => {
    it("parses Goodreads export with cleaned ISBNs and series strip", () => {
      const csv = `Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Recommended For,Recommended By,Owned Copies
44767,"Dune (Dune #1)",Frank Herbert,"Herbert, Frank",,="0441172717",="9780441172719",5,4.27,Ace Books,688,1990,1965,2026/02/01,2026/01/15,,,"read","A monumental masterpiece of ecology, religion, and politics.",,,,,1,,,0
234225,"Dune Messiah (Dune #2)",Frank Herbert,"Herbert, Frank",,="0441102670",="9780441102679",4,3.89,Ace Books,336,1987,1969,2026/03/10,2026/02/05,,,"read","A deconstruction of the messiah myth.",,,,,1,,,0`;

      const books = parseGoodreadsCSV(csv);
      expect(books.length).toBe(2);

      const dune = books[0];
      expect(dune.title).toBe("Dune"); // series stripped
      expect(dune.author).toBe("Frank Herbert");
      expect(dune.isbn).toBe("9780441172719");
      expect(dune.canonicalExternalId).toBe("isbn:9780441172719");
      expect(dune.pageCount).toBe(688);
      expect(dune.publisher).toBe("Ace Books");
      expect(dune.myRating).toBe(5);
      expect(dune.typePath).toBe("/product/book");
      expect(dune.coreType).toBe("BOOK");
      expect(dune.coreStructuredData.obiText).toContain("monumental masterpiece");
    });
  });

  describe("Batch Ingestion Persistence", () => {
    it("persists parsed imported books and films to the database", async () => {
      const csv = `Date,Name,Year,Letterboxd URI,Rating
2026-04-01,Challengers,2024,https://boxd.it/challengers,4.5`;
      const films = parseLetterboxdCSV(csv);

      const result = await ingestImportedItems(films);
      expect(result.insertedCount).toBe(1);
      expect(result.errors.length).toBe(0);
    });

    it("uses deterministic entityKey and deduplicates global entities without random salts", async () => {
      const csv = `Date,Name,Year,Letterboxd URI,Rating
2026-04-01,Drive My Car,2021,https://boxd.it/drive-my-car,5.0`;
      const films = parseLetterboxdCSV(csv);

      // Ingest first time
      const res1 = await ingestImportedItems(films);
      expect(res1.insertedCount).toBe(1);

      // Ingest second time
      const res2 = await ingestImportedItems(films);
      expect(res2.insertedCount).toBe(1);

      // Verify that only 1 global entity exists for this movie
      const { db, globalEntities } = await import("@/db");
      const { eq } = await import("drizzle-orm");
      const entities = await db
        .select()
        .from(globalEntities)
        .where(eq(globalEntities.canonicalUrl, "https://boxd.it/drive-my-car"));

      expect(entities.length).toBe(1);
      // Verify entityKey has no random salt or Date.now()
      expect(entities[0].entityKey).not.toContain("Math.random");
      expect(entities[0].entityKey).toMatch(/^[a-f0-9]{16}_/);
    });
  });

  describe("Prototype Pollution & Resilience Hardening", () => {
    it("neutralizes prototype pollution attempts in CSV headers", async () => {
      const { parseCSV } = await import("./csvParser");
      const maliciousCsv = `__proto__,constructor,prototype,Name,Year
polluted,dangerous,exploit,"Safe Movie",2025`;

      const rows = parseCSV(maliciousCsv);
      expect(rows.length).toBe(1);
      expect(rows[0].Name).toBe("Safe Movie");
      expect(rows[0].Year).toBe("2025");
      expect((rows[0] as any).__proto__).toBeUndefined();
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it("guards non-numeric strings from resulting in NaN", () => {
      const badLetterboxd = `Date,Name,Year,Letterboxd URI,Rating
2026-01-01,Test Film,invalid-year,https://boxd.it/test,not-a-rating`;
      const films = parseLetterboxdCSV(badLetterboxd);
      expect(films[0].releaseYear).toBeUndefined();
      expect(films[0].rating).toBeUndefined();

      const badGoodreads = `Book Id,Title,Author,Number of Pages,Year Published,My Rating
123,Bad Book,Author,N/A,TBD,unrated`;
      const books = parseGoodreadsCSV(badGoodreads);
      expect(books[0].pageCount).toBeUndefined();
      expect(books[0].yearPublished).toBeUndefined();
      expect(books[0].myRating).toBeUndefined();
    });
  });
});
