import { NextRequest, NextResponse } from "next/server";
import { getListBySlugWithItems } from "@/lib/lists/service";
import { generateActivityPubCollection } from "@/lib/federation/activitypub";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const data = await getListBySlugWithItems(slug);

    if (!data) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (data.list.visibility === "PRIVATE") {
      return NextResponse.json({ error: "Access denied: This list is private" }, { status: 403 });
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${host}`;

    const allItems = data.sections.flatMap((s) => s.items);
    const collection = generateActivityPubCollection(data.list, allItems, baseUrl, data.owner);

    return new Response(JSON.stringify(collection), {
      status: 200,
      headers: {
        "Content-Type": "application/activity+json; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (error: any) {
    if (error.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: "Access denied: This list is private" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
