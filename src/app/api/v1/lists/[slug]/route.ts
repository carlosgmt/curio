import { NextRequest, NextResponse } from "next/server";
import { getListBySlugWithItems } from "@/lib/lists/service";
import { getOptionalAuth } from "@/lib/auth/service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    let viewerUserId: string | undefined;
    const auth = await getOptionalAuth(req);
    if (auth) {
      viewerUserId = auth.user.id;
    } else if (process.env.NODE_ENV !== "production" && req.headers.get("x-strict-auth") !== "true") {
      try {
        const user = await getOrCreateDefaultUser();
        viewerUserId = user.id;
      } catch {
        // Unauthenticated visitor
      }
    }

    const data = await getListBySlugWithItems(slug, viewerUserId);

    if (!data) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    if (error.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: "Access denied: This list is private" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
