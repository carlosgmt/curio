import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db, globalEntities, users, userSaves } from "@/db";
import { parseGoodreadsCSV } from "@/lib/importers/goodreads";
import {
  GoodreadsAuthExpiredError,
  parseGoodreadsShelfHtml,
  upsertGoodreadsBooks,
} from "../goodreadsSync";

describe("Goodreads Cookie Sync, HTML Parser & CSV Tag Upgrade", () => {
  it("parses Goodreads table HTML including custom shelves (tags), full review, rating, pages, ISBN13, and pagination", () => {
    const sampleHtml = `
      <html>
        <head><title>Carlos's books on Goodreads (read)</title></head>
        <body>
          <table id="books">
            <tbody>
              <tr id="review_9001" class="bookalike review">
                <td class="field cover"><div class="value"><img src="https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/111._SX98_.jpg" /></div></td>
                <td class="field title"><div class="value"><a href="/book/show/44767.Dune" title="Dune (Dune, #1)">Dune<span class="darkGreyText"> (Dune, #1)</span></a></div></td>
                <td class="field author"><div class="value"><a href="/author/show/58">Herbert, Frank</a></div></td>
                <td class="field isbn"><div class="value">0441172717</div></td>
                <td class="field isbn13"><div class="value">9780441172719</div></td>
                <td class="field num_pages"><div class="value">688 <span>pp</span></div></td>
                <td class="field rating"><div class="value"><span class="staticStars notranslate" title="it was amazing"><span class="staticStar p10"></span><span class="staticStar p10"></span><span class="staticStar p10"></span><span class="staticStar p10"></span><span class="staticStar p10"></span></span></div></td>
                <td class="field shelves"><div class="value"><a class="shelfLink" href="/review/list/1?shelf=read">read</a>, <a class="shelfLink" href="/review/list/1?shelf=sci-fi">sci-fi</a>, <a class="shelfLink" href="/review/list/1?shelf=favorites">favorites</a></div></td>
                <td class="field date_pub"><div class="value">1965</div></td>
                <td class="field date_read"><div class="value"><span class="date_read_value">Nov 12, 2026</span></div></td>
                <td class="field review"><div class="value"><span id="freeTextContainer1">Short...</span><span id="freeText1" style="display:none">Monumental ecology &amp; political epic.<br/>Must re-read.</span></div></td>
                <td class="field owned"><div class="value">1</div></td>
              </tr>
            </tbody>
          </table>
          <a class="next_page" rel="next" href="/review/list/1?page=2">Next</a>
        </body>
      </html>
    `;

    const parsed = parseGoodreadsShelfHtml(sampleHtml, "read");
    expect(parsed.hasNextPage).toBe(true);
    expect(parsed.items.length).toBe(1);

    const book = parsed.items[0];
    expect(book.bookId).toBe("44767");
    expect(book.title).toBe("Dune");
    expect(book.author).toBe("Frank Herbert");
    expect(book.isbn13).toBe("9780441172719");
    expect(book.numPages).toBe(688);
    expect(book.userRating).toBe(5);
    expect(book.customShelves).toEqual(["sci-fi", "favorites"]);
    expect(book.userReadAt).toBe("2026-11-12");
    expect(book.userReview).toBe("Monumental ecology & political epic.\nMust re-read.");
    expect(book.coverUrl).toBe(
      "https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/111.jpg"
    );
    expect(book.ownedCopies).toBe(1);
  });

  it("throws GoodreadsAuthExpiredError on sign-in HTML redirects", () => {
    const loginHtml = `<html><head><title>Sign in</title></head><body><form name="signIn"></form></body></html>`;
    expect(() => parseGoodreadsShelfHtml(loginHtml, "read")).toThrow(
      GoodreadsAuthExpiredError
    );
  });

  it("merges Goodreads tags, rating, and review onto an existing owned Purchase Hub book without duplicating or losing ownership", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `gr-merge-${ts}@curio.local`, username: `grmerge_${ts}` })
      .returning();

    const [ownedEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `ph-babel-${ts}`,
        entityKey: `purchase-hub:prd_babel_${ts}`,
        canonicalExternalId: `purchase-hub:prd_babel_${ts}`,
        canonicalUrl: `https://mini.orca-banjo.ts.net/my-stuff/#product-prd_babel_${ts}`,
        coreType: "BOOK",
        typePath: "/product/book",
        title: `Babel ${ts}: The SUNDAY TIMES and #1 NEW YORK TIMES bestseller`,
        coreStructuredData: {},
        extendedAttributes: {
          source: "purchase-hub",
          purchaseHubProductId: `prd_babel_${ts}`,
          bookSource: "OWNED",
          owned: true,
        },
      })
      .returning();

    const [ownedSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: ownedEntity.id,
        typePath: "/product/book",
        wishlist: false,
        hasConvertedPurchase: true,
        autoTags: ["owner:home"],
        userCustomValues: { bookSource: "OWNED", owned: true },
      })
      .returning();

    const res = await upsertGoodreadsBooks(user.id, [
      {
        bookId: `999${ts}`,
        title: `Babel ${ts}`,
        author: "R. F. Kuang",
        isbn13: "9780063021426",
        numPages: 544,
        bookPublished: 2022,
        userRating: 5,
        userReadAt: "2026-10-15",
        userReview: "Brilliant translation magic and colonial critique.",
        coverUrl: "https://covers.openlibrary.org/b/isbn/9780063021426-L.jpg",
        link: `https://www.goodreads.com/book/show/999${ts}`,
        shelf: "read",
        customShelves: ["dark-academia", "2026-favorites"],
      },
    ]);

    expect(res.mergedWithOwned).toBe(1);
    expect(res.createdSaves).toBe(0);
    expect(res.updatedSaves).toBe(1);
    expect(res.tagsImportedCount).toBe(2);

    const allUserBooks = await db
      .select()
      .from(userSaves)
      .where(and(eq(userSaves.userId, user.id), eq(userSaves.typePath, "/product/book")));
    expect(allUserBooks.length).toBe(1);

    const mergedSave = allUserBooks[0];
    expect(mergedSave.id).toBe(ownedSave.id);
    expect(mergedSave.wishlist).toBe(false);
    expect(mergedSave.hasConvertedPurchase).toBe(true);
    expect(mergedSave.personalNotes).toContain(
      "Brilliant translation magic and colonial critique."
    );
    expect(mergedSave.autoTags).toContain("dark-academia");
    expect(mergedSave.autoTags).toContain("2026-favorites");
    expect((mergedSave.userCustomValues as any).readingStatus).toBe("FINISHED");
    expect((mergedSave.userCustomValues as any).rating).toBe(5);
    expect((mergedSave.userCustomValues as any).bookSource).toBe("OWNED");
  });

  it("parses Goodreads CSV custom Bookshelves, Exclusive Shelf, Date Read, and Owned Copies", () => {
    const csv = `Book Id,Title,Author,ISBN,ISBN13,My Rating,Publisher,Number of Pages,Year Published,Date Read,Date Added,Bookshelves,Exclusive Shelf,My Review,Private Notes,Owned Copies
44767,"Dune (Dune #1)",Frank Herbert,="0441172717",="9780441172719",5,Ace Books,688,1990,2026/02/01,2026/01/15,"sci-fi, classics, read","read","Monumental.","Re-read notes",1
234225,"The Left Hand of Darkness",Ursula K. Le Guin,="0441478123",="9780441478125",0,Ace Books,304,1969,,2026/03/01,"sci-fi, to-read","to-read","","",0`;

    const books = parseGoodreadsCSV(csv);
    expect(books.length).toBe(2);

    expect(books[0].goodreadsShelves).toEqual(["sci-fi", "classics"]);
    expect(books[0].readingStatus).toBe("FINISHED");
    expect(books[0].dateRead).toBe("2026-02-01");
    expect(books[0].ownedCopies).toBe(1);
    expect(books[0].wishlist).toBe(false);
    expect(books[0].tags).toContain("sci-fi");
    expect(books[0].tags).toContain("classics");

    expect(books[1].goodreadsShelves).toEqual(["sci-fi"]);
    expect(books[1].readingStatus).toBe("WANT_TO_READ");
    expect(books[1].wishlist).toBe(true);
  });
});
