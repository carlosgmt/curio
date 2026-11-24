import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeIngestionCascade } from "@/lib/ingest/cascade";
import { db, userSaves, globalEntities } from "@/db";
import { desc, eq, and, or, lt, count, sql } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { classifyOmniboxIntent } from "@/lib/router/intent";
import { getConnectedSaves, getConnectedSavesMap } from "@/lib/connections/service";

const captureSchema = z.object({
  input: z.string().min(1, "Capture input cannot be empty"),
  userId: z.string().uuid().optional(),
  customSchemaId: z.string().optional(),
  curioTypeId: z.string().optional(),
  forcedTypePath: z.string().optional(),
  isPrivateMemo: z.boolean().optional(),
  listId: z.string().optional(),
  queryContext: z.string().optional(),
  boardContext: z
    .object({
      title: z.string().optional(),
      slug: z.string().optional(),
      coreType: z.string().optional(),
      typePathPrefix: z.string().optional(),
    })
    .optional(),
  targetCandidate: z
    .object({
      title: z.string(),
      subtitle: z.string().optional(),
      creator: z.string().nullable().optional(),
      year: z.number().nullable().optional(),
      conceptUri: z.string().nullable().optional(),
      typePath: z.string().optional(),
      badgeLabel: z.string().optional(),
      heroImageUrl: z.string().nullable().optional(),
      canonicalUrl: z.string().optional(),
      curioTypeId: z.string().nullable().optional(),
    })
    .optional(),
  preview: z.boolean().optional(),
  skipLocalLlm: z.boolean().optional(),
  forceNew: z.boolean().optional(),
  targetSaveId: z.string().optional(),
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
      customSchemaId: parsed.data.customSchemaId || parsed.data.curioTypeId,
      curioTypeId: parsed.data.curioTypeId,
      forcedTypePath: parsed.data.forcedTypePath,
      targetCandidate: parsed.data.targetCandidate,
      listId: parsed.data.listId,
      queryContext: parsed.data.queryContext,
      boardContext: parsed.data.boardContext,
      isPrivateMemo: parsed.data.isPrivateMemo,
      skipLocalLlm: parsed.data.skipLocalLlm ?? true,
      forceNew: parsed.data.forceNew,
      targetSaveId: parsed.data.targetSaveId,
    });

    const createdOrEditedConnections = result.save.isPrivateMemo
      ? []
      : await getConnectedSaves(result.save.id);

    if (result.status === "edited") {
      return NextResponse.json(
        {
          status: "edited",
          action: "edited",
          is_private_memo: result.is_private_memo,
          entity_id: result.entity_id,
          save: result.save,
          entity: result.entity,
          connections: createdOrEditedConnections,
          candidate_fallbacks: result.candidate_fallbacks ?? [],
          editDetails: result.editDetails,
          previousSave: result.previousSave,
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
        connections: createdOrEditedConnections,
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
    const wishlistOnly = url.searchParams.get("wishlist") === "true";
    const includeWearLogs =
      wishlistOnly ||
      url.searchParams.get("includeWearLogs") === "true" ||
      url.searchParams.get("excludeWearLogs") === "false";
    const excludeCloset =
      !wishlistOnly && url.searchParams.get("excludeCloset") === "true";
    const excludeMyStuff =
      !wishlistOnly && url.searchParams.get("excludeMyStuff") === "true";
    const rawLimit = parseInt(url.searchParams.get("limit") || "50", 10);
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100));

    // SQL-NULL-safe predicate for daily /style/outfit wear-logs (preserves private memos & kind="idea" looks)
    const isWearLogExpr = sql<boolean>`(
      ${userSaves.isPrivateMemo} = 0
      AND lower(coalesce(${userSaves.typePath}, ${globalEntities.typePath}, '')) LIKE '/style/outfit%'
      AND lower(coalesce(
        CASE
          WHEN json_valid(${globalEntities.coreStructuredData})
          THEN json_extract(${globalEntities.coreStructuredData}, '$.kind')
          ELSE NULL
        END,
        'worn'
      )) != 'idea'
    )`;

    const isClosetGarmentExpr = sql<boolean>`(
      ${userSaves.isPrivateMemo} = 0
      AND lower(coalesce(${userSaves.typePath}, ${globalEntities.typePath}, '')) LIKE '/product/garment%'
    )`;

    const isMyStuffDurableExpr = sql<boolean>`(
      ${userSaves.isPrivateMemo} = 0
      AND coalesce(${globalEntities.canonicalExternalId}, '') LIKE 'purchase-hub:%'
      AND lower(coalesce(${userSaves.typePath}, ${globalEntities.typePath}, '')) NOT LIKE '/product/book%'
      AND lower(coalesce(${userSaves.typePath}, ${globalEntities.typePath}, '')) NOT LIKE '/media/%'
    )`;

    // Get vault total count, wishlist count, wear-log count, closet garment count, and my-stuff count
    const [vaultCountResult] = await db
      .select({ total: count() })
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    const vaultTotalCount = vaultCountResult?.total ?? 0;

    const [wishlistCountResult] = await db
      .select({ total: count() })
      .from(userSaves)
      .where(and(eq(userSaves.userId, user.id), eq(userSaves.wishlist, true)));
    const wishlistCount = wishlistCountResult?.total ?? 0;

    const [wearLogCountResult] = await db
      .select({ total: count() })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(and(eq(userSaves.userId, user.id), isWearLogExpr));
    const wearLogCount = wearLogCountResult?.total ?? 0;

    const [closetCountResult] = await db
      .select({ total: count() })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(and(eq(userSaves.userId, user.id), isClosetGarmentExpr));
    const closetCount = closetCountResult?.total ?? 0;

    const [myStuffCountResult] = await db
      .select({ total: count() })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(and(eq(userSaves.userId, user.id), isMyStuffDurableExpr));
    const myStuffCount = myStuffCountResult?.total ?? 0;

    const baseClauses: any[] = [eq(userSaves.userId, user.id)];
    if (wishlistOnly) {
      baseClauses.push(eq(userSaves.wishlist, true));
    } else {
      if (!includeWearLogs) {
        baseClauses.push(sql<boolean>`NOT (${isWearLogExpr})`);
      }
      if (excludeCloset) {
        baseClauses.push(sql<boolean>`NOT (${isClosetGarmentExpr})`);
      }
      if (excludeMyStuff) {
        baseClauses.push(sql<boolean>`NOT (${isMyStuffDurableExpr})`);
      }
    }
    const baseUserFilter = and(...baseClauses)!;

    const [filteredTotalResult] = await db
      .select({ total: count() })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(baseUserFilter);
    const totalCount = filteredTotalResult?.total ?? 0;

    let cursorFilter = baseUserFilter;

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
          baseUserFilter,
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

    const nonMemoIds = rows
      .filter((r) => !r.save.isPrivateMemo)
      .map((r) => r.save.id);
    const connectionsMap = await getConnectedSavesMap(nonMemoIds);
    const savesWithConnections = rows.map((r) => ({
      ...r,
      connections: r.save.isPrivateMemo ? [] : connectionsMap.get(r.save.id) ?? [],
    }));

    return NextResponse.json({
      saves: savesWithConnections,
      nextCursor,
      totalCount,
      vaultTotalCount,
      wishlistCount,
      wearLogCount,
      closetCount,
      myStuffCount,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
