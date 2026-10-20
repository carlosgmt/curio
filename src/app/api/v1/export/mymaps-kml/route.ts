import { NextRequest, NextResponse } from "next/server";
import { db, smartLists, listItems, userSaves, globalEntities } from "@/db";
import { eq, or } from "drizzle-orm";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get("boardId") || searchParams.get("slug");
    const format = searchParams.get("format") || "kml";

    if (!boardId) {
      return NextResponse.json(
        { success: false, error: "boardId or slug query parameter is required" },
        { status: 400 }
      );
    }

    const [board] = await db
      .select()
      .from(smartLists)
      .where(or(eq(smartLists.id, boardId), eq(smartLists.slug, boardId)))
      .limit(1);

    if (!board) {
      return NextResponse.json(
        { success: false, error: "Board not found" },
        { status: 404 }
      );
    }

    const rows = await db
      .select({
        listItem: listItems,
        save: userSaves,
        entity: globalEntities,
      })
      .from(listItems)
      .innerJoin(userSaves, eq(listItems.saveId, userSaves.id))
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(listItems.listId, board.id));

    // Extract places and spatial items
    const places = rows
      .filter((r) => {
        const type = r.entity?.coreType?.toUpperCase() || "";
        const path = r.entity?.typePath?.toLowerCase() || "";
        const ext = (r.entity?.extendedAttributes as any) || {};
        return (
          type === "PLACE" ||
          path.includes("place") ||
          path.includes("spot") ||
          ext.latitude != null ||
          ext.address != null ||
          ext.coordinates != null
        );
      })
      .map((r, idx) => {
        const ext = (r.entity?.extendedAttributes as any) || {};
        const title = r.entity?.title || r.save.privateTitle || `Spot ${idx + 1}`;
        const description = r.entity?.summary || r.listItem?.curatorNote || "";
        const address = ext.address || ext.location || "";
        const lat = ext.latitude ?? (Array.isArray(ext.coordinates) ? ext.coordinates[1] : 37.7749);
        const lng = ext.longitude ?? (Array.isArray(ext.coordinates) ? ext.coordinates[0] : -122.4194);

        return {
          id: r.save.id,
          title,
          description,
          address,
          curatorNote: r.listItem?.curatorNote || r.save.personalNotes || null,
          lat: Number(lat) || 0,
          lng: Number(lng) || 0,
          canonicalUrl: r.entity?.canonicalUrl || null,
        };
      });

    // --- GEOJSON FORMAT ---
    if (format === "geojson") {
      const featureCollection = {
        type: "FeatureCollection",
        name: board.title,
        features: places.map((p) => ({
          type: "Feature",
          id: p.id,
          geometry: {
            type: "Point",
            coordinates: [p.lng, p.lat],
          },
          properties: {
            title: p.title,
            description: p.description,
            address: p.address,
            curatorNote: p.curatorNote,
            canonicalUrl: p.canonicalUrl,
          },
        })),
      };

      return new NextResponse(JSON.stringify(featureCollection, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/geo+json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${board.slug || 'curio-spots'}.geojson"`,
        },
      });
    }

    // --- KML FORMAT (Google MyMaps Standard) ---
    const placemarksXml = places
      .map(
        (p) => `      <Placemark>
        <name>${escapeXml(p.title)}</name>
        <description>${escapeXml(p.description)}</description>
        <ExtendedData>
          <Data name="address"><value>${escapeXml(p.address)}</value></Data>
          <Data name="curatorNote"><value>${escapeXml(p.curatorNote || "")}</value></Data>
          <Data name="canonicalUrl"><value>${escapeXml(p.canonicalUrl || "")}</value></Data>
        </ExtendedData>
        <Point>
          <coordinates>${p.lng},${p.lat},0</coordinates>
        </Point>
      </Placemark>`
      )
      .join("\n");

    const kmlXml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(board.title)}</name>
    <description>${escapeXml(board.description || "Curated spots on Curio")}</description>
${placemarksXml}
  </Document>
</kml>`;

    return new NextResponse(kmlXml, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.google-earth.kml+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${board.slug || 'curio-spots'}.kml"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate KML/GeoJSON export" },
      { status: 500 }
    );
  }
}
