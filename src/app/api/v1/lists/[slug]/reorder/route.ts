import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reorderListItems } from "@/lib/lists/service";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { db, smartLists } from "@/db";
import { eq } from "drizzle-orm";

const reorderSchema = z.object({
  itemsOrder: z.array(
    z.object({
      saveId: z.string().min(1),
      positionIndex: z.number(),
      sectionHeader: z.string().optional().nullable(),
    })
  ),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user } = await requireAuth(req);
    const { slug } = await params;

    const [list] = await db
      .select()
      .from(smartLists)
      .where(eq(smartLists.slug, slug))
      .limit(1);

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (list.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized to reorder this list" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = reorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    await reorderListItems(list.id, parsed.data.itemsOrder);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
