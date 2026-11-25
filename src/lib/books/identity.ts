import type { GlobalEntity, UserSave } from "@/db";
import { cleanCommercialBookTitle } from "./library";

export interface BookIdentityProbe {
  title?: string | null;
  author?: string | null;
  isbn?: string | null;
  goodreadsBookId?: string | null;
  coverUrl?: string | null;
}

const AUTHOR_STOPWORDS = new Set([
  "the",
  "and",
  "with",
  "von",
  "van",
  "del",
  "los",
  "las",
  "de",
  "la",
  "el",
  "unknown",
  "author",
  "varios",
  "autores",
]);

function asRecord(val: unknown): Record<string, any> {
  return val && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, any>)
    : {};
}

export function extractEmbeddedIsbn13(raw?: string | null): string | null {
  if (!raw) return null;
  const compact = raw.replace(/[-–\s]/g, "");
  const m = compact.match(/(97[89]\d{10})/);
  return m ? m[1] : null;
}

export function normalizeIsbn(raw?: string | null): string | null {
  if (!raw) return null;
  const clean = raw.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (clean.length === 10 || clean.length === 13) return clean;
  return null;
}

function extractSeriesVolume(rawTitle?: string | null): string | null {
  if (!rawTitle) return null;
  const m = rawTitle.match(
    /(?:\(|,\s*|\s+)(?:vol(?:ume)?\.?|tomo|book|part|parte|#)\s*(\d+)\b/i
  );
  return m ? m[1] : null;
}

export function normalizeBookTitleKey(rawTitle: string): string {
  const cleaned = cleanCommercialBookTitle(rawTitle || "").title;
  let text = cleaned
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[…]+|\.{3,}$/g, "")
    .trim();

  // Strip trailing edition/format parentheticals
  text = text
    .replace(
      /\s*\((?:spanish|english|french|german|italian|portuguese|paperback|hardcover|kindle|ebook|audiobook|tapa\s+(?:blanda|dura)|edici[oó]n\s+[^)]*|reprint|illustrated|pocketbook|pocket)[^)]*\)\s*$/gi,
      ""
    )
    .trim();

  // Strip commercial or explanatory subtitle after ":" when base title is meaningful
  const colonIdx = text.indexOf(":");
  if (colonIdx >= 4) {
    const prefix = text.slice(0, colonIdx).trim();
    const prefixAlnum = prefix.replace(/[^a-zA-Z0-9]/g, "");
    if (
      prefixAlnum.length >= 4 &&
      !/^(?:vol|book|part|parte|no|insight|national\s+geographic)/i.test(prefix)
    ) {
      text = prefix;
    }
  }

  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCoverForMatch(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || /nophoto|placeholder/i.test(trimmed)) return null;
  return trimmed.split("?")[0].toLowerCase();
}

function normalizeAuthorTokens(raw?: string | null): string[] {
  if (!raw) return [];
  const clean = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!clean || clean === "unknown author" || clean === "unknown") return [];
  return clean
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !AUTHOR_STOPWORDS.has(tok));
}

function areAuthorsCompatible(a?: string | null, b?: string | null): boolean {
  const toksA = normalizeAuthorTokens(a);
  const toksB = normalizeAuthorTokens(b);
  if (toksA.length === 0 || toksB.length === 0) return true;
  const joinedA = toksA.join(" ");
  const joinedB = toksB.join(" ");
  if (joinedA.includes(joinedB) || joinedB.includes(joinedA)) return true;
  const setB = new Set(toksB);
  return toksA.some((tok) => setB.has(tok));
}

export function areSameBook(a: BookIdentityProbe, b: BookIdentityProbe): boolean {
  const isbnA = normalizeIsbn(a.isbn) || extractEmbeddedIsbn13(a.title);
  const isbnB = normalizeIsbn(b.isbn) || extractEmbeddedIsbn13(b.title);
  if (isbnA && isbnB && isbnA === isbnB) {
    return true;
  }

  const grA = a.goodreadsBookId?.trim();
  const grB = b.goodreadsBookId?.trim();
  if (grA && grB && grA === grB) {
    return true;
  }

  const coverA = normalizeCoverForMatch(a.coverUrl);
  const coverB = normalizeCoverForMatch(b.coverUrl);
  if (coverA && coverB && coverA === coverB) {
    return true;
  }

  const keyA = normalizeBookTitleKey(a.title || "");
  const keyB = normalizeBookTitleKey(b.title || "");
  if (keyA.length >= 4 && keyA === keyB) {
    const volA = extractSeriesVolume(a.title);
    const volB = extractSeriesVolume(b.title);
    if (volA && volB && volA !== volB) {
      return false;
    }
    return areAuthorsCompatible(a.author, b.author);
  }

  return false;
}

