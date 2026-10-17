import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserLists, createList, toggleSaveInLists } from "@/lib/lists/service";
import { requireAuth, AuthError } from "@/lib/auth/service";

const createListSchema = z.object({
  title: z.string().min(1, "List title cannot be empty"),
  slug: z.string().optional(),
  description: z.string().optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
  autoRules: z
    .object({
      coreType: z.string().optional(),
      tagsInclude: z.array(z.string()).optional(),
      maxPriceCents: z.number().optional(),
    })
    .optional(),
});

const syncListsSchema = z.object({
  saveId: z.string().min(1),
  listIds: z.array(z.string()),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const lists = await getUserLists(user.id);

    return NextResponse.json({ lists });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();
    const parsed = createListSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error },
        { status: 400 }
      );
    }

    const list = await createList(user.id, parsed.data);

    return NextResponse.json({ success: true, list }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();
    const parsed = syncListsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error },
        { status: 400 }
      );
    }

    const result = await toggleSaveInLists(parsed.data.saveId, parsed.data.listIds, user.id);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
