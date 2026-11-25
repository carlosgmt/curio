import { db, smartLists, listItems, userSaves, globalEntities, users, curioTypes, checkoutSessions, type SmartList, type ListItem, type UserSave, type GlobalEntity } from "@/db";
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import type { UserAffiliateTags } from "@/lib/commerce/affiliate";
import { getConnectedSavesMap, type ConnectedItem } from "@/lib/connections/service";

export interface AutoRulesConfig {
  coreType?: string;
  typePathPrefix?: string;
  tagsInclude?: string[];
  maxPriceCents?: number;
}

export type SmartListLayoutMode = "masonry" | "grid" | "timeline" | "shelf" | "posters";

export interface CreateListInput {
  title: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
  positionIndex?: number;
  isPaywalled?: boolean;
  accessPriceCents?: number;
  autoRules?: AutoRulesConfig;
  defaultLayout?: SmartListLayoutMode | null;
  visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC";
}

export interface UpdateBoardInput {
  title?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  positionIndex?: number;
  isPaywalled?: boolean;
  accessPriceCents?: number | null;
  autoRules?: AutoRulesConfig | null;
  defaultLayout?: SmartListLayoutMode | null;
  visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC";
}

export interface BoardMembershipSummary {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  positionIndex: number;
  visibility: string;
  itemCount: number;
  hasAutoRules: boolean;
  isMember: boolean;
  isManualMember: boolean;
  isAutoMatched: boolean;
}

function hasBoardAutoRules(slug: string, rules: AutoRulesConfig | null | undefined): boolean {
  return Boolean(rules || slug === "films" || slug === "music");
}

export function matchesAutoRules(
  rules: AutoRulesConfig | null | undefined,
  record: { save: UserSave; entity: GlobalEntity | null },
  fallbackSlug?: string
): boolean {
  const effectiveRules: AutoRulesConfig | null =
    rules
      ? fallbackSlug === "films" && !rules.typePathPrefix && rules.coreType?.toUpperCase() === "MEDIA"
        ? { ...rules, typePathPrefix: "/media/film" }
        : fallbackSlug === "music" && !rules.typePathPrefix && rules.coreType?.toUpperCase() === "MEDIA"
        ? { ...rules, typePathPrefix: "/media/music" }
        : rules
      : fallbackSlug === "films"
      ? { typePathPrefix: "/media/film" }
      : fallbackSlug === "music"
      ? { typePathPrefix: "/media/music" }
      : null;
  if (!effectiveRules) return false;
  if (record.save.isPrivateMemo) return false;

  const typePath = (record.save.typePath || record.entity?.typePath || "").toLowerCase();
  const entityCoreType = (record.entity?.coreType || "").toUpperCase();

  if (effectiveRules.typePathPrefix) {
    const prefix = effectiveRules.typePathPrefix.toLowerCase().replace(/\/+$/, "");
    if (prefix && typePath !== prefix && !typePath.startsWith(`${prefix}/`)) {
      return false;
    }
  }

  if (effectiveRules.coreType) {
    const targetCoreType = effectiveRules.coreType.toUpperCase();
    const targetTypeLower = effectiveRules.coreType.toLowerCase();

    if (targetCoreType === "MEDIA" && !effectiveRules.typePathPrefix) {
      const isMedia =
        entityCoreType === "MEDIA" ||
        typePath.startsWith("/media/film") ||
        typePath.startsWith("/media") ||
        typePath.includes("film") ||
        typePath.includes("cinema");
      if (!isMedia) return false;
    } else if (!effectiveRules.typePathPrefix) {
      const matchesCoreOrSubtype =
        entityCoreType === targetCoreType ||
        (targetTypeLower &&
          (typePath === targetTypeLower ||
            typePath.startsWith(`${targetTypeLower}/`) ||
            typePath.endsWith(`/${targetTypeLower}`)));
      if (!matchesCoreOrSubtype) {
        return false;
      }
    }
  }

  if (effectiveRules.tagsInclude && effectiveRules.tagsInclude.length > 0) {
    const itemTags = (record.save.autoTags || []).map((t) => t.toLowerCase());
    const hasTag = effectiveRules.tagsInclude.some((t) => itemTags.includes(t.toLowerCase()));
    if (!hasTag) return false;
  }

  if (effectiveRules.maxPriceCents !== undefined && record.entity?.priceCents) {
    if (record.entity.priceCents > effectiveRules.maxPriceCents) return false;
  }

  return true;
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
  connections?: ConnectedItem[];
}

