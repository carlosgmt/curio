import { db, curioTypes, users } from "@/db";
import { eq, or, isNull } from "drizzle-orm";
import { registerCustomType, type RegisterCustomTypeParams } from "@/lib/curio-learns/attributes";

export { registerCustomType, type RegisterCustomTypeParams };

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
  return true;
}
