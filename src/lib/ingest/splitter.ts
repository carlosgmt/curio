import { db, globalEntities, userSaves, curioTypes, type GlobalEntity, type UserSave } from "@/db";
import { generateEntityKey, getOrCreateDefaultUser } from "./cascade";
import { classifyEntityType } from "../curio-learns/ontology";
import { eq } from "drizzle-orm";

export interface SplitItem {
  title: string;
  creatorOrBrand?: string;
  timestampSeconds?: number;
  snippet?: string;
  rank?: number;
  typePath?: string;
}

export interface SplitterResult {
  isMultiItem: boolean;
  parentEntity: GlobalEntity | null;
  childEntities: GlobalEntity[];
  childSaves: UserSave[];
}

export function isMultiItemUrlOrText(input: string): boolean {
  const normalized = input.trim();
  const multiUrlRegex = /(?:youtube\.com\/(?:playlist\?list=|watch\?.*list=)|spotify\.com\/(?:playlist|album)|letterboxd\.com\/.*\/list\/)/i;
  const listicleRegex = /\b(?:top\s+\d+|\d+\s+best|\d+\s+favorite|\d+\s+greatest|collection of|roundup)\b/i;
  return multiUrlRegex.test(normalized) || listicleRegex.test(normalized);
}

/**
 * Parses timestamps, numbered lists, and bullet points from transcripts or listicles
 */
export function parseChildItemsFromContent(content: string): SplitItem[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: SplitItem[] = [];

  // Match: "1. Item Title - Creator (02:15)" OR "02:15 - Item Title"
  const numberedRegex = /^(?:(\d+)\.|\-|\*|\#\d+)\s*(.*?)(?:\s*[\(\[](\d{1,2}:\d{2}(?::\d{2})?)[\)\]])?$/;
  const timestampPrefixRegex = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-—:]\s*(.*)$/;

  for (const line of lines) {
    const tsMatch = line.match(timestampPrefixRegex);
    if (tsMatch) {
      const [, timeStr, rawTitle] = tsMatch;
      const parts = timeStr.split(":").map(Number);
      const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
      items.push({
        title: rawTitle.trim(),
        timestampSeconds: seconds,
        rank: items.length + 1,
      });
      continue;
    }

    const numMatch = line.match(numberedRegex);
    if (numMatch) {
      const [, rankStr, rawTitle, timeStr] = numMatch;
      let seconds: number | undefined;
      if (timeStr) {
        const parts = timeStr.split(":").map(Number);
        seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
      }
      items.push({
        title: rawTitle.trim(),
        rank: rankStr ? parseInt(rankStr, 10) : items.length + 1,
        timestampSeconds: seconds,
      });
    }
  }

  return items;
}

/**
 * Ingests a multi-item source and splits into parent container + atomic child entity saves
 */
export async function splitAndIngestMultiItem(params: {
  input: string;
  parentTitle: string;
  sourceUrl: string;
  userId?: string;
  content?: string;
}): Promise<SplitterResult> {
  const { input, parentTitle, sourceUrl, content } = params;
  const user = params.userId
    ? (await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, params.userId!) })) || (await getOrCreateDefaultUser())
    : await getOrCreateDefaultUser();

  const childItems = content ? parseChildItemsFromContent(content) : parseChildItemsFromContent(input);

  if (childItems.length === 0) {
    return {
      isMultiItem: false,
      parentEntity: null,
      childEntities: [],
      childSaves: [],
    };
  }

  // 1. Create or retrieve parent entity
  const { urlHash, entityKey } = generateEntityKey(sourceUrl, parentTitle);
  const [existingParent] = await db
    .select()
    .from(globalEntities)
    .where(eq(globalEntities.urlHash, urlHash))
    .limit(1);

  let parentEntity = existingParent;
  if (!parentEntity) {
    const isVideo = /youtube\.com|youtu\.be/i.test(sourceUrl);
    const [inserted] = await db
      .insert(globalEntities)
      .values({
        urlHash,
        entityKey,
        canonicalUrl: sourceUrl,
        coreType: isVideo ? "SOURCE_VIDEO" : "ARTICLE",
        typePath: isVideo ? "/media/source-video" : "/article/roundup",
        title: parentTitle,
        summary: `Multi-item collection containing ${childItems.length} curated artifacts.`,
        coreStructuredData: {
          childItemCount: childItems.length,
          sourceUrl,
        },
      })
      .returning();
    parentEntity = inserted;
  }

  // 2. Ingest child entities linked to parentEntityId
  const childEntities: GlobalEntity[] = [];
  const childSaves: UserSave[] = [];

  for (const item of childItems) {
    const childUrl = `${sourceUrl}#item=${encodeURIComponent(item.title)}`;
    const { urlHash: childHash, entityKey: childKey } = generateEntityKey(childUrl, item.title);

    const classification = await classifyEntityType(item.title, user.id);

    const [childEntity] = await db
      .insert(globalEntities)
      .values({
        parentEntityId: parentEntity.id,
        urlHash: childHash,
        entityKey: childKey,
        canonicalUrl: childUrl,
        coreType: classification.rootArchetype || "PRODUCT",
        typePath: classification.typePath || "/product/generic",
        title: item.title,
        brandOrCreator: item.creatorOrBrand || null,
        coreStructuredData: {
          rank: item.rank,
          timestampSeconds: item.timestampSeconds,
          parentTitle: parentEntity.title,
        },
      })
      .onConflictDoUpdate({
        target: globalEntities.entityKey,
        set: {
          parentEntityId: parentEntity.id,
        },
      })
      .returning();

    childEntities.push(childEntity);

    // Save for the user
    const [childSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: childEntity.id,
        typePath: childEntity.typePath,
        isPrivateMemo: false,
        autoTags: [childEntity.coreType.toLowerCase(), "extracted"],
        personalNotes: item.timestampSeconds !== undefined ? `Timestamp: ${item.timestampSeconds}s` : null,
        enrichmentStatus: "ENRICHED",
        visibility: "PRIVATE",
      })
      .returning();

    childSaves.push(childSave);
  }

  return {
    isMultiItem: true,
    parentEntity,
    childEntities,
    childSaves,
  };
}
