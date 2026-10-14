import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeIngestionCascade, getOrCreateDefaultUser } from "@/lib/ingest/cascade";
import { db, userSaves, globalEntities } from "@/db";
import { desc, eq } from "drizzle-orm";

const captureSchema = z.object({
  input: z.string().min(1, "Capture input cannot be empty"),
  userId: z.string().uuid().optional(),
  customSchemaId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = captureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid capture payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await executeIngestionCascade({
      input: parsed.data.input,
      userId: parsed.data.userId,
      customSchemaId: parsed.data.customSchemaId,
    });

    return NextResponse.json(
      {
        status: result.status,
        is_private_memo: result.is_private_memo,
        entity_id: result.entity_id,
        save: result.save,
        entity: result.entity,
        candidate_fallbacks: result.candidate_fallbacks ?? [],
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Capture failed:", error);
    return NextResponse.json(
      { error: "Capture ingestion failed", message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateDefaultUser();
    const saves = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.userId, user.id))
      .orderBy(desc(userSaves.createdAt))
      .limit(50);

    return NextResponse.json({ saves });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
