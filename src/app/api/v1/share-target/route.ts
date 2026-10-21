import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateDefaultUser,
  executeIngestionCascade,
  generateEntityKey,
} from "@/lib/ingest/cascade";
import { getOptionalAuth } from "@/lib/auth/service";
import { db, userSaves, globalEntities } from "@/db";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * Extracts the first http/https URL from a shared text string, returning both the URL
 * and any surrounding commentary as personal notes.
 */
function extractUrlAndNotesFromSharedText(rawText: string): {
  extractedUrl: string | null;
  surroundingNotes: string | null;
} {
  const trimmed = rawText.trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s<>"]+/i);
  if (!urlMatch) {
    return { extractedUrl: null, surroundingNotes: null };
  }
  const extractedUrl = urlMatch[0].replace(/[.,;!?)]+$/, "");
  const remaining = trimmed.replace(urlMatch[0], "").replace(/\s+/g, " ").trim();
  return {
    extractedUrl,
    surroundingNotes: remaining.length > 0 ? remaining : null,
  };
}

export async function POST(req: NextRequest) {
  const wantsJson =
    req.headers.get("accept")?.includes("application/json") ||
    req.headers.get("x-requested-with") === "Omnibox";
  const hasBasePath = req.url.includes("/curio/");
  const redirectPrefix = hasBasePath ? "/curio" : "";

  try {
    const auth = await getOptionalAuth(req);
    const user = auth?.user ?? (await getOrCreateDefaultUser());
    const contentType = req.headers.get("content-type") || "";

    let title = "";
    let text = "";
    let url = "";
    let uploadedImageUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      title = ((formData.get("title") as string) || "").trim();
      text = ((formData.get("text") as string) || "").trim();
      url = ((formData.get("url") as string) || "").trim();
      const imageFile = (formData.get("image") || formData.get("file")) as File | null;

      // Handle persistent image upload into MEDIA_PATH (/data/media in Docker)
      if (imageFile && typeof imageFile === "object" && imageFile.size > 0) {
        try {
          const mediaDir = process.env.MEDIA_PATH || join(process.cwd(), "data", "media");
          await mkdir(mediaDir, { recursive: true });
          const safeName = (imageFile.name || "image.jpg").replace(/[^a-zA-Z0-9_.-]/g, "_");
          const filename = `share-${Date.now()}-${safeName}`;
          const bytes = await imageFile.arrayBuffer();
          await writeFile(join(mediaDir, filename), Buffer.from(bytes));
          uploadedImageUrl = `/curio/api/v1/media/${filename}`;
        } catch {
          // Non-fatal fallback
        }
      }
    } else {
      const body = await req.json().catch(() => ({}));
      title = (body.title || "").trim();
      text = (body.text || "").trim();
      url = (body.url || "").trim();
    }

    // If URL field wasn't explicitly set, check if shared text embeds a URL (standard iOS/Android behavior)
    let surroundingNotes: string | null = null;
    if (!url && text) {
      const extracted = extractUrlAndNotesFromSharedText(text);
      if (extracted.extractedUrl) {
        url = extracted.extractedUrl;
        surroundingNotes = extracted.surroundingNotes || (title ? title : null);
      }
    } else if (url && text && text !== url) {
      surroundingNotes = text;
    }

    // Pure image share / clipboard image paste -> create a first-class /media/image PhotoCard
    if (uploadedImageUrl && !url && (!text || text === "Pasted Image" || text === "Shared Image")) {
      const photoTitle =
        title && title !== "Pasted Image" && title !== "Shared Image"
          ? title
          : title || "Captured Photograph";
      const canonicalUrl = `https://curio.local${uploadedImageUrl}`;
      const { urlHash, entityKey } = generateEntityKey(canonicalUrl, photoTitle);

      const [photoEntity] = await db
        .insert(globalEntities)
        .values({
          urlHash,
          entityKey,
          canonicalUrl,
          coreType: "MEDIA",
          typePath: "/media/image",
          title: photoTitle,
          summary: surroundingNotes || "Captured visual inspiration",
          heroImageUrl: uploadedImageUrl,
          brandOrCreator: `@${user.username}`,
          coreStructuredData: {
            title: photoTitle,
            imageUrl: uploadedImageUrl,
            photographer: `@${user.username}`,
            capturedAt: new Date().toISOString(),
          },
          extendedAttributes: {},
        })
        .returning();

      const [photoSave] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: photoEntity.id,
          typePath: "/media/image",
          isPrivateMemo: false,
          personalNotes: surroundingNotes || null,
          userCustomValues: {},
          candidateFallbacks: [],
          autoTags: ["photo", "image"],
          enrichmentStatus: "ENRICHED",
          visibility: "PRIVATE",
        })
        .returning();

      if (wantsJson) {
        return NextResponse.json(
          {
            status: "created",
            is_private_memo: false,
            entity_id: photoEntity.id,
            save: photoSave,
            entity: photoEntity,
            candidate_fallbacks: [],
          },
          { status: 201 }
        );
      }

      return new Response(null, {
        status: 303,
        headers: {
          Location: `${redirectPrefix}/?shared=success`,
        },
      });
    }

    const input = url || text || title || (uploadedImageUrl ? "Shared Image" : "Shared Item");

    if (input.trim()) {
      const res = await executeIngestionCascade({
        input: input.trim(),
        userId: user.id,
        skipLocalLlm: true,
      });

      if (res.save) {
        const mergedNotes = [res.save.personalNotes, surroundingNotes]
          .filter(Boolean)
          .join("\n")
          .trim();

        if (mergedNotes && mergedNotes !== res.save.personalNotes) {
          await db
            .update(userSaves)
            .set({ personalNotes: mergedNotes })
            .where(eq(userSaves.id, res.save.id))
            .catch(() => {});
          res.save.personalNotes = mergedNotes;
        }

        if (uploadedImageUrl && res.entity && !res.entity.heroImageUrl) {
          await db
            .update(globalEntities)
            .set({ heroImageUrl: uploadedImageUrl })
            .where(eq(globalEntities.id, res.entity.id))
            .catch(() => {});
          res.entity.heroImageUrl = uploadedImageUrl;
        }
      }

      if (wantsJson) {
        return NextResponse.json(res, { status: 201 });
      }
    }

    return new Response(null, {
      status: 303,
      headers: {
        Location: `${redirectPrefix}/?shared=success`,
      },
    });
  } catch (err: any) {
    if (wantsJson) {
      return NextResponse.json({ error: err.message || "Share target error" }, { status: 500 });
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: `${redirectPrefix}/?shared=error&msg=${encodeURIComponent(err.message)}`,
      },
    });
  }
}
