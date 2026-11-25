import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import {
  db,
  globalEntities,
  listItems,
  smartLists,
  users,
  userSaves,
} from "@/db";
import { clearAdapterSyncCache } from "../engine";
import {
  classifyPurchaseHubItem,
  createPurchaseHubItemFromWishlist,
  syncCurioSaveEditToPurchaseHub,
  syncPurchaseHubWithCurio,
  type PurchaseHubSyncItem,
} from "../purchaseHub";
import { createSession } from "@/lib/auth/session";
import { createList } from "@/lib/lists/service";
import { handleMarkBought } from "@/app/api/v1/saves/[id]/mark-bought/route";

describe("PurchaseHubAdapter & Books/Media/Furniture Sync", () => {
  it("excludes Apparel and Closet-exported items, routes Books & Media to media boards, and organizes Home/Personal durables into My Stuff/<Category> with Kit sections", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `ph-${ts}@curio.local`, username: `ph_${ts}` })
      .returning();

    // Seed pre-existing furniture wishlist save that should auto-promote by brand + model
    const [wishEntity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `wl-sofa-${ts}`,
        entityKey: `manual:sofa-${ts}`,
        canonicalUrl: `https://example.com/sofa-${ts}`,
        coreType: "PRODUCT",
        typePath: "/product/furniture",
        brandOrCreator: "Vitra",
        title: "Vitra Eames Lounge Chair",
        coreStructuredData: { model: "21204101" },
        extendedAttributes: {},
      })
      .returning();
    const [wishSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: wishEntity.id,
        wishlist: true,
        personalNotes: "Walnut & black leather study seat",
      })
      .returning();

    const upstreamItems: PurchaseHubSyncItem[] = [
      {
        product_id: `prd_chair_${ts}`,
        canonical_name: "Vitra Lounge Chair & Ottoman",
        brand: "Vitra",
        model_number: "21204101",
        category: "Furniture",
        owner_scope: "home",
        collections: ["Living Room"],
        total_spent: 7800,
        native_currency: "CHF",
        retailers: "Pfister",
        last_bought: "2026-11-10",
        image_filename: "vitra.jpg",
      },
      {
        product_id: `prd_book_${ts}`,
        canonical_name: "The Art of Doing Science and Engineering",
        brand: "Stripe Press",
        category: "Books & Media",
        owner_scope: "personal",
        collections: [],
        total_spent: 38,
        native_currency: "CHF",
      },
      {
        product_id: `prd_vinyl_${ts}`,
        canonical_name: "Kind of Blue Vinyl LP",
        brand: "Columbia",
        category: "Books & Media",
        owner_scope: "personal",
        collections: [],
        total_spent: 34,
        native_currency: "CHF",
      },
      {
        product_id: `prd_shirt_${ts}`,
        canonical_name: "Asket Merino Crewneck",
        category: "Apparel",
        owner_scope: "personal",
        closet_exported: false,
      },
      {
        product_id: `prd_closet_${ts}`,
        canonical_name: "Leather Messenger Bag",
        category: "Other",
        owner_scope: "personal",
        closet_exported: true,
      },
    ];

    const res = await syncPurchaseHubWithCurio(user.id, {
      force: true,
      fetchFn: async () =>
        new Response(
          JSON.stringify({ digest: `ph-digest-${ts}`, items: upstreamItems }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
    });

    expect(res.synced).toBe(true);
    expect(res.recordsProcessed).toBe(3); // excludes Apparel & closet_exported
    expect(res.promotedFromWishlist).toBe(1);
    expect(res.createdSaves).toBe(2); // Book + Vinyl LP

    const [promoted] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.id, wishSave.id));
    expect(promoted.wishlist).toBe(false);
    expect(promoted.personalNotes).toBe("Walnut & black leather study seat");

    const chairBoardRows = await db
      .select({
        title: smartLists.title,
        defaultLayout: smartLists.defaultLayout,
        sectionHeader: listItems.sectionHeader,
      })
      .from(listItems)
      .innerJoin(smartLists, eq(listItems.listId, smartLists.id))
      .where(eq(listItems.saveId, wishSave.id));
    expect(chairBoardRows.some((b) => b.title === "Furniture" && b.sectionHeader === "Living Room")).toBe(true);
    expect(chairBoardRows[0].defaultLayout).toBe("shelf");

    const clsFilm = classifyPurchaseHubItem({
      product_id: "prd_f",
      canonical_name: "In the Mood for Love 4K UHD Blu-ray",
      category: "Books & Media",
    });
    expect(clsFilm.boards[0].rootSlug).toBe("films");

    clearAdapterSyncCache("purchase-hub", user.id);
  });

  it("posts manual wishlist conversion and patches Purchase Hub metadata cleanly", async () => {
    let capturedPost: any = null;
    let capturedPatch: any = null;

    const created = await createPurchaseHubItemFromWishlist(
      {
        canonicalName: "Artemide Tolomeo Mega",
        brand: "Artemide",
        price: 920,
        currency: "CHF",
        category: "Furniture",
        ownerScope: "home",
        collections: ["Living Room"],
      },
      {
        purchaseHubApiUrl: "http://127.0.0.1:8760",
        fetchFn: async (url, init) => {
          capturedPost = { url: String(url), body: JSON.parse(String(init?.body || "{}")) };
          return new Response(
            JSON.stringify({ status: "inserted", product_id: "prd_artemide_1", order_id: "ord_1" }),
            { status: 201 }
          );
        },
      }
    );
    expect(created.productId).toBe("prd_artemide_1");
    expect(capturedPost.body.category).toBe("Furniture");
    expect(capturedPost.body.owner_scope).toBe("home");

    const ok = await syncCurioSaveEditToPurchaseHub(
      { entityKey: "purchase-hub:prd_artemide_1" },
      { title: "Artemide Tolomeo Floor Lamp", personalNotes: "Ordered matte grey shade" },
      {
        purchaseHubApiUrl: "http://127.0.0.1:8760",
        fetchFn: async (url, init) => {
          capturedPatch = {
            url: String(url),
            method: init?.method,
            body: JSON.parse(String(init?.body || "{}")),
          };
          return new Response(JSON.stringify({ product_id: "prd_artemide_1" }), { status: 200 });
        },
      }
    );
    expect(ok).toBe(true);
    expect(capturedPatch.method).toBe("PATCH");
    expect(capturedPatch.body.canonical_name).toBe("Artemide Tolomeo Floor Lamp");
  });

  it("handleMarkBought promotes wishlist item into My Stuff/<Category> preserving notes and handling offline Purchase Hub", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `mb-${ts}@curio.local`, username: `mb_${ts}` })
      .returning();
    const session = await createSession(user.id);

    const [entity] = await db
      .insert(globalEntities)
      .values({
        urlHash: `mb-sofa-${ts}`,
        entityKey: `manual:mb-sofa-${ts}`,
        canonicalUrl: `https://muuto.com/outline-sofa-${ts}`,
        coreType: "PRODUCT",
        typePath: "/product/furniture",
        brandOrCreator: "Muuto",
        title: "Muuto Outline Sofa",
        coreStructuredData: {},
        extendedAttributes: {},
      })
      .returning();
    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: entity.id,
        wishlist: true,
        personalNotes: "Cognac leather 3-seater",
      })
      .returning();

    const furnBoard = await createList(user.id, { title: `Furnishing-${ts}`, visibility: "PRIVATE" });
    await db.insert(listItems).values({ listId: furnBoard.id, saveId: save.id, positionIndex: 0 });

    const req = new Request(`http://localhost:3000/api/v1/saves/${save.id}/mark-bought`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price: 3400,
        currency: "CHF",
        retailer: "Pfister",
        category: "Furniture",
        ownerScope: "home",
        collections: ["Living Room"],
        location: "Main Room",
      }),
    });

    const resp = await handleMarkBought(req as any, save.id, {
      fetchFn: async () => {
        throw new Error("Connection refused");
      },
    });
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.success).toBe(true);
    expect(data.purchaseHubSynced).toBe(false);
    expect(data.targetBoardSlug).toBe("my-stuff-furniture");

    const [updatedSave] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.id, save.id));
    expect(updatedSave.wishlist).toBe(false);
    expect(updatedSave.hasConvertedPurchase).toBe(true);
    expect(updatedSave.personalNotes).toBe("Cognac leather 3-seater");

    const boardTitles = (
      await db
        .select({ title: smartLists.title })
        .from(listItems)
        .innerJoin(smartLists, eq(listItems.listId, smartLists.id))
        .where(eq(listItems.saveId, save.id))
    ).map((r) => r.title);
    expect(boardTitles).toContain(`Furnishing-${ts}`);
    expect(boardTitles).toContain("Furniture");
  });

  it("separates hardware, video games, and kids sticker/coloring books from genuine books and updates boards on reclassification", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `ph-sep-${ts}@curio.local`, username: `phsep_${ts}` })
      .returning();

    const kindleCls = classifyPurchaseHubItem({
      product_id: `prd_kindle_${ts}`,
      canonical_name: "Amazon Kindle Paperwhite (16 GB)",
      category: "Books & Media",
      tags: ["ebook reader", "kindle", "book"],
    });
    expect(kindleCls.coreType).toBe("PRODUCT");
    expect(kindleCls.typePath).toBe("/product/electronics");
    expect(kindleCls.boards[0].subSlug).toBe("my-stuff-electronics");

    const ssdCls = classifyPurchaseHubItem({
      product_id: `prd_ssd_${ts}`,
      canonical_name: "fanxiang S500 Pro 256 GB NVMe SSD",
      category: "Books & Media",
      tags: ["nvme ssd", "pc component"],
    });
    expect(ssdCls.coreType).toBe("PRODUCT");
    expect(ssdCls.boards[0].subSlug).toBe("my-stuff-electronics");

    const gameCls = classifyPurchaseHubItem({
      product_id: `prd_bg3_${ts}`,
      canonical_name: "Baldur's Gate 3 Early Access",
      category: "Books & Media",
      tags: ["video game", "role playing"],
    });
    expect(gameCls.coreType).toBe("MEDIA");
    expect(gameCls.typePath).toBe("/media/videogame");
    expect(gameCls.boards[0].rootSlug).toBe("games");

    const stickerCls = classifyPurchaseHubItem({
      product_id: `prd_peppa_${ts}`,
      canonical_name: "Peppa Pig: Peppa in Space Sticker Activity Book",
      category: "Books & Media",
      tags: ["sticker book", "activity book"],
    });
    expect(stickerCls.coreType).toBe("PRODUCT");
    expect(stickerCls.typePath).toBe("/product/kids-activity");
    expect(stickerCls.boards[0].subSlug).toBe("my-stuff-kids-activities");

    const realBookCls = classifyPurchaseHubItem({
      product_id: `prd_realbook_${ts}`,
      canonical_name: "Babel: The SUNDAY TIMES bestseller",
      category: "Books & Media",
      tags: ["bestseller", "book"],
    });
    expect(realBookCls.coreType).toBe("BOOK");
    expect(realBookCls.typePath).toBe("/product/book");
    expect(realBookCls.boards[0].rootSlug).toBe("books");

    // Seed a legacy misclassified SSD currently sitting in 'books' and verify sync moves it out
    const [booksBoard] = await db
      .insert(smartLists)
      .values({
        userId: user.id,
        title: "Books",
        slug: `books-reclass-${ts}`,
        visibility: "PRIVATE",
      })
      .returning();
    const [legacySsdEnt] = await db
      .insert(globalEntities)
      .values({
        urlHash: `ssd-${ts}`,
        entityKey: `purchase-hub:prd_legacy_ssd_${ts}`,
        canonicalExternalId: `purchase-hub:prd_legacy_ssd_${ts}`,
        canonicalUrl: "https://example.com/ssd",
        coreType: "BOOK",
        typePath: "/product/book",
        title: "fanxiang NVMe SSD",
        coreStructuredData: {},
        extendedAttributes: {},
      })
      .returning();
    const [legacySsdSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: legacySsdEnt.id,
        typePath: "/product/book",
      })
      .returning();
    await db.insert(listItems).values({
      listId: booksBoard.id,
      saveId: legacySsdSave.id,
      positionIndex: 0,
    });

    const syncRes = await syncPurchaseHubWithCurio(user.id, {
      force: true,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            digest: `reclass-${ts}`,
            items: [
              {
                product_id: `prd_legacy_ssd_${ts}`,
                canonical_name: "fanxiang S500 Pro 256 GB NVMe SSD",
                category: "Books & Media",
                tags: ["nvme ssd", "pc component"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
    });

    expect(syncRes.synced).toBe(true);
    const [reclassifiedEnt] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.id, legacySsdEnt.id));
    expect(reclassifiedEnt.coreType).toBe("PRODUCT");
    expect(reclassifiedEnt.typePath).toBe("/product/electronics");

    clearAdapterSyncCache("purchase-hub", user.id);
  });

  it("routes travel guides and study/textbooks (including bundled CD/DVD + ISBN-13) to My Stuff Travel & Study rather than FILM or BOOK", () => {
    const edito = classifyPurchaseHubItem({
      product_id: "prd_edito_b2",
      canonical_name: "EDITO B2 ELEVE+CD+DVD - 9788490492055",
      category: "Books & Media",
      tags: ["french", "textbook"],
    });
    expect(edito.coreType).toBe("PRODUCT");
    expect(edito.typePath).toBe("/product/reference");
    expect(edito.boards[0]?.subSlug).toBe("my-stuff-reference-travel");

    const guide = classifyPurchaseHubItem({
      product_id: "prd_rome_guide",
      canonical_name: "Guía de viaje National Geographic: Roma (GUIAS)",
      category: "Books & Media",
      tags: ["travel guide", "rome"],
    });
    expect(guide.coreType).toBe("PRODUCT");
    expect(guide.typePath).toBe("/product/reference");
    expect(guide.boards[0]?.subSlug).toBe("my-stuff-reference-travel");

    const novel = classifyPurchaseHubItem({
      product_id: "prd_babel",
      canonical_name: "Babel",
      brand: "R. F. Kuang",
      category: "Books & Media",
      tags: ["novel", "book"],
    });
    expect(novel.coreType).toBe("BOOK");
    expect(novel.typePath).toBe("/product/book");
  });
});
