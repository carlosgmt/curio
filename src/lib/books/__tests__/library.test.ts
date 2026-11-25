import { describe, expect, it } from "bun:test";
import type { GlobalEntity, UserSave } from "@/db";
import {
  cleanCommercialBookTitle,
  computeLibraryStats,
  extractDisplayTags,
  isOwnedBook,
  normalizeReadingStatus,
  toLibraryBookView,
} from "../library";

function makeSave(overrides: Partial<UserSave> = {}): UserSave {
  return {
    id: "save-1",
    userId: "user-1",
    entityId: "ent-1",
    customTypeId: null,
    typeId: null,
    typePath: "/product/book",
    preferredSourceId: null,
    isPrivateMemo: false,
    wishlist: false,
    privateTitle: null,
    personalNotes: null,
    userCustomValues: {},
    candidateFallbacks: [],
    autoTags: [],
    hasConvertedPurchase: false,
    enrichmentStatus: "ENRICHED",
    visibility: "PRIVATE",
    privateEmbedding: null,
    createdAt: "2026-11-20T10:00:00Z",
    ...overrides,
  };
}

function makeEntity(overrides: Partial<GlobalEntity> = {}): GlobalEntity {
  return {
    id: "ent-1",
    parentEntityId: null,
    canonicalExternalId: "isbn:9780143127741",
    identityFingerprint: "fp-1",
    brandOrCreator: "R. F. Kuang",
    typePath: "/product/book",
    urlHash: "uh-1",
    entityKey: "ek-1",
    canonicalUrl: "https://openlibrary.org/works/OL1",
    coreType: "BOOK",
    title: "Babel",
    summary: "Historical dark academia novel",
    heroImageUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
    coreStructuredData: { author: "R. F. Kuang", pageCount: 544, year: 2022 },
    extendedAttributes: {},
    ucpSkuId: null,
    priceCents: 2200,
    bestPriceCents: null,
    currency: "CHF",
    priceVerifiedAt: null,
    embedding: null,
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-20T10:00:00Z",
    ...overrides,
  };
}

describe("Personal Library helpers", () => {
  it("cleans noisy storefront book titles and extracts author hints", () => {
    expect(
      cleanCommercialBookTitle(
        "Babel: The SUNDAY TIMES and #1 NEW YORK TIMES bestseller"
      )
    ).toEqual({ title: "Babel", authorHint: null });

    expect(
      cleanCommercialBookTitle("Bösch, Robert: Engiadina - Deutsch / Englisch")
    ).toEqual({ title: "Engiadina", authorHint: "Robert Bösch" });

    expect(
      cleanCommercialBookTitle("Yellowface de Rebecca, F. Kuang")
    ).toEqual({ title: "Yellowface", authorHint: "F. Kuang Rebecca" });

    expect(
      cleanCommercialBookTitle("La hija única (Narrativas hispánicas no 652)")
    ).toEqual({ title: "La hija única", authorHint: null });

    expect(cleanCommercialBookTitle("Dune (Dune #1)")).toEqual({
      title: "Dune",
      authorHint: null,
    });
  });

  it("normalizes reading status across readingStatus, legacy shelf, and wishlist", () => {
    expect(normalizeReadingStatus({ readingStatus: "FINISHED" }, true)).toBe("FINISHED");
    expect(normalizeReadingStatus({ shelf: "currently-reading" }, false)).toBe("READING");
    expect(normalizeReadingStatus({ shelf: "read" }, false)).toBe("FINISHED");
    expect(normalizeReadingStatus({}, true)).toBe("WANT_TO_READ");
    expect(normalizeReadingStatus({ dateRead: "2026-11-01" }, false)).toBe("FINISHED");
  });

  it("detects owned books from Purchase Hub or userCustomValues and filters display tags", () => {
    const ownedSave = makeSave({
      hasConvertedPurchase: false,
      autoTags: ["book", "goodreads", "read", "sci-fi", "Favorites", "owner:home"],
      userCustomValues: { goodreadsShelves: ["favorites", "2026-reads"] },
    });
    const phEntity = makeEntity({ canonicalExternalId: "purchase-hub:prd_123" });

    expect(isOwnedBook(ownedSave, phEntity)).toBe(true);
    expect(
      isOwnedBook(
        makeSave({ userCustomValues: { bookSource: "READ_ONLINE" } }),
        makeEntity({ canonicalExternalId: "goodreads:999" })
      )
    ).toBe(false);

    const tags = extractDisplayTags(ownedSave);
    expect(tags).toEqual(["favorites", "2026-reads", "sci-fi"]);
  });

  it("builds LibraryBookView and computes LibraryStats accurately", () => {
    const currentYear = new Date().getFullYear();
    const b1 = toLibraryBookView(
      makeSave({
        id: "s1",
        hasConvertedPurchase: true,
        personalNotes: "Brilliant magic system",
        autoTags: ["fantasy", "dark-academia"],
        userCustomValues: {
          readingStatus: "FINISHED",
          rating: 5,
          dateRead: `${currentYear}-08-12`,
        },
      }),
      makeEntity({ id: "e1", canonicalExternalId: "purchase-hub:prd_1" })
    );

    const b2 = toLibraryBookView(
      makeSave({
        id: "s2",
        wishlist: false,
        autoTags: ["design", "fantasy"],
        userCustomValues: {
          bookSource: "READ_ONLINE",
          readingStatus: "READING",
          rating: 4,
        },
      }),
      makeEntity({
        id: "e2",
        title: "Grid Systems",
        canonicalExternalId: "openlibrary:OL2",
        coreStructuredData: { author: "Josef Müller-Brockmann", pageCount: 176 },
      })
    );

    const stats = computeLibraryStats([b1, b2]);
    expect(stats.total).toBe(2);
    expect(stats.ownedCount).toBe(1);
    expect(stats.readOnlineCount).toBe(1);
    expect(stats.finishedCount).toBe(1);
    expect(stats.readingCount).toBe(1);
    expect(stats.readThisYear).toBe(1);
    expect(stats.totalPagesRead).toBe(544);
    expect(stats.avgRating).toBe(4.5);
    expect(stats.tagCounts[0]).toEqual({ tag: "fantasy", count: 2 });
  });
});
