import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserQuotaStatus, checkAndConsumeCredit } from "@/lib/curio-learns/quota";
import { requireAuth, AuthError } from "@/lib/auth/service";

const QuotaConsumeSchema = z.object({
  cost: z.number().int("Cost must be an integer").min(1, "Cost must be at least 1").default(1),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const quota = await getUserQuotaStatus(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        isPro: user.isPro,
      },
      quota,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = QuotaConsumeSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: parseResult.error.issues[0]?.message || "Invalid request body: cost must be an integer >= 1",
        },
        { status: 400 }
      );
    }

    const { cost } = parseResult.data;
    const result = await checkAndConsumeCredit(user.id, cost);

    return NextResponse.json(
      {
        success: result.allowed,
        result,
      },
      { status: result.allowed ? 200 : 429 }
    );
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    if (error.message?.includes("Cost must be")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
