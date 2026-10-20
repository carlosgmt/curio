import { db, curioTypes } from "@/db";
import { eq, or, and, isNull } from "drizzle-orm";
import { registerCustomType, type RegisterCustomTypeParams } from "@/lib/curio-learns/attributes";
import { invalidateTypeCache } from "@/lib/curio-learns/ontology";
import { generateDeterministicEmbedding } from "@/lib/search/vector";
import {
  getCatalogTypes,
  getCatalogTypeByPath,
  getCatalogTypeById,
  isTypeInstalled,
  exportCurioSchemaSpec,
  validateCurioSchemaSpec,
  buildJsonSchemaFromFields,
  parseQuoteInput,
  type CatalogTypeDefinition,
  type CurioSchemaSpec,
  type ParsedQuote,
} from "./catalog";

export {
  registerCustomType,
  type RegisterCustomTypeParams,
  getCatalogTypes,
  getCatalogTypeByPath,
  getCatalogTypeById,
  isTypeInstalled,
  exportCurioSchemaSpec,
  validateCurioSchemaSpec,
  parseQuoteInput,
  type CatalogTypeDefinition,
  type CurioSchemaSpec,
  type ParsedQuote,
};

/**
 * Lists all available Curio types (canonical archetypes + user custom types)
 */
export async function listAllTypes(userId?: string) {
  if (userId) {
    return db
      .select()
      .from(curioTypes)
      .where(or(isNull(curioTypes.userId), eq(curioTypes.userId, userId)));
  }
  return db.select().from(curioTypes);
}

/**
 * Gets a type by ID
 */
export async function getTypeById(id: string) {
  const [record] = await db
    .select()
    .from(curioTypes)
    .where(eq(curioTypes.id, id))
    .limit(1);
  return record || null;
}

/**
 * Deletes a user custom type (protects canonical archetypes from deletion)
 */
export async function deleteCustomType(id: string, userId?: string): Promise<boolean> {
  const type = await getTypeById(id);
  if (!type) return false;

  // Canonical types (userId is null) cannot be deleted
  if (!type.userId) {
    throw new Error("CANNOT_DELETE_CANONICAL_TYPE");
  }

  if (userId && type.userId !== userId) {
    throw new Error("FORBIDDEN");
  }

  await db.delete(curioTypes).where(eq(curioTypes.id, id));
  invalidateTypeCache();
  return true;
}

/**
 * Installs a secondary catalog type into curio_types for the specified user.
 */
export async function installCatalogType(userId: string, catalogIdOrPath: string) {
  const catalog = getCatalogTypeById(catalogIdOrPath) || getCatalogTypeByPath(catalogIdOrPath);
  if (!catalog) {
    throw new Error(`Catalog type not found: ${catalogIdOrPath}`);
  }

  // Check if already installed for user
  const [existing] = await db
    .select()
    .from(curioTypes)
    .where(and(eq(curioTypes.typePath, catalog.typePath), eq(curioTypes.userId, userId)))
    .limit(1);

  if (existing) {
    return existing;
  }

  // Resolve parent type if exists
  let parentTypeId: string | null = null;
  if (catalog.parentTypePath) {
    const [parent] = await db
      .select({ id: curioTypes.id })
      .from(curioTypes)
      .where(eq(curioTypes.typePath, catalog.parentTypePath))
      .limit(1);
    if (parent) {
      parentTypeId = parent.id;
    }
  }

  const textToEmbed = `${catalog.name} ${catalog.typePath} ${catalog.rootArchetype} ${catalog.extractionPrompt || ""}`.trim();
  const typeEmbedding = generateDeterministicEmbedding(textToEmbed, 768);

  const baseSchema = catalog.jsonSchema || buildJsonSchemaFromFields(catalog.fields);

  const [created] = await db
    .insert(curioTypes)
    .values({
      userId,
      parentTypeId,
      name: catalog.name,
      typePath: catalog.typePath,
      rootArchetype: catalog.rootArchetype,
      defaultSilhouette: catalog.defaultSilhouette,
      identityRules: catalog.identityRules || null,
      jsonSchema: baseSchema,
      ownJsonSchema: catalog.ownJsonSchema || baseSchema,
      effectiveJsonSchema: catalog.effectiveJsonSchema || baseSchema,
      publicFieldKeys: catalog.publicFieldKeys || catalog.fields.map((f) => f.key),
      uiFieldConfig: catalog.uiFieldConfig || catalog.fields.map((f) => ({
        key: f.key,
        label: f.label,
        primitive: f.type,
        isPublicObjective: true,
      })),
      extractionPrompt: catalog.extractionPrompt || `Extract custom attributes for ${catalog.name}.`,
      typeEmbedding,
    })
    .returning();

  invalidateTypeCache();
  return created;
}

/**
 * Uninstalls / deactivates a catalog type for a user.
 */
