import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users, type User } from "@/db";
import { AuthError, requireAuth, toSafeUser, type SafeUser } from "@/lib/auth/service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";
import { verifySyncSecret } from "@/lib/sync/goodreadsAuthStore";
import {
  clearInstagramAuthRecord,
  getInstagramAuthRecord,
  setInstagramAuthRecord,
} from "@/lib/sync/instagramAuthStore";
import {
  InstagramAuthExpiredError,
  InstagramChallengeError,
} from "@/lib/sync/instagramClient";
import {
  INSTAGRAM_ROOT_BOARD_SLUG,
  instagramSyncAdapter,
} from "@/lib/sync/instagram";
import { importInstagramExport } from "@/lib/importers/instagramExport";

async function resolveSyncCaller(req: NextRequest): Promise<SafeUser | User> {
  const syncSecret = req.headers.get("x-curio-sync-secret");
  if (syncSecret && verifySyncSecret(syncSecret)) {
    return getOrCreateDefaultUser();
  }
  const auth = await requireAuth(req);
  return toSafeUser(auth.user as any);
}

export async function GET(req: NextRequest) {
  try {
    const user = await resolveSyncCaller(req);
    const [freshUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const tokens = (freshUser?.googleSyncTokens as Record<string, any>) || {};
    const authRec = getInstagramAuthRecord(user.id);
    const hasCookie = Boolean(authRec?.cookie);

    return NextResponse.json({
      success: true,
      configured: hasCookie,
      instagramUsername: authRec?.igUsername || tokens.instagramUsername || null,
      hasCookie,
      authStatus:
        tokens.instagramAuthStatus || (hasCookie ? "ok" : "unconfigured"),
      lastError: tokens.instagramLastError || null,
      lastSyncedAt: tokens.instagramLastSyncedAt || null,
      boardSlug: INSTAGRAM_ROOT_BOARD_SLUG,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveSyncCaller(req);
    const body = await req.json().catch(() => ({}));

    // Mode 1: Meta Data Export JSON backfill
    if (body?.exportJson !== undefined) {
      const res = await importInstagramExport(user.id, body.exportJson, {
        hydrateLimit:
          typeof body.hydrateLimit === "number" ? body.hydrateLimit : 0,
      });
      return NextResponse.json({
        success: true,
        mode: "export",
        boardSlug: INSTAGRAM_ROOT_BOARD_SLUG,
        ...res,
      });
    }

    // Mode 2: Gentle Cookie-Backed Web API Sync
    if (typeof body?.cookie === "string" && body.cookie.trim()) {
      setInstagramAuthRecord(user.id, {
        cookie: body.cookie.trim(),
        igUsername:
          typeof body.igUsername === "string" ? body.igUsername.trim() : undefined,
      });
    }

    const existingAuth = getInstagramAuthRecord(user.id);
    if (!existingAuth?.cookie) {
      return NextResponse.json(
        {
          error:
            "Instagram session cookie is not configured. Refresh via the Curio Chrome extension or paste your cookie.",
          code: "INSTAGRAM_COOKIE_REQUIRED",
        },
        { status: 400 }
      );
    }

    const res = await instagramSyncAdapter.run!(user.id, {
      force: body?.force !== false,
      incremental: body?.incremental !== false,
      maxPages: typeof body?.maxPages === "number" ? body.maxPages : 5,
    });

    return NextResponse.json({
      success: true,
      mode: "cookie",
      boardSlug: INSTAGRAM_ROOT_BOARD_SLUG,
      ...res,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof InstagramAuthExpiredError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 401 }
      );
    }
    if (err instanceof InstagramChallengeError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: err?.message || "Instagram sync failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await resolveSyncCaller(req);
    clearInstagramAuthRecord(user.id);

    const [freshUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const tokens = { ...((freshUser?.googleSyncTokens as Record<string, any>) || {}) };
    tokens.instagramAuthStatus = "unconfigured";
    tokens.instagramLastError = null;

    await db
      .update(users)
      .set({ googleSyncTokens: tokens })
      .where(eq(users.id, user.id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
