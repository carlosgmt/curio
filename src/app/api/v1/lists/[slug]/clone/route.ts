import { NextRequest, NextResponse } from "next/server";
import { db, smartLists, listItems, userSaves, globalEntities, checkoutSessions } from "@/db";
import { eq, or, and } from "drizzle-orm";
import { getOptionalAuth } from "@/lib/auth/service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json().catch(() => ({}));

    // 1. Resolve Visitor User
    const auth = await getOptionalAuth(req);
    let userId = body.targetUserId || auth?.user.id;
    if (!userId) {
      const defaultUser = await getOrCreateDefaultUser();
      userId = defaultUser.id;
    }

    // 2. Resolve Source List
    const [list] = await db
      .select()
      .from(smartLists)
      .where(or(eq(smartLists.slug, slug), eq(smartLists.id, slug)))
      .limit(1);

    if (!list) {
      return NextResponse.json({ success: false, error: "List not found" }, { status: 404 });
    }

    if (list.visibility === "PRIVATE" && list.userId !== userId) {
      return NextResponse.json({ success: false, error: "Access denied: List is private" }, { status: 403 });
    }

    if (list.isPaywalled && list.userId !== userId) {
      const [paid] = await db
        .select()
        .from(checkoutSessions)
        .where(
          and(
            eq(checkoutSessions.boardId, list.id),
            eq(checkoutSessions.buyerUserId, userId),
            eq(checkoutSessions.status, "COMPLETED")
          )
        )
        .limit(1);

      if (!paid) {
        return NextResponse.json(
          { success: false, error: "Payment required before cloning paywalled list" },
          { status: 402 }
        );
      }
    }

    // 3. Fetch Items to Clone
    const items = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(listItems)
      .innerJoin(userSaves, eq(listItems.saveId, userSaves.id))
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(listItems.listId, list.id));

    const clonedSaves: string[] = [];

    // 4. Clone items into visitor's library
    for (const row of items) {
      const { save, entity } = row;
      // Skip private memos belonging to original curator
      if (save.isPrivateMemo) continue;

      const [cloned] = await db
        .insert(userSaves)
        .values({
          userId,
          entityId: save.entityId,
          customTypeId: save.customTypeId,
          typeId: save.typeId,
          typePath: save.typePath,
          preferredSourceId: save.preferredSourceId,
          isPrivateMemo: false,
          autoTags: save.autoTags || [],
          userCustomValues: save.userCustomValues || {},
          personalNotes: `Cloned from @${list.slug} on ${new Date().toLocaleDateString()}`,
          enrichmentStatus: "ENRICHED",
          visibility: "PRIVATE",
        })
        .returning();

      clonedSaves.push(cloned.id);
    }

    return NextResponse.json({
      success: true,
      clonedCount: clonedSaves.length,
      boardTitle: list.title,
      clonedSaveIds: clonedSaves,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to clone board" },
      { status: 500 }
    );
  }
}
