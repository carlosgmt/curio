import { NextRequest, NextResponse } from "next/server";
import { getPrecomputedClusters, executeClusteringJob } from "@/lib/graph/clustering";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    const user = userId ? { id: userId } : await getOrCreateDefaultUser();
    const clusters = await getPrecomputedClusters(user.id);

    return NextResponse.json({
      success: true,
      clusters,
      count: clusters.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const user = body.userId ? { id: body.userId } : await getOrCreateDefaultUser();
    const result = await executeClusteringJob(user.id);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
