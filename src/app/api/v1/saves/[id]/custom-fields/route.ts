import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateSaveCustomAttributes } from "@/lib/curio-learns/attributes";
import { db, userSaves, globalEntities } from "@/db";
import { eq } from "drizzle-orm";

const updateCustomFieldsSchema = z.object({
  customValues: z.record(z.string(), z.unknown()),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: saveId } = await params;
    const body = await req.json();
    const parsed = updateCustomFieldsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error },
        { status: 400 }
      );
    }

    const result = await updateSaveCustomAttributes(saveId, parsed.data.customValues);

    return NextResponse.json({
      success: true,
      save: result.save,
      promotedAttributes: result.promotedAttributes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: saveId } = await params;
    const [save] = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.id, saveId))
      .limit(1);

    if (!save) {
      return NextResponse.json({ error: "Save not found" }, { status: 404 });
    }

    return NextResponse.json({
      userCustomValues: save.save.userCustomValues || {},
      extendedAttributes: save.entity?.extendedAttributes || {},
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
