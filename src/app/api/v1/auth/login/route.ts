import { NextRequest, NextResponse } from "next/server";
import { loginUser, AuthError } from "@/lib/auth/service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const usernameOrEmail = body.usernameOrEmail || body.email || body.username;
    const password = body.password;

    const result = await loginUser({
      usernameOrEmail,
      password,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: result.user,
        token: result.token,
      },
      { status: 200 }
    );

    response.headers.set("Set-Cookie", result.cookie);
    return response;
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Failed to login" },
      { status: 500 }
    );
  }
}
