import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, userSaves } from "@/db";
import { eq } from "drizzle-orm";
import {
  CONNECTION_TYPES,
  createConnection,
  deleteConnection,
  getConnectedSaves,
  type ConnectionType,
} from "@/lib/connections/service";
import { requireAuth, AuthError } from "@/lib/auth/service";

const createConnectionSchema = z.object({
  sourceSaveId: z.string().min(1),
  targetSaveId: z.string().min(1),
  connectionType: z.enum(CONNECTION_TYPES),
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
    if (error.message?.startsWith("NOT_FOUND:")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message?.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message?.includes("Cannot connect")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const saveId = searchParams.get("saveId");

    if (!saveId) {
      return NextResponse.json({ error: "saveId query parameter is required" }, { status: 400 });
    }

    const [save] = await db
      .select({ userId: userSaves.userId })
      .from(userSaves)
      .where(eq(userSaves.id, saveId))
      .limit(1);

    if (!save) {
      return NextResponse.json({ error: "Save not found" }, { status: 404 });
    }
    if (save.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: Not your save" }, { status: 403 });
    }

    const connections = await getConnectedSaves(saveId);
    return NextResponse.json({ connections });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
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
