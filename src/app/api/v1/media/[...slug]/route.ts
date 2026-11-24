import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, globalEntities, listItems, smartLists, users, userSaves, type GlobalEntity } from "@/db";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { matchesAutoRules } from "@/lib/lists/service";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".json": "application/json",
};

const CLOSET_BUCKETS = new Set(["garments", "cutouts", "outfits", "covers"]);

function resolveBaseMediaDir(): string {
  if (process.env.MEDIA_PATH) {
    return path.resolve(process.env.MEDIA_PATH);
  }
  if (fs.existsSync("/data/media")) {
    return "/data/media";
  }
  const localDevMedia = path.resolve(process.cwd(), "data", "media");
  if (process.env.NODE_ENV === "test") {
    return localDevMedia;
  }
  if (fs.existsSync("/Users/carlosgmt/dockermounts/curio/media")) {
    return path.resolve("/Users/carlosgmt/dockermounts/curio/media");
  }
  return localDevMedia;
}

function normalizeCandidatePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return null;
    }
  }
  const noHash = trimmed.split("#")[0] || "";
  const noQuery = noHash.split("?")[0] || "";
  return noQuery || null;
}

function valueContainsMediaUrl(
  val: unknown,
  candidatePaths: Set<string>,
  depth = 0
): boolean {
  if (depth > 6 || val === null || val === undefined) return false;
  if (typeof val === "string") {
    const norm = normalizeCandidatePath(val);
    if (!norm) return false;
    if (candidatePaths.has(norm)) return true;
    try {
      const decoded = decodeURIComponent(norm);
      if (candidatePaths.has(decoded)) return true;
    } catch {
      // Ignore malformed URI sequences
    }
    return false;
  }
  if (Array.isArray(val)) {
    return val.some((item) => valueContainsMediaUrl(item, candidatePaths, depth + 1));
  }
  if (typeof val === "object") {
    return Object.values(val as Record<string, unknown>).some((v) =>
      valueContainsMediaUrl(v, candidatePaths, depth + 1)
    );
  }
  return false;
}

function entityReferencesMedia(
  entity: GlobalEntity,
  candidatePaths: Set<string>
): boolean {
  if (entity.heroImageUrl && valueContainsMediaUrl(entity.heroImageUrl, candidatePaths)) {
    return true;
  }
  if (entity.coreStructuredData && valueContainsMediaUrl(entity.coreStructuredData, candidatePaths)) {
    return true;
  }
  if (entity.extendedAttributes && valueContainsMediaUrl(entity.extendedAttributes, candidatePaths)) {
    return true;
  }
  return false;
}

