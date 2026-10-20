/**
 * Curated Secondary Types Catalog & Schema Sharing Specification (PRD v3.2 §4.3)
 *
 * Tier 0 (Core Archetypes): Always active (Film, Book, Vinyl/Song, Place, Recipe, Wine, Art, Text Note).
 * Tier 1 (Secondary Types): Inactive by default, discoverable in Catalog, 1-tap installable.
 */

export interface CatalogFieldDefinition {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select";
  required?: boolean;
  options?: string[];
}

export interface CatalogTypeDefinition {
  id: string; // Catalog slug identifier
  name: string;
  typePath: string;
  parentTypePath?: string;
  rootArchetype: string;
  defaultSilhouette: string;
  description: string;
  icon?: string; // Lucide icon identifier
  fields: CatalogFieldDefinition[];
  extractionPrompt?: string;
  identityRules?: {
    hardExternalIdKeys?: string[];
    fingerprintFields?: string[];
  };
  publicFieldKeys?: string[];
  uiFieldConfig?: Array<{
    key: string;
    label: string;
    primitive: string;
    isPublicObjective: boolean;
  }>;
  jsonSchema?: Record<string, unknown>;
  ownJsonSchema?: Record<string, unknown>;
  effectiveJsonSchema?: Record<string, unknown>;
}

export interface CurioSchemaSpec {
  schemaVersion: "1.0";
  curioType: {
    name: string;
    typePath: string;
    parentTypePath?: string;
    rootArchetype: string;
    defaultSilhouette: string;
    description?: string;
    extractionPrompt?: string;
    fields: CatalogFieldDefinition[];
    identityRules?: {
      hardExternalIdKeys?: string[];
      fingerprintFields?: string[];
    };
    jsonSchema?: Record<string, unknown>;
    ownJsonSchema?: Record<string, unknown>;
    effectiveJsonSchema?: Record<string, unknown>;
    publicFieldKeys?: string[];
    uiFieldConfig?: Array<{
      key: string;
      label: string;
      primitive: string;
      isPublicObjective: boolean;
    }>;
  };
  exportedAt: string;
  sourceInstance?: string;
}

export function buildJsonSchemaFromFields(fields: CatalogFieldDefinition[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const f of fields) {
    properties[f.key] = {
      type: f.type === "number" ? "number" : f.type === "boolean" ? "boolean" : "string",
      title: f.label,
      ...(f.options ? { enum: f.options } : {}),
    };
    if (f.required) {
      required.push(f.key);
    }
  }

  return {
    type: "object",
    properties,
    required,
  };
}

