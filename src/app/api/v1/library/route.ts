import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, or } from "drizzle-orm";
import { db, globalEntities, users, userSaves } from "@/db";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { getConnectedSavesMap } from "@/lib/connections/service";
import { computeLibraryStats, toLibraryBookView } from "@/lib/books/library";
import {
  getGoodreadsAuthRecord,
  getOrCreateSyncSecret,
} from "@/lib/sync/goodreadsAuthStore";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);

    // Ensure host cron sync secret is provisioned in data directory
    try {
      getOrCreateSyncSecret();
    } catch {
      // ignore if read-only in tests
    }

    const rows = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(
        and(
          eq(userSaves.userId, user.id),
          eq(userSaves.isPrivateMemo, false),
          or(
            eq(globalEntities.coreType, "BOOK"),
            eq(userSaves.typePath, "/product/book")
          )
        )
      )
      .orderBy(desc(userSaves.createdAt));

    const saveIds = rows.map((r) => r.save.id);
    const connectionsMap =
      saveIds.length > 0 ? await getConnectedSavesMap(saveIds) : new Map();

    const books = rows.map((r) => {
      const view = toLibraryBookView(r.save, r.entity);
      view.card.connections = connectionsMap.get(r.save.id) ?? [];
      return view;
    });

    const stats = computeLibraryStats(books);

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
      books,
      stats,
      goodreadsStatus: {
        configured: Boolean(goodreadsUserId && hasCookie),
        goodreadsUserId,
        hasCookie,
        authStatus:
          tokens.goodreadsAuthStatus || (hasCookie ? "ok" : "unconfigured"),
        lastError: tokens.goodreadsLastError || null,
        lastSyncedAt:
          tokens.goodreadsLastSyncedAt || tokens.lastFeedSyncAt || null,
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to load library" },
      { status: 500 }
    );
  }
}
