import { db, smartLists, listItems, userSaves, globalEntities, users, type SmartList, type ListItem, type UserSave, type GlobalEntity } from "@/db";
import { eq, and, desc, asc, sql } from "drizzle-orm";

export interface CreateListInput {
  title: string;
  slug?: string;
  description?: string;
  isPaywalled?: boolean;
  accessPriceCents?: number;
  autoRules?: {
    coreType?: string;
    tagsInclude?: string[];
    maxPriceCents?: number;
  };
  visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC";
}

export interface ListItemCardData {
  listItem?: {
    id: string;
    positionIndex: number;
    sectionHeader: string | null;
    curatorNote: string | null;
    isPinned: boolean;
    addedAt: string;
  };
  save: UserSave;
  entity: GlobalEntity | null;
}

export interface SectionGroup {
  name: string | null; // null for unsectioned
  items: ListItemCardData[];
}

export interface ListWithSections {
  list: SmartList;
  owner: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  itemCount: number;
  sections: SectionGroup[];
}

/**
 * Generates a clean URL-safe unique slug for a list.
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "board";

  let slug = base;
  let counter = 1;

  while (true) {
    const [existing] = await db
      .select({ id: smartLists.id })
      .from(smartLists)
      .where(eq(smartLists.slug, slug))
      .limit(1);

    if (!existing) {
      return slug;
    }
    counter++;
    slug = `${base}-${counter}`;
  }
}

/**
 * Creates a new curated board / smart list.
 */
export async function createList(
  userId: string,
  input: CreateListInput
): Promise<SmartList> {
  const slug = input.slug
    ? input.slug.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-")
    : await generateUniqueSlug(input.title);

  const [list] = await db
    .insert(smartLists)
    .values({
      userId,
      title: input.title.trim(),
      slug,
      description: input.description?.trim() || null,
      isPaywalled: input.isPaywalled ?? false,
      accessPriceCents: input.accessPriceCents ?? null,
      autoRules: input.autoRules ?? null,
      visibility: input.visibility ?? "PUBLIC",
    })
    .returning();

  return list;
}

/**
 * Retrieves all lists belonging to a user with computed item counts.
 */
export async function getUserLists(userId: string): Promise<Array<SmartList & { itemCount: number }>> {
  const lists = await db
    .select()
    .from(smartLists)
    .where(eq(smartLists.userId, userId))
    .orderBy(desc(smartLists.createdAt));

  const result: Array<SmartList & { itemCount: number }> = [];

  for (const list of lists) {
    // Count manual items
    const [manualCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(listItems)
      .where(eq(listItems.listId, list.id));

    result.push({
      ...list,
      itemCount: Number(manualCount?.count || 0),
    });
  }

  return result;
}

/**
 * Appends or updates a card in a list.
 */
export async function addItemToList(
  listId: string,
  saveId: string,
  options?: {
    positionIndex?: number;
    sectionHeader?: string | null;
    curatorNote?: string | null;
    isPinned?: boolean;
  }
): Promise<ListItem> {
  // Check if item already exists in this list
  const [existing] = await db
    .select()
    .from(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.saveId, saveId)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(listItems)
      .set({
        positionIndex: options?.positionIndex !== undefined ? options.positionIndex : existing.positionIndex,
        sectionHeader: options?.sectionHeader !== undefined ? options.sectionHeader : existing.sectionHeader,
        curatorNote: options?.curatorNote !== undefined ? options.curatorNote : existing.curatorNote,
        isPinned: options?.isPinned !== undefined ? options.isPinned : existing.isPinned,
      })
      .where(eq(listItems.id, existing.id))
      .returning();
    return updated;
  }

  // Calculate next position index if not specified
  let position = options?.positionIndex;
  if (position === undefined) {
    const [maxItem] = await db
      .select({ maxPos: sql<number>`MAX(position_index)` })
      .from(listItems)
      .where(eq(listItems.listId, listId));
    position = (maxItem?.maxPos ?? -1) + 1;
  }

  const [created] = await db
    .insert(listItems)
    .values({
      listId,
      saveId,
      positionIndex: position,
      sectionHeader: options?.sectionHeader || null,
      curatorNote: options?.curatorNote || null,
      isPinned: options?.isPinned ?? false,
    })
    .returning();

  return created;
}

/**
 * Removes an item from a list.
 */
export async function removeItemFromList(listId: string, saveId: string): Promise<boolean> {
  const res = await db
    .delete(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.saveId, saveId)))
    .returning();

  return res.length > 0;
}

/**
 * Synchronizes multi-list assignments for a save from the `+ List` menu.
 */
export async function toggleSaveInLists(
  saveId: string,
  targetListIds: string[],
  userId: string
): Promise<{ added: string[]; removed: string[] }> {
  // Get all lists owned by this user
  const userLists = await db
    .select({ id: smartLists.id })
    .from(smartLists)
    .where(eq(smartLists.userId, userId));

  const validUserListIds = new Set(userLists.map((l) => l.id));

  // Find which of these lists currently contain the save
  const currentItems = await db
    .select({ listId: listItems.listId })
    .from(listItems)
    .where(eq(listItems.saveId, saveId));

  const currentListIds = new Set(
    currentItems.map((i) => i.listId).filter((id) => validUserListIds.has(id))
  );

  const targetSet = new Set(targetListIds.filter((id) => validUserListIds.has(id)));

  const added: string[] = [];
  const removed: string[] = [];

  // Add to target lists not currently assigned
  for (const listId of targetSet) {
    if (!currentListIds.has(listId)) {
      await addItemToList(listId, saveId);
      added.push(listId);
    }
  }

  // Remove from current lists not in target lists
  for (const listId of currentListIds) {
    if (!targetSet.has(listId)) {
      await removeItemFromList(listId, saveId);
      removed.push(listId);
    }
  }

  return { added, removed };
}

