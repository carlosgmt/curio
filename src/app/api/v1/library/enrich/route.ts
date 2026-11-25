import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db, globalEntities, userSaves } from "@/db";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { enrichBookEntity } from "@/lib/books/enrichBoughtBook";
import { cleanCommercialBookTitle } from "@/lib/books/library";
import { deduplicateUserBooks } from "@/lib/books/deduplicate";

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
        const noisyTitle =
          cleanCommercialBookTitle(entity.title).title !== entity.title.trim() ||
          /[…]$|\.\.\.$/.test(entity.title);
        const creatorLower = (entity.brandOrCreator || "").trim().toLowerCase();
        const missingAuthor =
          !creatorLower ||
          creatorLower === "unknown author" ||
          /^(amazon|galaxus|provini|google_play|buchhandlung)/.test(creatorLower);
        return (
          noisyTitle ||
          !entity.heroImageUrl ||
          missingAuthor ||
          !csd.pageCount ||
          !csd.isbn ||
          !entity.summary
        );
      })
      .slice(0, 80);

    let enrichedCount = 0;
    for (const entity of candidates) {
      const res = await enrichBookEntity(entity.id).catch(() => ({
        updated: false,
        entity: null,
      }));
      if (res.updated) enrichedCount++;
    }

    const dedupResult = await deduplicateUserBooks(user.id).catch(() => ({
      mergedSavesRemoved: 0,
    }));

    return NextResponse.json({
      success: true,
      enrichedCount,
      totalChecked: candidates.length,
      mergedSavesRemoved: dedupResult.mergedSavesRemoved,
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
