import { NextRequest, NextResponse } from "next/server";
import { db, smartLists, users, checkoutSessions, auditLogs } from "@/db";
import { eq, or, and } from "drizzle-orm";
import { getOptionalAuth } from "@/lib/auth/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json().catch(() => ({}));
    const auth = await getOptionalAuth(req);

    // 1. Resolve List
    const [list] = await db
      .select()
      .from(smartLists)
      .where(or(eq(smartLists.slug, slug), eq(smartLists.id, slug)))
      .limit(1);

    if (!list) {
      return NextResponse.json({ success: false, error: "List not found" }, { status: 404 });
    }

    if (!list.isPaywalled) {
      return NextResponse.json({
        success: true,
        message: "List is free and unpaywalled",
        isPaywalled: false,
        accessGranted: true,
      });
    }

    // 2. Resolve Curator
    const [curator] = await db
      .select()
      .from(users)
      .where(eq(users.id, list.userId))
      .limit(1);

    if (!curator) {
      return NextResponse.json({ success: false, error: "Curator not found" }, { status: 404 });
    }

    // 3. Resolve Buyer
    const buyerUserId = body.buyerUserId || auth?.user.id || null;

    if (buyerUserId && buyerUserId === curator.id) {
      return NextResponse.json({
        success: true,
        message: "Curator owner has full access",
        accessGranted: true,
      });
    }

    // 4. Check Existing Access
    if (buyerUserId) {
      const [existing] = await db
        .select()
        .from(checkoutSessions)
        .where(
          and(
            eq(checkoutSessions.boardId, list.id),
            eq(checkoutSessions.buyerUserId, buyerUserId),
            eq(checkoutSessions.status, "COMPLETED")
          )
        )
        .limit(1);

      if (existing) {
        return NextResponse.json({
          success: true,
          message: "User has already purchased access to this list",
          accessGranted: true,
          session: existing,
        });
      }
    }

    // 5. Create or Complete Purchase Session
    const isCompleted = Boolean(body.paymentToken || body.simulateSuccess);
    const sessionId = `ucp_ses_${crypto.randomUUID()}`;
    const priceCents = list.accessPriceCents || 0;
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const ucpLineItems = [
      {
        skuId: `list_${list.id}`,
        title: `List Access: ${list.title}`,
        priceCents,
        currency: "USD",
        quantity: 1,
        sellerName: curator.username,
        imageUrl: null,
      },
    ];

    const [session] = await db
      .insert(checkoutSessions)
      .values({
        id: sessionId,
        boardId: list.id,
        curatorId: curator.id,
        buyerUserId,
        totalCents: priceCents,
        currency: "USD",
        status: isCompleted ? "COMPLETED" : "READY",
        ucpLineItems,
        affiliateItems: [],
        createdAt,
        expiresAt,
      })
      .returning();

    // 6. Log Audit Record
    if (isCompleted) {
      try {
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          operatorUserId: buyerUserId || curator.id,
          action: "LIST_PURCHASE",
          targetEntityId: list.id,
          metadata: {
            priceCents,
            curatorId: curator.id,
            sessionId,
          },
          createdAt,
        });
      } catch (logErr) {
        console.warn("Failed to log list purchase audit:", logErr);
      }
    }

    const checkoutUrl = isCompleted
      ? ""
      : `https://pay.google.com/gp/p/ui/pay?session=${sessionId}`;

    return NextResponse.json({
      success: true,
      accessGranted: isCompleted,
      checkoutUrl,
      session,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process list purchase" },
      { status: 500 }
    );
  }
}
