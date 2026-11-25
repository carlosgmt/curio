import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users, type User } from "@/db";
import { AuthError, requireAuth, toSafeUser, type SafeUser } from "@/lib/auth/service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";
import { parseGoodreadsCSV } from "@/lib/importers/goodreads";
import {
  clearGoodreadsAuthRecord,
  getGoodreadsAuthRecord,
  getOrCreateSyncSecret,
  setGoodreadsAuthRecord,
  verifySyncSecret,
} from "@/lib/sync/goodreadsAuthStore";
import { goodreadsSyncAdapter } from "@/lib/sync/goodreadsRss";
import {
  GoodreadsAuthExpiredError,
  parseGoodreadsUserId,
  upsertGoodreadsBooks,
  type GoodreadsBookItem,
  type GoodreadsShelf,
} from "@/lib/sync/goodreadsSync";

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
    const authRec = getGoodreadsAuthRecord(user.id);
    const hasCookie = Boolean(authRec?.cookie);
    const goodreadsUserId =
      authRec?.goodreadsUserId || tokens.goodreadsUserId || null;

    return NextResponse.json({
      success: true,
      configured: Boolean(goodreadsUserId && hasCookie),
      goodreadsUserId,
      hasCookie,
      authStatus:
        tokens.goodreadsAuthStatus || (hasCookie ? "ok" : "unconfigured"),
      lastError: tokens.goodreadsLastError || null,
      lastSyncedAt:
        tokens.goodreadsLastSyncedAt || tokens.lastFeedSyncAt || null,
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

    const [freshUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const tokens = (freshUser?.googleSyncTokens as Record<string, any>) || {};

    // Mode 1: CSV Fallback Import (with full Goodreads tags, exclusive shelf, dates & notes)
    if (typeof body.csvText === "string" && body.csvText.trim()) {
      const parsedBooks = parseGoodreadsCSV(body.csvText);
      if (parsedBooks.length === 0) {
        return NextResponse.json(
          { error: "No book rows found in Goodreads CSV." },
          { status: 400 }
        );
      }

      const items: GoodreadsBookItem[] = parsedBooks.map((b) => ({
        bookId: b.bookId || b.canonicalExternalId.replace(/^goodreads:/, ""),
        title: b.title,
        author: b.author,
        isbn: b.isbn,
        isbn13: b.isbn13,
        userRating: b.myRating,
        userReadAt: b.dateRead,
        userDateAdded: b.dateAdded,
        userReview: b.review,
        privateNotes: b.privateNotes,
        bookPublished: b.yearPublished,
        numPages: b.pageCount,
        publisher: b.publisher,
        link: b.bookId
          ? `https://www.goodreads.com/book/show/${b.bookId}`
          : `https://openlibrary.org/search?q=${encodeURIComponent(b.title)}`,
        shelf: b.shelf || "read",
        customShelves: b.goodreadsShelves || [],
        ownedCopies: b.ownedCopies,
      }));

      const upsertRes = await upsertGoodreadsBooks(user.id, items);
      const syncedAt = new Date().toISOString();
      await db
        .update(users)
        .set({
          googleSyncTokens: {
            ...tokens,
            goodreadsLastSyncedAt: syncedAt,
            goodreadsLastError: null,
          },
        })
        .where(eq(users.id, user.id));

      return NextResponse.json({
        success: true,
        mode: "csv",
        recordsProcessed: upsertRes.fetchedCount,
        createdSaves: upsertRes.createdSaves,
        updatedSaves: upsertRes.updatedSaves,
        mergedWithOwned: upsertRes.mergedWithOwned,
        tagsImportedCount: upsertRes.tagsImportedCount,
        syncedAt,
      });
    }

    // Mode 2: Cookie-Backed Live Shelf Sync
    const existingAuth = getGoodreadsAuthRecord(user.id);
    const rawUserId =
      typeof body.goodreadsUserId === "string" && body.goodreadsUserId.trim()
        ? parseGoodreadsUserId(body.goodreadsUserId)
        : existingAuth?.goodreadsUserId || String(tokens.goodreadsUserId || "").trim();
    const rawCookie =
      typeof body.cookie === "string" && body.cookie.trim()
        ? body.cookie.trim()
        : existingAuth?.cookie || "";

    if (!rawUserId || !/^\d+$/.test(rawUserId)) {
      return NextResponse.json(
        {
          error:
            "Provide a valid numeric Goodreads User ID (from goodreads.com/user/show/<id>).",
        },
        { status: 400 }
      );
    }
    if (!rawCookie) {
      return NextResponse.json(
        {
          error:
            "Goodreads retired unauthenticated RSS feeds. Paste your Goodreads session cookie to enable auto-sync.",
          code: "GOODREADS_COOKIE_REQUIRED",
        },
        { status: 400 }
      );
    }

    setGoodreadsAuthRecord(user.id, {
      goodreadsUserId: rawUserId,
      cookie: rawCookie,
    });

    const shelves: GoodreadsShelf[] | undefined = Array.isArray(body.shelves)
      ? body.shelves
      : undefined;

    const res = await goodreadsSyncAdapter.run!(user.id, {
      force: true,
      goodreadsUserId: rawUserId,
      cookie: rawCookie,
      shelves,
    });

    return NextResponse.json({
      success: true,
      mode: "cookie",
      ...res,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof GoodreadsAuthExpiredError) {
      return NextResponse.json(
        { error: err.message, code: "GOODREADS_COOKIE_EXPIRED" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: err?.message || "Goodreads sync failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await resolveSyncCaller(req);
    clearGoodreadsAuthRecord(user.id);

    const [freshUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const tokens = { ...((freshUser?.googleSyncTokens as Record<string, any>) || {}) };
    tokens.goodreadsAuthStatus = "unconfigured";
    tokens.goodreadsLastError = null;

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
