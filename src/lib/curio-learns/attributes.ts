import { db, userSaves, globalEntities, curioTypes } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { classifyEntityType, invalidateTypeCache } from "./ontology";
import { generateDeterministicEmbedding } from "@/lib/search/vector";

export interface RegisterCustomTypeParams {
  name: string;
  parentTypePath: string;
  fields: Array<{
    key: string;
    label: string;
    type: "string" | "number" | "boolean" | "select";
    options?: string[];
  }>;
  rootArchetype?: string;
  defaultSilhouette?: string;
  extractionPrompt?: string;
}

export interface UpdateSaveCustomAttributesResult {
  save: typeof userSaves.$inferSelect;
  promotedAttributes: Record<string, unknown>;
}

/**
 * Updates custom key-value attributes on a user save and automatically evaluates
 * consensus promotion into global_entities.extended_attributes.
 */
export async function updateSaveCustomAttributes(
  saveId: string,
  customValues: Record<string, unknown>
): Promise<UpdateSaveCustomAttributesResult> {
  const [save] = await db.select().from(userSaves).where(eq(userSaves.id, saveId)).limit(1);
  if (!save) {
    throw new Error(`Save with ID ${saveId} not found`);
  }

  const currentValues =
    typeof save.userCustomValues === "object" && save.userCustomValues !== null
      ? (save.userCustomValues as Record<string, unknown>)
      : {};

  // Merge values: remove null/empty/undefined, set new ones
  const merged: Record<string, unknown> = { ...currentValues };
  for (const [key, val] of Object.entries(customValues)) {
    if (val === undefined || val === null || val === "") {
      delete merged[key];
    } else {
      merged[key] = val;
    }
  }

  const [updatedSave] = await db
    .update(userSaves)
    .set({
      userCustomValues: merged,
    })
    .where(eq(userSaves.id, saveId))
    .returning();

  let promotedAttributes: Record<string, unknown> = {};
  if (save.entityId) {
    promotedAttributes = await evaluateAttributePromotion(save.entityId);
  }

  return {
    save: updatedSave,
    promotedAttributes,
  };
}

/**
 * Consensus Promotion Engine:
 * Scans all user_saves for an entityId. When >= 2 distinct users have populated
 * the same attribute key with an identical value, merges that attribute into
 * global_entities.extended_attributes.
 * Restricted strictly to PUBLIC saves so private notes and fields never leak.
 */
