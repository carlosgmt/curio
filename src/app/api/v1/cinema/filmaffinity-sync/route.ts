import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { parseFilmAffinityCSV, parseFilmAffinityHtml } from "@/lib/importers/filmaffinity";
import {
  FilmAffinityBlockedError,
  syncFilmAffinityProfile,
  upsertFilmAffinityFilms,
} from "@/lib/sync/filmaffinitySync";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const [freshUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const tokens = (freshUser?.googleSyncTokens as Record<string, any>) || {};
    return NextResponse.json({
      success: true,
      configured: Boolean(tokens.filmaffinityUserId || tokens.filmaffinityLastSyncedAt),
      filmaffinityUserId: tokens.filmaffinityUserId || null,
      lastSyncedAt: tokens.filmaffinityLastSyncedAt || null,
      lastError: tokens.filmaffinityLastError || null,
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
    const tokens = (freshUser?.googleSyncTokens as Record<string, any>) || {};
    const isWatchlist = Boolean(body.isWatchlist);

    if (typeof body.htmlText === "string" && body.htmlText.trim()) {
      const parsed = parseFilmAffinityHtml(body.htmlText, { isWatchlist });
      if (parsed.length === 0) {
        return NextResponse.json(
          { error: "No FilmAffinity films found in that HTML file. Save the ratings, watchlist, or list page directly from FilmAffinity (Cmd+S)." },
          { status: 400 }
        );
      }
      const upsertRes = await upsertFilmAffinityFilms(user.id, parsed);
      const syncedAt = new Date().toISOString();
      await db
        .update(users)
        .set({
          googleSyncTokens: {
            ...tokens,
            filmaffinityLastSyncedAt: syncedAt,
            filmaffinityLastError: null,
          },
        })
        .where(eq(users.id, user.id));

      return NextResponse.json({
        success: true,
        mode: "html",
        recordsProcessed: upsertRes.fetchedCount,
        createdSaves: upsertRes.createdSaves,
        updatedSaves: upsertRes.updatedSaves,
        syncedAt,
      });
    }

    if (typeof body.csvText === "string" && body.csvText.trim()) {
      const parsed = parseFilmAffinityCSV(body.csvText, { isWatchlist });
      if (parsed.length === 0) {
        return NextResponse.json(
          { error: "No film rows found in the FilmAffinity CSV." },
          { status: 400 }
        );
      }
      const upsertRes = await upsertFilmAffinityFilms(user.id, parsed);
      const syncedAt = new Date().toISOString();
      await db
        .update(users)
        .set({
          googleSyncTokens: {
            ...tokens,
            filmaffinityLastSyncedAt: syncedAt,
            filmaffinityLastError: null,
          },
        })
        .where(eq(users.id, user.id));

      return NextResponse.json({
        success: true,
        mode: "csv",
        recordsProcessed: upsertRes.fetchedCount,
        createdSaves: upsertRes.createdSaves,
        updatedSaves: upsertRes.updatedSaves,
        syncedAt,
      });
    }

    const rawProfile =
      typeof body.userIdOrUrl === "string" && body.userIdOrUrl.trim()
        ? body.userIdOrUrl.trim()
        : String(tokens.filmaffinityUserId || "").trim();

    if (!rawProfile) {
      return NextResponse.json(
        { error: "Provide a FilmAffinity HTML/CSV export or a FilmAffinity user ID/URL." },
        { status: 400 }
      );
    }

    const res = await syncFilmAffinityProfile(rawProfile, user.id);
    return NextResponse.json({
      success: true,
      mode: "profile",
      recordsProcessed: res.fetchedCount,
      createdSaves: res.createdSaves,
      updatedSaves: res.updatedSaves,
      filmaffinityUserId: res.filmaffinityUserId,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FilmAffinityBlockedError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    return NextResponse.json(
      { error: err?.message || "FilmAffinity sync failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const [freshUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const tokens = { ...((freshUser?.googleSyncTokens as Record<string, any>) || {}) };
    delete tokens.filmaffinityUserId;
    delete tokens.filmaffinityLastError;
    await db.update(users).set({ googleSyncTokens: tokens }).where(eq(users.id, user.id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