export const CURIO_SECONDARY_CATALOG: CatalogTypeDefinition[] = [
  {
    id: "quote",
    name: "Quote",
    typePath: "/quote",
    parentTypePath: "/private_memo",
    rootArchetype: "MEMO",
    defaultSilhouette: "quote",
    description: "Memorable quotations, passages, maxims, and excerpts with speaker attribution, source work, and date.",
    icon: "Quote",
    fields: [
      { key: "text", label: "Quotation Text", type: "string", required: true },
      { key: "author", label: "Author / Speaker", type: "string", required: true },
      { key: "date", label: "Date / Era", type: "string", required: false },
      { key: "work", label: "Source Work / Context", type: "string", required: false },
    ],
    extractionPrompt: "Extract quotation text, author or speaker, date or era, and source work or publication.",
    identityRules: {
      fingerprintFields: ["author", "text"],
    },
    publicFieldKeys: ["text", "author", "date", "work"],
    uiFieldConfig: [
      { key: "text", label: "Quote", primitive: "string", isPublicObjective: true },
      { key: "author", label: "Author", primitive: "string", isPublicObjective: true },
      { key: "date", label: "Date", primitive: "string", isPublicObjective: true },
      { key: "work", label: "Source Work", primitive: "string", isPublicObjective: true },
    ],
  },
  {
    id: "watch",
    name: "Watch / Horology",
    typePath: "/product/watch",
    parentTypePath: "/product",
    rootArchetype: "PRODUCT",
    defaultSilhouette: "landscape_label",
    description: "Horological timepieces, vintage references, complications, calibers, and case materials.",
    icon: "Watch",
    fields: [
      { key: "brand", label: "Brand / Manufacture", type: "string", required: true },
      { key: "model", label: "Model Name", type: "string", required: true },
      { key: "reference", label: "Reference Number", type: "string", required: false },
      { key: "movement", label: "Movement / Caliber", type: "string", required: false },
      { key: "case_material", label: "Case Material", type: "string", required: false },
    ],
    extractionPrompt: "Extract watch brand, model, reference number, movement type, and case material.",
    identityRules: {
      hardExternalIdKeys: ["reference"],
      fingerprintFields: ["brand", "model", "reference"],
    },
    publicFieldKeys: ["brand", "model", "reference", "movement", "case_material"],
    uiFieldConfig: [
      { key: "brand", label: "Brand", primitive: "string", isPublicObjective: true },
      { key: "model", label: "Model", primitive: "string", isPublicObjective: true },
      { key: "reference", label: "Reference", primitive: "string", isPublicObjective: true },
      { key: "movement", label: "Movement", primitive: "string", isPublicObjective: true },
      { key: "case_material", label: "Case Material", primitive: "string", isPublicObjective: true },
    ],
  },
  {
    id: "coffee",
    name: "Specialty Coffee",
    typePath: "/product/beverage/coffee",
    parentTypePath: "/product",
    rootArchetype: "PRODUCT",
    defaultSilhouette: "landscape_label",
    description: "Single-origin and micro-lot coffees with roaster, washing process, varietal, elevation, and tasting notes.",
    icon: "Coffee",
    fields: [
      { key: "roaster", label: "Roaster", type: "string", required: true },
      { key: "origin", label: "Origin / Region", type: "string", required: true },
      { key: "process", label: "Process (Washed/Natural/Honey)", type: "string", required: false },
      { key: "varietal", label: "Varietal", type: "string", required: false },
      { key: "elevation", label: "Elevation (MASL)", type: "string", required: false },
      { key: "tasting_notes", label: "Tasting Notes", type: "string", required: false },
    ],
    extractionPrompt: "Extract coffee roaster, origin country/region, processing method, coffee varietal, elevation, and cup tasting notes.",
    identityRules: {
      fingerprintFields: ["roaster", "origin", "process"],
    },
    publicFieldKeys: ["roaster", "origin", "process", "varietal", "elevation", "tasting_notes"],
    uiFieldConfig: [
      { key: "roaster", label: "Roaster", primitive: "string", isPublicObjective: true },
      { key: "origin", label: "Origin", primitive: "string", isPublicObjective: true },
      { key: "process", label: "Process", primitive: "string", isPublicObjective: true },
      { key: "varietal", label: "Varietal", primitive: "string", isPublicObjective: true },
      { key: "elevation", label: "Elevation", primitive: "string", isPublicObjective: true },
      { key: "tasting_notes", label: "Tasting Notes", primitive: "string", isPublicObjective: true },
    ],
  },
  {
    id: "fragrance",
    name: "Fragrance / Perfume",
    typePath: "/product/cosmetics/fragrance",
    parentTypePath: "/product/cosmetics",
    rootArchetype: "PRODUCT",
    defaultSilhouette: "cosmetics",
    description: "Artisanal perfumes, extraits, noses, fragrance houses, and olfactory pyramids (top, heart, base).",
    icon: "Sparkles",
    fields: [
      { key: "house", label: "Fragrance House / Brand", type: "string", required: true },
      { key: "perfumer", label: "Perfumer / Nose", type: "string", required: false },
      { key: "concentration", label: "Concentration (EDP/EDT/Extrait)", type: "string", required: false },
      { key: "top_notes", label: "Top Notes", type: "string", required: false },
      { key: "heart_notes", label: "Heart Notes", type: "string", required: false },
      { key: "base_notes", label: "Base Notes", type: "string", required: false },
    ],
    extractionPrompt: "Extract fragrance house, perfumer name, concentration, top olfactory notes, heart notes, and base notes.",
    identityRules: {
      fingerprintFields: ["house", "perfumer", "concentration"],
    },
    publicFieldKeys: ["house", "perfumer", "concentration", "top_notes", "heart_notes", "base_notes"],
    uiFieldConfig: [
      { key: "house", label: "House", primitive: "string", isPublicObjective: true },
      { key: "perfumer", label: "Perfumer", primitive: "string", isPublicObjective: true },
      { key: "concentration", label: "Concentration", primitive: "string", isPublicObjective: true },
      { key: "top_notes", label: "Top Notes", primitive: "string", isPublicObjective: true },
      { key: "heart_notes", label: "Heart Notes", primitive: "string", isPublicObjective: true },
      { key: "base_notes", label: "Base Notes", primitive: "string", isPublicObjective: true },
    ],
  },
  {
    id: "podcast",
    name: "Podcast",
    typePath: "/media/podcast",
    parentTypePath: "/media/film",
    rootArchetype: "MEDIA",
    defaultSilhouette: "circle",
    description: "Audio shows, episodic series, hosts, production networks, and topics.",
    icon: "Mic",
    fields: [
      { key: "host", label: "Host / Creator", type: "string", required: true },
      { key: "network", label: "Network / Studio", type: "string", required: false },
      { key: "frequency", label: "Release Frequency", type: "string", required: false },
      { key: "category", label: "Category / Genre", type: "string", required: false },
    ],
    extractionPrompt: "Extract podcast host, network or studio, release frequency, and category.",
    identityRules: {
      fingerprintFields: ["host", "network"],
    },
    publicFieldKeys: ["host", "network", "frequency", "category"],
    uiFieldConfig: [
      { key: "host", label: "Host", primitive: "string", isPublicObjective: true },
      { key: "network", label: "Network", primitive: "string", isPublicObjective: true },
      { key: "frequency", label: "Frequency", primitive: "string", isPublicObjective: true },
      { key: "category", label: "Category", primitive: "string", isPublicObjective: true },
    ],
  },
];

