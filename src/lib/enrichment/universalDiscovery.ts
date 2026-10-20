/**
 * Universal Entity Discovery Engine
 * Single-call Wikidata + Wikipedia REST candidate discovery with description-to-ontology mapping.
 * Resolves arbitrary multilingual titles and queries without LLM hallucination or cutoff dates.
 */

export interface DiscoveredCandidate {
  title: string;
  snippet: string;
  url: string;
  coreType: string;
  typePath: string;
  badgeLabel: string;
  year?: number | null;
  creator?: string | null;
  thumbnailUrl?: string | null;
  conceptUri?: string | null;
  score?: number;
}

export interface CandidateFallback {
  title: string;
  url: string;
  snippet: string;
  coreType: string;
  typePath?: string;
  badgeLabel?: string;
}

export interface UniversalDiscoveryOptions {
  fetchFn?: typeof fetch;
  limit?: number;
  timeoutMs?: number;
}

/**
 * Normalizes text for accent-insensitive and punctuation-insensitive comparisons
 */
export function normalizeEntityString(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Maps semantic descriptions (from Wikidata/Wikipedia) to Curio's internal ontology
 */
export function mapDescriptionToOntology(description: string, title?: string): {
  coreType: string;
  typePath: string;
  badgeLabel: string;
} {
  const d = (description || "").toLowerCase();
  const t = (title || "").toLowerCase();

  // 1. Cinema & Film
  if (
    /\b(?:film|movie|feature film|motion picture|television series|tv series|anime|documentary|miniseries|directed by|screenplay|filmmaker|director|screenwriter|actor|actress)\b/i.test(
      d
    )
  ) {
    return { coreType: "MEDIA", typePath: "/media/film", badgeLabel: "FILM" };
  }

  // 2. Books & Literature
  if (
    /\b(?:novel|novella|book|memoir|biography|autobiography|manga|written work|edition of written work|poem|poetry collection|short story|play by|literary work|non-fiction|author|writer|novelist|poet|playwright)\b/i.test(
      d
    )
  ) {
    return { coreType: "BOOK", typePath: "/product/book", badgeLabel: "BOOK" };
  }

  // 3. Music, Vinyl, Tracks
  if (
    /\b(?:song|original song|single|album|studio album|extended play|ep|musical composition|band|musical duo|record by|recorded by|soundtrack|musician|singer|songwriter|composer)\b/i.test(
      d
    )
  ) {
    return { coreType: "MEDIA", typePath: "/media/music/vinyl", badgeLabel: "SONG" };
  }

  // 4. Wine & Beverages
  if (
    /\b(?:wine|vineyard|winery|grape|appellation|cuvée|cuvee|docg|doc|red wine|white wine|champagne|whisky|bourbon|spirit|alcoholic beverage)\b/i.test(d)
  ) {
    return { coreType: "PRODUCT", typePath: "/product/beverage/wine", badgeLabel: "WINE" };
  }

  // 5. Video Games
  if (
    /\b(?:video game|computer game|arcade game|expansion pack|playstation|nintendo|xbox|action game|rpg)\b/i.test(d)
  ) {
    return { coreType: "VIDEOGAME", typePath: "/media/videogame", badgeLabel: "GAME" };
  }

  // 6. Fine Art & Sculptures
  if (
    /\b(?:painting|sculpture|artwork|installation|drawing|oil on canvas|mural|statue)\b/i.test(d)
  ) {
    return { coreType: "PRODUCT", typePath: "/product/art", badgeLabel: "ART" };
  }

  // 7. Culinary & Recipes
  if (
    /\b(?:dish|recipe|food|pastry|cocktail|cuisine|soup|dessert|bread|cheese)\b/i.test(d)
  ) {
    return { coreType: "CULINARY", typePath: "/article/recipe", badgeLabel: "RECIPE" };
  }

  // 8. Places, Venues & Architecture
  if (
    /\b(?:restaurant|cafe|café|hotel|city|comune|municipality|capital|museum|building|park|street|neighborhood|district|mountain|lake|island|province|town|village)\b/i.test(d)
  ) {
    return { coreType: "PLACE", typePath: "/place", badgeLabel: "PLACE" };
  }

  // Title fallback checks if description was too sparse
  if (/\b(?:wine|cuvée|domaine|chateau|château)\b/i.test(t)) {
    return { coreType: "PRODUCT", typePath: "/product/beverage/wine", badgeLabel: "WINE" };
  }

  return { coreType: "PRODUCT", typePath: "/product/generic", badgeLabel: "PRODUCT" };
}

/**
 * Extracts 4-digit release year and creator/director from candidate descriptions
 */
export function extractYearAndCreator(description: string): { year: number | null; creator: string | null } {
  if (!description) return { year: null, creator: null };

  const yearMatch = description.match(/\b(1[89]\d\d|20[0-2]\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  let creator: string | null = null;
  const creatorMatch = description.match(
    /\b(?:by|directed by|written by|recorded by|composed by|authored by)\s+([^,;.]+)/i
  );
  if (creatorMatch) {
    creator = creatorMatch[1].trim();
  }

  return { year, creator };
}

/**
 * Query Wikidata Entity Search and Wikipedia REST Search concurrently,
 * fusing results into prioritized DiscoveredCandidate objects.
 */
export async function discoverUniversalEntities(
  query: string,
  options?: UniversalDiscoveryOptions
): Promise<DiscoveredCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const fetchFn = options?.fetchFn ?? fetch;
  const limit = options?.limit ?? 6;
  const timeoutMs = options?.timeoutMs ?? 2500;

  const normalizedQuery = normalizeEntityString(trimmed);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    "User-Agent": "Curio/3.2 (https://github.com/curio-app; autonomous-taste-graph)",
    Accept: "application/json",
  };

  try {
    const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      trimmed
    )}&language=en&uselang=en&format=json&limit=${limit}`;

    const wikipediaUrl = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(
      trimmed
    )}&limit=${Math.min(limit, 5)}`;

    const [wikidataRes, wikipediaRes] = await Promise.allSettled([
      fetchFn(wikidataUrl, { headers, signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetchFn(wikipediaUrl, { headers, signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ]);

    const candidates: DiscoveredCandidate[] = [];
    const seenKeys = new Set<string>();

    const leadTitleMatch = trimmed.match(
      /^(.+?)(?:\s+(?:by|directed by|written by|movie|film|cinema|book|novel|album|song)\b)/i
    );
    const leadTitle = leadTitleMatch ? leadTitleMatch[1].trim() : trimmed;
    const normalizedLeadTitle = normalizeEntityString(leadTitle);

    // 1. Process Wikidata results
    if (wikidataRes.status === "fulfilled" && wikidataRes.value?.search) {
      const items = wikidataRes.value.search as Array<{
        id: string;
        label: string;
        description?: string;
        concepturi?: string;
        match?: { type?: string; language?: string; text?: string };
        aliases?: string[];
      }>;

      const queryLower = trimmed.toLowerCase();

      items.forEach((item, index) => {
        const rawTitle = item.label || item.id;
        const title = rawTitle
          .replace(
            /\s*\((?:film|movie|novel|book|album|song|soundtrack|miniseries|tv series|television series|play|video game|game)\)\s*$/i,
            ""
          )
          .trim();
        const description = item.description || "";
        const ontology = mapDescriptionToOntology(description, title);
        const { year, creator } = extractYearAndCreator(description);

        const normalizedTitle = normalizeEntityString(title);
        const dedupeKey = `${normalizedTitle}::${ontology.typePath}`;

        // Compute matching score
        let score = (items.length - index) * 10;
        if (normalizedTitle === normalizedQuery) {
          score += 80;
        } else if (normalizedLeadTitle && normalizedTitle === normalizedLeadTitle) {
          score += 120;
        } else if (normalizedQuery.includes(normalizedTitle)) {
          score += 45;
        } else if (normalizedTitle.includes(normalizedQuery)) {
          score += 25;
        }

        // Query intent keywords boost
        if (/\b(?:movie|film|cinema)\b/i.test(queryLower) && ontology.typePath === "/media/film") {
          score += 70;
        }
        if (/\b(?:book|novel|memoir|author)\b/i.test(queryLower) && ontology.typePath === "/product/book") {
          score += 70;
        }
        if (/\b(?:song|album|vinyl|music|track)\b/i.test(queryLower) && ontology.typePath === "/media/music/vinyl") {
          score += 70;
        }
        if (/\b(?:wine|vineyard|cuvée|château)\b/i.test(queryLower) && ontology.typePath.includes("wine")) {
          score += 70;
        }

        // Check match info & aliases for cross-language matching (e.g. Spanish "Mi vida sin mí" matching Q83630)
        if (item.match?.text && normalizeEntityString(item.match.text) === normalizedQuery) {
          score += 70;
        }
        if (item.aliases && item.aliases.some((a) => normalizeEntityString(a) === normalizedQuery)) {
          score += 50;
        }

        // Prioritize structured cultural archetypes over generic fallback
        if (ontology.typePath !== "/product/generic") {
          score += 25;
        }

        if (!seenKeys.has(dedupeKey)) {
          seenKeys.add(dedupeKey);
          candidates.push({
            title,
            snippet: description || `Wikidata entity ${item.id}`,
            url: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`,
            coreType: ontology.coreType,
            typePath: ontology.typePath,
            badgeLabel: ontology.badgeLabel,
            year,
            creator,
            conceptUri: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`,
            score,
          });
        }
      });
    }

    // 2. Process Wikipedia REST results
    if (wikipediaRes.status === "fulfilled" && wikipediaRes.value?.pages) {
      const queryLower = trimmed.toLowerCase();
      const pages = wikipediaRes.value.pages as Array<{
        id: number;
        key: string;
        title: string;
        description?: string;
        excerpt?: string;
        thumbnail?: { url: string };
      }>;

      pages.forEach((page, index) => {
        const rawTitle = page.title;
        const title = rawTitle
          .replace(
            /\s*\((?:film|movie|novel|book|album|song|soundtrack|miniseries|tv series|television series|play|video game|game)\)\s*$/i,
            ""
          )
          .trim();
        const description = page.description || page.excerpt?.replace(/<[^>]+>/g, "") || "";
        const ontology = mapDescriptionToOntology(description, title);
        const { year, creator } = extractYearAndCreator(description);

        const normalizedTitle = normalizeEntityString(title);
        const dedupeKey = `${normalizedTitle}::${ontology.typePath}`;

        let score = (pages.length - index) * 8;
        if (normalizedTitle === normalizedQuery) {
          score += 70;
        } else if (normalizedLeadTitle && normalizedTitle === normalizedLeadTitle) {
          score += 120;
        } else if (normalizedQuery.includes(normalizedTitle)) {
          score += 40;
        } else if (normalizedTitle.includes(normalizedQuery)) {
          score += 20;
        }

        // Query intent keywords boost
        if (/\b(?:movie|film|cinema)\b/i.test(queryLower) && ontology.typePath === "/media/film") {
          score += 70;
        }
        if (/\b(?:book|novel|memoir|author)\b/i.test(queryLower) && ontology.typePath === "/product/book") {
          score += 70;
        }
        if (/\b(?:song|album|vinyl|music|track)\b/i.test(queryLower) && ontology.typePath === "/media/music/vinyl") {
          score += 70;
        }
        if (/\b(?:wine|vineyard|cuvée|château)\b/i.test(queryLower) && ontology.typePath.includes("wine")) {
          score += 70;
        }

        if (ontology.typePath !== "/product/generic") {
          score += 20;
        }

        const thumbUrl = page.thumbnail?.url
          ? page.thumbnail.url.startsWith("//")
            ? `https:${page.thumbnail.url}`
            : page.thumbnail.url
          : null;

        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key || page.title.replace(/\s+/g, "_"))}`;

        if (!seenKeys.has(dedupeKey)) {
          seenKeys.add(dedupeKey);
          candidates.push({
            title,
            snippet: description || `Wikipedia article for ${page.title}`,
            url: wikiUrl,
            coreType: ontology.coreType,
            typePath: ontology.typePath,
            badgeLabel: ontology.badgeLabel,
            year,
            creator,
            thumbnailUrl: thumbUrl,
            score,
          });
        } else {
          // If already in candidates from Wikidata, augment with thumbnail if missing
          const existing = candidates.find((c) => normalizeEntityString(c.title) === normalizedTitle);
          if (existing && thumbUrl && !existing.thumbnailUrl) {
            existing.thumbnailUrl = thumbUrl;
          }
        }
      });
    }

    // Sort by computed score descending
    candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return candidates.slice(0, limit);
  } finally {
    clearTimeout(timer);
  }
}
