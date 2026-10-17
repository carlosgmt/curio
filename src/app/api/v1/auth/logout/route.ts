import { NextRequest, NextResponse } from "next/server";
import { logoutUser } from "@/lib/auth/service";

export async function POST(req: NextRequest) {
  try {
    const { success, clearCookie } = await logoutUser(req);

    const response = NextResponse.json({ success: true }, { status: 200 });
    response.headers.set("Set-Cookie", clearCookie);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to logout" },
      { status: 500 }
    );
  }
}
