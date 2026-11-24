import { NextRequest, NextResponse } from "next/server";
import { getSaveBoardMemberships } from "@/lib/lists/service";
import { requireAuth, AuthError } from "@/lib/auth/service";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const saveId = req.nextUrl.searchParams.get("saveId")?.trim() || null;
    const boards = await getSaveBoardMemberships(user.id, saveId);
    return NextResponse.json({ boards, memberships: boards });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
