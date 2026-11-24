import { NextRequest, NextResponse } from "next/server";
import { findSerendipityRecommendations } from "@/lib/graph/serendipity";
import { AuthError, requireAuth } from "@/lib/auth/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const url = new URL(req.url);
    const requestedUserId = url.searchParams.get("userId");
    const saveId = url.searchParams.get("saveId") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const isStrictOrSession =
      auth.session !== null ||
      process.env.NODE_ENV === "production" ||
      req.headers.get("x-strict-auth") === "true";

    if (isStrictOrSession && requestedUserId && requestedUserId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetUserId = !isStrictOrSession && requestedUserId ? requestedUserId : auth.user.id;
    const recommendations = await findSerendipityRecommendations(targetUserId, saveId, limit);

    return NextResponse.json({
      success: true,
      recommendations,
      count: recommendations.length,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
