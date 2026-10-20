import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuth } from "@/lib/auth/service";
import {
  createBoardSplitCheckoutSession,
  getCheckoutSession,
} from "@/lib/commerce/splitCheckout";

const splitCheckoutSchema = z.object({
  boardId: z.string().min(1, "boardId is required"),
  buyerUserId: z.string().optional(),
  currency: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = splitCheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid split checkout request",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const auth = await getOptionalAuth(req);
    const buyerUserId = parsed.data.buyerUserId || auth?.user.id || null;

    const session = await createBoardSplitCheckoutSession({
      boardId: parsed.data.boardId,
      buyerUserId,
      currency: parsed.data.currency,
    });

    return NextResponse.json({
      success: true,
      session,
      checkoutUrl: session.checkoutUrl,
    });
  } catch (error: any) {
    const status = error.message?.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create split checkout" },
      { status }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    const session = await getCheckoutSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Checkout session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve session" },
      { status: 500 }
    );
  }
}
