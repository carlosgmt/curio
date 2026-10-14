export type FieldKind =
  | "text"
  | "number"
  | "date"
  | "select"
  | "rating"
  | "tag"
  | "checkbox";

export interface CustomTypeField {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  required?: boolean;
}

export interface CustomTypeDefinition {
  id: string; // slug, e.g. "wine"
  name: string; // display name, e.g. "Wine"
  description?: string;
  icon: string; // Lucide icon name, e.g. "Wine", "Sparkles"
  color: string;
  fields: CustomTypeField[];
  patterns: string[]; // keywords or regex strings
}

/**
 * Infer field kind from field name / label.
 */
export function inferFieldKind(name: string): FieldKind {
  const n = name.toLowerCase().replace(/_/g, " ").trim();
  if (/\b(rating|stars?|score)\b/.test(n)) return "rating";
  if (/\b(date|due|when|year|deadline|time)\b/.test(n)) return "date";
  if (/\b(price|cost|amount|count|sets|reps|weight|calories|pages|qty|quantity)\b/.test(n))
    return "number";
  if (/\b(tags?|labels?|category|genre)\b/.test(n)) return "tag";
  if (/\b(completed|done|active|favorite|is_\w+)\b/.test(n)) return "checkbox";
  return "text";
}

/**
 * Parses inline type creation syntax:
 * Examples:
 * - "new type: Wine (vintage, winery, region, rating)"
 * - "create type: Workout (exercise, sets, reps, weight)"
 * - "type: Plant (species, watering_frequency, sunlight)"
 */
export function parseInlineTypeDefinition(rawText: string): CustomTypeDefinition | null {
  const text = rawText.trim();
  const match = text.match(
    /^(?:new\s+type|create\s+type|type):\s*([a-zA-Z0-9_\s-]+?)(?:\s*\((.+?)\))?$/i
  );

  if (!match) return null;

  const rawName = match[1].trim();
  if (!rawName || rawName.length < 2) return null;

  const id = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const fieldsRaw = match[2];

  let fields: CustomTypeField[] = [];
  if (fieldsRaw) {
    fields = fieldsRaw
      .split(/[,;]/)
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => {
        const fieldKey = f.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
        const label = f.charAt(0).toUpperCase() + f.slice(1);
        return {
          key: fieldKey,
          label,
          kind: inferFieldKind(f),
        };
      });
  }

  // If no fields specified, create default title + notes
  if (fields.length === 0) {
    fields = [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "notes", label: "Notes", kind: "text" },
    ];
  }

  // Keywords default to the type name parts
  const patterns = [rawName.toLowerCase(), id];

  return {
    id,
    name: rawName.charAt(0).toUpperCase() + rawName.slice(1),
    icon: "Sparkles",
    color: "oklch(0.65 0.18 270)",
    fields,
    patterns,
  };
}

/**
 * Matches raw input text against user's custom types.
 */
export function matchCustomType(
  rawText: string,
  types: CustomTypeDefinition[]
): { type: CustomTypeDefinition; score: number } | null {
  const t = rawText.toLowerCase().trim();
  let bestMatch: CustomTypeDefinition | null = null;
  let highestScore = 0;

  for (const ct of types) {
    let score = 0;

    // Check direct pattern matches
    for (const pattern of ct.patterns) {
      if (!pattern) continue;
      const regex = new RegExp(`\\b${pattern}\\b`, "i");
      if (regex.test(t)) {
        score += 3;
      }
    }

    // Check field name mentions (e.g. "vintage 2018", "rating 5")
    for (const field of ct.fields) {
      const fieldRegex = new RegExp(`\\b${field.key}\\b`, "i");
      if (fieldRegex.test(t)) {
        score += 1.5;
      }
    }

    if (score > highestScore && score >= 3) {
      highestScore = score;
      bestMatch = ct;
    }
  }

  if (bestMatch && highestScore >= 3) {
    return { type: bestMatch, score: highestScore };
  }

  return null;
}
