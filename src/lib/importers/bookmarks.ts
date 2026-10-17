import { extractOpenGraph } from "@/lib/enrichment/opengraph";

export interface ImportedBookmark {
  url: string;
  title: string;
  folderPath: string;
  folderStack: string[];
  tags: string[];
  addDate?: string;
  enrichmentStatus: "ENRICHED" | "LAZY_QUEUED" | "OPTIMISTIC";
  typePath: string;
  coreType: string;
  canonicalExternalId: string;
  heroImageUrl?: string;
  summary?: string;
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/**
 * Pure parser for standard Netscape Bookmark Format (Chrome, Safari, Firefox, Arc).
 * Traverses folder hierarchy and extracts titles, URLs, tags, and timestamps.
 */
export function parseBookmarksHTML(htmlContent: string): ImportedBookmark[] {
  const bookmarks: ImportedBookmark[] = [];
  const folderStack: string[] = [];

  // Match tags of interest: <H3...>, </H3>, <DL...>, </DL>, <A...>...</A>
  const tagRegex = /(?:<H3[^>]*>(.*?)<\/H3>)|(?:<\/?DL[^>]*>)|(?:<A\s+([^>]+)>(.*?)<\/A>)/gi;

  let match: RegExpExecArray | null;
  let pendingFolder: string | null = null;

  while ((match = tagRegex.exec(htmlContent)) !== null) {
    const fullMatch = match[0];

    // 1. Heading tag: <H3...>FolderName</H3>
    if (match[1] !== undefined) {
      pendingFolder = decodeEntities(match[1].replace(/<[^>]*>/g, "").trim());
      continue;
    }

    // 2. Open DL tag: <DL> -> push pending folder onto stack
    if (/^<DL/i.test(fullMatch)) {
      if (pendingFolder) {
        folderStack.push(pendingFolder);
        pendingFolder = null;
      }
      continue;
    }

    // 3. Close DL tag: </DL> -> pop folder from stack
    if (/^<\/DL/i.test(fullMatch)) {
      if (folderStack.length > 0) {
        folderStack.pop();
      }
      continue;
    }

    // 4. Anchor tag: <A ...>Title</A>
    if (match[2] !== undefined && match[3] !== undefined) {
      const attrsStr = match[2];
      const rawTitle = decodeEntities(match[3].replace(/<[^>]*>/g, "").trim());

      const hrefMatch = attrsStr.match(/href=["']([^"']+)["']/i);
      const url = hrefMatch?.[1]?.trim();
      if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
        continue;
      }

      // Title fallback
      const title = rawTitle || url;

      // Extract ADD_DATE timestamp
      const dateMatch = attrsStr.match(/add_date=["']?(\d+)["']?/i);
      let addDate: string | undefined;
      if (dateMatch?.[1]) {
        try {
          const sec = parseInt(dateMatch[1], 10);
          if (!isNaN(sec) && sec > 0) {
            addDate = new Date(sec * 1000).toISOString();
          }
        } catch {}
      }

      // Extract TAGS attribute
      const tagsMatch = attrsStr.match(/tags=["']([^"']+)["']/i);
      const explicitTags = tagsMatch?.[1]
        ? tagsMatch[1]
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        : [];

      // Extract domain for auto-tagging
      let domain = "";
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {}

      const autoTags = Array.from(
        new Set([
          ...explicitTags,
          ...folderStack.map((f) => f.toLowerCase()),
          ...(domain ? [domain] : []),
          "bookmark",
        ])
      );

      const folderPath = folderStack.join(" / ");
      const canonicalExternalId = `url:${url.toLowerCase()}`;

      // Ingestion Throttling: First 20 items are OPTIMISTIC (candidate for immediate head fetch),
      // items 21+ are LAZY_QUEUED to conserve network bandwidth and memory.
      const enrichmentStatus = bookmarks.length < 20 ? "OPTIMISTIC" : "LAZY_QUEUED";

      bookmarks.push({
        url,
        title,
        folderPath,
        folderStack: [...folderStack],
        tags: autoTags,
        addDate,
        enrichmentStatus,
        typePath: "/article",
        coreType: "ARTICLE",
        canonicalExternalId,
      });
    }
  }

  return bookmarks;
}

/**
 * Hydrates top items with Tier-0 OpenGraph head metadata
 */
export async function hydrateTopBookmarks(
  bookmarks: ImportedBookmark[],
  limit: number = 20
): Promise<ImportedBookmark[]> {
  const topSlice = bookmarks.slice(0, limit);
  const remaining = bookmarks.slice(limit);

  const hydratedSlice = await Promise.all(
    topSlice.map(async (bm) => {
      try {
        const og = await extractOpenGraph(bm.url, { timeoutMs: 3000 });
        return {
          ...bm,
          title: og.title || bm.title,
          heroImageUrl: og.image,
          summary: og.description,
          enrichmentStatus: "ENRICHED" as const,
        };
      } catch {
        return bm;
      }
    })
  );

  return [...hydratedSlice, ...remaining];
}
