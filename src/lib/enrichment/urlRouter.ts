import type { EnrichmentPayload } from "./dispatcher";
import { fetchAndExtractMetadata } from "./opengraph";
import { resolveFilm } from "./providers/cinema";
import { resolveBook } from "./providers/books";
import { resolveSpotifyUrl, fetchItunesMusicMetadata } from "./providers/music";
import { resolvePlace } from "./providers/places";
import { resolveCreator } from "./providers/creators";
import { mapDescriptionToOntology, extractYearAndCreator } from "./universalDiscovery";

/**
 * Converts a URL slug (e.g. "the-revenant-2015" or "dune-part-two") into a clean title and optional year.
 */
function parseSlugTitleAndYear(slug: string): { title: string; year: number | null } {
  const decoded = decodeURIComponent(slug).replace(/^\/+|\/+$/g, "");
  const yearMatch = decoded.match(/^(.*)-((?:19|20)\d{2})$/);
  const rawTitle = yearMatch ? yearMatch[1] : decoded;
  const year = yearMatch ? parseInt(yearMatch[2], 10) : null;
  const title = rawTitle
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return { title, year };
}

/**
 * Domain-Aware URL & Link Capture Router
 * Intercepts known cultural & utility domains before generic OpenGraph fallback.
 */
export async function routeKnownDomainUrl(
  rawUrl: string,
  options?: { fetchFn?: typeof fetch; forcedTypePath?: string }
): Promise<EnrichmentPayload | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname;

  // =========================================================================
  // 1. SPOTIFY & APPLE MUSIC
  // =========================================================================
  if (host.includes("spotify.com")) {
    const spotifyRes = await resolveSpotifyUrl(rawUrl, { fetchFn });
    if (spotifyRes) {
      return {
        title: spotifyRes.title,
        summary: spotifyRes.summary,
        heroImageUrl: spotifyRes.coverUrl,
        coreType: "MEDIA",
        typePath: options?.forcedTypePath || spotifyRes.typePath,
        canonicalExternalId: spotifyRes.canonicalExternalId,
        canonicalUrl: spotifyRes.canonicalUrl,
        brandOrCreator: spotifyRes.artist,
        priceCents: spotifyRes.priceCents,
        coreStructuredData: spotifyRes.coreStructuredData,
        primarySource: {
          sellerName: "Spotify",
          sourceUrl: rawUrl,
          priceCents: 0,
        },
        runnerUpCandidates: [],
      };
    }
  }

  if (host === "music.apple.com") {
    const isSong = parsed.searchParams.has("i") || path.includes("/song/");
    const segments = path.split("/").filter(Boolean);
    // e.g. /es/album/omega/12345678 -> slug is second-to-last segment
    const albumSlug = segments.length >= 3 ? segments[segments.length - 2] : segments[segments.length - 1] || "";
    const { title: slugTitle } = parseSlugTitleAndYear(albumSlug);
    const itunesMeta = await fetchItunesMusicMetadata(slugTitle, {
      subType: isSong ? "song" : "album",
      fetchFn,
    });
    if (itunesMeta && itunesMeta.title) {
      const typePath = isSong ? "/media/music/song" : "/media/music/album";
      return {
        title: itunesMeta.title,
        summary: `${isSong ? "Song" : "Album"} by ${itunesMeta.artist || "Unknown Artist"}${
          itunesMeta.releaseYear ? ` (${itunesMeta.releaseYear})` : ""
        }`,
        heroImageUrl: itunesMeta.coverUrl || null,
        coreType: "MEDIA",
        typePath,
        canonicalExternalId: `applemusic:${segments[segments.length - 1] || slugTitle.toLowerCase()}`,
        canonicalUrl: rawUrl,
        brandOrCreator: itunesMeta.artist || null,
        priceCents: isSong ? 129 : 1999,
        coreStructuredData: {
          artist: itunesMeta.artist,
          album: itunesMeta.album || itunesMeta.title,
          releaseYear: itunesMeta.releaseYear,
          format: isSong ? "song" : "album",
          tracklist: itunesMeta.tracklist,
          trackCount: itunesMeta.trackCount,
        },
        primarySource: {
          sellerName: "Apple Music",
          sourceUrl: rawUrl,
          priceCents: isSong ? 129 : 1999,
        },
        runnerUpCandidates: [],
      };
    }
  }

  // =========================================================================
  // 2. LETTERBOXD (letterboxd.com/film/<slug>, letterboxd.com/<user>/film/<slug>, boxd.it/...)
  // =========================================================================
  if (host === "letterboxd.com" || host === "boxd.it") {
    const og = await fetchAndExtractMetadata(rawUrl, { fetchFn }).catch(() => ({ url: rawUrl } as any));
    const effectiveUrl = og.url || rawUrl;
    const filmMatch = effectiveUrl.match(/letterboxd\.com\/(?:[^/]+\/)?film\/([^/?#]+)/i) || path.match(/\/(?:[^/]+\/)?film\/([^/?#]+)/i);

    if (filmMatch || host === "boxd.it") {
      const slug = filmMatch ? filmMatch[1] : path.replace(/^\/+/, "");
      const { title: slugTitle, year: slugYear } = parseSlugTitleAndYear(slug);

      // Parse Letterboxd og:title e.g. "The Revenant (2015)" or "‎The Revenant (2015) directed by Alejandro González Iñárritu"
      const rawOgTitle = String(og.title || "").replace(/[\u200e\u200f]/g, "").trim();
      const ogYearMatch = rawOgTitle.match(/\((\d{4})\)/);
      const yearHint = ogYearMatch ? parseInt(ogYearMatch[1], 10) : slugYear;
      const cleanTitle = rawOgTitle
        ? rawOgTitle
            .replace(/\s*\(\d{4}\).*$/, "")
            .replace(/\s*•\s*Letterboxd.*$/i, "")
            .trim()
        : slugTitle;

      const directorMatch =
        String(og.description || rawOgTitle).match(/directed by\s+([^.•,]+)/i);
      const creatorHint = og.authorOrCreator || (directorMatch ? directorMatch[1].trim() : null);

      const canonicalFilmUrl = filmMatch
        ? `https://letterboxd.com/film/${filmMatch[1]}/`
        : effectiveUrl;

      const filmRes = await resolveFilm(cleanTitle || slugTitle, {
        yearHint,
        creatorHint,
        fetchFn,
      });

      const finalTitle = filmRes?.title || cleanTitle || slugTitle;
      const finalDirector = filmRes?.director || creatorHint || null;
      const finalYear = filmRes?.releaseYear || yearHint || undefined;
      const finalPoster = filmRes?.posterUrl || og.image || null;

      return {
        title: finalTitle,
        summary: filmRes?.summary || og.description || `Film on Letterboxd: ${finalTitle}`,
        heroImageUrl: finalPoster,
        coreType: "MEDIA",
        typePath: "/media/film",
        canonicalExternalId:
          filmRes?.canonicalExternalId ||
          `letterboxd:${slug}${finalYear && !slug.endsWith(String(finalYear)) ? `-${finalYear}` : ""}`,
        canonicalUrl: canonicalFilmUrl,
        brandOrCreator: finalDirector,
        priceCents: filmRes?.priceCents ?? 399,
        coreStructuredData: {
          ...(filmRes?.coreStructuredData || {}),
          title: finalTitle,
          ...(finalDirector ? { director: finalDirector } : {}),
          ...(finalYear ? { releaseYear: finalYear } : {}),
          letterboxdUrl: canonicalFilmUrl,
        },
        primarySource: {
          sellerName: "Letterboxd",
          sourceUrl: canonicalFilmUrl,
          priceCents: filmRes?.priceCents ?? 399,
        },
        runnerUpCandidates: [],
      };
    }
  }

  // =========================================================================
  // 3. IMDb (imdb.com/title/tt...)
  // =========================================================================
  if (host.endsWith("imdb.com")) {
    const ttMatch = path.match(/\/title\/(tt\d+)/i);
    if (ttMatch) {
      const imdbId = ttMatch[1].toLowerCase();
      const og = await fetchAndExtractMetadata(rawUrl, { fetchFn }).catch(() => ({ url: rawUrl } as any));

      let cleanTitle = "";
      let yearHint: number | null = null;
      let creatorHint: string | null = og.authorOrCreator || null;

      if (og.title) {
        // e.g. "The Revenant (2015) - IMDb"
        const ym = og.title.match(/\((\d{4})\)/);
        if (ym) yearHint = parseInt(ym[1], 10);
        cleanTitle = og.title
          .replace(/\s*\([^)]*\)\s*/g, " ")
          .replace(/\s*[-|]\s*IMDb.*$/i, "")
          .trim();
      }

      // If IMDb blocked HTML scraping, resolve title + year via Wikidata SPARQL/wbsearchentities by P345 (IMDb ID)
      if (!cleanTitle) {
        try {
          const wdUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
            imdbId
          )}&language=en&format=json&limit=1`;
          const wdRes = await fetchFn(wdUrl, {
            headers: { "User-Agent": "Curio/1.0 (https://curio.local)" },
          });
          if (wdRes.ok) {
            const wdData = await wdRes.json();
            const first = wdData?.search?.[0];
            if (first?.label) {
              cleanTitle = first.label;
              const extracted = extractYearAndCreator(first.description || "");
              if (extracted.year) yearHint = extracted.year;
              if (extracted.creator) creatorHint = extracted.creator;
            }
          }
        } catch {
          // Non-fatal
        }
      }

      const filmRes = await resolveFilm(cleanTitle || imdbId, {
        imdbId,
        yearHint,
        creatorHint,
        fetchFn,
      });

      const finalTitle = filmRes?.title || cleanTitle || `IMDb ${imdbId}`;
      return {
        title: finalTitle,
        summary: filmRes?.summary || og.description || `Film entry (${imdbId})`,
        heroImageUrl: filmRes?.posterUrl || og.image || null,
        coreType: "MEDIA",
        typePath: "/media/film",
        canonicalExternalId: `imdb:${imdbId}`,
        canonicalUrl: `https://www.imdb.com/title/${imdbId}/`,
        brandOrCreator: filmRes?.director || creatorHint || null,
        priceCents: filmRes?.priceCents ?? 399,
        coreStructuredData: {
          ...(filmRes?.coreStructuredData || {}),
          title: finalTitle,
          imdbId,
        },
        primarySource: {
          sellerName: "IMDb",
          sourceUrl: `https://www.imdb.com/title/${imdbId}/`,
          priceCents: filmRes?.priceCents ?? 399,
        },
        runnerUpCandidates: [],
      };
    }
  }

  // =========================================================================
  // 4. GOODREADS & OPENLIBRARY
  // =========================================================================
  if (host.endsWith("goodreads.com") || host.endsWith("openlibrary.org")) {
    const og = await fetchAndExtractMetadata(rawUrl, { fetchFn }).catch(() => ({ url: rawUrl } as any));

    // Extract fallback title from Goodreads URL slug: /book/show/44767.Dune or /book/show/44767-dune
    const grMatch = path.match(/\/book\/show\/(\d+)(?:[.-]([^/?#]+))?/i);
    const slugFallback = grMatch?.[2]
      ? decodeURIComponent(grMatch[2]).replace(/[-_]+/g, " ").trim()
      : "";

    const rawTitle = (og.title || slugFallback || "")
      .replace(/\s+by\s+[^|•-]+.*$/i, "")
      .replace(/\s*\|\s*Goodreads.*$/i, "")
      .trim();

    const byAuthorMatch = String(og.title || "").match(/\s+by\s+([^|•-]+)/i);
    const authorHint = og.authorOrCreator || (byAuthorMatch ? byAuthorMatch[1].trim() : null);

    const bookRes = await resolveBook(rawTitle || slugFallback || rawUrl, {
      authorHint,
      fetchFn,
    });

    const finalTitle = bookRes?.title || rawTitle || slugFallback || "Book";
    const finalAuthor = bookRes?.author || authorHint || "Unknown Author";

    return {
      title: finalTitle,
      summary: bookRes?.summary || og.description || `By ${finalAuthor}`,
      heroImageUrl: bookRes?.coverUrl || og.image || null,
      coreType: "BOOK",
      typePath: "/product/book",
      canonicalExternalId:
        bookRes?.canonicalExternalId ||
        (grMatch?.[1] ? `goodreads:${grMatch[1]}` : null),
      canonicalUrl: rawUrl,
      brandOrCreator: finalAuthor,
      priceCents: bookRes?.priceCents ?? 1899,
      coreStructuredData: {
        ...(bookRes?.coreStructuredData || {}),
        title: finalTitle,
        author: finalAuthor,
      },
      primarySource: {
        sellerName: host.includes("goodreads") ? "Goodreads" : "OpenLibrary",
        sourceUrl: rawUrl,
        priceCents: bookRes?.priceCents ?? 1899,
      },
      runnerUpCandidates: [],
    };
  }

  // =========================================================================
  // 5. YOUTUBE (youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...)
  // =========================================================================
  if (host.includes("youtube.com") || host === "youtu.be") {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`;
      const res = await fetchFn(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        const videoIdMatch =
          parsed.searchParams.get("v") ||
          (host === "youtu.be" ? path.slice(1).split("/")[0] : null) ||
          path.match(/\/shorts\/([^/?#]+)/)?.[1];
        const title = data.title || "YouTube Video";
        const creator = data.author_name || "YouTube Creator";
        const thumbnailUrl = videoIdMatch
          ? `https://i.ytimg.com/vi/${videoIdMatch}/hqdefault.jpg`
          : data.thumbnail_url || null;

        return {
          title,
          summary: `Video by ${creator} on YouTube`,
          heroImageUrl: thumbnailUrl,
          coreType: "LINK",
          typePath: options?.forcedTypePath || "/media/video",
          canonicalExternalId: videoIdMatch ? `youtube:${videoIdMatch}` : null,
          canonicalUrl: rawUrl,
          brandOrCreator: creator,
          priceCents: null,
          coreStructuredData: {
            rawUrl,
            siteName: "YouTube",
            domain: "youtube.com",
            author: creator,
            videoId: videoIdMatch,
          },
          primarySource: {
            sellerName: "YouTube",
            sourceUrl: rawUrl,
          },
          runnerUpCandidates: [],
        };
      }
    } catch {
      // Fall through
    }
  }

  // =========================================================================
  // 6. GOOGLE MAPS (google.com/maps/place/..., maps.google.com, maps.app.goo.gl)
  // =========================================================================
  if (
    (host.includes("google.") && path.startsWith("/maps")) ||
    host.startsWith("maps.google.") ||
    host === "maps.app.goo.gl"
  ) {
    const placeMatch = path.match(/\/maps\/place\/([^/]+)/i);
    const coordMatch = path.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const queryParam = parsed.searchParams.get("q") || parsed.searchParams.get("query");
    const rawPlaceName = placeMatch
      ? decodeURIComponent(placeMatch[1].replace(/\+/g, " "))
      : queryParam || "Saved Place";

    const placeRes = await resolvePlace(rawPlaceName, { fetchFn });
    const lat = coordMatch ? parseFloat(coordMatch[1]) : placeRes?.coreStructuredData?.latitude;
    const lon = coordMatch ? parseFloat(coordMatch[2]) : placeRes?.coreStructuredData?.longitude;

    return {
      title: placeRes?.title || rawPlaceName,
      summary:
        placeRes?.summary ||
        `Location on Google Maps${lat && lon ? ` (${lat.toFixed(4)}, ${lon.toFixed(4)})` : ""}`,
      heroImageUrl: placeRes?.heroImageUrl || null,
      coreType: "PLACE",
      typePath: "/place",
      canonicalExternalId:
        placeRes?.canonicalExternalId ||
        (lat && lon ? `geo:${lat.toFixed(4)},${lon.toFixed(4)}` : null),
      canonicalUrl: rawUrl,
      brandOrCreator: placeRes?.city
        ? `${placeRes.city}${placeRes.country ? `, ${placeRes.country}` : ""}`
        : "Google Maps",
      priceCents: null,
      coreStructuredData: {
        ...(placeRes?.coreStructuredData || {}),
        ...(lat ? { latitude: lat } : {}),
        ...(lon ? { longitude: lon } : {}),
        googleMapsUrl: rawUrl,
      },
      primarySource: {
        sellerName: "Google Maps",
        sourceUrl: rawUrl,
      },
      runnerUpCandidates: [],
    };
  }

  // =========================================================================
  // 7. WIKIPEDIA (*.wikipedia.org/wiki/<Slug>)
  // =========================================================================
  if (host.endsWith("wikipedia.org") && path.startsWith("/wiki/")) {
    const slug = decodeURIComponent(path.replace(/^\/wiki\//, ""));
    try {
      const sumUrl = `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
      const res = await fetchFn(sumUrl, {
        headers: { "User-Agent": "Curio/1.0 (https://curio.local)" },
      });
      if (res.ok) {
        const data = await res.json();
        const title = String(data.title || slug.replace(/_/g, " "))
          .replace(/\s*\([^)]*\)\s*$/, "")
          .trim();
        const description = data.description || data.extract || "";
        const ontology = mapDescriptionToOntology(description, data.title);
        const { year, creator } = extractYearAndCreator(description);
        const image = data.originalimage?.source || data.thumbnail?.source || null;

        if (ontology.typePath === "/media/film") {
          const filmRes = await resolveFilm(title, {
            yearHint: year,
            creatorHint: creator,
            wikiUrlHint: rawUrl,
            fetchFn,
          });
          if (filmRes) {
            return {
              title: filmRes.title,
              summary: filmRes.summary || data.extract,
              heroImageUrl: filmRes.posterUrl || image,
              coreType: "MEDIA",
              typePath: "/media/film",
              canonicalExternalId: filmRes.canonicalExternalId,
              canonicalUrl: rawUrl,
              brandOrCreator: filmRes.director || creator,
              priceCents: filmRes.priceCents,
              coreStructuredData: filmRes.coreStructuredData,
              primarySource: {
                sellerName: "Wikipedia",
                sourceUrl: rawUrl,
              },
              runnerUpCandidates: [],
            };
          }
        }

        if (ontology.typePath === "/product/book") {
          const bookRes = await resolveBook(title, {
            authorHint: creator,
            yearHint: year,
            fetchFn,
          });
          if (bookRes) {
            return {
              title: bookRes.title,
              summary: bookRes.summary || data.extract,
              heroImageUrl: bookRes.coverUrl || image,
              coreType: "BOOK",
              typePath: "/product/book",
              canonicalExternalId: bookRes.canonicalExternalId,
              canonicalUrl: rawUrl,
              brandOrCreator: bookRes.author || creator,
              priceCents: bookRes.priceCents,
              coreStructuredData: bookRes.coreStructuredData,
              primarySource: {
                sellerName: "Wikipedia",
                sourceUrl: rawUrl,
              },
              runnerUpCandidates: [],
            };
          }
        }

        if (ontology.typePath.startsWith("/person")) {
          const creatorRes = await resolveCreator(title, { fetchFn });
          if (creatorRes) {
            return {
              title: creatorRes.name || title,
              summary: creatorRes.summary || data.extract,
              heroImageUrl: creatorRes.portraitUrl || image,
              coreType: "CREATOR",
              typePath: creatorRes.typePath || ontology.typePath,
              canonicalExternalId: creatorRes.canonicalExternalId,
              canonicalUrl: rawUrl,
              brandOrCreator: creatorRes.role,
              priceCents: null,
              coreStructuredData: creatorRes.coreStructuredData,
              primarySource: {
                sellerName: "Wikipedia",
                sourceUrl: rawUrl,
              },
              runnerUpCandidates: [],
            };
          }
        }

        return {
          title,
          summary: data.extract || description,
          heroImageUrl: image,
          coreType: ontology.coreType,
          typePath: options?.forcedTypePath || ontology.typePath,
          canonicalExternalId: `wiki:${data.titles?.canonical || slug}`,
          canonicalUrl: rawUrl,
          brandOrCreator: creator,
          priceCents: null,
          coreStructuredData: {
            title,
            ...(year ? { year } : {}),
            ...(creator ? { creator } : {}),
          },
          primarySource: {
            sellerName: "Wikipedia",
            sourceUrl: rawUrl,
          },
          runnerUpCandidates: [],
        };
      }
    } catch {
      // Fall through
    }
  }

  return null;
}
