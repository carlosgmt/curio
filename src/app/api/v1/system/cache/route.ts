import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { sqlite } from "@/db";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";
    const archetype = searchParams.get("archetype")?.trim() || "";
    const missingArtwork = searchParams.get("missingArtwork") === "true";
    const multiMerchant = searchParams.get("multiMerchant") === "true";
    const limit = Math.min(Number(searchParams.get("limit")) || 25, 100);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push("(g.title LIKE ? OR g.canonical_external_id LIKE ? OR g.identity_fingerprint LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (archetype && archetype !== "ALL") {
      conditions.push("(UPPER(g.core_type) = ? OR g.type_path LIKE ?)");
      params.push(archetype.toUpperCase(), `%${archetype.toLowerCase()}%`);
    }

    if (missingArtwork) {
      conditions.push("(g.hero_image_url IS NULL OR g.hero_image_url = '')");
    }

    if (multiMerchant) {
      conditions.push(`
        g.id IN (
          SELECT entity_id 
          FROM entity_sources 
          GROUP BY entity_id 
          HAVING COUNT(*) > 1
        )
      `);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = sqlite
      .prepare(`SELECT COUNT(*) as count FROM global_entities g ${whereClause}`)
      .get(...params) as { count: number };

    const totalCount = countRow?.count || 0;

    const items = sqlite
      .prepare(`
        SELECT 
          g.id,
          g.title,
          g.core_type as coreType,
          g.type_path as typePath,
          g.canonical_url as canonicalUrl,
          g.canonical_external_id as canonicalExternalId,
          g.identity_fingerprint as identityFingerprint,
          g.hero_image_url as heroImageUrl,
          g.summary,
          g.core_structured_data as coreStructuredData,
          g.extended_attributes as extendedAttributes,
          g.created_at as createdAt,
          (SELECT COUNT(*) FROM entity_sources s WHERE s.entity_id = g.id) as sourceCount,
          (SELECT COUNT(*) FROM user_saves us WHERE us.entity_id = g.id) as saveCount
        FROM global_entities g
        ${whereClause}
        ORDER BY g.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...params, limit, offset) as Array<any>;

    const parsedItems = items.map((item) => {
      let coreData = {};
      let extAttr = {};
      try {
        coreData = JSON.parse(item.coreStructuredData || "{}");
      } catch {}
      try {
        extAttr = JSON.parse(item.extendedAttributes || "{}");
      } catch {}
      return {
        ...item,
        coreStructuredData: coreData,
        extendedAttributes: extAttr,
      };
    });

    return NextResponse.json({
      items: parsedItems,
      totalCount,
      limit,
      offset,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to query cache explorer" },
      { status: err.statusCode || 500 }
    );
  }
}
