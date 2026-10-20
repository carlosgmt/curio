import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDefaultUser, executeIngestionCascade } from "@/lib/ingest/cascade";
import { db, userSaves } from "@/db";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateDefaultUser();
    const contentType = req.headers.get("content-type") || "";

    let input = "";
    let uploadedImageUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const title = (formData.get("title") as string) || "";
      const text = (formData.get("text") as string) || "";
      const url = (formData.get("url") as string) || "";
      const imageFile = formData.get("image") as File | null;

      // Handle image upload if present
      if (imageFile && typeof imageFile === "object" && imageFile.size > 0) {
        try {
          const uploadsDir = join(process.cwd(), "public", "uploads");
          await mkdir(uploadsDir, { recursive: true });
          const filename = `share-${Date.now()}-${imageFile.name || "image.jpg"}`.replace(/[^a-zA-Z0-9_.-]/g, "_");
          const bytes = await imageFile.arrayBuffer();
          await writeFile(join(uploadsDir, filename), Buffer.from(bytes));
          uploadedImageUrl = `/uploads/${filename}`;
        } catch {
          // If filesystem write fails, fallback gracefully
        }
      }

      // Priority: URL > Text > Title
      input = url || text || title || (uploadedImageUrl ? "Shared Image" : "Shared Item");
    } else {
      const body = await req.json().catch(() => ({}));
      input = body.url || body.text || body.title || "";
    }

    if (input.trim()) {
      const res = await executeIngestionCascade({ input: input.trim(), userId: user.id });
      // If an image was uploaded and save was created, attach hero image
      if (uploadedImageUrl && res.save) {
        await db.update(userSaves)
          .set({ personalNotes: res.save.personalNotes ? `${res.save.personalNotes}\nImage: ${uploadedImageUrl}` : `Image: ${uploadedImageUrl}` })
          .where(eq(userSaves.id, res.save.id))
          .catch(() => {});
      }
    }

    // PRD & NFR requirement: Always return HTTP 303 See Other redirect to /?shared=success
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/?shared=success",
      },
    });
  } catch (err: any) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/?shared=error&msg=${encodeURIComponent(err.message)}`,
      },
    });
  }
}