async function isPublicBoardMediaAllowed(sanitizedSlug: string[]): Promise<boolean> {
  const rawRel = sanitizedSlug.join("/");
  const encodedRel = sanitizedSlug.map((s) => encodeURIComponent(s)).join("/");
  const candidatePaths = new Set<string>([
    `/curio/api/v1/media/${rawRel}`,
    `/api/v1/media/${rawRel}`,
    `/curio/api/v1/media/${encodedRel}`,
    `/api/v1/media/${encodedRel}`,
    ...(sanitizedSlug.length === 1
      ? [
          `/uploads/${rawRel}`,
          `/curio/uploads/${rawRel}`,
          `/uploads/${encodedRel}`,
          `/curio/uploads/${encodedRel}`,
        ]
      : []),
  ]);

  const leafName = sanitizedSlug[sanitizedSlug.length - 1];
  const encodedLeaf = encodeURIComponent(leafName);
  const rawPattern = `%${leafName}%`;
  const encodedPattern = `%${encodedLeaf}%`;

  // 0. Public curator avatar on a non-paywalled PUBLIC/UNLISTED board or PUBLIC/UNLISTED save
  const candidateUsers = await db
    .select({ id: users.id, avatarUrl: users.avatarUrl })
    .from(users)
    .where(
      sql`(
        coalesce(${users.avatarUrl}, '') LIKE ${rawPattern}
        OR coalesce(${users.avatarUrl}, '') LIKE ${encodedPattern}
      )`
    );
  const matchedUserIds = candidateUsers
    .filter((u) => u.avatarUrl && valueContainsMediaUrl(u.avatarUrl, candidatePaths))
    .map((u) => u.id);

  if (matchedUserIds.length > 0) {
    const [publicBoard] = await db
      .select({ id: smartLists.id })
      .from(smartLists)
      .where(
        and(
          inArray(smartLists.userId, matchedUserIds),
          inArray(smartLists.visibility, ["PUBLIC", "UNLISTED"]),
          eq(smartLists.isPaywalled, false)
        )
      )
      .limit(1);
    if (publicBoard) {
      return true;
    }

    const [publicSave] = await db
      .select({ id: userSaves.id })
      .from(userSaves)
      .where(
        and(
          inArray(userSaves.userId, matchedUserIds),
          eq(userSaves.isPrivateMemo, false),
          inArray(userSaves.visibility, ["PUBLIC", "UNLISTED"])
        )
      )
      .limit(1);
    if (publicSave) {
      return true;
    }
  }

  const candidateEntities = await db
    .select()
    .from(globalEntities)
    .where(
      sql`(
        coalesce(${globalEntities.heroImageUrl}, '') LIKE ${rawPattern}
        OR coalesce(${globalEntities.heroImageUrl}, '') LIKE ${encodedPattern}
        OR coalesce(${globalEntities.coreStructuredData}, '') LIKE ${rawPattern}
        OR coalesce(${globalEntities.coreStructuredData}, '') LIKE ${encodedPattern}
        OR coalesce(${globalEntities.extendedAttributes}, '') LIKE ${rawPattern}
        OR coalesce(${globalEntities.extendedAttributes}, '') LIKE ${encodedPattern}
      )`
    );

  const matchedEntities = candidateEntities.filter((ent) =>
    entityReferencesMedia(ent, candidatePaths)
  );
  if (matchedEntities.length === 0) {
    return false;
  }

  const entityMap = new Map(matchedEntities.map((ent) => [ent.id, ent]));
  const matchedEntityIds = Array.from(entityMap.keys());

  const linkedSaves = await db
    .select()
    .from(userSaves)
    .where(
      and(
        eq(userSaves.isPrivateMemo, false),
        inArray(userSaves.entityId, matchedEntityIds)
      )
    );

  if (linkedSaves.length === 0) {
    return false;
  }

  // 1. Standalone public/unlisted non-memo saves (/card/[id])
  if (
    linkedSaves.some(
      (s) => s.visibility === "PUBLIC" || s.visibility === "UNLISTED"
    )
  ) {
    return true;
  }

  const linkedSaveIds = linkedSaves.map((s) => s.id);

  // 2. Manual membership on a PUBLIC or UNLISTED non-paywalled board
  const manualPublicMembership = await db
    .select({ listItemId: listItems.id })
    .from(listItems)
    .innerJoin(smartLists, eq(listItems.listId, smartLists.id))
    .where(
      and(
        inArray(listItems.saveId, linkedSaveIds),
        inArray(smartLists.visibility, ["PUBLIC", "UNLISTED"]),
        eq(smartLists.isPaywalled, false)
      )
    )
    .limit(1);

  if (manualPublicMembership.length > 0) {
    return true;
  }

  // 3. Dynamic autoRules membership on a PUBLIC or UNLISTED non-paywalled board
  const ownerIds = Array.from(new Set(linkedSaves.map((s) => s.userId)));
  const publicOwnerBoards = await db
    .select()
    .from(smartLists)
    .where(
      and(
        inArray(smartLists.userId, ownerIds),
        inArray(smartLists.visibility, ["PUBLIC", "UNLISTED"]),
        eq(smartLists.isPaywalled, false)
      )
    );

  for (const board of publicOwnerBoards) {
    if (!board.autoRules && board.slug !== "films" && board.slug !== "music") {
      continue;
    }
    for (const save of linkedSaves) {
      if (save.userId !== board.userId) continue;
      const entity = save.entityId ? entityMap.get(save.entityId) ?? null : null;
      if (matchesAutoRules(board.autoRules, { save, entity }, board.slug)) {
        return true;
      }
    }
  }

  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    if (!slug || slug.length === 0) {
      return NextResponse.json({ error: "Missing media slug" }, { status: 400 });
    }

    const baseMediaDir = resolveBaseMediaDir();
    const sanitizedSlug = slug.map((seg) => {
      try {
        return path.basename(decodeURIComponent(seg));
      } catch {
        return path.basename(seg);
      }
    });
    if (sanitizedSlug.some((seg) => !seg || seg === "." || seg === "..")) {
      return NextResponse.json({ error: "Invalid media path" }, { status: 400 });
    }

    let targetPath = path.resolve(baseMediaDir, ...sanitizedSlug);

    // Guard against directory traversal
    if (!targetPath.startsWith(baseMediaDir + path.sep) && targetPath !== baseMediaDir) {
      return NextResponse.json({ error: "Forbidden: Path traversal" }, { status: 403 });
    }

    let isPublicFallback = false;
    try {
      await requireAuth(req);
    } catch (authErr) {
      if (authErr instanceof AuthError) {
        const allowed = await isPublicBoardMediaAllowed(sanitizedSlug);
        if (!allowed) {
          throw authErr;
        }
        isPublicFallback = true;
      } else {
        throw authErr;
      }
    }
    const cacheControl = isPublicFallback ? "private, max-age=300" : "private, max-age=86400";

    // Read-through cache & proxy for Closet UI media (/api/v1/media/closet/<bucket>/<filename>)
    if (
      !fs.existsSync(/*turbopackIgnore: true*/ targetPath) &&
      sanitizedSlug.length === 3 &&
      sanitizedSlug[0] === "closet" &&
      CLOSET_BUCKETS.has(sanitizedSlug[1])
    ) {
      const bucket = sanitizedSlug[1];
      const filename = sanitizedSlug[2];
      const closetApiBase = (process.env.CLOSET_API_URL || "http://127.0.0.1:8710").replace(/\/+$/, "");
      const upstreamUrl = `${closetApiBase}/api/media/${bucket}/${encodeURIComponent(filename)}`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const upstreamRes = await fetch(upstreamUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (upstreamRes.ok) {
          const bytes = Buffer.from(await upstreamRes.arrayBuffer());
          try {
            await fs.promises.mkdir(/*turbopackIgnore: true*/ path.dirname(targetPath), { recursive: true });
            await fs.promises.writeFile(/*turbopackIgnore: true*/ targetPath, bytes);
          } catch {
            // Non-fatal if media dir is read-only; serve directly from memory
            const ext = path.extname(filename).toLowerCase();
            return new NextResponse(bytes, {
              status: 200,
              headers: {
                "Content-Type": upstreamRes.headers.get("content-type") || MIME_MAP[ext] || "image/png",
                "Content-Length": bytes.length.toString(),
                "Cache-Control": cacheControl,
              },
            });
          }
        }
      } catch {
        // Closet service temporarily unreachable; fall through to 404 if uncached
      }
    }

    // Read-through cache & proxy for Purchase Hub media (/api/v1/media/purchase-hub/<filename>)
    if (
      !fs.existsSync(/*turbopackIgnore: true*/ targetPath) &&
      sanitizedSlug.length === 2 &&
      sanitizedSlug[0] === "purchase-hub"
    ) {
      const filename = sanitizedSlug[1];
      const hubApiBase = (process.env.PURCHASE_HUB_API_URL || "http://127.0.0.1:8760").replace(
        /\/+$/,
        ""
      );
      const upstreamUrl = `${hubApiBase}/api/images/${encodeURIComponent(filename)}`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const upstreamRes = await fetch(upstreamUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (upstreamRes.ok) {
          const bytes = Buffer.from(await upstreamRes.arrayBuffer());
          try {
            await fs.promises.mkdir(/*turbopackIgnore: true*/ path.dirname(targetPath), {
              recursive: true,
            });
            await fs.promises.writeFile(/*turbopackIgnore: true*/ targetPath, bytes);
          } catch {
            const ext = path.extname(filename).toLowerCase();
            return new NextResponse(bytes, {
              status: 200,
              headers: {
                "Content-Type":
                  upstreamRes.headers.get("content-type") || MIME_MAP[ext] || "image/jpeg",
                "Content-Length": bytes.length.toString(),
                "Cache-Control": cacheControl,
              },
            });
          }
        }
      } catch {
        // Purchase Hub temporarily unreachable; fall through to 404 if uncached
      }
    }

    // Legacy single-filename fallback to public/uploads
    if (!fs.existsSync(/*turbopackIgnore: true*/ targetPath) && sanitizedSlug.length === 1) {
      const legacyDir = path.join(process.cwd(), "public", "uploads");
      const legacyPath = path.resolve(legacyDir, sanitizedSlug[0]);
      if (legacyPath.startsWith(legacyDir + path.sep) && fs.existsSync(/*turbopackIgnore: true*/ legacyPath)) {
        targetPath = legacyPath;
      }
    }

    if (!fs.existsSync(/*turbopackIgnore: true*/ targetPath)) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const stat = await fs.promises.stat(/*turbopackIgnore: true*/ targetPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    const nodeStream = fs.createReadStream(/*turbopackIgnore: true*/ targetPath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": stat.size.toString(),
        "Cache-Control": cacheControl,
      },
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Media route error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}
