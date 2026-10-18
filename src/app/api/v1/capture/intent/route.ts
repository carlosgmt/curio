import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { classifyOmniboxIntent } from "@/lib/router/intent";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const q = req.nextUrl.searchParams.get("q") || "";
    const result = await classifyOmniboxIntent(q, user.id, { skipLocalLlm: true });
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
