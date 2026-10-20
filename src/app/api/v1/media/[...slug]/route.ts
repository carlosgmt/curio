import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    if (!slug || slug.length === 0) {
      return NextResponse.json({ error: "Missing media slug" }, { status: 400 });
    }

    const baseMediaDir = process.env.MEDIA_PATH
      ? path.resolve(process.env.MEDIA_PATH)
      : fs.existsSync("/data/media")
        ? "/data/media"
        : path.resolve("/Users/carlosgmt/dockermounts/curio/media");

    const sanitizedSlug = slug.map((seg) => path.basename(seg));
    const targetPath = path.resolve(baseMediaDir, ...sanitizedSlug);

    // Guard against directory traversal
    if (!targetPath.startsWith(baseMediaDir)) {
      return NextResponse.json({ error: "Forbidden: Path traversal" }, { status: 403 });
    }

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const stat = await fs.promises.stat(targetPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    const nodeStream = fs.createReadStream(targetPath);
    // Convert Node ReadStream to web ReadableStream
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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("Media route error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}
