import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reorderBoards } from "@/lib/lists/service";
import { requireAuth, AuthError } from "@/lib/auth/service";

const reorderBoardsSchema = z.object({
  parentId: z.string().nullable().optional(),
  orderedIds: z.array(z.string().min(1)),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();
    const parsed = reorderBoardsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error },
        { status: 400 }
      );
    }

    const parentId = parsed.data.parentId ? parsed.data.parentId : null;
    await reorderBoards(parentId, parsed.data.orderedIds, user.id);

    return NextResponse.json({ success: true });
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
