import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, globalEntities, smartLists, userSaves } from "@/db";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { resolveBook } from "@/lib/enrichment/providers/books";
import { generateEntityKey } from "@/lib/ingest/cascade";
import { computeIdentityFingerprint } from "@/lib/ingest/resolution";
import { normalizeEntityString } from "@/lib/enrichment/universalDiscovery";
import { ensureHierarchicalBoard } from "@/lib/sync/engine";
import {
  cleanCommercialBookTitle,
  isOwnedBook,
  normalizeDateString,
  readingStatusToShelf,
  toLibraryBookView,
} from "@/lib/books/library";

const logBookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().optional().nullable(),
  isbn: z.string().optional().nullable(),
  pageCount: z.number().int().positive().optional().nullable(),
  publisher: z.string().optional().nullable(),
  year: z.number().int().optional().nullable(),
  coverUrl: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  canonicalUrl: z.string().optional().nullable(),
  readingStatus: z.enum(["WANT_TO_READ", "READING", "FINISHED"]).default("FINISHED"),
  bookSource: z.enum(["OWNED", "READ_ONLINE", "BORROWED", "GOODREADS"]).default("READ_ONLINE"),
  format: z.enum(["PHYSICAL", "KINDLE", "EBOOK", "AUDIOBOOK", "ONLINE"]).optional(),
  rating: z.number().min(0.5).max(5).optional().nullable(),
  dateRead: z.string().optional().nullable(),
  personalNotes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  marginQuotes: z.array(z.string()).optional(),
});

