import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, userSaves, globalEntities, entitySources, users } from "@/db";
import { eq } from "drizzle-orm";
import { getOptionalAuth } from "@/lib/auth/service";
import { createUcpCheckoutSession } from "@/lib/commerce/ucp";

const checkoutSchema = z.object({
  saveId: z.string().min(1, "saveId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid checkout request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { saveId } = parsed.data;

    // 1. Resolve Save
    const [save] = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.id, saveId))
      .limit(1);

    if (!save) {
      return NextResponse.json(
        { success: false, error: "Save not found" },
        { status: 404 }
      );
    }

    // 2. Resolve Curator
    const [curator] = await db
      .select()
      .from(users)
      .where(eq(users.id, save.userId))
      .limit(1);

    if (!curator) {
      return NextResponse.json(
        { success: false, error: "Curator user not found" },
        { status: 404 }
      );
    }

    // 3. Resolve Global Entity
    let entity: any = null;
    if (save.entityId) {
      const [resolvedEntity] = await db
        .select()
        .from(globalEntities)
        .where(eq(globalEntities.id, save.entityId))
        .limit(1);
      entity = resolvedEntity || null;
    }

    // Fallback if entity record is not present (e.g. private or stub card)
    if (!entity) {
      entity = {
        id: save.id,
        title: save.privateTitle || "Curated Item",
        brandOrCreator: null,
        priceCents: null,
        bestPriceCents: null,
        currency: "USD",
        ucpSkuId: null,
        canonicalUrl: undefined,
        heroImageUrl: null,
      };
    }

    // 4. Resolve Preferred or First Available Entity Source
    let primarySource: any = null;
    if (save.preferredSourceId) {
      const [source] = await db
        .select()
        .from(entitySources)
        .where(eq(entitySources.id, save.preferredSourceId))
        .limit(1);
      primarySource = source || null;
    } else if (entity?.id) {
      const [source] = await db
        .select()
        .from(entitySources)
        .where(eq(entitySources.entityId, entity.id))
        .limit(1);
      primarySource = source || null;
    }

    // 5. Check Optional Buyer Auth
    const buyerAuth = await getOptionalAuth(req);

    // 6. Generate Standardized UCP Session
    const session = createUcpCheckoutSession({
      saveId: save.id,
      entity,
      primarySource,
      curator: {
        id: curator.id,
        username: curator.username,
        affiliateTags: curator.affiliateTags,
      },
      buyerUserId: buyerAuth?.user.id,
    });

    return NextResponse.json({
      success: true,
      session,
      checkoutUrl: session.checkoutUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create UCP checkout session" },
      { status: 500 }
    );
  }
}
