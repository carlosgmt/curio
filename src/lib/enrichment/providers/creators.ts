/**
 * Creator & Person Specialist Provider
 * Extracts verified biographical metadata: portrait, bio, birth/death years,
 * nationality, creative role (AUTHOR, DIRECTOR, MUSICIAN, ARTIST), and notable works
 * via Wikipedia REST & Wikidata.
 */

export interface ResolvedCreator {
  name: string;
  role: "AUTHOR" | "DIRECTOR" | "MUSICIAN" | "ARTIST" | "CREATOR";
  typePath: string;
  coreType: "CREATOR";
  summary?: string;
  portraitUrl?: string | null;
  birthYear?: number;
  deathYear?: number;
  nationality?: string;
  bio?: string;
  notableWorks?: string[];
  canonicalExternalId: string;
  canonicalUrl: string;
  coreStructuredData: {
    name: string;
    role: string;
    birthYear?: number;
    deathYear?: number;
    nationality?: string;
    bio?: string;
    notableWorks?: string[];
    wikidataUri?: string;
  };
}

export async function resolveCreator(
  query: string,
  options?: { fetchFn?: typeof fetch; timeoutMs?: number; forcedRole?: string }
): Promise<ResolvedCreator | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 4000;

  const trimmed = query.trim();
  if (!trimmed) return null;

  const cleanName = trimmed
    .replace(/\b(?:author|writer|director|filmmaker|musician|singer|artist|painter|sculptor)\b/gi, "")
    .trim();

  const titleVariations = [
    cleanName.replace(/\s+/g, "_"),
    trimmed.replace(/\s+/g, "_"),
    `${cleanName.replace(/\s+/g, "_")}_(writer)`,
    `${cleanName.replace(/\s+/g, "_")}_(director)`,
    `${cleanName.replace(/\s+/g, "_")}_(musician)`,
    `${cleanName.replace(/\s+/g, "_")}_(artist)`,
  ];

  let wikiData: any = null;
  let canonicalPageTitle = cleanName;

  for (const pageTitle of titleVariations) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
      const res = await fetchFn(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Curio/3.2 (https://github.com/curio-app; creator-resolver)",
          Accept: "application/json",
        },
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data.type === "standard" && data.title) {
          wikiData = data;
          canonicalPageTitle = data.titles?.canonical || pageTitle;
          break;
        }
      }
    } catch {
      // Continue next variation
    }
  }

  const name = wikiData?.title ? wikiData.title.replace(/\s*\([^)]+\)$/, "").trim() : trimmed;
  const description = wikiData?.description || "";
  const extract = wikiData?.extract || "";
  const portraitUrl = wikiData?.thumbnail?.source || wikiData?.originalimage?.source || null;

  // Determine role & typePath
  const fullText = `${description} ${extract}`.toLowerCase();
  let role: "AUTHOR" | "DIRECTOR" | "MUSICIAN" | "ARTIST" | "CREATOR" = "CREATOR";
  let typePath = "/person";

  if (
    /\b(?:filmmaker|film director|movie director|cinema director|screenwriter)\b/i.test(fullText) ||
    options?.forcedRole === "DIRECTOR"
  ) {
    role = "DIRECTOR";
    typePath = "/person/director";
  } else if (
    /\b(?:musician|singer|songwriter|composer|conductor|pianist|guitarist|trumpeter|bassist|drummer|vocalist|band)\b/i.test(
      fullText
    ) ||
    options?.forcedRole === "MUSICIAN"
  ) {
    role = "MUSICIAN";
    typePath = "/person/musician";
  } else if (
    /\b(?:painter|sculptor|printmaker|illustrator|visual artist|ceramicist)\b/i.test(fullText) ||
    options?.forcedRole === "ARTIST"
  ) {
    role = "ARTIST";
    typePath = "/person/artist";
  } else if (
    /\b(?:author|writer|novelist|poet|playwright|essayist|biographer)\b/i.test(fullText) ||
    options?.forcedRole === "AUTHOR"
  ) {
    role = "AUTHOR";
    typePath = "/person/author";
  }

  // Parse birth and death years from description (e.g. "English modernist writer (1882–1941)")
  let birthYear: number | undefined;
  let deathYear: number | undefined;

  const yearsMatch = description.match(/\b(1[6789]\d\d|20[0-2]\d)\s*[–—\-]\s*(1[6789]\d\d|20[0-2]\d|\b)/);
  if (yearsMatch) {
    birthYear = parseInt(yearsMatch[1], 10);
    if (yearsMatch[2]) {
      deathYear = parseInt(yearsMatch[2], 10);
    }
  } else {
    const singleYear = (description || extract).match(/\bborn\s+(?:in\s+)?(1[6789]\d\d|20[0-2]\d)\b/i);
    if (singleYear) {
      birthYear = parseInt(singleYear[1], 10);
    }
  }

  // Parse nationality
  const nationalityMatch = description.match(
    /\b(English|British|American|French|Spanish|German|Italian|Japanese|Russian|Irish|Scottish|Canadian|Australian|Mexican|Argentine|Brazilian|Swedish|Norwegian|Danish|Dutch|Portuguese|Polish|Greek|Austrian|Swiss|Chinese|Korean|Indian)\b/i
  );
  const nationality = nationalityMatch ? nationalityMatch[1] : undefined;

  // Extract notable works mentioned in quotation marks or italics in the extract
  const notableWorks: string[] = [];
  const quotes = extract.match(/"([^"]+)"|'([^']+)'/g);
  if (quotes) {
    quotes.forEach((q: string) => {
      const clean = q.replace(/['"]/g, "").trim();
      if (clean.length > 2 && clean.length < 60 && !notableWorks.includes(clean)) {
        notableWorks.push(clean);
      }
    });
  }

  const canonicalUrl = wikiData?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${canonicalPageTitle}`;
  const canonicalExternalId = wikiData?.wikibase_item || `creator:${canonicalPageTitle}`;

  return {
    name,
    role,
    typePath,
    coreType: "CREATOR",
    summary: extract.slice(0, 320) + (extract.length > 320 ? "..." : ""),
    portraitUrl,
    birthYear,
    deathYear,
    nationality,
    bio: extract,
    notableWorks: notableWorks.slice(0, 5),
    canonicalExternalId,
    canonicalUrl,
    coreStructuredData: {
      name,
      role,
      birthYear,
      deathYear,
      nationality,
      bio: extract,
      notableWorks: notableWorks.slice(0, 5),
      wikidataUri: wikiData?.wikibase_item ? `https://www.wikidata.org/wiki/${wikiData.wikibase_item}` : undefined,
    },
  };
}
