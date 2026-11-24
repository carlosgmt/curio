import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth/service";
import {
  listAllSyncStatuses,
  listSyncAdapters,
  runRegisteredSync,
} from "@/lib/sync/registry";
import "@/lib/sync/closet";
import "@/lib/sync/letterboxdRss";
import "@/lib/sync/goodreadsRss";
import "@/lib/sync/purchaseHub";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const sources = await listAllSyncStatuses(user.id);
    return NextResponse.json({ success: true, sources });
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
    const sourceId = typeof body?.source === "string" ? body.source.trim() : "";

    if (sourceId) {
      const result = await runRegisteredSync(user.id, sourceId, {
        force: Boolean(body?.force),
        ifStaleMs: typeof body?.ifStaleMs === "number" ? body.ifStaleMs : undefined,
      });
      return NextResponse.json({ success: true, result });
    }

    const adapters = listSyncAdapters();
    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    for (const adapter of adapters) {
      try {
        results[adapter.sourceId] = await runRegisteredSync(user.id, adapter.sourceId, {
          force: Boolean(body?.force),
          ifStaleMs: typeof body?.ifStaleMs === "number" ? body.ifStaleMs : undefined,
        });
      } catch (err: any) {
        errors[adapter.sourceId] = err?.message || "Sync failed";
      }
    }
    return NextResponse.json({ success: true, results, errors });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: error.message || "Sync orchestration failed" },
      { status: 400 }
    );
  }
}