function mergeDistinctTags(
  existing: string[] | null | undefined,
  incoming: string[]
): string[] {
  const seen = new Map<string, string>();
  for (const raw of [...(existing || []), ...incoming]) {
    const clean = String(raw || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) seen.set(key, clean);
  }
  return [...seen.values()];
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();
    const parsed = logBookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid book payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const cleaned = cleanCommercialBookTitle(input.title);
    const cleanIsbn = input.isbn?.replace(/[^0-9Xx]/g, "").trim() || undefined;
    let resolvedAuthor = input.author?.trim() || cleaned.authorHint || undefined;
    let resolvedCover = input.coverUrl?.trim() || undefined;
    let resolvedPages = input.pageCount ?? undefined;
    let resolvedPublisher = input.publisher?.trim() || undefined;
    let resolvedYear = input.year ?? undefined;
    let resolvedSummary = input.summary?.trim() || undefined;
    let resolvedIsbn = cleanIsbn;
    let resolvedCanonicalUrl = input.canonicalUrl?.trim() || undefined;

    if (!resolvedCover || !resolvedPages || !resolvedAuthor) {
      const resolved = await resolveBook(cleaned.title, {
        authorHint: resolvedAuthor,
        isbnHint: resolvedIsbn,
        yearHint: resolvedYear ?? undefined,
        timeoutMs: 4000,
      }).catch(() => null);
      if (resolved) {
        resolvedAuthor = resolvedAuthor || resolved.author;
        resolvedCover = resolvedCover || resolved.coverUrl;
        resolvedPages = resolvedPages ?? resolved.pageCount;
        resolvedPublisher = resolvedPublisher || resolved.publisher;
        resolvedYear = resolvedYear ?? resolved.releaseYear;
        resolvedIsbn = resolvedIsbn || resolved.isbn;
        resolvedSummary = resolvedSummary || resolved.summary;
        resolvedCanonicalUrl = resolvedCanonicalUrl || resolved.canonicalUrl;
      }
    }

    const finalAuthor = resolvedAuthor || "Unknown Author";
    const fingerprint = computeIdentityFingerprint(
      "/product/book",
      cleaned.title,
      finalAuthor
    );
    const normTitle = normalizeEntityString(cleaned.title);
    const normAuthor = normalizeEntityString(finalAuthor);
    const isbnExtId = resolvedIsbn ? `isbn:${resolvedIsbn}` : null;

    const existingBooks = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.typePath, "/product/book"));

    let entity = existingBooks.find((e) => {
      if (isbnExtId && e.canonicalExternalId === isbnExtId) return true;
      if (e.identityFingerprint === fingerprint) return true;
      const eCore = (e.coreStructuredData as Record<string, any>) || {};
      if (resolvedIsbn && eCore.isbn === resolvedIsbn) return true;
      const eCleaned = cleanCommercialBookTitle(e.title);
      const normETitle = normalizeEntityString(eCleaned.title);
      const normEAuthor = normalizeEntityString(
        e.brandOrCreator || eCore.author || eCleaned.authorHint || ""
      );
      return (
        normETitle === normTitle &&
        (!normAuthor ||
          !normEAuthor ||
          normEAuthor.includes(normAuthor) ||
          normAuthor.includes(normEAuthor))
      );
    });

    if (!entity) {
      const canonicalUrl =
        resolvedCanonicalUrl ||
        `https://openlibrary.org/search?q=${encodeURIComponent(cleaned.title)}`;
      const { urlHash, entityKey } = generateEntityKey(canonicalUrl, cleaned.title);

      const [createdEntity] = await db
        .insert(globalEntities)
        .values({
          urlHash,
          entityKey,
          canonicalUrl,
          coreType: "BOOK",
          typePath: "/product/book",
          canonicalExternalId: isbnExtId || `book:${entityKey}`,
          identityFingerprint: fingerprint,
          brandOrCreator: finalAuthor,
          title: input.title.trim(),
          summary:
            resolvedSummary ||
            `By ${finalAuthor}${resolvedYear ? ` (${resolvedYear})` : ""}`,
          heroImageUrl: resolvedCover || null,
          coreStructuredData: {
            title: input.title.trim(),
            author: finalAuthor,
            ...(resolvedIsbn ? { isbn: resolvedIsbn } : {}),
            ...(resolvedPages ? { pageCount: resolvedPages } : {}),
            ...(resolvedPublisher ? { publisher: resolvedPublisher } : {}),
            ...(resolvedYear ? { year: resolvedYear } : {}),
            ...(input.personalNotes
              ? { obiText: input.personalNotes.trim().slice(0, 140) }
              : {}),
          },
          extendedAttributes: {
            bookSource: input.bookSource,
            owned: input.bookSource === "OWNED",
          },
          priceCents: 1899,
          currency: "USD",
        })
        .returning();
      entity = createdEntity;
    } else {
      const eCore =
        entity.coreStructuredData && typeof entity.coreStructuredData === "object"
          ? ({ ...(entity.coreStructuredData as Record<string, any>) })
          : {};
      const entityPatch: Record<string, unknown> = {};
      let csdChanged = false;
      if (!entity.heroImageUrl && resolvedCover) {
        entityPatch.heroImageUrl = resolvedCover;
      }
      if (!entity.brandOrCreator && finalAuthor !== "Unknown Author") {
        entityPatch.brandOrCreator = finalAuthor;
      }
      if (!eCore.author && finalAuthor) {
        eCore.author = finalAuthor;
        csdChanged = true;
      }
      if (!eCore.isbn && resolvedIsbn) {
        eCore.isbn = resolvedIsbn;
        csdChanged = true;
      }
      if (!eCore.pageCount && resolvedPages) {
        eCore.pageCount = resolvedPages;
        csdChanged = true;
      }
      if (!eCore.year && resolvedYear) {
        eCore.year = resolvedYear;
        csdChanged = true;
      }
      if (!eCore.publisher && resolvedPublisher) {
        eCore.publisher = resolvedPublisher;
        csdChanged = true;
      }
      if (csdChanged) entityPatch.coreStructuredData = eCore;
      if (Object.keys(entityPatch).length > 0) {
        entityPatch.updatedAt = new Date().toISOString();
        const [updatedEnt] = await db
          .update(globalEntities)
          .set(entityPatch)
          .where(eq(globalEntities.id, entity.id))
          .returning();
        if (updatedEnt) entity = updatedEnt;
      }
    }

    const [existingSave] = await db
      .select()
      .from(userSaves)
      .where(and(eq(userSaves.userId, user.id), eq(userSaves.entityId, entity.id)))
      .limit(1);

    const existingCv =
      existingSave?.userCustomValues &&
      typeof existingSave.userCustomValues === "object"
        ? (existingSave.userCustomValues as Record<string, any>)
        : {};

    const existingOwned = existingSave ? isOwnedBook(existingSave, entity) : false;
    const isOwned = existingOwned || input.bookSource === "OWNED";
    const effectiveSource = isOwned ? "OWNED" : input.bookSource;
    const effectiveFormat =
      input.format || (effectiveSource === "OWNED" ? "PHYSICAL" : "ONLINE");
    const effectiveDateRead =
      normalizeDateString(input.dateRead) ||
      (input.readingStatus === "FINISHED" && !existingCv.dateRead
        ? new Date().toISOString().slice(0, 10)
        : existingCv.dateRead || undefined);
    const wishlist = isOwned ? false : input.readingStatus === "WANT_TO_READ";

    const nextCv: Record<string, any> = {
      ...existingCv,
      readingStatus: input.readingStatus,
      shelf: readingStatusToShelf(input.readingStatus),
      bookSource: effectiveSource,
      owned: isOwned,
      format: effectiveFormat,
    };

    if (input.rating !== undefined && input.rating !== null) {
      nextCv.rating = input.rating;
      nextCv.myRating = input.rating;
    }
    if (effectiveDateRead) {
      nextCv.dateRead = effectiveDateRead;
    }
    if (Array.isArray(input.marginQuotes) && input.marginQuotes.length > 0) {
      const existingQuotes = Array.isArray(existingCv.marginQuotes)
        ? existingCv.marginQuotes
        : [];
      nextCv.marginQuotes = [
        ...new Set([...existingQuotes, ...input.marginQuotes.map((q) => q.trim()).filter(Boolean)]),
      ];
    }

    const incomingTags = [
      "book",
      ...(effectiveSource === "READ_ONLINE" ? ["read-online"] : []),
      ...(input.tags || []),
    ];
    const cleanNotes = input.personalNotes?.trim();

    let savedRow: typeof userSaves.$inferSelect;
    if (existingSave) {
      const nextNotes = cleanNotes
        ? existingSave.personalNotes &&
          existingSave.personalNotes.toLowerCase().includes(cleanNotes.toLowerCase())
          ? existingSave.personalNotes
          : existingSave.personalNotes
          ? `${existingSave.personalNotes}\n\n${cleanNotes}`
          : cleanNotes
        : existingSave.personalNotes;

      const [updated] = await db
        .update(userSaves)
        .set({
          wishlist,
          hasConvertedPurchase: existingSave.hasConvertedPurchase || isOwned,
          personalNotes: nextNotes,
          userCustomValues: nextCv,
          autoTags: mergeDistinctTags(existingSave.autoTags, incomingTags),
        })
        .where(eq(userSaves.id, existingSave.id))
        .returning();
      savedRow = updated;
    } else {
      const [created] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: entity.id,
          typePath: "/product/book",
          isPrivateMemo: false,
          wishlist,
          hasConvertedPurchase: isOwned,
          personalNotes: cleanNotes || null,
          userCustomValues: nextCv,
          autoTags: mergeDistinctTags([], incomingTags),
          enrichmentStatus: "ENRICHED",
          visibility: "PRIVATE",
        })
        .returning();
      savedRow = created;
    }

    const boardRes = await ensureHierarchicalBoard(user.id, {
      rootSlug: "books",
      rootTitle: "Books",
      rootDefaultLayout: "shelf",
      autoRules: { coreType: "BOOK" },
    });
    await db
      .update(smartLists)
      .set({ defaultLayout: "shelf" })
      .where(eq(smartLists.id, boardRes.rootId));

    return NextResponse.json(
      {
        success: true,
        book: toLibraryBookView(savedRow, entity),
      },
      { status: existingSave ? 200 : 201 }
    );
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to log book" },
      { status: 500 }
    );
  }
}
