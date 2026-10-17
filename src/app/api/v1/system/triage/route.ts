import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { sqlite } from "@/db";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);

    const filter = searchParams.get("filter") || "all"; // all, failed, missing_artwork
    const limit = Math.min(Number(searchParams.get("limit")) || 25, 100);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const conditions: string[] = ["s.is_private_memo = 0"];
    if (filter === "failed") {
      conditions.push("s.enrichment_status = 'FAILED'");
    } else if (filter === "missing_artwork") {
      conditions.push("(g.hero_image_url IS NULL OR g.hero_image_url = '')");
    } else {
      conditions.push("(s.enrichment_status = 'FAILED' OR g.hero_image_url IS NULL OR g.hero_image_url = '')");
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countRow = sqlite
      .prepare(`
        SELECT COUNT(*) as count 
        FROM user_saves s 
        LEFT JOIN global_entities g ON s.entity_id = g.id 
        ${whereClause}
      `)
      .get() as { count: number };

    const totalCount = countRow?.count || 0;

    const items = sqlite
      .prepare(`
        SELECT 
          s.id as saveId,
          s.entity_id as entityId,
          s.type_path as typePath,
          s.enrichment_status as enrichmentStatus,
          s.is_private_memo as isPrivateMemo,
          s.private_title as privateTitle,
          s.created_at as createdAt,
          g.title as entityTitle,
          g.core_type as coreType,
          g.hero_image_url as heroImageUrl,
          g.canonical_url as canonicalUrl,
          g.canonical_external_id as canonicalExternalId
        FROM user_saves s
        LEFT JOIN global_entities g ON s.entity_id = g.id
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(limit, offset) as Array<any>;

    const formattedItems = items.map((item) => {
      const missingFields: string[] = [];
      if (!item.heroImageUrl) missingFields.push("hero_image_url");
      if (!item.canonicalExternalId) missingFields.push("canonical_external_id");
      if (item.enrichmentStatus === "FAILED") missingFields.push("enrichment_failed");

      return {
        saveId: item.saveId,
        entityId: item.entityId,
        title: item.privateTitle || item.entityTitle || "Untitled Item",
        typePath: item.typePath || (item.isPrivateMemo ? "/memo" : "/uncategorized"),
        coreType: item.coreType || "OTHER",
        enrichmentStatus: item.enrichmentStatus,
        heroImageUrl: item.heroImageUrl,
        canonicalUrl: item.canonicalUrl,
        missingFields,
        createdAt: item.createdAt,
      };
    });

    return NextResponse.json({
      items: formattedItems,
      totalCount,
      limit,
      offset,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to query triage queue" },
      { status: err.statusCode || 500 }
    );
  }
}
