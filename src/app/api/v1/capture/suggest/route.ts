import { NextRequest, NextResponse } from "next/server";
import { db, userSaves, globalEntities, curioTypes } from "@/db";
import { eq, and, or, like, desc, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/service";
import { discoverUniversalEntities } from "@/lib/enrichment/universalDiscovery";
import { fetchItunesMusicMetadata } from "@/lib/enrichment/providers/music";
import { parseQuoteInput } from "@/lib/types/catalog";

export interface OmniboxSuggestion {
  title: string;
  subtitle: string;
  typePath: string;
  badgeLabel: string;
  heroImageUrl: string | null;
  canonicalUrl: string;
  isExistingSave: boolean;
  saveId: string | null;
  curioTypeId?: string | null;
}

function findMatchingCurioType(
  typePath: string,
  title: string,
  types: Array<{ id: string; name: string; typePath: string; userId: string | null }>
) {
  const normPath = (typePath || "").toLowerCase().trim();
  const normTitle = (title || "").toLowerCase().trim();

  // Sort candidate types: user-specific first, then deeper type paths
  const sorted = [...types].sort((a, b) => {
    if (a.userId && !b.userId) return -1;
    if (!a.userId && b.userId) return 1;
    return b.typePath.length - a.typePath.length;
  });

  // 1. Exact match on typePath
  const exact = sorted.find((t) => t.typePath.toLowerCase() === normPath);
  if (exact) return exact;

  // 2. Subpath / parent-child match (e.g. /product/beverage/wine/specialty-coffee vs /product/coffee or /product/watch)
  const prefixMatch = sorted.find(
    (t) =>
      normPath.startsWith(t.typePath.toLowerCase()) ||
      t.typePath.toLowerCase().startsWith(normPath)
  );
  if (prefixMatch) return prefixMatch;

  // 3. Keyword / slug match (e.g. typePath ends with 'watch' or contains 'coffee')
  const lastSegment = normPath.split("/").pop();
  if (lastSegment && lastSegment.length > 2) {
    const slugMatch = sorted.find((t) => {
      const tLast = t.typePath.toLowerCase().split("/").pop();
      return tLast === lastSegment || t.name.toLowerCase() === lastSegment;
    });
    if (slugMatch) return slugMatch;
  }

  // 4. Fallback on name match if query or title mentions the custom type name
  const nameMatch = sorted.find((t) => {
    const tName = t.name.toLowerCase();
    return normPath.includes(tName) || (normTitle && normTitle.includes(tName));
  });
  if (nameMatch) return nameMatch;

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const query = req.nextUrl.searchParams.get("q")?.trim() || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // 1. Parallel lookup across existing saves, universal discovery, iTunes, and curio_types
    const [existingSavesRes, universalCandidatesRes, itunesRes, curioTypesRes] = await Promise.allSettled([
      // A. User's existing saves
      (async () => {
        try {
          const rows = await db
            .select({
              saveId: userSaves.id,
              typePath: userSaves.typePath,
              customTypeId: userSaves.customTypeId,
              title: globalEntities.title,
              creator: globalEntities.brandOrCreator,
              heroImageUrl: globalEntities.heroImageUrl,
              canonicalUrl: globalEntities.canonicalUrl,
            })
            .from(userSaves)
            .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
            .where(
              and(
                eq(userSaves.userId, user.id),
                or(
                  like(globalEntities.title, `%${query}%`),
                  like(globalEntities.brandOrCreator, `%${query}%`)
                )
              )
            )
            .orderBy(desc(userSaves.createdAt))
            .limit(3);

          return rows.filter((r) => Boolean(r.title));
        } catch {
          return [];
        }
      })(),

      // B. Universal discovery (Wikidata + EN/ES Wikipedia)
      discoverUniversalEntities(query, { limit: 5, timeoutMs: 2000 }).catch(() => []),

      // C. iTunes search for instant music album / song resolution
      fetchItunesMusicMetadata(query, { timeoutMs: 1500 }).catch(() => null),

      // D. Active curio_types (system & user custom types)
      db
        .select({
          id: curioTypes.id,
          name: curioTypes.name,
          typePath: curioTypes.typePath,
          userId: curioTypes.userId,
        })
        .from(curioTypes)
        .where(or(isNull(curioTypes.userId), eq(curioTypes.userId, user.id))),
    ]);

    const activeCurioTypes = curioTypesRes.status === "fulfilled" ? curioTypesRes.value : [];

    const suggestions: OmniboxSuggestion[] = [];
    const seenTitles = new Set<string>();

    // 0. Detect quote pattern or quotation input
    const parsedQuoteQuery = parseQuoteInput(query);
    const hasQuoteChar = query.includes('"') || query.includes('“') || query.includes('”') || query.toLowerCase().startsWith("quote:");
    const activeQuoteType = activeCurioTypes.find((t) => t.typePath.toLowerCase() === "/quote");

    if ((parsedQuoteQuery || (hasQuoteChar && activeQuoteType)) && query.length >= 3) {
      const qText = parsedQuoteQuery?.text || query.replace(/^quote:\s*/i, "").replace(/["“”]/g, "").trim();
      const qAuthor = parsedQuoteQuery?.author || "";

      suggestions.push({
        title: `"${qText}"`,
        subtitle: qAuthor ? `Quote • ${qAuthor}` : "Save as Quote",
        typePath: "/quote",
        badgeLabel: "QUOTE",
        heroImageUrl: null,
        canonicalUrl: "",
        isExistingSave: false,
        saveId: null,
        curioTypeId: activeQuoteType?.id || null,
      });
      seenTitles.add(`"${qText}"`.toLowerCase());
    }

    // Add existing user saves first
    if (existingSavesRes.status === "fulfilled" && existingSavesRes.value) {
      for (const save of existingSavesRes.value) {
        if (!save.title) continue;
        const norm = save.title.toLowerCase().trim();
        seenTitles.add(norm);

        const typePath = (save.typePath || "/product/generic").toLowerCase();
        let badgeLabel = "ITEM";
        if (typePath.includes("film") || typePath.includes("movie")) badgeLabel = "FILM";
        else if (typePath.includes("book")) badgeLabel = "BOOK";
        else if (typePath.includes("album")) badgeLabel = "ALBUM";
        else if (typePath.includes("song")) badgeLabel = "SONG";
        else if (typePath.includes("watch")) badgeLabel = "WATCH";
        else if (typePath.includes("wine")) badgeLabel = "WINE";
        else if (typePath.includes("place")) badgeLabel = "PLACE";
        else if (typePath.includes("quote")) badgeLabel = "QUOTE";

        suggestions.push({
          title: save.title,
          subtitle: save.creator ? `In your saves • ${save.creator}` : "In your saves",
          typePath,
          badgeLabel,
          heroImageUrl: save.heroImageUrl || null,
          canonicalUrl: save.canonicalUrl || "",
          isExistingSave: true,
          saveId: save.saveId,
          curioTypeId: save.customTypeId || null,
        });
      }
    }

    // 2. Add universal discovery candidates (Wikidata + Wikipedia)
    if (universalCandidatesRes.status === "fulfilled" && universalCandidatesRes.value) {
      for (const cand of universalCandidatesRes.value) {
        const norm = cand.title.toLowerCase().trim();
        if (seenTitles.has(norm)) continue;
        seenTitles.add(norm);

        const subtitleParts = [
          cand.creator,
          cand.year ? String(cand.year) : null,
          !cand.creator && !cand.year ? cand.snippet : null,
        ].filter(Boolean);

        suggestions.push({
          title: cand.title,
          subtitle: subtitleParts.join(" • ") || cand.snippet,
          typePath: cand.typePath,
          badgeLabel: cand.badgeLabel,
          heroImageUrl: cand.thumbnailUrl || null,
          canonicalUrl: cand.url,
          isExistingSave: false,
          saveId: null,
          curioTypeId: null,
        });

        if (suggestions.length >= 6) break;
      }
    }

    // 3. Add iTunes metadata if it's music and not already covered by universal discovery
    if (suggestions.length < 6 && itunesRes.status === "fulfilled" && itunesRes.value) {
      const it = itunesRes.value;
      if (it.title) {
        const norm = it.title.toLowerCase().trim();
        if (!seenTitles.has(norm)) {
          seenTitles.add(norm);
          const isAlbum = Boolean(it.album && it.album === it.title);
          suggestions.push({
            title: it.title,
            subtitle: [it.artist, it.releaseYear].filter(Boolean).join(" • "),
            typePath: isAlbum ? "/media/music/album" : "/media/music/song",
            badgeLabel: isAlbum ? "ALBUM" : "SONG",
            heroImageUrl: it.coverUrl || null,
            canonicalUrl: `https://open.spotify.com/search/${encodeURIComponent(`${it.artist || ""} ${it.title}`.trim())}`,
            isExistingSave: false,
            saveId: null,
            curioTypeId: null,
          });
        }
      }
    }

    // Match all suggestions against active curio_types (especially user custom types)
    for (const sug of suggestions) {
      const matched = findMatchingCurioType(sug.typePath, sug.title, activeCurioTypes);
      if (matched) {
        sug.curioTypeId = matched.id;
        sug.badgeLabel = matched.name.toUpperCase();
        if (!sug.typePath || sug.typePath === "/product/generic") {
          sug.typePath = matched.typePath;
        }
      }
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 6) });
  } catch (err) {
    console.error("Capture suggestion error:", err);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
