import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addItemToList, removeItemFromList } from "@/lib/lists/service";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { db, smartLists } from "@/db";
import { eq } from "drizzle-orm";

const addItemSchema = z.object({
  saveId: z.string().min(1),
  sectionHeader: z.string().optional().nullable(),
  curatorNote: z.string().optional().nullable(),
  isPinned: z.boolean().optional(),
  positionIndex: z.number().optional(),
});

export async function POST(
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
      return NextResponse.json({ error: "Unauthorized to edit this list" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = addItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const item = await addItemToList(list.id, parsed.data.saveId, {
      sectionHeader: parsed.data.sectionHeader,
      curatorNote: parsed.data.curatorNote,
      isPinned: parsed.data.isPinned,
      positionIndex: parsed.data.positionIndex,
    });

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
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

    const [list] = await db
      .select()
      .from(smartLists)
      .where(eq(smartLists.slug, slug))
      .limit(1);

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (list.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized to edit this list" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const saveId = searchParams.get("saveId");

    if (!saveId) {
      return NextResponse.json({ error: "saveId query parameter is required" }, { status: 400 });
    }

    const removed = await removeItemFromList(list.id, saveId);
    return NextResponse.json({ success: true, removed });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
