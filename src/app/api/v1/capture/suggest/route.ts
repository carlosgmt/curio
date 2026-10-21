import { NextRequest, NextResponse } from "next/server";
import { db, userSaves, globalEntities, curioTypes } from "@/db";
import { eq, and, or, like, desc, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/service";
import { discoverUniversalEntities } from "@/lib/enrichment/universalDiscovery";
import { fetchItunesMusicMetadata } from "@/lib/enrichment/providers/music";
import { searchNominatimPlaces } from "@/lib/enrichment/providers/places";
import { parseQuoteInput } from "@/lib/types/catalog";

export interface OmniboxSuggestion {
  title: string;
  subtitle: string;
  creator?: string | null;
  year?: number | null;
  conceptUri?: string | null;
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

  const sorted = [...types].sort((a, b) => {
    if (a.userId && !b.userId) return -1;
    if (!a.userId && b.userId) return 1;
    return b.typePath.length - a.typePath.length;
  });

  const exact = sorted.find((t) => t.typePath.toLowerCase() === normPath);
  if (exact) return exact;

  const prefixMatch = sorted.find(
    (t) =>
      normPath.startsWith(t.typePath.toLowerCase()) ||
      t.typePath.toLowerCase().startsWith(normPath)
  );
  if (prefixMatch) return prefixMatch;

  const lastSegment = normPath.split("/").pop();
  if (lastSegment && lastSegment.length > 2) {
    const slugMatch = sorted.find((t) => {
      const tLast = t.typePath.toLowerCase().split("/").pop();
      return tLast === lastSegment || t.name.toLowerCase() === lastSegment;
    });
    if (slugMatch) return slugMatch;
  }

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

    const [existingSavesRes, universalCandidatesRes, nominatimRes, itunesRes, curioTypesRes] = await Promise.allSettled([
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

      discoverUniversalEntities(query, { limit: 5, timeoutMs: 2000 }).catch(() => []),

      searchNominatimPlaces(query, { limit: 3, timeoutMs: 1800 }).catch(() => []),

      fetchItunesMusicMetadata(query, { timeoutMs: 1500 }).catch(() => null),

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

    const parsedQuoteQuery = parseQuoteInput(query);
    const hasQuoteChar = query.includes('"') || query.includes('“') || query.includes('”') || query.toLowerCase().startsWith("quote:");
    const activeQuoteType = activeCurioTypes.find((t) => t.typePath.toLowerCase() === "/quote");

    if ((parsedQuoteQuery || (hasQuoteChar && activeQuoteType)) && query.length >= 3) {
      const qText = parsedQuoteQuery?.text || query.replace(/^quote:\s*/i, "").replace(/["“”]/g, "").trim();
      const qAuthor = parsedQuoteQuery?.author || "";

      suggestions.push({
        title: `"${qText}"`,
        subtitle: qAuthor ? `Quote • ${qAuthor}` : "Save as Quote",
        creator: qAuthor || null,
        year: null,
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
          creator: save.creator || null,
          year: null,
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

    const addNominatimSuggestions = () => {
      if (nominatimRes.status === "fulfilled" && nominatimRes.value) {
        for (const place of nominatimRes.value) {
          const norm = place.title.toLowerCase().trim();
          if (seenTitles.has(norm)) continue;
          seenTitles.add(norm);

          const locationStr = place.city
            ? place.country
              ? `${place.city}, ${place.country}`
              : place.city
            : place.country || "";

          const subtitleParts = [
            place.category,
            locationStr,
          ].filter(Boolean);

          suggestions.push({
            title: place.title,
            subtitle: subtitleParts.join(" • ") || "Place & Venue",
            creator: locationStr || null,
            year: null,
            typePath: "/place",
            badgeLabel: "PLACE",
            heroImageUrl: null,
            canonicalUrl: place.mapsUrl,
            isExistingSave: false,
            saveId: null,
            curioTypeId: null,
          });

          if (suggestions.length >= 6) break;
        }
      }
    };

    const addUniversalSuggestions = () => {
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
            creator: cand.creator || null,
            year: cand.year || null,
            conceptUri: cand.conceptUri || null,
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
    };

    const isPlaceQuery = /\b(?:cafe|cafeteria|bar|restaurant|restaurante|pub|bistro|bakery|pasteleria|hotel|hostel|museum|museo|gallery|galeria|piazza|plaza|street|carrer|calle|avenida|brutal|federal|dishoom)\b/i.test(query);

    if (isPlaceQuery) {
      addNominatimSuggestions();
      addUniversalSuggestions();
    } else {
      addUniversalSuggestions();
      addNominatimSuggestions();
    }

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
            creator: it.artist || null,
            year: it.releaseYear || null,
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
