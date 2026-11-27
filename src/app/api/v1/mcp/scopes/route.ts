import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { getUserMcpScopes, MCP_DOMAIN_DEFS, setUserMcpScopes } from "@/lib/mcp/scopes";

const updateSchema = z.object({
  scopes: z.record(z.string(), z.boolean()),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const { scopes, isConfigured } = getUserMcpScopes(user.id);
    return NextResponse.json({
      success: true,
      scopes,
      isConfigured,
      domains: MCP_DOMAIN_DEFS,
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

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid scopes payload" },
        { status: 400 }
      );
    }
    const scopes = setUserMcpScopes(user.id, parsed.data.scopes);
    return NextResponse.json({
      success: true,
      scopes,
      isConfigured: true,
      domains: MCP_DOMAIN_DEFS,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update MCP scopes" },
      { status: 500 }
    );
  }
}
