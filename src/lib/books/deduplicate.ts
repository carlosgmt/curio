import { and, eq, inArray, or } from "drizzle-orm";
import {
  db,
  entityPriceHistory,
  entitySources,
  entryConnections,
  globalEntities,
  listItems,
  userSaves,
  type GlobalEntity,
  type UserSave,
} from "@/db";
import {
  cleanCommercialBookTitle,
  isOwnedBook,
  normalizeDateString,
  normalizeReadingStatus,
  readingStatusToShelf,
  type ReadingStatus,
} from "./library";
import {
  areSameBook,
  extractBookProbe,
  extractEmbeddedIsbn13,
  findDuplicateBookGroups,
  isTravelGuideOrStudyBook,
  normalizeBookTitleKey,
  normalizeIsbn,
  sanitizeGoodreadsNote,
  type BookIdentityProbe,
} from "./identity";
import { ensureHierarchicalBoard } from "../sync/engine";

export {
  areSameBook,
  extractBookProbe,
  extractEmbeddedIsbn13,
  findDuplicateBookGroups,
  isTravelGuideOrStudyBook,
  normalizeBookTitleKey,
  normalizeIsbn,
  sanitizeGoodreadsNote,
  type BookIdentityProbe,
};

export interface BookDedupCandidate {
  saveId: string;
  entityId: string | null;
  title: string;
  author: string | null;
  isbn: string | null;
  goodreadsBookId: string | null;
  coverUrl: string | null;
  summary: string | null;
  pageCount: number | null;
  isOwned: boolean;
  readingStatus: ReadingStatus;
  rating: number | null;
  dateRead: string | null;
  personalNotes: string | null;
  createdAt: string;
  purchaseHubProductId: string | null;
  mergedPurchaseHubIds: string[];
}

export interface DeduplicateBooksResult {
  duplicateGroups: number;
  duplicateSaveCount: number;
  mergedSavesRemoved: number;
  mergedTitles: string[];
  cleanedNotesCount?: number;
  reclassifiedReferenceCount?: number;
}

function asRecord(val: unknown): Record<string, any> {
  return val && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, any>)
    : {};
}

export function toBookDedupCandidate(
  save: UserSave,
  entity: GlobalEntity | null
): BookDedupCandidate {
  const csd = asRecord(entity?.coreStructuredData);
  const ext = asRecord(entity?.extendedAttributes);
  const cv = asRecord(save.userCustomValues);
  const probe = extractBookProbe(save, entity);

  const rawPages = csd.pageCount ?? csd.pages ?? csd.numberOfPagesMedian ?? ext.pageCount;
  const parsedPages =
    typeof rawPages === "number" ? rawPages : parseInt(String(rawPages || ""), 10);

  const rawRating = cv.rating ?? cv.myRating ?? csd.rating;
  const parsedRating =
    typeof rawRating === "number" ? rawRating : parseFloat(String(rawRating || ""));

  const phFromExt =
    typeof ext.purchaseHubProductId === "string" && ext.purchaseHubProductId.trim()
      ? ext.purchaseHubProductId.trim()
      : null;
  const phFromCanonical = entity?.canonicalExternalId?.startsWith("purchase-hub:")
    ? entity.canonicalExternalId.slice("purchase-hub:".length).trim()
    : null;
  const purchaseHubProductId = phFromExt || phFromCanonical || null;
  const mergedList = Array.isArray(ext.mergedPurchaseHubIds)
    ? ext.mergedPurchaseHubIds.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const mergedSet = new Set<string>([
    ...mergedList,
    ...(purchaseHubProductId ? [purchaseHubProductId] : []),
  ]);

  return {
    saveId: save.id,
    entityId: entity?.id ?? null,
    title: (save.privateTitle || entity?.title || "Untitled Book").trim(),
    author: probe.author || null,
    isbn: probe.isbn || null,
    goodreadsBookId: probe.goodreadsBookId || null,
    coverUrl: probe.coverUrl || null,
    summary: entity?.summary || null,
    pageCount: Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : null,
    isOwned: isOwnedBook(save, entity),
    readingStatus: normalizeReadingStatus(cv, save.wishlist),
    rating:
      Number.isFinite(parsedRating) && parsedRating > 0 && parsedRating <= 5
        ? parsedRating
        : null,
    dateRead: normalizeDateString(typeof cv.dateRead === "string" ? cv.dateRead : null),
    personalNotes: save.personalNotes || null,
    createdAt: save.createdAt,
    purchaseHubProductId,
    mergedPurchaseHubIds: [...mergedSet],
  };
}

