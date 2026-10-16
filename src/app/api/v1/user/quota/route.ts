import { NextRequest, NextResponse } from "next/server";
import { getUserQuotaStatus, checkAndConsumeCredit } from "@/lib/curio-learns/quota";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateDefaultUser();
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateDefaultUser();
    const body = await req.json().catch(() => ({}));
    const cost = typeof body?.cost === "number" ? body.cost : 1;

    const result = await checkAndConsumeCredit(user.id, cost);

    return NextResponse.json({
      success: result.allowed,
      result,
    }, { status: result.allowed ? 200 : 429 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
