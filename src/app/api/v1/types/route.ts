import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listAllTypes, registerCustomType } from "@/lib/types/service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

const createTypeSchema = z.object({
  name: z.string().min(1, "Type name is required"),
  parentTypePath: z.string().min(1, "Parent type path is required"),
  fields: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        type: z.enum(["string", "number", "boolean", "select"]),
        options: z.array(z.string()).optional(),
      })
    )
    .default([]),
  rootArchetype: z.string().optional(),
  defaultSilhouette: z.string().optional(),
  extractionPrompt: z.string().optional(),
});

export async function GET() {
  try {
    const user = await getOrCreateDefaultUser();
    const types = await listAllTypes(user.id);
    return NextResponse.json({ types });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateDefaultUser();
    const body = await req.json();
    const parsed = createTypeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error },
        { status: 400 }
      );
    }

    const createdType = await registerCustomType(user.id, parsed.data);
    return NextResponse.json({ success: true, type: createdType }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
