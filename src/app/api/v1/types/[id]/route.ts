import { NextRequest, NextResponse } from "next/server";
import { getTypeById, deleteCustomType } from "@/lib/types/service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const type = await getTypeById(id);

    if (!type) {
      return NextResponse.json({ error: "Type not found" }, { status: 404 });
    }

    return NextResponse.json({ type });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateDefaultUser();

    const success = await deleteCustomType(id, user.id);
    if (!success) {
      return NextResponse.json({ error: "Type not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Type deleted successfully" });
  } catch (error: any) {
    if (error.message === "CANNOT_DELETE_CANONICAL_TYPE") {
      return NextResponse.json(
        { error: "Cannot delete canonical root archetype" },
        { status: 403 }
      );
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
