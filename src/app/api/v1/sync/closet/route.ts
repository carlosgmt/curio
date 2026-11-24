import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { getClosetSyncStatus, syncClosetWithCurio } from "@/lib/sync/closet";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const status = getClosetSyncStatus(user.id);
    return NextResponse.json({ success: true, ...status });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    let body: { force?: boolean; ifStaleMs?: number } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const result = await syncClosetWithCurio(user.id, {
      force: Boolean(body?.force),
      ifStaleMs: typeof body?.ifStaleMs === "number" ? body.ifStaleMs : undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: error.message || "Closet sync failed" },
      { status: 503 }
    );
  }
}
