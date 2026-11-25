import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, globalEntities, smartLists, userSaves } from "@/db";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { resolveFilm } from "@/lib/enrichment/providers/cinema";
import { generateEntityKey } from "@/lib/ingest/cascade";
import { computeIdentityFingerprint } from "@/lib/ingest/resolution";
import { normalizeEntityString } from "@/lib/enrichment/universalDiscovery";
import { ensureHierarchicalBoard } from "@/lib/sync/engine";
import { isOwnedFilm, toFilmView } from "@/lib/cinema/library";
import { normalizeDateString } from "@/lib/books/library";

const logFilmSchema = z.object({
  title: z.string().min(1, "Title is required"),
  director: z.string().optional().nullable(),
  releaseYear: z.number().int().optional().nullable(),
  runtimeMinutes: z.number().int().positive().optional().nullable(),
  posterUrl: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  canonicalUrl: z.string().optional().nullable(),
  tmdbId: z.string().optional().nullable(),
  watchStatus: z.enum(["WATCHED", "WATCHLIST"]).default("WATCHED"),
  isOwned: z.boolean().optional(),
  rating: z.number().min(0.5).max(5).optional().nullable(),
  dateWatched: z.string().optional().nullable(),
  rewatch: z.boolean().optional(),
  personalNotes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

function mergeDistinctTags(
  existing: string[] | null | undefined,
  incoming: string[]
): string[] {
  const seen = new Map<string, string>();
  for (const raw of [...(existing || []), ...incoming]) {
    const clean = String(raw || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) seen.set(key, clean);
  }
  return [...seen.values()];
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();
    const parsed = logFilmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid film payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const cleanTitle = input.title.trim();
    let resolvedDirector = input.director?.trim() || undefined;
    let resolvedYear = input.releaseYear ?? undefined;
    let resolvedRuntime = input.runtimeMinutes ?? undefined;
    let resolvedPoster = input.posterUrl?.trim() || undefined;
    let resolvedSummary = input.summary?.trim() || undefined;
    let resolvedCanonicalUrl = input.canonicalUrl?.trim() || undefined;
    let resolvedTmdbId = input.tmdbId?.trim() || undefined;

    if (!resolvedPoster || !resolvedDirector || !resolvedRuntime) {
      const resolved = await resolveFilm(cleanTitle, {
        yearHint: resolvedYear ?? undefined,
        creatorHint: resolvedDirector,
        tmdbId: resolvedTmdbId,
        timeoutMs: 4000,
      }).catch(() => null);
      if (resolved) {
        resolvedDirector = resolvedDirector || resolved.director;
        resolvedYear = resolvedYear ?? resolved.releaseYear;
        resolvedRuntime = resolvedRuntime ?? resolved.runtimeMinutes;
        resolvedPoster = resolvedPoster || resolved.posterUrl;
        resolvedSummary = resolvedSummary || resolved.summary;
        resolvedCanonicalUrl = resolvedCanonicalUrl || resolved.canonicalUrl;
        if (!resolvedTmdbId && resolved.coreStructuredData?.tmdbId) {
          resolvedTmdbId = String(resolved.coreStructuredData.tmdbId);
        }
      }
    }

    const fingerprint = computeIdentityFingerprint(
      "/media/film",
      cleanTitle,
      undefined,
      { releaseYear: resolvedYear }
    );
    const normTitle = normalizeEntityString(cleanTitle);
    const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const tmdbExtId = resolvedTmdbId ? `tmdb:movie:${resolvedTmdbId}` : null;
    const lbExtId = `letterboxd:${slug}${resolvedYear ? `-${resolvedYear}` : ""}`;

    const existingFilms = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.typePath, "/media/film"));
    const userFilmSaves = await db
      .select({ entity: globalEntities })
      .from(userSaves)
      .innerJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(
        and(
          eq(userSaves.userId, user.id),
          eq(globalEntities.typePath, "/media/film")
        )
      );
    const userFilmIds = new Set(userFilmSaves.map((r) => r.entity.id));
    const prioritizedFilms = [
      ...userFilmSaves.map((r) => r.entity),
      ...existingFilms.filter((e) => !userFilmIds.has(e.id)),
    ];

    let entity = prioritizedFilms.find((e) => {
      if (tmdbExtId && e.canonicalExternalId === tmdbExtId) return true;
      if (e.canonicalExternalId === lbExtId) return true;
      if (e.identityFingerprint === fingerprint) return true;
      const eCore = (e.coreStructuredData as Record<string, any>) || {};
      const eYear = eCore.releaseYear ?? eCore.year;
      return (
        normalizeEntityString(e.title) === normTitle &&
        (!resolvedYear || !eYear || Number(eYear) === resolvedYear)
      );
    });

    if (!entity) {
      const canonicalUrl =
        resolvedCanonicalUrl || `https://letterboxd.com/film/${slug}/`;
      const { urlHash, entityKey } = generateEntityKey(canonicalUrl, cleanTitle);

      const [createdEntity] = await db
        .insert(globalEntities)
        .values({
          urlHash,
          entityKey,
          canonicalUrl,
          coreType: "MEDIA",
          typePath: "/media/film",
          canonicalExternalId: tmdbExtId || lbExtId,
          identityFingerprint: fingerprint,
          brandOrCreator: resolvedDirector || null,
          title: cleanTitle,
          summary:
            resolvedSummary ||
            `Feature film${resolvedYear ? ` (${resolvedYear})` : ""}`,
          heroImageUrl: resolvedPoster || null,
          coreStructuredData: {
            title: cleanTitle,
            ...(resolvedDirector ? { director: resolvedDirector } : {}),
            ...(resolvedYear ? { releaseYear: resolvedYear } : {}),
            ...(resolvedRuntime ? { runtimeMinutes: resolvedRuntime } : {}),
            ...(resolvedTmdbId ? { tmdbId: resolvedTmdbId } : {}),
          },
          extendedAttributes: input.isOwned ? { owned: true } : {},
          priceCents: 399,
          currency: "USD",
        })
        .returning();
      entity = createdEntity;
    } else {
      const eCore =
        entity.coreStructuredData && typeof entity.coreStructuredData === "object"
          ? ({ ...(entity.coreStructuredData as Record<string, any>) })
          : {};
      const entityPatch: Record<string, unknown> = {};
      let csdChanged = false;
      if (!entity.heroImageUrl && resolvedPoster) {
        entityPatch.heroImageUrl = resolvedPoster;
      }
      if (!entity.brandOrCreator && resolvedDirector) {
        entityPatch.brandOrCreator = resolvedDirector;
      }
      if (!eCore.director && resolvedDirector) {
        eCore.director = resolvedDirector;
        csdChanged = true;
      }
      if (!eCore.releaseYear && resolvedYear) {
        eCore.releaseYear = resolvedYear;
        csdChanged = true;
      }
      if (!eCore.runtimeMinutes && resolvedRuntime) {
        eCore.runtimeMinutes = resolvedRuntime;
        csdChanged = true;
      }
      if (csdChanged) entityPatch.coreStructuredData = eCore;
      if (Object.keys(entityPatch).length > 0) {
        entityPatch.updatedAt = new Date().toISOString();
        const [updatedEnt] = await db
          .update(globalEntities)
          .set(entityPatch)
          .where(eq(globalEntities.id, entity.id))
          .returning();
        if (updatedEnt) entity = updatedEnt;
      }
    }

    const [existingSave] = await db
      .select()
      .from(userSaves)
      .where(and(eq(userSaves.userId, user.id), eq(userSaves.entityId, entity.id)))
      .limit(1);

    const existingCv =
      existingSave?.userCustomValues &&
      typeof existingSave.userCustomValues === "object"
        ? (existingSave.userCustomValues as Record<string, any>)
        : {};
    const existingOwned = existingSave ? isOwnedFilm(existingSave, entity) : false;
    const isOwned = existingOwned || Boolean(input.isOwned);
    const wishlist = isOwned ? false : input.watchStatus === "WATCHLIST";
    const effectiveDateWatched =
      normalizeDateString(input.dateWatched) ||
      (input.watchStatus === "WATCHED" && !existingCv.dateWatched
        ? new Date().toISOString().slice(0, 10)
        : existingCv.dateWatched || undefined);

    const nextCv: Record<string, any> = {
      ...existingCv,
      watchStatus: input.watchStatus,
      owned: isOwned,
      ...(input.rewatch !== undefined ? { rewatch: input.rewatch } : {}),
    };
    if (input.rating !== undefined && input.rating !== null) {
      nextCv.rating = Math.round(input.rating * 2) / 2;
    }
    if (effectiveDateWatched) {
      nextCv.dateWatched = effectiveDateWatched;
    }

    const incomingTags = [
      "media",
      "film",
      ...(input.watchStatus === "WATCHLIST" ? ["watchlist"] : []),
      ...(input.tags || []),
    ];
    const cleanNotes = input.personalNotes?.trim();

    let savedRow: typeof userSaves.$inferSelect;
    if (existingSave) {
      const nextNotes = cleanNotes
        ? existingSave.personalNotes &&
          existingSave.personalNotes.toLowerCase().includes(cleanNotes.toLowerCase())
          ? existingSave.personalNotes
          : existingSave.personalNotes
          ? `${existingSave.personalNotes}\n\n${cleanNotes}`
          : cleanNotes
        : existingSave.personalNotes;

      const [updated] = await db
        .update(userSaves)
        .set({
          wishlist,
          hasConvertedPurchase: existingSave.hasConvertedPurchase || isOwned,
          personalNotes: nextNotes,
          userCustomValues: nextCv,
          autoTags: mergeDistinctTags(existingSave.autoTags, incomingTags),
        })
        .where(eq(userSaves.id, existingSave.id))
        .returning();
      savedRow = updated;
    } else {
      const [created] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: entity.id,
          typePath: "/media/film",
          isPrivateMemo: false,
          wishlist,
          hasConvertedPurchase: isOwned,
          personalNotes: cleanNotes || null,
          userCustomValues: nextCv,
          autoTags: mergeDistinctTags([], incomingTags),
          enrichmentStatus: "ENRICHED",
          visibility: "PRIVATE",
        })
        .returning();
      savedRow = created;
    }

    const boardRes = await ensureHierarchicalBoard(user.id, {
      rootSlug: "films",
      rootTitle: "Films",
      rootDefaultLayout: "posters",
      autoRules: { typePathPrefix: "/media/film" },
    });
    await db
      .update(smartLists)
      .set({ defaultLayout: "posters" })
      .where(eq(smartLists.id, boardRes.rootId));

    return NextResponse.json(
      {
        success: true,
        film: toFilmView(savedRow, entity),
      },
      { status: existingSave ? 200 : 201 }
    );
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to log film" },
      { status: 500 }
    );
  }
}