export interface SectionGroup {
  name: string | null; // null for unsectioned
  items: ListItemCardData[];
}

export interface BoardChildSummary extends SmartList {
  itemCount: number;
  sections?: SectionGroup[];
}

export interface BoardTreeNode extends SmartList {
  itemCount: number;
  children: BoardTreeNode[];
}

export interface ListWithSections {
  list: SmartList;
  owner: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    affiliateTags?: UserAffiliateTags | null;
  } | null;
  itemCount: number;
  sections: SectionGroup[];
  ancestors: Array<{ id: string; title: string; slug: string }>;
  children: BoardChildSummary[];
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

  let position = input.positionIndex;
  if (position === undefined) {
    const parentCondition = input.parentId
      ? eq(smartLists.parentId, input.parentId)
      : isNull(smartLists.parentId);
    const [maxItem] = await db
      .select({ maxPos: sql<number>`MAX(position_index)` })
      .from(smartLists)
      .where(and(eq(smartLists.userId, userId), parentCondition));
    position = (maxItem?.maxPos ?? -1) + 1;
  }

  const [list] = await db
    .insert(smartLists)
    .values({
      userId,
      parentId: input.parentId || null,
      positionIndex: position,
      title: input.title.trim(),
      slug,
      description: input.description?.trim() || null,
      isPaywalled: input.isPaywalled ?? false,
      accessPriceCents: input.accessPriceCents ?? null,
      autoRules: input.autoRules ?? null,
      defaultLayout: input.defaultLayout ?? null,
      visibility: input.visibility ?? "PUBLIC",
    })
    .returning();

  return list;
}

/**
 * Updates a board's metadata, parent, or position index with cycle prevention.
 */
export async function updateBoard(
  listId: string,
  input: UpdateBoardInput,
  userId?: string
): Promise<SmartList> {
  const [existing] = await db
    .select()
    .from(smartLists)
    .where(eq(smartLists.id, listId))
    .limit(1);

  if (!existing) {
    throw new Error("Board not found");
  }

  if (userId && existing.userId !== userId) {
    throw new Error("FORBIDDEN: You do not own this board");
  }

  // Cycle prevention if changing parentId
  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === listId) {
      throw new Error("Cannot set board as its own parent (cycle detected)");
    }

    const [targetParent] = await db
      .select({ userId: smartLists.userId })
      .from(smartLists)
      .where(eq(smartLists.id, input.parentId))
      .limit(1);
    if (!targetParent || targetParent.userId !== existing.userId) {
      throw new Error("FORBIDDEN: Target parent board not found or owned by another user");
    }

    // Check if new parent is a descendant of listId
    let curr: string | null = input.parentId;
    const visited = new Set<string>();
    while (curr) {
      if (curr === listId) {
        throw new Error("Cannot set parent: cycle detected (target board is a descendant)");
      }
      if (visited.has(curr)) break;
      visited.add(curr);

      const [p] = await db
        .select({ parentId: smartLists.parentId })
        .from(smartLists)
        .where(eq(smartLists.id, curr))
        .limit(1);
      curr = p?.parentId || null;
    }
  }

  const updates: Partial<SmartList> = {};
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.slug !== undefined) updates.slug = input.slug.trim();
  if (input.description !== undefined) updates.description = input.description ? input.description.trim() : null;
  if (input.parentId !== undefined) updates.parentId = input.parentId;
  if (input.positionIndex !== undefined) updates.positionIndex = input.positionIndex;
  if (input.isPaywalled !== undefined) updates.isPaywalled = input.isPaywalled;
  if (input.accessPriceCents !== undefined) updates.accessPriceCents = input.accessPriceCents;
  if (input.autoRules !== undefined) updates.autoRules = input.autoRules;
  if (input.defaultLayout !== undefined) updates.defaultLayout = input.defaultLayout;
  if (input.visibility !== undefined) updates.visibility = input.visibility;

  const [updated] = await db
    .update(smartLists)
    .set(updates)
    .where(eq(smartLists.id, listId))
    .returning();

  return updated;
}

