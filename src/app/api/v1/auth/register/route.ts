import { NextRequest, NextResponse } from "next/server";
import { registerUser, AuthError } from "@/lib/auth/service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, username, displayName, password } = body;

    const result = await registerUser({
      email,
      username,
      displayName,
      password,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: result.user,
        token: result.token,
      },
      { status: 201 }
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
      { success: false, error: error.message || "Failed to register" },
      { status: 500 }
    );
  }
}
