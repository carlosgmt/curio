import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeIngestionCascade } from "@/lib/ingest/cascade";
import { db, userSaves, globalEntities } from "@/db";
import { desc, eq, and, or, lt, count } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { classifyOmniboxIntent } from "@/lib/router/intent";

const captureSchema = z.object({
  input: z.string().min(1, "Capture input cannot be empty"),
  userId: z.string().uuid().optional(),
  customSchemaId: z.string().optional(),
  preview: z.boolean().optional(),
  skipLocalLlm: z.boolean().optional(),
  forceNew: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();
    const parsed = captureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid capture payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const isPreview =
      parsed.data.preview === true ||
      req.nextUrl.searchParams.get("preview") === "true";

    if (isPreview) {
      const intentResult = await classifyOmniboxIntent(parsed.data.input, user.id, {
        skipLocalLlm: true,
      });
      return NextResponse.json(
        {
          preview: true,
          ...intentResult,
        },
        { status: 200 }
      );
    }

    const result = await executeIngestionCascade({
      input: parsed.data.input,
      userId: user.id,
      customSchemaId: parsed.data.customSchemaId,
      skipLocalLlm: parsed.data.skipLocalLlm ?? true,
      forceNew: parsed.data.forceNew,
    });

    if (result.status === "edited") {
      return NextResponse.json(
        {
          status: "edited",
          action: "edited",
          is_private_memo: result.is_private_memo,
          entity_id: result.entity_id,
          save: result.save,
          entity: result.entity,
          candidate_fallbacks: result.candidate_fallbacks ?? [],
          editDetails: result.editDetails,
        },
        { status: 200 }
      );
    }

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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Capture failed:", error);
    return NextResponse.json(
      { error: "Capture ingestion failed", message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const url = new URL(req.url);

    // Support non-mutating preview queries via GET /api/v1/capture?q=... or ?preview=true&q=...
    const previewQuery = url.searchParams.get("q") || url.searchParams.get("input");
    if (previewQuery) {
      const intentResult = await classifyOmniboxIntent(previewQuery, user.id, {
        skipLocalLlm: true,
      });
      return NextResponse.json(intentResult, { status: 200 });
    }

    const cursor = url.searchParams.get("cursor");
    const rawLimit = parseInt(url.searchParams.get("limit") || "50", 10);
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100));

    // Get total count of saves for the authenticated user
    const [countResult] = await db
      .select({ total: count() })
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    const totalCount = countResult?.total ?? 0;

    let cursorFilter = eq(userSaves.userId, user.id);

    if (cursor) {
      const [cursorSave] = await db
        .select({
          id: userSaves.id,
          createdAt: userSaves.createdAt,
        })
        .from(userSaves)
        .where(and(eq(userSaves.id, cursor), eq(userSaves.userId, user.id)))
        .limit(1);

      if (cursorSave) {
        cursorFilter = and(
          eq(userSaves.userId, user.id),
          or(
            lt(userSaves.createdAt, cursorSave.createdAt),
            and(
              eq(userSaves.createdAt, cursorSave.createdAt),
              lt(userSaves.id, cursorSave.id)
            )
          )
        )!;
      }
    }

    const rows = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(cursorFilter)
      .orderBy(desc(userSaves.createdAt), desc(userSaves.id))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      rows.pop();
      nextCursor = rows[rows.length - 1].save.id;
    }

    return NextResponse.json({
      saves: rows,
      nextCursor,
      totalCount,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