/**
 * Deletes a board (and cleans up list_items for it and any descendant sub-boards) without deleting user_saves.
 */
export async function deleteBoard(listId: string, userId: string): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(smartLists)
    .where(eq(smartLists.id, listId))
    .limit(1);

  if (!existing) return false;
  if (existing.userId !== userId) {
    throw new Error("FORBIDDEN: You do not own this board");
  }

  return db.transaction((tx) => {
    const allUserBoards = tx
      .select({ id: smartLists.id, parentId: smartLists.parentId })
      .from(smartLists)
      .where(eq(smartLists.userId, userId))
      .all();

    const toDelete = new Set<string>([listId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const b of allUserBoards) {
        if (b.parentId && toDelete.has(b.parentId) && !toDelete.has(b.id)) {
          toDelete.add(b.id);
          changed = true;
        }
      }
    }

    for (const id of toDelete) {
      tx.delete(listItems).where(eq(listItems.listId, id)).run();
      tx.update(checkoutSessions).set({ boardId: null }).where(eq(checkoutSessions.boardId, id)).run();
    }

    tx.delete(smartLists)
      .where(and(eq(smartLists.id, listId), eq(smartLists.userId, userId)))
      .run();

    // Ensure children are deleted even if SQLite foreign_keys cascade was bypassed on legacy tables
    for (const id of toDelete) {
      if (id !== listId) {
        tx.delete(smartLists)
          .where(and(eq(smartLists.id, id), eq(smartLists.userId, userId)))
          .run();
      }
    }

    return true;
  });
}

/**
 * Returns path of ancestor boards [{ id, title, slug }] from root down to parent.
 */
export async function getBoardAncestors(
  listId: string
): Promise<Array<{ id: string; title: string; slug: string }>> {
  const [current] = await db
    .select({ parentId: smartLists.parentId })
    .from(smartLists)
    .where(eq(smartLists.id, listId))
    .limit(1);

  if (!current || !current.parentId) {
    return [];
  }

  const ancestors: Array<{ id: string; title: string; slug: string }> = [];
  let currId: string | null = current.parentId;
  const visited = new Set<string>([listId]);

  while (currId) {
    if (visited.has(currId)) break;
    visited.add(currId);

    const [parent] = await db
      .select({ id: smartLists.id, title: smartLists.title, slug: smartLists.slug, parentId: smartLists.parentId })
      .from(smartLists)
      .where(eq(smartLists.id, currId))
      .limit(1);

    if (!parent) break;

    ancestors.unshift({
      id: parent.id,
      title: parent.title,
      slug: parent.slug,
    });

    currId = parent.parentId;
  }

  return ancestors;
}

/**
 * Retrieves all lists belonging to a user with computed item counts and optional parent filtering.
 */
export async function getUserLists(
  userId: string,
  options?: { rootOnly?: boolean; parentId?: string | null }
): Promise<Array<SmartList & { itemCount: number }>> {
  const conditions = [eq(smartLists.userId, userId)];

  if (options?.rootOnly) {
    conditions.push(isNull(smartLists.parentId));
  } else if (options?.parentId !== undefined) {
    if (options.parentId === null) {
      conditions.push(isNull(smartLists.parentId));
    } else {
      conditions.push(eq(smartLists.parentId, options.parentId));
    }
  }

  const lists = await db
    .select()
    .from(smartLists)
    .where(and(...conditions))
    .orderBy(asc(smartLists.positionIndex), desc(smartLists.createdAt));

  if (lists.length === 0) return [];

  const listIds = new Set(lists.map((l) => l.id));
  const manualRows = await db
    .select({
      listId: listItems.listId,
      saveId: listItems.saveId,
    })
    .from(listItems)
    .innerJoin(smartLists, eq(listItems.listId, smartLists.id))
    .innerJoin(userSaves, eq(listItems.saveId, userSaves.id))
    .where(eq(smartLists.userId, userId));

  const manualSetsByBoard = new Map<string, Set<string>>();
  for (const row of manualRows) {
    if (!listIds.has(row.listId)) continue;
    let set = manualSetsByBoard.get(row.listId);
    if (!set) {
      set = new Set<string>();
      manualSetsByBoard.set(row.listId, set);
    }
    set.add(row.saveId);
  }

  const anyAutoRules = lists.some((l) => hasBoardAutoRules(l.slug, l.autoRules));
  let allUserSaves: Array<{ save: UserSave; entity: GlobalEntity | null }> = [];
  if (anyAutoRules) {
    allUserSaves = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(and(eq(userSaves.userId, userId), eq(userSaves.isPrivateMemo, false)));
  }

  return lists.map((list) => {
    const manualSet = manualSetsByBoard.get(list.id) || new Set<string>();
    let count = manualSet.size;

    if (hasBoardAutoRules(list.slug, list.autoRules)) {
      for (const rec of allUserSaves) {
        if (!manualSet.has(rec.save.id) && matchesAutoRules(list.autoRules, rec, list.slug)) {
          count++;
        }
      }
    }

    return {
      ...list,
      itemCount: count,
    };
  });
}