export async function uninstallCatalogType(userId: string, catalogIdOrPath: string): Promise<boolean> {
  const catalog = getCatalogTypeById(catalogIdOrPath) || getCatalogTypeByPath(catalogIdOrPath);
  const targetPath = catalog?.typePath || catalogIdOrPath;

  const [existing] = await db
    .select()
    .from(curioTypes)
    .where(and(eq(curioTypes.typePath, targetPath), eq(curioTypes.userId, userId)))
    .limit(1);

  if (!existing) {
    return false;
  }

  await db.delete(curioTypes).where(eq(curioTypes.id, existing.id));
  invalidateTypeCache();
  return true;
}

/**
 * Exports a custom type as a portable Curio Schema Specification bundle.
 */
export async function exportTypeAsSchemaSpec(
  typeIdOrPath: string,
  userId?: string,
  sourceInstance: string = "curio.local"
): Promise<CurioSchemaSpec> {
  let type = await getTypeById(typeIdOrPath);
  if (!type) {
    const [byPath] = await db
      .select()
      .from(curioTypes)
      .where(
        userId
          ? and(eq(curioTypes.typePath, typeIdOrPath), or(isNull(curioTypes.userId), eq(curioTypes.userId, userId)))
          : eq(curioTypes.typePath, typeIdOrPath)
      )
      .limit(1);
    type = byPath || null;
  }

  if (!type) {
    const catalog = getCatalogTypeById(typeIdOrPath) || getCatalogTypeByPath(typeIdOrPath);
    if (catalog) {
      return exportCurioSchemaSpec(catalog, sourceInstance);
    }
    throw new Error(`Type not found: ${typeIdOrPath}`);
  }

  return exportCurioSchemaSpec(type, sourceInstance);
}

/**
 * Imports a shared CurioSchemaSpec bundle into the user's curio_types using the contract + overlay pattern.
 */
export async function importSchemaSpec(userId: string, rawSpec: unknown): Promise<typeof curioTypes.$inferSelect> {
  const spec = validateCurioSchemaSpec(rawSpec);
  const ct = spec.curioType;

  // Check if user already has this typePath installed
  const [existing] = await db
    .select()
    .from(curioTypes)
    .where(and(eq(curioTypes.typePath, ct.typePath), eq(curioTypes.userId, userId)))
    .limit(1);

  if (existing) {
    // Contract + Overlay pattern:
    const upstreamProperties = (ct.jsonSchema as any)?.properties || {};
    const localOverlay = (existing.ownJsonSchema as any)?.properties || {};
    const mergedProperties = { ...upstreamProperties, ...localOverlay };

    const mergedEffective = {
      type: "object",
      properties: mergedProperties,
      required: Array.from(new Set([
        ...((ct.jsonSchema as any)?.required || []),
        ...((existing.ownJsonSchema as any)?.required || []),
      ])),
    };

    const publicKeys = Array.from(new Set([
      ...(ct.publicFieldKeys || []),
      ...((existing.publicFieldKeys as string[]) || []),
    ]));

    const [updated] = await db
      .update(curioTypes)
      .set({
        jsonSchema: ct.jsonSchema || buildJsonSchemaFromFields(ct.fields),
        effectiveJsonSchema: mergedEffective,
        publicFieldKeys: publicKeys,
      })
      .where(eq(curioTypes.id, existing.id))
      .returning();

    invalidateTypeCache();
    return updated;
  }

  // Resolve parent type if exists
  let parentTypeId: string | null = null;
  if (ct.parentTypePath) {
    const [parent] = await db
      .select({ id: curioTypes.id })
      .from(curioTypes)
      .where(eq(curioTypes.typePath, ct.parentTypePath))
      .limit(1);
    if (parent) parentTypeId = parent.id;
  }

  const textToEmbed = `${ct.name} ${ct.typePath} ${ct.rootArchetype} ${ct.extractionPrompt || ""}`.trim();
  const typeEmbedding = generateDeterministicEmbedding(textToEmbed, 768);

  const baseSchema = ct.jsonSchema || buildJsonSchemaFromFields(ct.fields);
  const [created] = await db
    .insert(curioTypes)
    .values({
      userId,
      parentTypeId,
      name: ct.name,
      typePath: ct.typePath,
      rootArchetype: ct.rootArchetype,
      defaultSilhouette: ct.defaultSilhouette,
      identityRules: ct.identityRules || null,
      jsonSchema: baseSchema,
      ownJsonSchema: ct.ownJsonSchema || baseSchema,
      effectiveJsonSchema: ct.effectiveJsonSchema || baseSchema,
      publicFieldKeys: ct.publicFieldKeys || ct.fields.map((f) => f.key),
      uiFieldConfig: ct.uiFieldConfig || ct.fields.map((f) => ({
        key: f.key,
        label: f.label,
        primitive: f.type,
        isPublicObjective: true,
      })),
      extractionPrompt: ct.extractionPrompt || `Extract custom attributes for ${ct.name}.`,
      typeEmbedding,
    })
    .returning();

  invalidateTypeCache();
  return created;
}
