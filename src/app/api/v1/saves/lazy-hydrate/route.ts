import { NextRequest, NextResponse } from "next/server";
import { db, userSaves, globalEntities } from "@/db";
import { eq, inArray, and } from "drizzle-orm";
import { executeBackgroundEnrichment } from "@/lib/ingest/cascade";
import { extractOpenGraphHead } from "@/lib/enrichment/opengraph";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { saveIds, limit = 20 } = body;

    let targetSaves = [];
    if (Array.isArray(saveIds) && saveIds.length > 0) {
      targetSaves = await db
        .select()
        .from(userSaves)
        .where(
          and(
            inArray(userSaves.id, saveIds),
            eq(userSaves.enrichmentStatus, "LAZY_QUEUED")
          )
        )
        .limit(limit);
    } else {
      targetSaves = await db
        .select()
        .from(userSaves)
        .where(eq(userSaves.enrichmentStatus, "LAZY_QUEUED"))
        .limit(limit);
    }

    const hydratedResults = [];

    for (const save of targetSaves) {
      try {
        let targetUrl: string | undefined;

        if (save.entityId) {
          const [entity] = await db
            .select()
            .from(globalEntities)
            .where(eq(globalEntities.id, save.entityId))
            .limit(1);
          if (entity?.canonicalUrl) {
            targetUrl = entity.canonicalUrl;
          }
        }

        if (!targetUrl && save.candidateFallbacks && save.candidateFallbacks.length > 0) {
          targetUrl = save.candidateFallbacks[0].url;
        }

        if (targetUrl) {
          const enriched = await executeBackgroundEnrichment(
            save.id,
            targetUrl,
            save.userId
          );

          hydratedResults.push({
            saveId: save.id,
            status: "ENRICHED",
            entityId: enriched.entityId,
          });
        } else {
          // No external URL; promote to ENRICHED local save
          await db
            .update(userSaves)
            .set({ enrichmentStatus: "ENRICHED" })
            .where(eq(userSaves.id, save.id));

          hydratedResults.push({
            saveId: save.id,
            status: "ENRICHED",
            entityId: save.entityId,
          });
        }
      } catch (err: any) {
        hydratedResults.push({
          saveId: save.id,
          status: "FAILED",
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      hydratedCount: hydratedResults.filter((r) => r.status === "ENRICHED").length,
      results: hydratedResults,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
