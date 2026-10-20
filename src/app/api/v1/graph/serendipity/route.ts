import { NextRequest, NextResponse } from "next/server";
import { findSerendipityRecommendations } from "@/lib/graph/serendipity";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const saveId = url.searchParams.get("saveId") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);

    const user = userId ? { id: userId } : await getOrCreateDefaultUser();
    const recommendations = await findSerendipityRecommendations(user.id, saveId, limit);

    return NextResponse.json({
      success: true,
      recommendations,
      count: recommendations.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
