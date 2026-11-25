import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { syncLetterboxdRss } from "@/lib/sync/letterboxdRss";
import { goodreadsSyncAdapter, parseGoodreadsUserId } from "@/lib/sync/goodreadsRss";
import {
  clearGoodreadsAuthRecord,
  getGoodreadsAuthRecord,
  setGoodreadsAuthRecord,
} from "@/lib/sync/goodreadsAuthStore";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const [freshUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const tokens = (freshUser?.googleSyncTokens as Record<string, any>) || {};
    const authRec = getGoodreadsAuthRecord(user.id);

    const lastFeedSyncAt: string | null = tokens.lastFeedSyncAt || null;
    const isStale =
      !lastFeedSyncAt ||
      Date.now() - new Date(lastFeedSyncAt).getTime() > 6 * 60 * 60 * 1000;

    return NextResponse.json({
      letterboxdUsername: tokens.letterboxdUsername || null,
      goodreadsUserId: authRec?.goodreadsUserId || tokens.goodreadsUserId || null,
      goodreadsHasCookie: Boolean(authRec?.cookie),
      goodreadsAuthStatus:
        tokens.goodreadsAuthStatus || (authRec?.cookie ? "ok" : "unconfigured"),
      lastFeedSyncAt,
      isStale,
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
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));

    const [freshUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const currentTokens = (freshUser?.googleSyncTokens as Record<string, any>) || {};

    const letterboxdUsername =
      body.letterboxdUsername !== undefined
        ? String(body.letterboxdUsername || "").trim()
        : currentTokens.letterboxdUsername || "";
    const goodreadsUserId =
      body.goodreadsUserId !== undefined
        ? parseGoodreadsUserId(String(body.goodreadsUserId || ""))
        : currentTokens.goodreadsUserId || "";
    const goodreadsCookie =
      typeof body.goodreadsCookie === "string" ? body.goodreadsCookie.trim() : "";

    if (!letterboxdUsername && !goodreadsUserId) {
      return NextResponse.json(
        { error: "Provide a Letterboxd username or Goodreads User ID to sync" },
        { status: 400 }
      );
    }

    if (goodreadsUserId && goodreadsCookie) {
      setGoodreadsAuthRecord(user.id, { goodreadsUserId, cookie: goodreadsCookie });
    }

    let letterboxdResult = null;
    let goodreadsResult = null;
    const errors: string[] = [];

    if (letterboxdUsername) {
      try {
        letterboxdResult = await syncLetterboxdRss(letterboxdUsername, user.id);
      } catch (err: any) {
        errors.push(`Letterboxd: ${err.message}`);
      }
    }

    if (goodreadsUserId) {
      try {
        const res = await goodreadsSyncAdapter.run!(user.id, {
          goodreadsUserId,
          ...(goodreadsCookie ? { cookie: goodreadsCookie } : {}),
        });
        if (!res.synced && res.skippedReason === "cookie_required") {
          errors.push(
            "Goodreads retired RSS feeds; paste your Goodreads session cookie in Personal Library -> Sync Goodreads."
          );
        } else {
          goodreadsResult = {
            goodreadsUserId,
            fetchedCount: res.recordsProcessed,
            createdSaves: res.createdSaves,
            updatedSaves: res.updatedSaves,
          };
        }
      } catch (err: any) {
        errors.push(`Goodreads: ${err.message}`);
      }
    }

    const syncedAt = new Date().toISOString();
    const [postSyncUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const postTokens = (postSyncUser?.googleSyncTokens as Record<string, any>) || currentTokens;
    const updatedTokens = {
      ...postTokens,
      ...(letterboxdResult ? { letterboxdUsername: letterboxdResult.username } : {}),
      ...(goodreadsUserId ? { goodreadsUserId } : {}),
      lastFeedSyncAt: syncedAt,
    };

    await db
      .update(users)
      .set({ googleSyncTokens: updatedTokens })
      .where(eq(users.id, user.id));

    if (errors.length > 0 && !letterboxdResult && !goodreadsResult) {
      return NextResponse.json({ error: errors.join(" | ") }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      letterboxd: letterboxdResult,
      goodreads: goodreadsResult,
      errors: errors.length > 0 ? errors : undefined,
      syncedAt,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const provider = req.nextUrl.searchParams.get("provider");
    const [freshUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const currentTokens = { ...((freshUser?.googleSyncTokens as Record<string, any>) || {}) };

    if (!provider || provider === "letterboxd") {
      delete currentTokens.letterboxdUsername;
    }
    if (!provider || provider === "goodreads") {
      delete currentTokens.goodreadsUserId;
      delete currentTokens.goodreadsAuthStatus;
      delete currentTokens.goodreadsLastError;
      clearGoodreadsAuthRecord(user.id);
    }

    await db
      .update(users)
      .set({ googleSyncTokens: currentTokens })
      .where(eq(users.id, user.id));

    return NextResponse.json({ success: true, tokens: currentTokens });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