const STATUS_PRIORITY: Record<ReadingStatus, number> = {
  FINISHED: 3,
  READING: 2,
  WANT_TO_READ: 1,
};

function scoreCandidate(c: BookDedupCandidate): number {
  const hasRealAuthor =
    Boolean(c.author) && c.author?.toLowerCase() !== "unknown author";
  return (
    (c.isOwned ? 10 : 0) +
    (c.coverUrl ? 5 : 0) +
    (hasRealAuthor ? 4 : 0) +
    (c.personalNotes ? 4 : 0) +
    (c.summary ? 3 : 0) +
    (c.rating !== null ? 3 : 0) +
    (c.pageCount !== null ? 2 : 0) +
    STATUS_PRIORITY[c.readingStatus]
  );
}

function pickBestTitle(titles: string[], fallback: string): string {
  const nonEmpty = titles.map((t) => t.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return fallback;
  const nonTruncated = nonEmpty.filter((t) => !/[…]$|\.\.\.$/.test(t));
  const pool = nonTruncated.length > 0 ? nonTruncated : nonEmpty;
  pool.sort((a, b) => {
    const ca = cleanCommercialBookTitle(a).title;
    const cb = cleanCommercialBookTitle(b).title;
    return ca.length - cb.length || a.length - b.length;
  });
  return cleanCommercialBookTitle(pool[0]).title || pool[0];
}

function mergeDistinctStrings(arrays: Array<string[] | null | undefined>): string[] {
  const seen = new Map<string, string>();
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      const clean = String(raw || "").trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) seen.set(key, clean);
    }
  }
  return [...seen.values()];
}

function mergeParagraphs(notes: Array<string | null | undefined>): string | null {
  let out = "";
  for (const raw of notes) {
    const clean = (raw || "").trim();
    if (!clean) continue;
    if (!out) {
      out = clean;
    } else if (!out.toLowerCase().includes(clean.toLowerCase())) {
      out = `${out}\n\n${clean}`;
    }
  }
  return out || null;
}

