import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/service";
import {
  createSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const { user, session } = await requireAuth(req, { allowFallback: false });

    const response = NextResponse.json({
      success: true,
      user,
      token: session?.token ?? null,
      session: session
        ? {
            id: session.id,
            expiresAt: session.expiresAt,
            createdAt: session.createdAt,
          }
        : null,
    });

    if (session?.token) {
      const remainingSeconds = Math.max(
        1,
        Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)
      );
      response.headers.set(
        "Set-Cookie",
        createSessionCookie(session.token, remainingSeconds)
      );
    }

    return response;
  } catch (error: any) {
    if (error instanceof AuthError) {
      const response = NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
      if (
        error.statusCode === 401 &&
        req.headers.get("cookie")?.includes(`${SESSION_COOKIE_NAME}=`)
      ) {
        response.headers.set("Set-Cookie", clearSessionCookie());
      }
      return response;
    }
    return NextResponse.json(
      { success: false, error: error.message || "Unauthorized" },
      { status: 401 }
    );
  }
}
