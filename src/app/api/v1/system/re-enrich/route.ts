import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { sqlite } from "@/db";
import { resolveFilm } from "@/lib/enrichment/providers/cinema";
import { resolveBook } from "@/lib/enrichment/providers/books";
import { extractOpenGraph } from "@/lib/enrichment/opengraph";

interface ReEnrichTarget {
  save_id: string;
  entity_id: string;
  type_path: string | null;
  title: string;
  canonical_url: string;
  canonical_external_id: string | null;
  hero_image_url: string | null;
  core_type: string;
  summary: string | null;
  brand_or_creator: string | null;
  core_structured_data: string;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "all" ? "all" : "failed";
    const limit = typeof body?.limit === "number" && body.limit > 0 ? Math.min(body.limit, 100) : 50;

    let targets: ReEnrichTarget[] = [];
    if (mode === "all") {
      targets = sqlite
        .prepare(`
          SELECT 
            s.id as save_id,
            s.entity_id,
            s.type_path,
            g.title,
            g.canonical_url,
            g.canonical_external_id,
            g.hero_image_url,
            g.core_type,
            g.summary,
            g.brand_or_creator,
            g.core_structured_data
          FROM user_saves s
          JOIN global_entities g ON s.entity_id = g.id
          LIMIT ?
        `)
        .all(limit) as ReEnrichTarget[];
    } else {
      targets = sqlite
        .prepare(`
          SELECT 
            s.id as save_id,
            s.entity_id,
            s.type_path,
            g.title,
            g.canonical_url,
            g.canonical_external_id,
            g.hero_image_url,
            g.core_type,
            g.summary,
            g.brand_or_creator,
            g.core_structured_data
          FROM user_saves s
          JOIN global_entities g ON s.entity_id = g.id
          WHERE s.enrichment_status = 'FAILED' OR g.hero_image_url IS NULL OR g.hero_image_url = ''
          LIMIT ?
        `)
        .all(limit) as ReEnrichTarget[];
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Concurrency pool with limit = 3
    const concurrency = 3;
    for (let i = 0; i < targets.length; i += concurrency) {
      const chunk = targets.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (target) => {
          try {
            let updatedHero = target.hero_image_url;
            let updatedSummary = target.summary;
            let updatedBrandOrCreator = target.brand_or_creator;
            let parsedCoreData: Record<string, unknown> = {};
            try {
              parsedCoreData = JSON.parse(target.core_structured_data || "{}");
            } catch {}

            const path = (target.type_path || "").toLowerCase();
            const core = (target.core_type || "").toUpperCase();

            if (core === "MEDIA" || path.startsWith("/media")) {
              const film = await resolveFilm(target.title);
              if (film) {
                if (film.posterUrl) updatedHero = film.posterUrl;
                if (film.summary) updatedSummary = film.summary;
                if (film.director) updatedBrandOrCreator = film.director;
                parsedCoreData = { ...parsedCoreData, ...film.coreStructuredData };
              }
            } else if (core === "BOOK" || path.includes("book")) {
              const query = target.canonical_external_id || target.title;
              const book = await resolveBook(query);
              if (book) {
                if (book.coverUrl) updatedHero = book.coverUrl;
                if (book.summary) updatedSummary = book.summary;
                if (book.author) updatedBrandOrCreator = book.author;
                parsedCoreData = { ...parsedCoreData, ...book.coreStructuredData };
              }
            } else if (target.canonical_url && target.canonical_url.startsWith("http")) {
              const meta = await extractOpenGraph(target.canonical_url);
              if (meta.image) updatedHero = meta.image;
              if (meta.description) updatedSummary = meta.description;
              if (meta.authorOrCreator) updatedBrandOrCreator = meta.authorOrCreator;
            }

            sqlite
              .prepare(`
                UPDATE global_entities 
                SET hero_image_url = ?, summary = ?, brand_or_creator = ?, core_structured_data = ?, updated_at = datetime('now')
                WHERE id = ?
              `)
              .run(
                updatedHero,
                updatedSummary,
                updatedBrandOrCreator,
                JSON.stringify(parsedCoreData),
                target.entity_id
              );

            sqlite
              .prepare(`
                UPDATE user_saves
                SET enrichment_status = 'ENRICHED'
                WHERE id = ?
              `)
              .run(target.save_id);

            successCount++;
          } catch (err: any) {
            failedCount++;
            errors.push(`Save ${target.save_id} (${target.title}): ${err.message || String(err)}`);
          }
        })
      );
    }

    return NextResponse.json({
      processedCount: targets.length,
      successCount,
      failedCount,
      errors,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute re-enrichment" },
      { status: err.statusCode || 500 }
    );
  }
}
