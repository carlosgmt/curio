import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { deduplicateUserBooks } from "@/lib/books/deduplicate";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);
    const result = await deduplicateUserBooks(user.id, { dryRun });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to deduplicate library books" },
      { status: 500 }
    );
  }
}
