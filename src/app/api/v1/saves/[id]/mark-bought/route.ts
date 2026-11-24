import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, globalEntities, listItems, userSaves } from "@/db";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { getSaveDetails } from "@/lib/saves/service";
import { ensureHierarchicalBoard, type SyncFetchFn } from "@/lib/sync/engine";
import {
  classifyPurchaseHubItem,
  createPurchaseHubItemFromWishlist,
} from "@/lib/sync/purchaseHub";

const markBoughtSchema = z.object({
  price: z.number().nonnegative().nullable().optional(),
  currency: z.string().min(3).max(3).optional(),
  orderDate: z.string().optional(),
  retailer: z.string().optional(),
  category: z.string().optional(),
  ownerScope: z.enum(["home", "personal"]).optional(),
  collections: z.array(z.string()).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  logToPurchaseHub: z.boolean().optional(),
});

export async function handleMarkBought(
  req: NextRequest,
  saveId: string,
  options?: { fetchFn?: SyncFetchFn; purchaseHubApiUrl?: string }
): Promise<Response> {
  try {
    const { user } = await requireAuth(req);
    const details = await getSaveDetails(saveId);
    if (!details) {
      return NextResponse.json({ error: "Save not found" }, { status: 404 });
    }
    if (details.save.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: Not your save" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = markBoughtSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const entity = details.entity;
    const itemTitle =
      details.save.privateTitle || entity?.title || "Purchased Item";
    const category = input.category?.trim() || "Other";
    const ownerScope = input.ownerScope || "home";
    const currency = (input.currency || entity?.currency || "CHF").toUpperCase();
    const orderDate = input.orderDate?.trim() || new Date().toISOString().slice(0, 10);
    const retailer = input.retailer?.trim() || "Manual";
    const collections = (input.collections || [])
      .map((c) => c.trim())
      .filter(Boolean);
    const effectivePrice =
      input.price !== undefined && input.price !== null
        ? input.price
        : entity?.priceCents
        ? Math.round((entity.priceCents / 100) * 100) / 100
        : 0;
    const effectiveNotes =
      input.notes !== undefined
        ? input.notes.trim() || null
        : details.save.personalNotes;

    const cls = classifyPurchaseHubItem({
      product_id: entity?.id || saveId,
      canonical_name: itemTitle,
      brand: entity?.brandOrCreator ?? null,
      category: category.toLowerCase() === "apparel" ? "Other" : category,
      collections,
      closet_exported: false,
    });
    const targetBoard =
      cls.boards[0] || {
        rootSlug: "my-stuff",
        rootTitle: "My Stuff",
        rootDefaultLayout: "shelf" as const,
        subSlug: "my-stuff-other",
        subTitle: "Other",
        subDefaultLayout: "shelf" as const,
        sectionHeader: collections[0] || null,
      };

    let purchaseHubSynced = false;
    let purchaseHubProductId: string | null = null;
    let purchaseHubError: string | undefined;

    if (input.logToPurchaseHub !== false) {
      try {
        const res = await createPurchaseHubItemFromWishlist(
          {
            canonicalName: itemTitle,
            brand: entity?.brandOrCreator ?? null,
            price: effectivePrice,
            currency,
            orderDate,
            retailer,
            category,
            ownerScope,
            collections,
            location: input.location ?? null,
            imageUrl:
              entity?.heroImageUrl && /^https?:\/\//i.test(entity.heroImageUrl)
                ? entity.heroImageUrl
                : null,
            sourceUrl:
              entity?.canonicalUrl && /^https?:\/\//i.test(entity.canonicalUrl)
                ? entity.canonicalUrl
                : null,
            notes: effectiveNotes,
          },
          options
        );
        purchaseHubSynced = true;
        purchaseHubProductId = res.productId;
      } catch (err: any) {
        purchaseHubError = err?.message || "Purchase Hub unreachable";
      }
    }

    const ensuredBoard = await ensureHierarchicalBoard(user.id, targetBoard);
    const targetBoardSlug = targetBoard.subSlug || targetBoard.rootSlug;

    await db
      .update(userSaves)
      .set({
        wishlist: false,
        hasConvertedPurchase: true,
        typePath: cls.typePath || details.save.typePath,
        personalNotes: effectiveNotes,
      })
      .where(eq(userSaves.id, saveId));

    if (entity) {
      const existingExt =
        entity.extendedAttributes && typeof entity.extendedAttributes === "object"
          ? (entity.extendedAttributes as Record<string, unknown>)
          : {};
      const nextPriceCents =
        input.price !== undefined && input.price !== null
          ? Math.round(input.price * 100)
          : entity.priceCents;

      await db
        .update(globalEntities)
        .set({
          priceCents: nextPriceCents,
          currency,
          typePath: cls.typePath || entity.typePath,
          canonicalExternalId: purchaseHubProductId
            ? `purchase-hub:${purchaseHubProductId}`
            : entity.canonicalExternalId,
          extendedAttributes: {
            ...existingExt,
            ...(purchaseHubProductId ? { purchaseHubProductId, source: "purchase-hub" } : {}),
            ownerScope,
            category,
            collections,
            retailers: retailer,
            lastBought: orderDate,
            location: input.location ?? existingExt.location ?? null,
          },
          updatedAt: new Date().toISOString(),
        })
        .where(eq(globalEntities.id, entity.id));
    }

    const [existingMembership] = await db
      .select()
      .from(listItems)
      .where(
        and(eq(listItems.listId, ensuredBoard.listId), eq(listItems.saveId, saveId))
      )
      .limit(1);

    const sectionHeader = collections[0] || null;
    if (existingMembership) {
      if (sectionHeader && existingMembership.sectionHeader !== sectionHeader) {
        await db
          .update(listItems)
          .set({ sectionHeader })
          .where(eq(listItems.id, existingMembership.id));
      }
    } else {
      const existingListRows = await db
        .select({ positionIndex: listItems.positionIndex })
        .from(listItems)
        .where(eq(listItems.listId, ensuredBoard.listId));
      const maxPos = existingListRows.reduce(
        (m, r) => Math.max(m, r.positionIndex),
        -1
      );
      await db.insert(listItems).values({
        listId: ensuredBoard.listId,
        saveId,
        positionIndex: maxPos + 1,
        sectionHeader,
      });
    }

    const refreshed = await getSaveDetails(saveId);
    return NextResponse.json({
      success: true,
      save: refreshed?.save ?? details.save,
      entity: refreshed?.entity ?? entity,
      targetBoardSlug,
      targetBoardId: ensuredBoard.listId,
      purchaseHubSynced,
      purchaseHubProductId,
      ...(purchaseHubError ? { purchaseHubError } : {}),
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error?.message || "Failed to promote wishlist item" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleMarkBought(req, id);
}