export async function deduplicateUserBooks(
  userId: string,
  options?: { dryRun?: boolean }
): Promise<DeduplicateBooksResult> {
  const rows = await db
    .select({
      save: userSaves,
      entity: globalEntities,
    })
    .from(userSaves)
    .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
    .where(
      and(
        eq(userSaves.userId, userId),
        eq(userSaves.isPrivateMemo, false),
        or(
          eq(globalEntities.coreType, "BOOK"),
          eq(userSaves.typePath, "/product/book")
        )
      )
    );

  const groups = findDuplicateBookGroups(rows);
  const duplicateSaveCount = groups.reduce((acc, g) => acc + g.length - 1, 0);

  const mergedTitles: string[] = [];
  let mergedSavesRemoved = 0;

  if (groups.length > 0) {
    db.transaction((tx) => {
      for (const group of groups) {
      const ranked = group
        .map((row) => ({
          row,
          cand: toBookDedupCandidate(row.save, row.entity),
        }))
        .sort((a, b) => {
          const scoreDiff = scoreCandidate(b.cand) - scoreCandidate(a.cand);
          if (scoreDiff !== 0) return scoreDiff;
          const cleanLenDiff =
            cleanCommercialBookTitle(a.cand.title).title.length -
            cleanCommercialBookTitle(b.cand.title).title.length;
          if (cleanLenDiff !== 0) return cleanLenDiff;
          return a.cand.createdAt.localeCompare(b.cand.createdAt);
        });

      const winner = ranked[0];
      const losers = ranked.slice(1);
      const winnerSave = winner.row.save;
      const winnerEntity = winner.row.entity;
      const loserSaveIds = losers.map((l) => l.row.save.id);

      const bestTitle = pickBestTitle(
        ranked.map((r) => r.cand.title),
        winner.cand.title
      );
      mergedTitles.push(bestTitle);

      const bestAuthor =
        ranked.find(
          (r) => r.cand.author && r.cand.author.toLowerCase() !== "unknown author"
        )?.cand.author || winner.cand.author;
      const bestCover = ranked.find((r) => r.cand.coverUrl)?.cand.coverUrl || null;
      const bestSummary = ranked.find((r) => r.cand.summary)?.cand.summary || null;
      const bestPageCount =
        ranked.find((r) => r.cand.pageCount)?.cand.pageCount ?? null;
      const bestIsbn = ranked.find((r) => r.cand.isbn)?.cand.isbn ?? null;
      const bestGoodreadsId =
        ranked.find((r) => r.cand.goodreadsBookId)?.cand.goodreadsBookId ?? null;
      const anyOwned = ranked.some((r) => r.cand.isOwned);

      let bestStatus: ReadingStatus = winner.cand.readingStatus;
      for (const r of ranked) {
        if (STATUS_PRIORITY[r.cand.readingStatus] > STATUS_PRIORITY[bestStatus]) {
          bestStatus = r.cand.readingStatus;
        }
      }

      const bestRating = ranked.find((r) => r.cand.rating !== null)?.cand.rating ?? null;
      const bestDateRead = ranked.find((r) => r.cand.dateRead)?.cand.dateRead ?? null;
      const mergedNotes = mergeParagraphs(ranked.map((r) => r.row.save.personalNotes));
      const mergedAutoTags = mergeDistinctStrings(
        ranked.map((r) => r.row.save.autoTags)
      );

      const mergedShelves = mergeDistinctStrings(
        ranked.map((r) => {
          const cv = asRecord(r.row.save.userCustomValues);
          return Array.isArray(cv.goodreadsShelves)
            ? cv.goodreadsShelves.map(String)
            : [];
        })
      );

      const mergedQuotes = mergeDistinctStrings(
        ranked.map((r) => {
          const cv = asRecord(r.row.save.userCustomValues);
          return Array.isArray(cv.marginQuotes) ? cv.marginQuotes.map(String) : [];
        })
      );

      const allPurchaseHubIds = mergeDistinctStrings(
        ranked.map((r) => r.cand.mergedPurchaseHubIds)
      );

      if (winnerEntity) {
        let mergedStruct: Record<string, any> = {};
        let mergedExt: Record<string, any> = {};
        const aliases = new Set<string>();
        for (const r of [...losers].reverse().concat([winner])) {
          const e = r.row.entity;
          if (!e) continue;
          const csd = asRecord(e.coreStructuredData);
          const ext = asRecord(e.extendedAttributes);
          mergedStruct = { ...mergedStruct, ...csd };
          mergedExt = { ...mergedExt, ...ext };
          if (e.title) aliases.add(e.title);
          if (Array.isArray(csd.aliases)) {
            for (const a of csd.aliases) if (a) aliases.add(String(a));
          }
        }
        mergedStruct = {
          ...mergedStruct,
          title: bestTitle,
          ...(bestAuthor ? { author: bestAuthor } : {}),
          ...(bestIsbn ? { isbn: bestIsbn } : {}),
          ...(bestPageCount ? { pageCount: bestPageCount } : {}),
          ...(bestGoodreadsId ? { goodreadsId: bestGoodreadsId } : {}),
          aliases: [...aliases],
        };
        mergedExt = {
          ...mergedExt,
          ...(anyOwned ? { owned: true } : {}),
          ...(allPurchaseHubIds.length > 0
            ? { mergedPurchaseHubIds: allPurchaseHubIds }
            : {}),
        };

        tx.update(globalEntities)
          .set({
            title: bestTitle,
            brandOrCreator: bestAuthor || winnerEntity.brandOrCreator,
            heroImageUrl: bestCover || winnerEntity.heroImageUrl,
            summary: bestSummary || winnerEntity.summary,
            coreStructuredData: mergedStruct,
            extendedAttributes: mergedExt,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(globalEntities.id, winnerEntity.id))
          .run();
      }

      let mergedCv: Record<string, any> = {};
      for (const r of [...losers].reverse().concat([winner])) {
        mergedCv = { ...mergedCv, ...asRecord(r.row.save.userCustomValues) };
      }
      mergedCv = {
        ...mergedCv,
        readingStatus: bestStatus,
        shelf: readingStatusToShelf(bestStatus),
        owned: anyOwned,
        ...(bestRating !== null ? { rating: bestRating, myRating: bestRating } : {}),
        ...(bestDateRead ? { dateRead: bestDateRead } : {}),
        ...(bestGoodreadsId ? { goodreadsBookId: bestGoodreadsId } : {}),
        ...(mergedShelves.length > 0 ? { goodreadsShelves: mergedShelves } : {}),
        ...(mergedQuotes.length > 0 ? { marginQuotes: mergedQuotes } : {}),
      };
      if (anyOwned) {
        mergedCv.bookSource = "OWNED";
      }

      const nextWishlist =
        anyOwned || bestStatus !== "WANT_TO_READ"
          ? false
          : ranked.some((r) => Boolean(r.row.save.wishlist));

      tx.update(userSaves)
        .set({
          hasConvertedPurchase: anyOwned || winnerSave.hasConvertedPurchase,
          wishlist: nextWishlist,
          personalNotes: mergedNotes,
          autoTags: mergedAutoTags,
          userCustomValues: mergedCv,
        })
        .where(eq(userSaves.id, winnerSave.id))
        .run();

      // Reassign list_items cleanly onto winnerSave without creating duplicates in the same board
      const allGroupSaveIds = [winnerSave.id, ...loserSaveIds];
      const groupListItems = tx
        .select()
        .from(listItems)
        .where(inArray(listItems.saveId, allGroupSaveIds))
        .all();

      const winnerItemsByListId = new Map<string, typeof groupListItems[number]>();
      for (const li of groupListItems) {
        if (li.saveId !== winnerSave.id) continue;
        if (!winnerItemsByListId.has(li.listId)) {
          winnerItemsByListId.set(li.listId, li);
        } else {
          tx.delete(listItems).where(eq(listItems.id, li.id)).run();
        }
      }

      for (const li of groupListItems) {
        if (li.saveId === winnerSave.id) continue;
        const existingWinnerItem = winnerItemsByListId.get(li.listId);
        if (!existingWinnerItem) {
          tx.update(listItems)
            .set({ saveId: winnerSave.id })
            .where(eq(listItems.id, li.id))
            .run();
          winnerItemsByListId.set(li.listId, { ...li, saveId: winnerSave.id });
        } else {
          const patch: Partial<typeof li> = {};
          if (!existingWinnerItem.curatorNote && li.curatorNote) {
            patch.curatorNote = li.curatorNote;
          }
          if (!existingWinnerItem.isPinned && li.isPinned) {
            patch.isPinned = true;
          }
          if (Object.keys(patch).length > 0) {
            tx.update(listItems)
              .set(patch)
              .where(eq(listItems.id, existingWinnerItem.id))
              .run();
          }
          tx.delete(listItems).where(eq(listItems.id, li.id)).run();
        }
      }

      // Reassign entryConnections without self-loops or duplicates
      const allEdges = tx
        .select()
        .from(entryConnections)
        .where(
          and(
            eq(entryConnections.userId, userId),
            or(
              inArray(entryConnections.sourceSaveId, allGroupSaveIds),
              inArray(entryConnections.targetSaveId, allGroupSaveIds)
            )
          )
        )
        .all();

      const seenEdgeKeys = new Set<string>();
      for (const edge of allEdges) {
        const nextSrc = loserSaveIds.includes(edge.sourceSaveId)
          ? winnerSave.id
          : edge.sourceSaveId;
        const nextDst = loserSaveIds.includes(edge.targetSaveId)
          ? winnerSave.id
          : edge.targetSaveId;
        const key = `${nextSrc}:${nextDst}:${edge.connectionType}`;
        if (nextSrc === nextDst || seenEdgeKeys.has(key)) {
          tx.delete(entryConnections).where(eq(entryConnections.id, edge.id)).run();
        } else {
          seenEdgeKeys.add(key);
          if (nextSrc !== edge.sourceSaveId || nextDst !== edge.targetSaveId) {
            tx.update(entryConnections)
              .set({ sourceSaveId: nextSrc, targetSaveId: nextDst })
              .where(eq(entryConnections.id, edge.id))
              .run();
          }
        }
      }

      // Remove duplicate userSaves and orphaned globalEntities
      const loserEntityIds = new Set<string>();
      for (const loser of losers) {
        tx.delete(userSaves).where(eq(userSaves.id, loser.row.save.id)).run();
        mergedSavesRemoved++;
        if (loser.row.entity && loser.row.entity.id !== winnerEntity?.id) {
          loserEntityIds.add(loser.row.entity.id);
        }
      }

      for (const entId of loserEntityIds) {
        const [stillUsed] = tx
          .select({ id: userSaves.id })
          .from(userSaves)
          .where(eq(userSaves.entityId, entId))
          .limit(1)
          .all();
        if (!stillUsed) {
          if (winnerEntity) {
            const orphanSources = tx
              .select()
              .from(entitySources)
              .where(eq(entitySources.entityId, entId))
              .all();
            for (const src of orphanSources) {
              const [dupSrc] = tx
                .select({ id: entitySources.id })
                .from(entitySources)
                .where(
                  and(
                    eq(entitySources.entityId, winnerEntity.id),
                    eq(entitySources.urlHash, src.urlHash)
                  )
                )
                .limit(1)
                .all();
              if (!dupSrc) {
                tx.update(entitySources)
                  .set({ entityId: winnerEntity.id })
                  .where(eq(entitySources.id, src.id))
                  .run();
              } else {
                tx.delete(entitySources).where(eq(entitySources.id, src.id)).run();
              }
            }
          } else {
            tx.delete(entitySources).where(eq(entitySources.entityId, entId)).run();
          }
          tx.delete(entityPriceHistory).where(eq(entityPriceHistory.entityId, entId)).run();
          tx.delete(globalEntities).where(eq(globalEntities.id, entId)).run();
        }
      }
    }
    });
  }

  if (options?.dryRun) {
    return {
      duplicateGroups: groups.length,
      duplicateSaveCount,
      mergedSavesRemoved: 0,
      mergedTitles: groups.map((g) =>
        pickBestTitle(
          g.map((r) => r.save.privateTitle || r.entity?.title || ""),
          "Untitled Book"
        )
      ),
    };
  }

  // Hygiene pass across remaining books:
  // 1) Reclassify travel guides & language/study books into My Stuff / Travel & Study
  // 2) Sanitize empty Goodreads note placeholders & "[edit]" tags
  // 3) Clean commercial title noise & infer authorHint when missing
  let cleanedNotesCount = 0;
  let reclassifiedReferenceCount = 0;

  const remainingRows = await db
    .select({
      save: userSaves,
      entity: globalEntities,
    })
    .from(userSaves)
    .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
    .where(
      and(
        eq(userSaves.userId, userId),
        eq(userSaves.isPrivateMemo, false),
        or(
          eq(globalEntities.coreType, "BOOK"),
          eq(userSaves.typePath, "/product/book"),
          eq(userSaves.typePath, "/media/film"),
          eq(globalEntities.typePath, "/media/film")
        )
      )
    );

  const booksBoardRows = await db
    .query.smartLists.findMany({
      where: (sl, { and: a, eq: e }) =>
        a(e(sl.userId, userId), or(e(sl.slug, "books"), e(sl.slug, "films"))),
    })
    .catch(() => []);
  const booksBoardId = booksBoardRows.find((b) => b.slug === "books")?.id || null;
  const filmsBoardId = booksBoardRows.find((b) => b.slug === "films")?.id || null;

  let travelStudyBoardId: string | null = null;
  for (const row of remainingRows) {
    const ent = row.entity;
    const isFilmRow =
      row.save.typePath === "/media/film" || ent?.typePath === "/media/film";
    const rawTitle = (row.save.privateTitle || ent?.title || "").trim();
    const probe = `${rawTitle} ${ent?.brandOrCreator || ""} ${(row.save.autoTags || []).join(" ")}`.trim();

    if (isTravelGuideOrStudyBook(probe)) {
      if (!travelStudyBoardId) {
        const boardRes = await ensureHierarchicalBoard(userId, {
          rootSlug: "my-stuff",
          rootTitle: "My Stuff",
          rootDescription: "Owned durable objects synced from Purchase Hub",
          rootDefaultLayout: "shelf",
          subSlug: "my-stuff-reference-travel",
          subTitle: "Travel & Study",
          subDescription:
            "Owned travel guides, language textbooks, and study books synced from Purchase Hub",
          subDefaultLayout: "shelf",
        });
        travelStudyBoardId = boardRes.listId;
      }

      db.transaction((tx) => {
        if (ent) {
          tx.update(globalEntities)
            .set({
              coreType: "PRODUCT",
              typePath: "/product/reference",
              updatedAt: new Date().toISOString(),
            })
            .where(eq(globalEntities.id, ent.id))
            .run();
        }
        tx.update(userSaves)
          .set({ typePath: "/product/reference" })
          .where(eq(userSaves.id, row.save.id))
          .run();

        if (booksBoardId) {
          tx.delete(listItems)
            .where(and(eq(listItems.listId, booksBoardId), eq(listItems.saveId, row.save.id)))
            .run();
        }
        if (filmsBoardId) {
          tx.delete(listItems)
            .where(and(eq(listItems.listId, filmsBoardId), eq(listItems.saveId, row.save.id)))
            .run();
        }
        if (travelStudyBoardId) {
          const [exists] = tx
            .select({ id: listItems.id })
            .from(listItems)
            .where(
              and(
                eq(listItems.listId, travelStudyBoardId),
                eq(listItems.saveId, row.save.id)
              )
            )
            .limit(1)
            .all();
          if (!exists) {
            tx.insert(listItems)
              .values({
                listId: travelStudyBoardId,
                saveId: row.save.id,
                positionIndex: 999,
              })
              .run();
          }
        }
      });
      reclassifiedReferenceCount++;
      continue;
    }

    if (isFilmRow) {
      continue;
    }

    const sanitizedNote = sanitizeGoodreadsNote(row.save.personalNotes);
    const noteChanged = (row.save.personalNotes || null) !== sanitizedNote;
    const rawTags = Array.isArray(row.save.autoTags) ? row.save.autoTags : [];
    const cleanTags = rawTags.filter((t) => {
      const low = String(t || "").trim().toLowerCase();
      return Boolean(low) && low !== "[edit]" && low !== "edit";
    });
    const tagsChanged = cleanTags.length !== rawTags.length;

    const cv = asRecord(row.save.userCustomValues);
    const rawShelves = Array.isArray(cv.goodreadsShelves)
      ? cv.goodreadsShelves.map(String)
      : [];
    const cleanShelves = rawShelves.filter((s) => {
      const low = s.trim().toLowerCase();
      return Boolean(low) && low !== "[edit]" && low !== "edit";
    });
    const shelvesChanged = cleanShelves.length !== rawShelves.length;

    if (noteChanged || tagsChanged || shelvesChanged) {
      await db
        .update(userSaves)
        .set({
          ...(noteChanged ? { personalNotes: sanitizedNote } : {}),
          ...(tagsChanged ? { autoTags: cleanTags } : {}),
          ...(shelvesChanged
            ? { userCustomValues: { ...cv, goodreadsShelves: cleanShelves } }
            : {}),
        })
        .where(eq(userSaves.id, row.save.id));
      cleanedNotesCount++;
    }

    if (ent && ent.title) {
      const cleaned = cleanCommercialBookTitle(ent.title);
      const entPatch: Record<string, unknown> = {};
      if (cleaned.title && cleaned.title !== ent.title.trim() && cleaned.title.length >= 3) {
        entPatch.title = cleaned.title;
      }
      if (!ent.brandOrCreator && cleaned.authorHint) {
        entPatch.brandOrCreator = cleaned.authorHint;
      }
      if (Object.keys(entPatch).length > 0) {
        entPatch.updatedAt = new Date().toISOString();
        await db
          .update(globalEntities)
          .set(entPatch)
          .where(eq(globalEntities.id, ent.id));
      }
    }
  }

  return {
    duplicateGroups: groups.length,
    duplicateSaveCount,
    mergedSavesRemoved,
    mergedTitles,
    cleanedNotesCount,
    reclassifiedReferenceCount,
  };
}
