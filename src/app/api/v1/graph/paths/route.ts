import { NextRequest, NextResponse } from "next/server";
import { db, userSaves } from "@/db";
import { inArray } from "drizzle-orm";
import { findShortestPath } from "@/lib/graph/pathfinding";
import { AuthError, requireAuth } from "@/lib/auth/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
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

    const endpointRows = await db
      .select({ id: userSaves.id, userId: userSaves.userId })
      .from(userSaves)
      .where(inArray(userSaves.id, [sourceSaveId, targetSaveId]));

    const sourceSave = endpointRows.find((r) => r.id === sourceSaveId);
    const targetSave = endpointRows.find((r) => r.id === targetSaveId);
    if (!sourceSave || !targetSave) {
      return NextResponse.json({ error: "Save not found" }, { status: 404 });
    }
    if (sourceSave.userId !== targetSave.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isStrictOrSession =
      auth.session !== null ||
      process.env.NODE_ENV === "production" ||
      req.headers.get("x-strict-auth") === "true";

    if (isStrictOrSession && sourceSave.userId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await findShortestPath(sourceSaveId, targetSaveId, maxDepth);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
