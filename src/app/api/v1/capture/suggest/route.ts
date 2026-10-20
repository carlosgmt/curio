import { NextRequest, NextResponse } from "next/server";
import { db, userSaves, globalEntities } from "@/db";
import { eq, and, or, like, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/service";
import { discoverUniversalEntities } from "@/lib/enrichment/universalDiscovery";
import { fetchItunesMusicMetadata } from "@/lib/enrichment/providers/music";

export interface OmniboxSuggestion {
  title: string;
  subtitle: string;
  typePath: string;
  badgeLabel: string;
  heroImageUrl: string | null;
  canonicalUrl: string;
  isExistingSave: boolean;
  saveId: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const query = req.nextUrl.searchParams.get("q")?.trim() || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // 1. Parallel lookup across existing saves, universal discovery, and iTunes
    const [existingSavesRes, universalCandidatesRes, itunesRes] = await Promise.allSettled([
      // A. User's existing saves
      (async () => {
        try {
          const rows = await db
            .select({
              saveId: userSaves.id,
              typePath: userSaves.typePath,
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
    ]);

    const suggestions: OmniboxSuggestion[] = [];
    const seenTitles = new Set<string>();

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

        suggestions.push({
          title: save.title,
          subtitle: save.creator ? `In your saves • ${save.creator}` : "In your saves",
          typePath,
          badgeLabel,
          heroImageUrl: save.heroImageUrl || null,
          canonicalUrl: save.canonicalUrl || "",
          isExistingSave: true,
          saveId: save.saveId,
        });
      }
    }

    // Add iTunes metadata if it's high confidence and not in saves
    if (itunesRes.status === "fulfilled" && itunesRes.value) {
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
          });
        }
      }
    }

    // Add universal discovery candidates
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
        });

        if (suggestions.length >= 6) break;
      }
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 6) });
  } catch (err) {
    console.error("Capture suggestion error:", err);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
