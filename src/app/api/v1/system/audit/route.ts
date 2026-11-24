import { NextRequest, NextResponse } from "next/server";
import { getRecentAuditLogs } from "@/lib/system/audit";
import { AuthError, requireAuth } from "@/lib/auth/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit")) || 50;
    const offset = Number(searchParams.get("offset")) || 0;
    const action = searchParams.get("action") || undefined;
    const operatorUserId = searchParams.get("operatorUserId") || undefined;

    const logs = await getRecentAuditLogs({ limit, offset, action, operatorUserId });

    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
