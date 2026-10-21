import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename: rawFilename } = await params;
    const cleanFilename = rawFilename.replace(/[^a-zA-Z0-9_.-]/g, "");
    if (!cleanFilename || cleanFilename.includes("..")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const mediaDir = process.env.MEDIA_PATH || join(process.cwd(), "data", "media");
    const legacyDir = join(process.cwd(), "public", "uploads");

    let filePath = join(mediaDir, cleanFilename);
    try {
      await stat(filePath);
    } catch {
      filePath = join(legacyDir, cleanFilename);
      await stat(filePath);
    }

    const bytes = await readFile(filePath);
    const extMatch = cleanFilename.toLowerCase().match(/\.[a-z0-9]+$/);
    const contentType = (extMatch && MIME_BY_EXT[extMatch[0]]) || "image/jpeg";

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Media file not found" }, { status: 404 });
  }
}
