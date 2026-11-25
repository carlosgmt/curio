import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, globalEntities, users, userSaves } from "@/db";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { getConnectedSavesMap } from "@/lib/connections/service";
import { computeCinemaStats, toFilmView } from "@/lib/cinema/library";
import { getOrCreateSyncSecret } from "@/lib/sync/goodreadsAuthStore";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    try {
      getOrCreateSyncSecret();
    } catch {
      // ignore if read-only
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
          sql`lower(coalesce(${userSaves.typePath}, ${globalEntities.typePath}, '')) LIKE '/media/film%'`
        )
      )
      .orderBy(desc(userSaves.createdAt));

    const saveIds = rows.map((r) => r.save.id);
    const connectionsMap =
      saveIds.length > 0 ? await getConnectedSavesMap(saveIds) : new Map();

    const films = rows.map((r) => {
      const view = toFilmView(r.save, r.entity);
      view.card.connections = connectionsMap.get(r.save.id) ?? [];
      return view;
    });

    const stats = computeCinemaStats(films);

    const [freshUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const tokens = (freshUser?.googleSyncTokens as Record<string, any>) || {};

    return NextResponse.json({
      success: true,
      films,
      stats,
      letterboxdStatus: {
        configured: Boolean(tokens.letterboxdUsername),
        letterboxdUsername: tokens.letterboxdUsername || null,
        lastSyncedAt:
          tokens.letterboxdLastSyncedAt || tokens.lastFeedSyncAt || null,
        lastError: tokens.letterboxdLastError || null,
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to load cinema" },
      { status: 500 }
    );
  }
}