// Attach schemas to catalog entries
for (const entry of CURIO_SECONDARY_CATALOG) {
  const schema = buildJsonSchemaFromFields(entry.fields);
  entry.jsonSchema = schema;
  entry.ownJsonSchema = schema;
  entry.effectiveJsonSchema = schema;
}

/**
 * Returns all predefined secondary types in the Curio catalog.
 */
export function getCatalogTypes(): CatalogTypeDefinition[] {
  return [...CURIO_SECONDARY_CATALOG];
}

/**
 * Finds a catalog type by its unique path (e.g. "/quote", "/product/watch")
 */
export function getCatalogTypeByPath(typePath: string): CatalogTypeDefinition | undefined {
  const cleanPath = typePath.toLowerCase().trim();
  return CURIO_SECONDARY_CATALOG.find((t) => t.typePath.toLowerCase() === cleanPath);
}

/**
 * Finds a catalog type by its slug ID (e.g. "quote", "watch", "coffee")
 */
export function getCatalogTypeById(id: string): CatalogTypeDefinition | undefined {
  const cleanId = id.toLowerCase().trim();
  return CURIO_SECONDARY_CATALOG.find((t) => t.id.toLowerCase() === cleanId);
}

/**
 * Checks whether a given typePath is currently installed for the user.
 */
export function isTypeInstalled(
  typePath: string,
  userTypes: Array<{ typePath: string; userId?: string | null }>,
  userId?: string
): boolean {
  const cleanPath = typePath.toLowerCase().trim();
  return userTypes.some((t) => {
    if (t.typePath.toLowerCase() !== cleanPath) return false;
    if (userId) {
      return t.userId === userId || t.userId === null;
    }
    return true;
  });
}

/**
 * Exports a Curio custom type or catalog type as a portable JSON schema specification.
 */