/**
 * Reorders list items and updates section headers in bulk.
 */
export async function reorderListItems(
  listId: string,
  itemsOrder: Array<{
    saveId: string;
    positionIndex: number;
    sectionHeader?: string | null;
  }>
): Promise<void> {
  for (const item of itemsOrder) {
    await db
      .update(listItems)
      .set({
        positionIndex: item.positionIndex,
        ...(item.sectionHeader !== undefined ? { sectionHeader: item.sectionHeader } : {}),
      })
      .where(and(eq(listItems.listId, listId), eq(listItems.saveId, item.saveId)));
  }
}

/**
 * Fetches a list by its slug with section grouping, curator notes, and privacy checks.
 */
export async function getListBySlugWithItems(
  slug: string,
  viewerUserId?: string
): Promise<ListWithSections | null> {
  const [list] = await db
    .select()
    .from(smartLists)
    .where(eq(smartLists.slug, slug))
    .limit(1);

  if (!list) return null;

  // Privacy gating: Private lists accessible ONLY to the owner
  if (list.visibility === "PRIVATE" && list.userId !== viewerUserId) {
    throw new Error("FORBIDDEN: Private list");
  }

  // Fetch list owner info
  const [owner] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, list.userId))
    .limit(1);

  // 1. Fetch manual list items
  const manualRecords = await db
    .select({
      listItem: listItems,
      save: userSaves,
      entity: globalEntities,
    })
    .from(listItems)
    .innerJoin(userSaves, eq(listItems.saveId, userSaves.id))
    .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
    .where(eq(listItems.listId, list.id))
    .orderBy(desc(listItems.isPinned), asc(listItems.positionIndex));

  const itemsMap = new Map<string, ListItemCardData>();

  for (const row of manualRecords) {
    itemsMap.set(row.save.id, {
      listItem: {
        id: row.listItem.id,
        positionIndex: row.listItem.positionIndex,
        sectionHeader: row.listItem.sectionHeader,
        curatorNote: row.listItem.curatorNote,
        isPinned: row.listItem.isPinned,
        addedAt: row.listItem.addedAt,
      },
      save: row.save,
      entity: row.entity,
    });
  }

  // 2. Dynamic Auto-Rules Population (if rules defined)
  if (list.autoRules) {
    const rules = list.autoRules;

    const allUserSaves = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(and(eq(userSaves.userId, list.userId), eq(userSaves.isPrivateMemo, false)));

    for (const record of allUserSaves) {
      if (itemsMap.has(record.save.id)) continue;

      let match = true;

      // Filter: coreType
      if (rules.coreType && record.entity?.coreType?.toUpperCase() !== rules.coreType.toUpperCase()) {
        match = false;
      }

      // Filter: tagsInclude
      if (match && rules.tagsInclude && rules.tagsInclude.length > 0) {
        const itemTags = (record.save.autoTags || []).map((t) => t.toLowerCase());
        const hasTag = rules.tagsInclude.some((t) => itemTags.includes(t.toLowerCase()));
        if (!hasTag) match = false;
      }

      // Filter: maxPriceCents
      if (match && rules.maxPriceCents !== undefined && record.entity?.priceCents) {
        if (record.entity.priceCents > rules.maxPriceCents) match = false;
      }

      if (match) {
        itemsMap.set(record.save.id, {
          save: record.save,
          entity: record.entity,
          listItem: {
            id: `auto-${record.save.id}`,
            positionIndex: 999,
            sectionHeader: null,
            curatorNote: null,
            isPinned: false,
            addedAt: record.save.createdAt,
          },
        });
      }
    }
  }

  const allItems = Array.from(itemsMap.values());

  // Sort: pinned first, then position index, then added date
  allItems.sort((a, b) => {
    const aPin = a.listItem?.isPinned ? 1 : 0;
    const bPin = b.listItem?.isPinned ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;

    const aPos = a.listItem?.positionIndex ?? 999;
    const bPos = b.listItem?.positionIndex ?? 999;
    if (aPos !== bPos) return aPos - bPos;

    return 0;
  });

  // 3. Group by sectionHeader
  const sectionsMap = new Map<string | null, ListItemCardData[]>();

  for (const item of allItems) {
    const section = item.listItem?.sectionHeader || null;
    if (!sectionsMap.has(section)) {
      sectionsMap.set(section, []);
    }
    sectionsMap.get(section)!.push(item);
  }

  // Format sections array: unsectioned first, followed by alphabetical or insertion order
  const sections: SectionGroup[] = [];
  if (sectionsMap.has(null)) {
    sections.push({ name: null, items: sectionsMap.get(null)! });
  }

  for (const [sectionName, secItems] of sectionsMap.entries()) {
    if (sectionName !== null) {
      sections.push({ name: sectionName, items: secItems });
    }
  }

  return {
    list,
    owner: owner || null,
    itemCount: allItems.length,
    sections,
  };
}
