import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, smartLists } from "@/db";
import { eq, or } from "drizzle-orm";
import { getListBySlugWithItems, updateBoard, deleteBoard } from "@/lib/lists/service";
import { getOptionalAuth, requireAuth, AuthError } from "@/lib/auth/service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

const updateBoardSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  positionIndex: z.number().int().optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
  defaultLayout: z.enum(["masonry", "grid", "timeline", "shelf", "posters"]).nullable().optional(),
  isPaywalled: z.boolean().optional(),
  accessPriceCents: z.number().nullable().optional(),
  autoRules: z
    .object({
      coreType: z.string().optional(),
      typePathPrefix: z.string().optional(),
      tagsInclude: z.array(z.string()).optional(),
      maxPriceCents: z.number().optional(),
    })
    .nullable()
    .optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    let viewerUserId: string | undefined;
    const auth = await getOptionalAuth(req);
    if (auth) {
      viewerUserId = auth.user.id;
    } else if (process.env.NODE_ENV !== "production" && req.headers.get("x-strict-auth") !== "true") {
      try {
        const user = await getOrCreateDefaultUser();
        viewerUserId = user.id;
      } catch {
        // Unauthenticated visitor
      }
    }

    const data = await getListBySlugWithItems(slug, viewerUserId);

    if (!data) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    if (error.message?.includes("PAYWALL_REQUIRED")) {
      return NextResponse.json(
        { error: "Payment required to access this paywalled list", isPaywalled: true },
        { status: 402 }
      );
    }
    if (error.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: "Access denied: This list is private" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user } = await requireAuth(req);
    const { slug } = await params;

    const [existing] = await db
      .select()
      .from(smartLists)
      .where(or(eq(smartLists.slug, slug), eq(smartLists.id, slug)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this board" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateBoardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const updated = await updateBoard(existing.id, parsed.data, user.id);

    return NextResponse.json({ success: true, list: updated });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message?.includes("cycle detected")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user } = await requireAuth(req);
    const { slug } = await params;

    const [existing] = await db
      .select()
      .from(smartLists)
      .where(or(eq(smartLists.slug, slug), eq(smartLists.id, slug)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this board" }, { status: 403 });
    }

    await deleteBoard(existing.id, user.id);
    return NextResponse.json({ success: true, deletedId: existing.id, deletedSlug: existing.slug });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