export function exportCurioSchemaSpec(
  typeRecord: {
    name: string;
    typePath: string;
    parentTypePath?: string | null;
    rootArchetype: string;
    defaultSilhouette: string;
    extractionPrompt?: string | null;
    identityRules?: any;
    jsonSchema?: any;
    ownJsonSchema?: any;
    effectiveJsonSchema?: any;
    publicFieldKeys?: any;
    uiFieldConfig?: any;
  },
  sourceInstance: string = "curio.local"
): CurioSchemaSpec {
  // Extract fields either from uiFieldConfig or properties
  const fields: CatalogFieldDefinition[] = [];
  const schemaProps =
    (typeRecord.effectiveJsonSchema as any)?.properties ||
    (typeRecord.ownJsonSchema as any)?.properties ||
    (typeRecord.jsonSchema as any)?.properties ||
    {};
  const requiredKeys = new Set<string>(
    (typeRecord.effectiveJsonSchema as any)?.required ||
    (typeRecord.ownJsonSchema as any)?.required ||
    (typeRecord.jsonSchema as any)?.required ||
    []
  );

  if (Array.isArray(typeRecord.uiFieldConfig) && typeRecord.uiFieldConfig.length > 0) {
    for (const u of typeRecord.uiFieldConfig) {
      const prop = schemaProps[u.key] || {};
      fields.push({
        key: u.key,
        label: u.label || u.key,
        type: u.primitive === "number" ? "number" : u.primitive === "boolean" ? "boolean" : "string",
        required: requiredKeys.has(u.key),
        options: Array.isArray(prop.enum) ? prop.enum : undefined,
      });
    }
  } else {
    for (const [key, prop] of Object.entries<any>(schemaProps)) {
      fields.push({
        key,
        label: prop.title || key,
        type: prop.type === "number" ? "number" : prop.type === "boolean" ? "boolean" : "string",
        required: requiredKeys.has(key),
        options: Array.isArray(prop.enum) ? prop.enum : undefined,
      });
    }
  }

  return {
    schemaVersion: "1.0",
    curioType: {
      name: typeRecord.name,
      typePath: typeRecord.typePath,
      parentTypePath: typeRecord.parentTypePath || undefined,
      rootArchetype: typeRecord.rootArchetype,
      defaultSilhouette: typeRecord.defaultSilhouette,
      extractionPrompt: typeRecord.extractionPrompt || undefined,
      fields,
      identityRules: typeRecord.identityRules || undefined,
      jsonSchema: typeRecord.jsonSchema || buildJsonSchemaFromFields(fields),
      ownJsonSchema: typeRecord.ownJsonSchema || buildJsonSchemaFromFields(fields),
      effectiveJsonSchema: typeRecord.effectiveJsonSchema || buildJsonSchemaFromFields(fields),
      publicFieldKeys: Array.isArray(typeRecord.publicFieldKeys)
        ? typeRecord.publicFieldKeys
        : fields.map((f) => f.key),
      uiFieldConfig: typeRecord.uiFieldConfig || undefined,
    },
    exportedAt: new Date().toISOString(),
    sourceInstance,
  };
}

/**
 * Validates and parses an incoming CurioSchemaSpec bundle.
 */
