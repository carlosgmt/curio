import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createConnection, deleteConnection, getConnectedSaves, type ConnectionType } from "@/lib/connections/service";
import { requireAuth, AuthError } from "@/lib/auth/service";

const createConnectionSchema = z.object({
  sourceSaveId: z.string().min(1),
  targetSaveId: z.string().min(1),
  connectionType: z.enum(["PAIRED_WITH", "SOUNDTRACK_TO", "WORN_ON", "INSPIRED_BY", "CONSUMED_AT"]),
  contextNote: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();
    const parsed = createConnectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const connection = await createConnection({
      userId: user.id,
      sourceSaveId: parsed.data.sourceSaveId,
      targetSaveId: parsed.data.targetSaveId,
      connectionType: parsed.data.connectionType as ConnectionType,
      contextNote: parsed.data.contextNote,
    });

    return NextResponse.json({ success: true, connection }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const saveId = searchParams.get("saveId");

    if (!saveId) {
      return NextResponse.json({ error: "saveId query parameter is required" }, { status: 400 });
    }

    const connections = await getConnectedSaves(saveId);
    return NextResponse.json({ connections });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connectionId");

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId query parameter is required" }, { status: 400 });
    }

    const deleted = await deleteConnection(connectionId, user.id);
    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
