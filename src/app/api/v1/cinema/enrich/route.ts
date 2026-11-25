import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db, globalEntities, userSaves } from "@/db";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { resolveFilm } from "@/lib/enrichment/providers/cinema";
import { deduplicateUserBooks } from "@/lib/books/deduplicate";

function isWeakDirector(val?: string | null): boolean {
  const clean = String(val || "").trim();
  if (!clean) return true;
  if (/^unknown(\s+director)?$/i.test(clean)) return true;
  if (/\b(?:and\s+(?:written|produced|edited|starring)|written\s+by)\b/i.test(clean)) {
    return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    await deduplicateUserBooks(user.id).catch(() => null);

    const rows = await db
      .select({ entity: globalEntities })
      .from(userSaves)
      .innerJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(
        and(
          eq(userSaves.userId, user.id),
          eq(userSaves.isPrivateMemo, false),
          or(
            eq(userSaves.typePath, "/media/film"),
            eq(globalEntities.typePath, "/media/film")
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
        const genres = Array.isArray(csd.genres) ? csd.genres : [];
        return (
          isWeakDirector(csd.director || entity.brandOrCreator) ||
          genres.length === 0 ||
          !entity.heroImageUrl ||
          !csd.runtimeMinutes ||
          !entity.summary
        );
      })
      .slice(0, 60);

    let enrichedCount = 0;
    for (const entity of candidates) {
      const csd =
        entity.coreStructuredData && typeof entity.coreStructuredData === "object"
          ? ({ ...(entity.coreStructuredData as Record<string, any>) })
          : {};
      const resolved = await resolveFilm(entity.title, {
        yearHint: typeof csd.releaseYear === "number" ? csd.releaseYear : null,
        creatorHint: isWeakDirector(csd.director || entity.brandOrCreator)
          ? null
          : String(csd.director || entity.brandOrCreator),
        tmdbId: csd.tmdbId,
        imdbId: csd.imdbId,
        timeoutMs: 4500,
      }).catch(() => null);

      if (!resolved) continue;

      const patch: Record<string, unknown> = {};
      const nextCsd = { ...csd };
      let changed = false;

      if (resolved.director && isWeakDirector(csd.director || entity.brandOrCreator)) {
        patch.brandOrCreator = resolved.director;
        nextCsd.director = resolved.director;
        changed = true;
      } else if (csd.director && /\band\s+(?:written|produced|edited|starring)\b/i.test(String(csd.director))) {
        const cleanDir = String(csd.director)
          .replace(/\s+\b(?:and\s+(?:written|produced|edited|starring)|written|produced|starring)\b.*$/i, "")
          .trim();
        if (cleanDir) {
          patch.brandOrCreator = cleanDir;
          nextCsd.director = cleanDir;
          changed = true;
        }
      }

      if (
        Array.isArray(resolved.genres) &&
        resolved.genres.length > 0 &&
        (!Array.isArray(nextCsd.genres) || nextCsd.genres.length === 0)
      ) {
        nextCsd.genres = resolved.genres;
        changed = true;
      }
      if (!entity.heroImageUrl && resolved.posterUrl) {
        patch.heroImageUrl = resolved.posterUrl;
        changed = true;
      }
      if (!nextCsd.runtimeMinutes && resolved.runtimeMinutes) {
        nextCsd.runtimeMinutes = resolved.runtimeMinutes;
        changed = true;
      }
      if (!nextCsd.releaseYear && resolved.releaseYear) {
        nextCsd.releaseYear = resolved.releaseYear;
        changed = true;
      }
      if ((!entity.summary || entity.summary.startsWith("Feature film")) && resolved.summary) {
        patch.summary = resolved.summary;
        changed = true;
      }

      if (changed) {
        patch.coreStructuredData = nextCsd;
        patch.updatedAt = new Date().toISOString();
        await db.update(globalEntities).set(patch).where(eq(globalEntities.id, entity.id));
        enrichedCount++;
      }
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
      { error: err?.message || "Film enrichment failed" },
      { status: 500 }
    );
  }
}
