import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/service";

export async function GET(req: NextRequest) {
  try {
    const { user, session } = await requireAuth(req, { allowFallback: false });

    return NextResponse.json({
      success: true,
      user,
      session: session
        ? {
            id: session.id,
            expiresAt: session.expiresAt,
            createdAt: session.createdAt,
          }
        : null,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Unauthorized" },
      { status: 401 }
    );
  }
}
