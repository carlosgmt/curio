import { NextRequest, NextResponse } from "next/server";
import { db, userSaves, globalEntities, entryConnections } from "@/db";
import { eq } from "drizzle-orm";
import { AuthError, requireAuth } from "@/lib/auth/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const url = new URL(req.url);
    const requestedUserId = url.searchParams.get("userId");
    const isStrictOrSession =
      auth.session !== null ||
      process.env.NODE_ENV === "production" ||
      req.headers.get("x-strict-auth") === "true";

    if (isStrictOrSession && requestedUserId && requestedUserId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetUserId = !isStrictOrSession && requestedUserId ? requestedUserId : auth.user.id;

    // 1. Fetch user saves
    const saves = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.userId, targetUserId));

    // 2. Fetch edges
    const edges = await db
      .select()
      .from(entryConnections)
      .where(eq(entryConnections.userId, targetUserId));

    const nodes = saves.map((s, idx) => {
      // Deterministic layout angle for initial plinth positioning
      const angle = (idx / Math.max(1, saves.length)) * 2 * Math.PI;
      const radius = 250 + (idx % 3) * 60;
      return {
        id: s.save.id,
        title: s.save.privateTitle || s.entity?.title || "Untitled",
        coreType: s.entity?.coreType || (s.save.isPrivateMemo ? "PRIVATE_MEMO" : "PRODUCT"),
        typePath: s.save.typePath || s.entity?.typePath || "/general",
        heroImageUrl: s.entity?.heroImageUrl || null,
        isPrivateMemo: s.save.isPrivateMemo,
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
      };
    });

    const formattedEdges = edges.map((e) => ({
      id: e.id,
      source: e.sourceSaveId,
      target: e.targetSaveId,
      type: e.connectionType,
      weight: e.weight,
      isBidirectional: e.isBidirectional,
    }));

    return NextResponse.json({
      success: true,
      nodes,
      edges: formattedEdges,
      nodeCount: nodes.length,
      edgeCount: formattedEdges.length,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
