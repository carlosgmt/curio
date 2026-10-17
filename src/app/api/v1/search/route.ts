import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { hybridSearch } from "@/lib/search/vector";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";
    const isSemanticParam = url.searchParams.get("semantic");
    const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
    const limit = isNaN(limitParam) ? 20 : Math.min(100, Math.max(1, limitParam));

    // Determine semantic weight
    let semanticWeight = 0.5;
    if (isSemanticParam === "false") {
      semanticWeight = 0.0;
    } else if (url.searchParams.get("semanticWeight")) {
      const parsedWeight = parseFloat(url.searchParams.get("semanticWeight")!);
      if (!isNaN(parsedWeight)) {
        semanticWeight = Math.max(0, Math.min(1, parsedWeight));
      }
    }

    const results = await hybridSearch({
      query,
      userId: user.id,
      limit,
      semanticWeight,
    });

    return NextResponse.json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
