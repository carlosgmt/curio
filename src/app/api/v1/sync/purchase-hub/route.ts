import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth/service";
import {
  getPurchaseHubSyncStatus,
  syncPurchaseHubWithCurio,
} from "@/lib/sync/purchaseHub";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    return NextResponse.json({
      success: true,
      ...getPurchaseHubSyncStatus(user.id),
    });
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
    const body = await req.json().catch(() => ({}));
    const result = await syncPurchaseHubWithCurio(user.id, {
      force: Boolean(body?.force),
      ifStaleMs: typeof body?.ifStaleMs === "number" ? body.ifStaleMs : undefined,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: error.message || "Purchase Hub sync failed" },
      { status: 503 }
    );
  }
}
