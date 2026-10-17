import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSaveDetails, updateSaveDetails, deleteSave } from "@/lib/saves/service";

const updateSaveSchema = z.object({
  privateTitle: z.string().optional().nullable(),
  personalNotes: z.string().optional().nullable(),
  typePath: z.string().optional().nullable(),
  userCustomValues: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: saveId } = await params;
    const details = await getSaveDetails(saveId);

    if (!details) {
      return NextResponse.json({ error: "Save not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...details });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: saveId } = await params;
    const body = await req.json();
    const parsed = updateSaveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const updated = await updateSaveDetails(saveId, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Save not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...updated });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: saveId } = await params;
    const deleted = await deleteSave(saveId);

    if (!deleted) {
      return NextResponse.json({ error: "Save not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
