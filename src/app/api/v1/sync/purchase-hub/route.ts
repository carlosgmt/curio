import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuth, toSafeUser, type SafeUser } from "@/lib/auth/service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";
import {
  getPurchaseHubSyncStatus,
  syncPurchaseHubWithCurio,
} from "@/lib/sync/purchaseHub";

async function resolveSyncUser(req: NextRequest): Promise<SafeUser> {
  const provided = req.headers.get("x-curio-sync-secret")?.trim() || "";
  const expected = process.env.CURIO_SYNC_SECRET?.trim() || "";
  if (provided) {
    if (!expected) {
      throw new AuthError("Invalid sync secret", 401);
    }
    const a = crypto.createHash("sha256").update(provided).digest();
    const b = crypto.createHash("sha256").update(expected).digest();
    if (!crypto.timingSafeEqual(a, b)) {
      throw new AuthError("Invalid sync secret", 401);
    }
    const user = await getOrCreateDefaultUser();
    return toSafeUser(user);
  }
  const { user } = await requireAuth(req);
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await resolveSyncUser(req);
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
    const user = await resolveSyncUser(req);
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
