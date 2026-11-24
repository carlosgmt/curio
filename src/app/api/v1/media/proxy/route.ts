import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, globalEntities, userSaves } from "@/db";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { safeFetch, type SafeFetchOptions } from "@/lib/network/safeFetch";

const ALLOWED_RASTER_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const MAX_PROXY_IMAGE_BYTES = 5 * 1024 * 1024;

async function isPublicEntityImageUrl(targetUrl: string): Promise<boolean> {
  const rows = await db
    .select({ id: globalEntities.id })
    .from(globalEntities)
    .innerJoin(userSaves, eq(userSaves.entityId, globalEntities.id))
    .where(
      and(
        eq(globalEntities.heroImageUrl, targetUrl),
        eq(userSaves.isPrivateMemo, false),
        inArray(userSaves.visibility, ["PUBLIC", "UNLISTED"])
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function handleMediaProxy(
  req: NextRequest,
  options?: SafeFetchOptions & { allowAnonymousPublicCheck?: boolean }
): Promise<Response> {
  const rawUrl = (req.nextUrl?.searchParams?.get("url") ?? new URL(req.url).searchParams.get("url") ?? "").trim();
  if (!rawUrl || rawUrl.length > 2048) {
    return NextResponse.json({ error: "Missing or overly long url parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Malformed URL" }, { status: 400 });
  }

  if (parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only HTTPS image URLs are allowed" }, { status: 400 });
  }

  if (parsed.username || parsed.password) {
    return NextResponse.json({ error: "Embedded URL credentials are not allowed" }, { status: 400 });
  }

  let isPublicFallback = false;
  try {
    await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      const allowedPublic =
        options?.allowAnonymousPublicCheck !== false && (await isPublicEntityImageUrl(rawUrl));
      if (!allowedPublic) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
      isPublicFallback = true;
    } else {
      throw err;
    }
  }

  try {
    const upstream = await safeFetch(rawUrl, {
      method: "GET",
      maxRedirects: 2,
      maxBytes: MAX_PROXY_IMAGE_BYTES,
      timeoutMs: options?.timeoutMs ?? 8000,
      allowedContentTypes: ALLOWED_RASTER_IMAGE_TYPES,
      fetchFn: options?.fetchFn,
      dnsLookup: options?.dnsLookup,
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream image returned status ${upstream.status}` },
        { status: upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502 }
      );
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get("content-type") || "image/jpeg";

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": bytes.length.toString(),
        "Cache-Control": isPublicFallback ? "private, max-age=300" : "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || "Image proxy failed");
    const isBlocked =
      msg.includes("SSRF Protection") ||
      msg.includes("blocked") ||
      msg.includes("Disallowed content-type");
    return NextResponse.json({ error: msg }, { status: isBlocked ? 403 : 502 });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  return handleMediaProxy(req);
}
