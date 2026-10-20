import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { importSchemaSpec } from "@/lib/types/service";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();

    let rawSpec = body?.spec || body;

    // Support importing from remote URL if provided
    if (body?.url && typeof body.url === "string") {
      try {
        const remoteRes = await fetch(body.url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        if (!remoteRes.ok) {
          return NextResponse.json(
            { error: `Failed to fetch remote schema: HTTP ${remoteRes.status}` },
            { status: 400 }
          );
        }
        const fetchedData = await remoteRes.json();
        rawSpec = fetchedData?.spec || fetchedData;
      } catch (fetchErr: any) {
        return NextResponse.json(
          { error: `Error fetching remote schema URL: ${fetchErr.message}` },
          { status: 400 }
        );
      }
    }

    const importedType = await importSchemaSpec(user.id, rawSpec);
    return NextResponse.json({ success: true, type: importedType }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error.message?.includes("Invalid schema bundle")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
