export interface TypePromptInfo {
  key: string;
  name: string;
  listTitle: string;
  coreType?: string;
}

const EXCLUDED_TYPE_PATHS = new Set([
  "/product/generic",
  "/general",
  "/uncategorized",
  "/private_memo",
  "/memo",
]);

const UNCOUNTABLE_TYPE_NAMES = new Set([
  "cinema",
  "music",
  "art",
  "footwear",
  "outerwear",
  "apparel",
  "media",
  "hardware",
  "skincare",
]);

function humanizeTypeSegment(segment: string): string {
  return segment
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Formats a clean plural smart-list title for a discovered type name
 * (e.g. "Cosmetics" -> "Cosmetics", "Cinema" -> "Cinema", "Watch" -> "Watches", "Winery" -> "Wineries").
 */
export function pluralizeTypeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Items";
  const lower = trimmed.toLowerCase();
  if (UNCOUNTABLE_TYPE_NAMES.has(lower)) {
    return trimmed;
  }
  if (lower.endsWith("s") && !lower.endsWith("ss")) {
    return trimmed;
  }
  if (/[^aeiou]y$/i.test(trimmed)) {
    return `${trimmed.slice(0, -1)}ies`;
  }
  if (/(?:ch|sh|x|z|ss)$/i.test(trimmed)) {
    return `${trimmed}es`;
  }
  return `${trimmed}s`;
}

/**
 * Extracts normalized type prompt metadata for the "New type added" smart-list prompt.
 * Prefers explicit hierarchical `typePath` (`save.typePath` then `entity.typePath`) over coarse `coreType`,
 * and excludes fallback/memo paths (`/product/generic`, `/memo/*`, `NOTE`).
 */
export function extractTypeInfo(card: {
  save: { isPrivateMemo: boolean; typePath?: string | null };
  entity?: { typePath?: string | null; coreType?: string | null } | null;
}): TypePromptInfo | null {
  if (card.save.isPrivateMemo) return null;

  const rawTypePath =
    card.save.typePath && card.save.typePath !== "/"
      ? card.save.typePath
      : card.entity?.typePath && card.entity.typePath !== "/"
      ? card.entity.typePath
      : null;

  if (rawTypePath) {
    const normalizedRel = rawTypePath.trim().replace(/\/+$/, "").toLowerCase();
    const key = normalizedRel.startsWith("/") ? normalizedRel : `/${normalizedRel}`;
    if (EXCLUDED_TYPE_PATHS.has(key) || key.startsWith("/memo/")) {
      return null;
    }
    const segments = key.split("/").filter(Boolean);
    const lastSeg = segments[segments.length - 1];
    if (lastSeg) {
      const name = humanizeTypeSegment(lastSeg);
      return {
        key,
        name,
        listTitle: pluralizeTypeName(name),
        coreType: card.entity?.coreType || undefined,
      };
    }
  }

  if (card.entity?.coreType) {
    const raw = card.entity.coreType.trim().toLowerCase();
    if (!raw || raw === "note" || raw === "unknown") {
      return null;
    }
    const name = raw === "media" ? "Cinema" : humanizeTypeSegment(raw);
    return {
      key: raw,
      name,
      listTitle: pluralizeTypeName(name),
      coreType: card.entity.coreType,
    };
  }

  return null;
}

/**
 * Checks whether an existing smart list already covers the discovered type
 * by title or by exact/ancestor `typePathPrefix` (or `coreType` fallback).
 */
export function isTypeCoveredByBoards(
  typeInfo: TypePromptInfo,
  lists: Array<{
    title: string;
    autoRules?: { coreType?: string; typePathPrefix?: string } | null;
  }>
): boolean {
  const lowerName = typeInfo.name.toLowerCase();
  const lowerListTitle = typeInfo.listTitle.toLowerCase();
  const lowerNaivePlural = `${typeInfo.name}s`.toLowerCase();
  const normalizedKey = typeInfo.key.trim().replace(/\/+$/, "").toLowerCase();

  return lists.some((l) => {
    const boardTitle = l.title.trim().toLowerCase();
    if (
      boardTitle === lowerName ||
      boardTitle === lowerListTitle ||
      boardTitle === lowerNaivePlural
    ) {
      return true;
    }
    const prefix = l.autoRules?.typePathPrefix?.trim().replace(/\/+$/, "").toLowerCase();
    if (prefix && normalizedKey.startsWith("/")) {
      if (normalizedKey === prefix || normalizedKey.startsWith(`${prefix}/`)) {
        return true;
      }
    }
    if (!normalizedKey.startsWith("/") && typeInfo.coreType && l.autoRules?.coreType) {
      if (l.autoRules.coreType.toUpperCase() === typeInfo.coreType.toUpperCase()) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Builds the `autoRules` payload for a newly prompted smart list.
 * Uses `{ typePathPrefix }` whenever `typeInfo.key` is a hierarchical `typePath` (e.g. `/product/beverage/wine`),
 * falling back to `{ coreType }` only when no `typePath` is available.
 */
export function buildNewTypeAutoRules(
  typeInfo: TypePromptInfo
): { typePathPrefix: string } | { coreType: string } | undefined {
  const trimmedKey = typeInfo.key.trim().replace(/\/+$/, "");
  if (trimmedKey.startsWith("/") && trimmedKey.length > 1) {
    return { typePathPrefix: trimmedKey.toLowerCase() };
  }
  if (typeInfo.coreType) {
    return { coreType: typeInfo.coreType };
  }
  return undefined;
}
