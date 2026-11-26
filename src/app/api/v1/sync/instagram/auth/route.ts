import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users, type User } from "@/db";
import { AuthError, requireAuth, toSafeUser, type SafeUser } from "@/lib/auth/service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";
import { verifySyncSecret } from "@/lib/sync/goodreadsAuthStore";
import {
  parseInstagramCookieString,
  setInstagramAuthRecord,
} from "@/lib/sync/instagramAuthStore";

async function resolveCaller(req: NextRequest): Promise<SafeUser | User> {
  const syncSecret = req.headers.get("x-curio-sync-secret");
  if (syncSecret && verifySyncSecret(syncSecret)) {
    return getOrCreateDefaultUser();
  }
  const auth = await requireAuth(req);
  return toSafeUser(auth.user as any);
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveCaller(req);
    const body = await req.json().catch(() => ({}));
    const rawCookie = typeof body?.cookie === "string" ? body.cookie.trim() : "";

    if (!rawCookie || !parseInstagramCookieString(rawCookie)) {
      return NextResponse.json(
        { error: "Missing or invalid Instagram cookie (sessionid required)." },
        { status: 400 }
      );
    }

    const igUsername =
      typeof body?.igUsername === "string" && body.igUsername.trim()
        ? body.igUsername.trim().replace(/^@/, "")
        : undefined;

    const stored = setInstagramAuthRecord(user.id, {
      cookie: rawCookie,
      igUsername,
    });

    const [freshUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const tokens = { ...((freshUser?.googleSyncTokens as Record<string, any>) || {}) };
    tokens.instagramAuthStatus = "ok";
    tokens.instagramLastError = null;
    if (igUsername) tokens.instagramUsername = igUsername;

    await db
      .update(users)
      .set({ googleSyncTokens: tokens })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      configured: true,
      updatedAt: stored.updatedAt,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to update Instagram session" },
      { status: 500 }
    );
  }
}