export async function evaluateAttributePromotion(
  entityId: string
): Promise<Record<string, unknown>> {
  const saves = await db
    .select({
      userId: userSaves.userId,
      userCustomValues: userSaves.userCustomValues,
    })
    .from(userSaves)
    .where(
      and(
        eq(userSaves.entityId, entityId),
        eq(userSaves.visibility, "PUBLIC"),
        eq(userSaves.isPrivateMemo, false)
      )
    );

  if (saves.length < 2) {
    return {};
  }

  // Consensus map: key -> Map<serializedValue, { rawValue, userIds }>
  const consensusTracker = new Map<
    string,
    Map<string, { rawValue: unknown; userIds: Set<string> }>
  >();

  for (const s of saves) {
    const values =
      typeof s.userCustomValues === "object" && s.userCustomValues !== null
        ? (s.userCustomValues as Record<string, unknown>)
        : {};

    for (const [key, val] of Object.entries(values)) {
      if (val === undefined || val === null || val === "") continue;

      const normalizedKey = key.trim();
      const serialized = typeof val === "string" ? val.trim().toLowerCase() : JSON.stringify(val);

      if (!consensusTracker.has(normalizedKey)) {
        consensusTracker.set(normalizedKey, new Map());
      }
      const valMap = consensusTracker.get(normalizedKey)!;

      if (!valMap.has(serialized)) {
        valMap.set(serialized, { rawValue: val, userIds: new Set() });
      }
      valMap.get(serialized)!.userIds.add(s.userId);
    }
  }

  // Find consensus keys where userIds.size >= 2
  const newlyPromoted: Record<string, unknown> = {};

  for (const [key, valMap] of consensusTracker.entries()) {
    for (const [, { rawValue, userIds }] of valMap.entries()) {
      if (userIds.size >= 2) {
        newlyPromoted[key] = rawValue;
        break;
      }
    }
  }

  if (Object.keys(newlyPromoted).length === 0) {
    return {};
  }

  const [entity] = await db
    .select()
    .from(globalEntities)
    .where(eq(globalEntities.id, entityId))
    .limit(1);

  if (!entity) return {};

  const currentExtended =
    typeof entity.extendedAttributes === "object" && entity.extendedAttributes !== null
      ? (entity.extendedAttributes as Record<string, unknown>)
      : {};

  const mergedExtended = {
    ...currentExtended,
    ...newlyPromoted,
  };

  await db
    .update(globalEntities)
    .set({
      extendedAttributes: mergedExtended,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(globalEntities.id, entityId));

  return newlyPromoted;
}

/**
 * Defines a specialized custom subtype in curio_types with synonym convergence and delta schema computation.
 */
export async function registerCustomType(
  userId: string,
  data: RegisterCustomTypeParams
): Promise<typeof curioTypes.$inferSelect & { isSynonymConvergence?: boolean }> {
  // 1. Synonym Convergence Gate (>0.92)
  const classification = await classifyEntityType(data.name, userId);
  if (classification.similarity > 0.92 && classification.typeId) {
    const [existing] = await db
      .select()
      .from(curioTypes)
      .where(eq(curioTypes.id, classification.typeId))
      .limit(1);

    if (existing) {
      const existingAliases = (existing.localizedAliases as Record<string, string>) || {};
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32);
      if (!Object.values(existingAliases).some((v) => v.toLowerCase() === data.name.toLowerCase())) {
        const updatedAliases = { ...existingAliases, [slug]: data.name };
        await db
          .update(curioTypes)
          .set({ localizedAliases: updatedAliases })
          .where(eq(curioTypes.id, existing.id));
        existing.localizedAliases = updatedAliases;
        invalidateTypeCache();
      }
      return {
        ...existing,
        isSynonymConvergence: true,
      };
    }
  }

  // 2. Fetch parent archetype to inherit schemas
  const [parent] = await db
    .select()
    .from(curioTypes)
    .where(eq(curioTypes.typePath, data.parentTypePath))
    .limit(1);

  const cleanSlug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const typePath = `${data.parentTypePath.replace(/\/+$/, "")}/${cleanSlug}`;

  const rootArchetype = data.rootArchetype || parent?.rootArchetype || "PRODUCT";
  const defaultSilhouette = data.defaultSilhouette || parent?.defaultSilhouette || "landscape_label";

  // Delta Schema Computation:
  const parentEffectiveSchema = (parent?.effectiveJsonSchema as any) || (parent?.jsonSchema as any) || { properties: {} };
  const parentProperties: Record<string, any> = parentEffectiveSchema.properties || {};

  const ownProperties: Record<string, any> = {};
  for (const f of data.fields) {
    ownProperties[f.key] = {
      type: f.type === "number" ? "number" : f.type === "boolean" ? "boolean" : "string",
      title: f.label,
      ...(f.options ? { enum: f.options } : {}),
    };
  }

  const ownJsonSchema = {
    type: "object",
    properties: ownProperties,
    required: [],
  };

  const effectiveJsonSchema = {
    type: "object",
    properties: {
      ...parentProperties,
      ...ownProperties,
    },
    required: [],
  };

  const publicFieldKeys = data.fields.map((f) => f.key);
  const textToEmbed = `${data.name} ${typePath} ${rootArchetype} ${data.extractionPrompt || ""}`.trim();
  const typeEmbedding = generateDeterministicEmbedding(textToEmbed, 768);

  const [created] = await db
    .insert(curioTypes)
    .values({
      userId,
      parentTypeId: parent?.id || null,
      name: data.name,
      typePath,
      rootArchetype,
      defaultSilhouette,
      jsonSchema: ownJsonSchema,
      ownJsonSchema,
      effectiveJsonSchema,
      publicFieldKeys,
      typeEmbedding,
      extractionPrompt: data.extractionPrompt || `Extract custom attributes for ${data.name}.`,
    })
    .returning();

  invalidateTypeCache();

  return {
    ...created,
    isSynonymConvergence: false,
  };
}
