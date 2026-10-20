import { NextRequest, NextResponse } from "next/server";
import { ZipArchive } from "archiver";
import { db, users, userSaves, globalEntities, smartLists, listItems } from "@/db";
import { eq } from "drizzle-orm";
import { getOptionalAuth } from "@/lib/auth/service";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";
import { generateListJsonLd } from "@/lib/federation/jsonld";

async function createArchiveBuffer(
  buildFn: (archive: ZipArchive) => Promise<void> | void
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", (err) => reject(err));

    Promise.resolve(buildFn(archive))
      .then(() => archive.finalize())
      .catch(reject);
  });
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "item";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "zip";
    const boardId = searchParams.get("boardId") || searchParams.get("listId");

    // 1. Resolve User
    const auth = await getOptionalAuth(req);
    let user = auth?.user;
    if (!user) {
      try {
        user = await getOrCreateDefaultUser();
      } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 2. Fetch User Saves & Entities
    const saves = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.userId, user.id));

    // Fetch Lists
    const lists = await db
      .select()
      .from(smartLists)
      .where(eq(smartLists.userId, user.id));

    // --- FORMAT: JSON-LD ---
    if (format === "jsonld") {
      if (boardId) {
        const board = lists.find((l) => l.id === boardId || l.slug === boardId);
        if (!board) {
          return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }
        const jsonLd = generateListJsonLd(
          board,
          saves.map((s) => ({
            save: s.save,
            entity: s.entity,
          })),
          user,
          "https://curio.app"
        );
        return new NextResponse(JSON.stringify(jsonLd, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/ld+json; charset=utf-8",
            "Content-Disposition": `attachment; filename="${board.slug}-jsonld.json"`,
          },
        });
      }

      // Export all saves as Schema.org ItemList
      const allJsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${user.displayName || user.username}'s Curio Vitrine`,
        numberOfItems: saves.length,
        itemListElement: saves.map((s, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          item: {
            "@type": "Thing",
            name: s.entity?.title || s.save.privateTitle || "Curated Item",
            description: s.entity?.summary || s.save.personalNotes || "",
            url: s.entity?.canonicalUrl,
            image: s.entity?.heroImageUrl,
          },
        })),
      };

      return new NextResponse(JSON.stringify(allJsonLd, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/ld+json; charset=utf-8",
          "Content-Disposition": `attachment; filename="curio-export-jsonld.json"`,
        },
      });
    }

    // --- FORMAT: MARKDOWN (ZIP) ---
    if (format === "markdown") {
      const buffer = await createArchiveBuffer(async (archive) => {
        for (const item of saves) {
          const title = item.entity?.title || item.save.privateTitle || "Untitled Item";
          const filename = `${sanitizeFilename(title)}-${item.save.id.slice(0, 8)}.md`;
          const tags = Array.isArray(item.save.autoTags) ? item.save.autoTags : [];

          const frontmatter = [
            "---",
            `title: ${JSON.stringify(title)}`,
            `curator: ${JSON.stringify(user.username)}`,
            `coreType: ${JSON.stringify(item.entity?.coreType || "MEMO")}`,
            `typePath: ${JSON.stringify(item.save.typePath || item.entity?.typePath || "")}`,
            `canonicalUrl: ${JSON.stringify(item.entity?.canonicalUrl || "")}`,
            `tags: ${JSON.stringify(tags)}`,
            `createdAt: ${JSON.stringify(item.save.createdAt)}`,
            "---",
            "",
            `# ${title}`,
            "",
            item.entity?.summary ? `> ${item.entity.summary}\n` : "",
            item.save.personalNotes ? `\n## Curator Notes\n\n${item.save.personalNotes}\n` : "",
          ].join("\n");

          archive.append(frontmatter, { name: filename });
        }
      });

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="curio-markdown-export.zip"',
        },
      });
    }

    // --- FORMAT: FULL SYMMETRIC ZIP BACKUP ---
    const backupBuffer = await createArchiveBuffer(async (archive) => {
      const manifest = {
        version: "3.2",
        exportedAt: new Date().toISOString(),
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
        },
        saveCount: saves.length,
        boardCount: lists.length,
        boards: lists.map((l) => ({ id: l.id, title: l.title, slug: l.slug })),
      };

      archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
      archive.append(JSON.stringify(saves, null, 2), { name: "data/saves.json" });
      archive.append(JSON.stringify(lists, null, 2), { name: "data/boards.json" });

      // Add Markdown notes directory
      for (const item of saves) {
        const title = item.entity?.title || item.save.privateTitle || "Untitled Item";
        const filename = `notes/${sanitizeFilename(title)}-${item.save.id.slice(0, 8)}.md`;
        const tags = Array.isArray(item.save.autoTags) ? item.save.autoTags : [];

        const mdContent = [
          "---",
          `title: ${JSON.stringify(title)}`,
          `canonicalUrl: ${JSON.stringify(item.entity?.canonicalUrl || "")}`,
          `tags: ${JSON.stringify(tags)}`,
          `createdAt: ${JSON.stringify(item.save.createdAt)}`,
          "---",
          "",
          `# ${title}`,
          "",
          item.save.personalNotes || item.entity?.summary || "No notes provided.",
        ].join("\n");

        archive.append(mdContent, { name: filename });
      }
    });

    return new NextResponse(new Uint8Array(backupBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="curio-backup-${new Date().toISOString().slice(0, 10)}.zip"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process data export" },
      { status: 500 }
    );
  }
}