export function extractBookProbe(
  save: { privateTitle?: string | null; userCustomValues?: unknown },
  entity: {
    title?: string | null;
    brandOrCreator?: string | null;
    heroImageUrl?: string | null;
    canonicalExternalId?: string | null;
    coreStructuredData?: unknown;
    extendedAttributes?: unknown;
  } | null
): BookIdentityProbe {
  const csd = asRecord(entity?.coreStructuredData);
  const ext = asRecord(entity?.extendedAttributes);
  const cv = asRecord(save.userCustomValues);
  const rawTitle = (save.privateTitle || entity?.title || "").trim();
  const cleaned = cleanCommercialBookTitle(rawTitle);

  const author =
    String(
      csd.author ||
        ext.author ||
        entity?.brandOrCreator ||
        cleaned.authorHint ||
        ""
    ).trim() || null;

  const isbn =
    normalizeIsbn(typeof csd.isbn === "string" ? csd.isbn : null) ||
    (entity?.canonicalExternalId?.startsWith("isbn:")
      ? normalizeIsbn(entity.canonicalExternalId.slice(5))
      : null) ||
    normalizeIsbn(typeof ext.modelNumber === "string" ? ext.modelNumber : null) ||
    extractEmbeddedIsbn13(rawTitle);

  const goodreadsBookId =
    (typeof cv.goodreadsBookId === "string" && cv.goodreadsBookId.trim()) ||
    (typeof csd.goodreadsId === "string" && csd.goodreadsId.trim()) ||
    (entity?.canonicalExternalId?.startsWith("goodreads:")
      ? entity.canonicalExternalId.slice(10).trim()
      : null) ||
    null;

  return {
    title: rawTitle,
    author,
    isbn,
    goodreadsBookId,
    coverUrl: entity?.heroImageUrl || null,
  };
}

export function findDuplicateBookGroups<
  T extends {
    save: Pick<UserSave, "privateTitle" | "userCustomValues">;
    entity: Pick<
      GlobalEntity,
      | "title"
      | "brandOrCreator"
      | "heroImageUrl"
      | "canonicalExternalId"
      | "coreStructuredData"
      | "extendedAttributes"
    > | null;
  }
>(rows: T[]): T[][] {
  if (rows.length < 2) return [];
  const probes = rows.map((r) => extractBookProbe(r.save, r.entity));
  const parent = rows.map((_, i) => i);

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (areSameBook(probes[i], probes[j])) {
        union(i, j);
      }
    }
  }

  const buckets = new Map<number, T[]>();
  for (let i = 0; i < rows.length; i++) {
    const root = find(i);
    const list = buckets.get(root) || [];
    list.push(rows[i]);
    buckets.set(root, list);
  }

  return [...buckets.values()].filter((g) => g.length >= 2);
}

/**
 * Shared Goodreads HTML/table boilerplate sanitizer (client- and server-safe).
 */
export function sanitizeGoodreadsNote(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s*\[edit\]\s*/gi, "\n")
    .replace(/\s*\.\.\.more\s*$/gi, "")
    .replace(/\s*\(less\)\s*$/gi, "");

  const keptLines: string[] = [];
  for (const rawLine of cleaned.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (keptLines.length > 0 && keptLines[keptLines.length - 1] !== "") {
        keptLines.push("");
      }
      continue;
    }
    if (
      /^(?:review|notes|my\s+comment|write\s+a\s+review|add\s+notes|none|\[edit\]|edit|\.\.\.more|\(less\))$/i.test(
        line
      )
    ) {
      continue;
    }
    keptLines.push(line);
  }

  const out = keptLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out || null;
}

/**
 * Matches travel guides, phrasebooks, and language/study textbooks that belong in
 * My Stuff / Travel & Study rather than the reading library.
 */
export function isTravelGuideOrStudyBook(probe: string): boolean {
  if (!probe) return false;
  if (
    /\b(travel\s*guide|guide\s*book|guidebook|travel\s*book|country\s*guide|lonely\s*planet|insight\s*guides?|national\s*geographic\s*traveler|gu[ií]a\s+de\s+viaje|gu[ií]as?\s+(?:de\s+pa[ií]s|de\s+cerca)|guiarama|rough\s*guide|fodor'?s|frommer'?s|rick\s*steves|dk\s*eyewitness|michelin\s+green\s+guide|marco\s+polo\s+guide)\b/i.test(
      probe
    )
  ) {
    return true;
  }
  if (
    /\b(language\s*book|foreign\s*language|textbook|workbook|study\s*guide|exam\s*prep|coursebook|curso\s+de\s+(?:alem[aá]n|franc[eé]s|ingl[eé]s|espa[ñn]ol)|spektrum\s+deutsch|edito\s+[abc][12]|cahier\s+d'?exercices|eleve\+?cd|grammar\s+in\s+use|goethe-?zertifikat|delf\s+[abc][12]|ielts|toefl)\b/i.test(
      probe
    )
  ) {
    return true;
  }
  return /\b(?:deutsch|fran[cç]ais|english|espa[ñn]ol)\s+[abc][12]\+?\b/i.test(
    probe
  );
}
