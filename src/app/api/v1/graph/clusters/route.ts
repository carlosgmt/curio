import { NextRequest, NextResponse } from "next/server";
import { getPrecomputedClusters, executeClusteringJob } from "@/lib/graph/clustering";
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
    const clusters = await getPrecomputedClusters(targetUserId);

    return NextResponse.json({
      success: true,
      clusters,
      count: clusters.length,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const requestedUserId = body.userId;
    const isStrictOrSession =
      auth.session !== null ||
      process.env.NODE_ENV === "production" ||
      req.headers.get("x-strict-auth") === "true";

    if (isStrictOrSession && requestedUserId && requestedUserId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetUserId = !isStrictOrSession && requestedUserId ? requestedUserId : auth.user.id;
    const result = await executeClusteringJob(targetUserId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
