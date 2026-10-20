import { NextRequest, NextResponse } from "next/server";
import { exportTypeAsSchemaSpec } from "@/lib/types/service";
import { getOptionalAuth } from "@/lib/auth/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOptionalAuth(req);
    const { id } = await params;

    const host = req.headers.get("host") || "curio.local";
    const spec = await exportTypeAsSchemaSpec(id, auth?.user?.id, host);

    // If query ?download=true or requested as attachment
    const shouldDownload = req.nextUrl.searchParams.get("download") === "true";
    if (shouldDownload) {
      const fileName = `${spec.curioType.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-schema.json`;
      return new NextResponse(JSON.stringify(spec, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    return NextResponse.json({ success: true, spec });
  } catch (error: any) {
    if (error.message?.includes("Type not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
