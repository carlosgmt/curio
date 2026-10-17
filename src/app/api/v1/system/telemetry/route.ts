import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDatabaseTelemetry } from "@/lib/system/telemetry";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const telemetry = await getDatabaseTelemetry();
    return NextResponse.json(telemetry);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to retrieve telemetry" },
      { status: err.statusCode || 500 }
    );
  }
}
