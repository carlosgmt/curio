import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users, type User } from "@/db";
import { AuthError, requireAuth, toSafeUser, type SafeUser } from "@/lib/auth/service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";
import { parseLetterboxdCSV } from "@/lib/importers/letterboxd";
import {
  getOrCreateSyncSecret,
  verifySyncSecret,
} from "@/lib/sync/goodreadsAuthStore";
import {
  letterboxdSyncAdapter,
  upsertLetterboxdFilms,
  type LetterboxdRssItem,
} from "@/lib/sync/letterboxdRss";

async function resolveCinemaSyncCaller(
  req: NextRequest
): Promise<{ user: SafeUser | User; viaSecret: boolean }> {
  const syncSecret = req.headers.get("x-curio-sync-secret");
  if (syncSecret && verifySyncSecret(syncSecret)) {
    return { user: await getOrCreateDefaultUser(), viaSecret: true };
  }
  const auth = await requireAuth(req);
  return { user: toSafeUser(auth.user as any), viaSecret: false };
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await resolveCinemaSyncCaller(req);
    try {
      getOrCreateSyncSecret();
    } catch {
      // ignore in read-only env
    }

    const [freshUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const tokens = (freshUser?.googleSyncTokens as Record<string, any>) || {};

    return NextResponse.json({
      success: true,
      configured: Boolean(tokens.letterboxdUsername),
      letterboxdUsername: tokens.letterboxdUsername || null,
      lastSyncedAt:
        tokens.letterboxdLastSyncedAt || tokens.lastFeedSyncAt || null,
      lastError: tokens.letterboxdLastError || null,
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
    const { user, viaSecret } = await resolveCinemaSyncCaller(req);
    const body = await req.json().catch(() => ({}));

    const [freshUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const tokens = (freshUser?.googleSyncTokens as Record<string, any>) || {};

    // Mode 1: CSV Import (diary.csv / watched.csv / reviews.csv / watchlist.csv with Tags)
    if (typeof body.csvText === "string" && body.csvText.trim()) {
      const isWatchlist = Boolean(body.isWatchlist);
      const parsedFilms = parseLetterboxdCSV(body.csvText, { isWatchlist });
      if (parsedFilms.length === 0) {
        return NextResponse.json(
          { error: "No film rows found in Letterboxd CSV." },
          { status: 400 }
        );
      }

      const items: LetterboxdRssItem[] = parsedFilms.map((f) => {
        const slugMatch = f.letterboxdUri?.match(
          /letterboxd\.com\/(?:[^/]+\/)?film\/([^/?#]+)/i
        );
        const slug = slugMatch
          ? slugMatch[1].toLowerCase()
          : f.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
        return {
          title: f.title,
          filmTitle: f.title,
          filmYear: f.releaseYear,
          memberRating: f.rating,
          watchedDate: f.dateWatched,
          rewatch: f.rewatch,
          isWatchlist: Boolean(f.isWatchlist),
          link: f.letterboxdUri || `https://letterboxd.com/film/${slug}/`,
          canonicalFilmUrl: `https://letterboxd.com/film/${slug}/`,
          slug,
          reviewText: f.review,
          letterboxdTags: f.letterboxdTags,
        };
      });

      const upsertRes = await upsertLetterboxdFilms(user.id, items, {
        hydrateMissingDirectors: true,
      });
      const syncedAt = new Date().toISOString();
      await db
        .update(users)
        .set({
          googleSyncTokens: {
            ...tokens,
            letterboxdLastSyncedAt: syncedAt,
            letterboxdLastError: null,
          },
        })
        .where(eq(users.id, user.id));

      return NextResponse.json({
        success: true,
        mode: "csv",
        recordsProcessed: upsertRes.fetchedCount,
        createdSaves: upsertRes.createdSaves,
        updatedSaves: upsertRes.updatedSaves,
        tagsImportedCount: upsertRes.tagsImportedCount,
        syncedAt,
      });
    }

    // Mode 2: Public RSS Live Sync
    const rawUsername =
      typeof body.username === "string" && body.username.trim()
        ? body.username.trim()
        : typeof body.letterboxdUsername === "string" && body.letterboxdUsername.trim()
        ? body.letterboxdUsername.trim()
        : String(tokens.letterboxdUsername || "").trim();

    if (!rawUsername) {
      if (viaSecret) {
        return NextResponse.json({
          success: true,
          skipped: true,
          skippedReason: "not_configured",
        });
      }
      return NextResponse.json(
        { error: "Provide a Letterboxd username or profile URL." },
        { status: 400 }
      );
    }

    const res = await letterboxdSyncAdapter.run!(user.id, {
      force: true,
      username: rawUsername,
    });

    return NextResponse.json({
      success: true,
      mode: "rss",
      ...res,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err?.message || "Letterboxd sync failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await resolveCinemaSyncCaller(req);
    const [freshUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const tokens = { ...((freshUser?.googleSyncTokens as Record<string, any>) || {}) };
    delete tokens.letterboxdUsername;
    delete tokens.letterboxdLastError;

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
