import { NextRequest, NextResponse } from "next/server";
import { findShortestPath } from "@/lib/graph/pathfinding";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sourceSaveId = url.searchParams.get("sourceSaveId") || url.searchParams.get("source");
    const targetSaveId = url.searchParams.get("targetSaveId") || url.searchParams.get("target");
    const maxDepth = parseInt(url.searchParams.get("maxDepth") || "4", 10);

    if (!sourceSaveId || !targetSaveId) {
      return NextResponse.json(
        { error: "Both sourceSaveId and targetSaveId parameters are required" },
        { status: 400 }
      );
    }

    const result = await findShortestPath(sourceSaveId, targetSaveId, maxDepth);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