/**
 * Builds an N-level hierarchy tree of boards for a user.
 */
export async function getBoardTree(userId: string): Promise<BoardTreeNode[]> {
  const allLists = await getUserLists(userId);
  const byId = new Map<string, BoardTreeNode>();
  const roots: BoardTreeNode[] = [];

  for (const list of allLists) {
    byId.set(list.id, { ...list, children: [] });
  }

  const sorted = [...byId.values()].sort((a, b) => {
    if (a.positionIndex !== b.positionIndex) {
      return a.positionIndex - b.positionIndex;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  for (const node of sorted) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Reorders sibling boards under a parent with strict user ownership isolation.
 */
export async function reorderBoards(
  parentId: string | null,
  orderedIds: string[],
  userId?: string
): Promise<void> {
  if (orderedIds.length === 0) return;

  db.transaction((tx) => {
    let effectiveUserId = userId;

    if (parentId !== null) {
      const [parent] = tx
        .select({ userId: smartLists.userId })
        .from(smartLists)
        .where(eq(smartLists.id, parentId))
        .all();
      if (!parent) {
        throw new Error("FORBIDDEN: Target parent board not found");
      }
      if (effectiveUserId && parent.userId !== effectiveUserId) {
        throw new Error("FORBIDDEN: Target parent board owned by another user");
      }
      effectiveUserId = effectiveUserId || parent.userId;
    } else if (!effectiveUserId) {
      const [firstBoard] = tx
        .select({ userId: smartLists.userId })
        .from(smartLists)
        .where(eq(smartLists.id, orderedIds[0]))
        .all();
      effectiveUserId = firstBoard?.userId;
    }

    if (!effectiveUserId) return;

    for (let i = 0; i < orderedIds.length; i++) {
      const boardId = orderedIds[i];
      if (parentId && boardId === parentId) continue;
      tx.update(smartLists)
        .set({ positionIndex: i, parentId: parentId })
        .where(and(eq(smartLists.id, boardId), eq(smartLists.userId, effectiveUserId)))
        .run();
    }
  });
}

/**
 * Returns all boards owned by a user with accurate counts and manual/auto membership flags for a given saveId in O(1) queries.
 */
export async function getSaveBoardMemberships(
  userId: string,
  saveId?: string | null
): Promise<BoardMembershipSummary[]> {
  const boards = await db
    .select()
    .from(smartLists)
    .where(eq(smartLists.userId, userId))
    .orderBy(asc(smartLists.positionIndex), desc(smartLists.createdAt));

  if (boards.length === 0) return [];

  // Fetch all manual list_items for this user's boards in 1 query
  const boardIds = new Set(boards.map((b) => b.id));
  const allManualRows = await db
    .select({
      listId: listItems.listId,
      saveId: listItems.saveId,
    })
    .from(listItems)
    .innerJoin(smartLists, eq(listItems.listId, smartLists.id))
    .where(eq(smartLists.userId, userId));

  const manualSetsByBoard = new Map<string, Set<string>>();
  for (const row of allManualRows) {
    if (!boardIds.has(row.listId)) continue;
    let set = manualSetsByBoard.get(row.listId);
    if (!set) {
      set = new Set<string>();
      manualSetsByBoard.set(row.listId, set);
    }
    set.add(row.saveId);
  }

  // Only fetch user's saves once if any board uses autoRules or if saveId is provided
  const anyAutoRules = boards.some((b) => hasBoardAutoRules(b.slug, b.autoRules));
  let allUserSaves: Array<{ save: UserSave; entity: GlobalEntity | null }> = [];
  if (anyAutoRules || saveId) {
    allUserSaves = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.userId, userId));
  }

  const targetSaveRecord = saveId
    ? allUserSaves.find((r) => r.save.id === saveId) || null
    : null;

  return boards.map((board) => {
    const manualSet = manualSetsByBoard.get(board.id) || new Set<string>();
    const isManualMember = Boolean(saveId && manualSet.has(saveId));
    const hasAutoRules = hasBoardAutoRules(board.slug, board.autoRules);

    let itemCount = manualSet.size;
    let isAutoMatched = false;

    if (hasAutoRules) {
      for (const rec of allUserSaves) {
        const matched = matchesAutoRules(board.autoRules, rec, board.slug);
        if (matched) {
          if (!manualSet.has(rec.save.id)) {
            itemCount++;
          }
          if (saveId && rec.save.id === saveId) {
            isAutoMatched = true;
          }
        }
      }
    } else if (targetSaveRecord) {
      isAutoMatched = false;
    }

    return {
      id: board.id,
      title: board.title,
      slug: board.slug,
      parentId: board.parentId || null,
      positionIndex: board.positionIndex,
      visibility: board.visibility,
      itemCount,
      hasAutoRules,
      isMember: isManualMember,
      isManualMember,
      isAutoMatched,
    };
  });
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
 * Synchronizes multi-list assignments for a save from the `+ List` menu atomically.
 */
export async function toggleSaveInLists(
  saveId: string,
  targetListIds: string[],
  userId: string
): Promise<{ added: string[]; removed: string[] }> {
  return db.transaction((tx) => {
    // Get all lists owned by this user
    const userLists = tx
      .select({ id: smartLists.id })
      .from(smartLists)
      .where(eq(smartLists.userId, userId))
      .all();

    const validUserListIds = new Set(userLists.map((l) => l.id));

    // Find which of these lists currently contain the save
    const currentItems = tx
      .select({ listId: listItems.listId })
      .from(listItems)
      .where(eq(listItems.saveId, saveId))
      .all();

    const currentListIds = new Set(
      currentItems.map((i) => i.listId).filter((id) => validUserListIds.has(id))
    );

    const targetSet = new Set(targetListIds.filter((id) => validUserListIds.has(id)));

    const added: string[] = [];
    const removed: string[] = [];

    // Add to target lists not currently assigned
    for (const listId of targetSet) {
      if (!currentListIds.has(listId)) {
        const [maxItem] = tx
          .select({ maxPos: sql<number>`MAX(position_index)` })
          .from(listItems)
          .where(eq(listItems.listId, listId))
          .all();
        const position = (maxItem?.maxPos ?? -1) + 1;

        tx.insert(listItems)
          .values({
            listId,
            saveId,
            positionIndex: position,
            sectionHeader: null,
            curatorNote: null,
            isPinned: false,
          })
          .run();

        added.push(listId);
      }
    }

    // Remove from current lists not in target lists
    for (const listId of currentListIds) {
      if (!targetSet.has(listId)) {
        tx.delete(listItems)
          .where(and(eq(listItems.listId, listId), eq(listItems.saveId, saveId)))
          .run();
        removed.push(listId);
      }
    }

    return { added, removed };
  });
}

/**
 * Reorders list items and updates section headers in bulk atomically.
 */
export async function reorderListItems(
  listId: string,
  itemsOrder: Array<{
    saveId: string;
    positionIndex: number;
    sectionHeader?: string | null;
  }>
): Promise<void> {
  db.transaction((tx) => {
    for (const item of itemsOrder) {
      tx.update(listItems)
        .set({
          positionIndex: item.positionIndex,
          ...(item.sectionHeader !== undefined ? { sectionHeader: item.sectionHeader } : {}),
        })
        .where(and(eq(listItems.listId, listId), eq(listItems.saveId, item.saveId)))
        .run();
    }
  });
}

/**
 * Fetches a list by its slug with section grouping, curator notes, and privacy checks.
 */
export async function getListBySlugWithItems(
  slug: string,
  viewerUserId?: string,
  includeNestedChildren = true
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

  // Paywall gating: If list is paywalled, require owner or completed checkout session
  if (list.isPaywalled && list.userId !== viewerUserId) {
    let hasAccess = false;
    if (viewerUserId) {
      const [paid] = await db
        .select()
        .from(checkoutSessions)
        .where(
          and(
            eq(checkoutSessions.boardId, list.id),
            eq(checkoutSessions.buyerUserId, viewerUserId),
            eq(checkoutSessions.status, "COMPLETED")
          )
        )
        .limit(1);
      if (paid) hasAccess = true;
    }
    if (!hasAccess) {
      throw new Error("PAYWALL_REQUIRED: List access requires purchase");
    }
  }

  // Fetch list owner info
  const [owner] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      affiliateTags: users.affiliateTags,
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

  // 2. Dynamic Auto-Rules Population (if rules defined or legacy slug === "films" / "music")
  if (hasBoardAutoRules(list.slug, list.autoRules)) {
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

      if (matchesAutoRules(list.autoRules, record, list.slug)) {
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

  // Privacy isolation: If viewed by anyone other than the list owner, sanitize item saves
  const isOwner = Boolean(viewerUserId && viewerUserId === list.userId);
  if (!isOwner) {
    const allCurioTypes = await db.select().from(curioTypes);
    const typeIdToPublicKeys = new Map<string, string[]>();
    const typePathToPublicKeys = new Map<string, string[]>();

    for (const ct of allCurioTypes) {
      typeIdToPublicKeys.set(ct.id, ct.publicFieldKeys || []);
      if (ct.typePath) {
        typePathToPublicKeys.set(ct.typePath, ct.publicFieldKeys || []);
      }
    }

    for (const item of allItems) {
      const customTypeId = item.save.customTypeId || (item.save as any).typeId;
      let allowedKeys: Set<string> | null = null;

      if (customTypeId && typeIdToPublicKeys.has(customTypeId)) {
        allowedKeys = new Set(typeIdToPublicKeys.get(customTypeId));
      } else if (item.save.typePath && typePathToPublicKeys.has(item.save.typePath)) {
        allowedKeys = new Set(typePathToPublicKeys.get(item.save.typePath));
      }

      const rawCustom = item.save.userCustomValues;
      const sanitizedCustom: Record<string, unknown> = {};

      if (allowedKeys && rawCustom && typeof rawCustom === "object") {
        for (const [k, v] of Object.entries(rawCustom as Record<string, unknown>)) {
          if (allowedKeys.has(k)) {
            sanitizedCustom[k] = v;
          }
        }
      }

      item.save = {
        ...item.save,
        personalNotes: null,
        privateTitle: null,
        userCustomValues: sanitizedCustom,
      };
    }
  }

  // Batch-populate synaptic connections for all items (eliminates N+1 GET /api/v1/connections on board mount)
  const nonMemoSaveIds = allItems
    .filter((item) => !item.save.isPrivateMemo)
    .map((item) => item.save.id);
  const connectionsBySaveId = await getConnectedSavesMap(nonMemoSaveIds, {
    sanitizeForPublic: !isOwner,
  });
  for (const item of allItems) {
    item.connections = item.save.isPrivateMemo
      ? []
      : connectionsBySaveId.get(item.save.id) ?? [];
  }

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

  // 4. Fetch ancestors for breadcrumb navigation
  const ancestors = await getBoardAncestors(list.id);

  // 5. Fetch direct child boards
  const childrenWithCounts: BoardChildSummary[] = [];
  if (includeNestedChildren) {
    const directChildren = await db
      .select()
      .from(smartLists)
      .where(eq(smartLists.parentId, list.id))
      .orderBy(asc(smartLists.positionIndex), asc(smartLists.createdAt));

    for (const child of directChildren) {
      let count = 0;
      let childSections: SectionGroup[] = [];

      try {
        const childDetails = await getListBySlugWithItems(child.slug, viewerUserId, false);
        if (childDetails) {
          count = childDetails.itemCount;
          childSections = childDetails.sections;
        }
      } catch {
        const [manualCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(listItems)
          .where(eq(listItems.listId, child.id));
        count = Number(manualCount?.count || 0);
      }

      childrenWithCounts.push({
        ...child,
        itemCount: count,
        sections: childSections,
      });
    }
  }

  return {
    list,
    owner: owner || null,
    itemCount: allItems.length,
    sections,
    ancestors,
    children: childrenWithCounts,
  };
}
