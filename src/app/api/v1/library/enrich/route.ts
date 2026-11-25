import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db, globalEntities, userSaves } from "@/db";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { enrichBookEntity } from "@/lib/books/enrichBoughtBook";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const rows = await db
      .select({
        entity: globalEntities,
      })
      .from(userSaves)
      .innerJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(
        and(
          eq(userSaves.userId, user.id),
          eq(userSaves.isPrivateMemo, false),
          or(
            eq(globalEntities.coreType, "BOOK"),
            eq(userSaves.typePath, "/product/book")
          )
        )
      );

    const candidates = rows
      .map((r) => r.entity)
      .filter((entity, idx, arr) => {
        if (arr.findIndex((x) => x.id === entity.id) !== idx) return false;
        const csd =
          entity.coreStructuredData && typeof entity.coreStructuredData === "object"
            ? (entity.coreStructuredData as Record<string, any>)
            : {};
        return !entity.heroImageUrl || !entity.brandOrCreator || !csd.pageCount;
      })
      .slice(0, 25);

    let enrichedCount = 0;
    for (const entity of candidates) {
      const res = await enrichBookEntity(entity.id).catch(() => ({
        updated: false,
        entity: null,
      }));
      if (res.updated) enrichedCount++;
    }

    return NextResponse.json({
      success: true,
      enrichedCount,
      totalChecked: candidates.length,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err?.message || "Book enrichment failed" },
      { status: 500 }
    );
  }
}