export function validateCurioSchemaSpec(raw: unknown): CurioSchemaSpec {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid schema bundle: payload must be a JSON object");
  }

  const spec = raw as Partial<CurioSchemaSpec>;
  if (spec.schemaVersion !== "1.0") {
    throw new Error(`Unsupported schemaVersion '${spec.schemaVersion}'. Expected '1.0'`);
  }

  const ct = spec.curioType;
  if (!ct || typeof ct !== "object") {
    throw new Error("Invalid schema bundle: missing 'curioType' definition");
  }

  if (!ct.name || typeof ct.name !== "string") {
    throw new Error("Invalid schema bundle: 'curioType.name' is required");
  }

  if (!ct.typePath || typeof ct.typePath !== "string" || !ct.typePath.startsWith("/")) {
    throw new Error("Invalid schema bundle: 'curioType.typePath' must be a valid path starting with '/'");
  }

  const fields: CatalogFieldDefinition[] = Array.isArray(ct.fields)
    ? ct.fields.map((f: any) => ({
        key: String(f.key || ""),
        label: String(f.label || f.key || ""),
        type: (["string", "number", "boolean", "select"].includes(f.type) ? f.type : "string") as any,
        required: Boolean(f.required),
        options: Array.isArray(f.options) ? f.options.map(String) : undefined,
      })).filter((f) => f.key.length > 0)
    : [];

  return {
    schemaVersion: "1.0",
    curioType: {
      name: ct.name.trim(),
      typePath: ct.typePath.trim(),
      parentTypePath: ct.parentTypePath ? String(ct.parentTypePath).trim() : undefined,
      rootArchetype: ct.rootArchetype || "PRODUCT",
      defaultSilhouette: ct.defaultSilhouette || "landscape_label",
      description: ct.description,
      extractionPrompt: ct.extractionPrompt,
      fields,
      identityRules: ct.identityRules,
      jsonSchema: ct.jsonSchema || buildJsonSchemaFromFields(fields),
      ownJsonSchema: ct.ownJsonSchema || buildJsonSchemaFromFields(fields),
      effectiveJsonSchema: ct.effectiveJsonSchema || buildJsonSchemaFromFields(fields),
      publicFieldKeys: Array.isArray(ct.publicFieldKeys) ? ct.publicFieldKeys : fields.map((f) => f.key),
      uiFieldConfig: ct.uiFieldConfig,
    },
    exportedAt: spec.exportedAt || new Date().toISOString(),
    sourceInstance: spec.sourceInstance,
  };
}

export interface ParsedQuote {
  isQuote: boolean;
  text: string;
  author: string;
  date?: string;
  work?: string;
}

/**
 * Parses quotation strings (e.g. '"..." - Author', 'quote: ... by Author', '"..." - Seneca (c. 65 AD)').
 */
export function parseQuoteInput(input: string): ParsedQuote | null {
  const trimmed = input.trim();
  let clean = trimmed;

  const prefixMatch = clean.match(/^quote:\s*(.+)$/i);
  if (prefixMatch) {
    clean = prefixMatch[1].trim();
  }

  // 1. Quoted text with quotation marks: "..." or “...”
  const quotedMatch = clean.match(/^["“]([\s\S]+?)["”]\s*(?:[-—–]|by|,)\s*([\s\S]+)$/i);
  if (quotedMatch) {
    const text = quotedMatch[1].trim();
    let authorPart = quotedMatch[2].trim();
    let date: string | undefined;
    let work: string | undefined;

    // Check for year/date in parentheses: e.g. Author (1942) or Author (c. 65 AD)
    const dateParenMatch = authorPart.match(/^(.+?)\s*\(((?:c\.?\s*)?\d{1,4}(?:\s*(?:BC|AD|BCE|CE))?)\)$/i);
    if (dateParenMatch) {
      authorPart = dateParenMatch[1].trim();
      date = dateParenMatch[2].trim();
    } else {
      const workParenMatch = authorPart.match(/^(.+?)\s*\((.+?)\)$/);
      if (workParenMatch) {
        authorPart = workParenMatch[1].trim();
        work = workParenMatch[2].trim();
      } else {
        const commaParts = authorPart.split(",");
        if (commaParts.length === 2) {
          authorPart = commaParts[0].trim();
          const secondPart = commaParts[1].trim();
          if (/^(?:c\.?\s*)?\d{1,4}(?:\s*(?:BC|AD|BCE|CE))?$/i.test(secondPart)) {
            date = secondPart;
          } else {
            work = secondPart;
          }
        }
      }
    }

    return {
      isQuote: true,
      text,
      author: authorPart || "Anonymous",
      date,
      work,
    };
  }

  // 2. Explicit prefix `quote:` without quotes
  if (prefixMatch) {
    const byMatch = clean.match(/^(.+?)\s+(?:[-—–]|by)\s+([^-—–\n]+)$/i);
    if (byMatch) {
      return {
        isQuote: true,
        text: byMatch[1].trim().replace(/^["“]|["”]$/g, ""),
        author: byMatch[2].trim(),
      };
    }
    return {
      isQuote: true,
      text: clean,
      author: "Anonymous",
    };
  }

  return null;
}

