import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { searchFilmCandidates } from "@/lib/cinema/searchFilms";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    if (q.length < 2) {
      return NextResponse.json({ candidates: [] });
    }
    const candidates = await searchFilmCandidates(q, { limit: 6 });
    return NextResponse.json({ candidates });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to look up films" },
      { status: 500 }
    );
  }
}
