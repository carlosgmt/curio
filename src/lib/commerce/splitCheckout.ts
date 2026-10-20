import { db, smartLists, listItems, userSaves, globalEntities, entitySources, users, checkoutSessions } from "@/db";
import { eq, or, desc, asc } from "drizzle-orm";
import { buildAffiliateUrl, type UserAffiliateTags } from "./affiliate";

export interface CreateSplitCheckoutParams {
  boardId: string;
  buyerUserId?: string | null;
  currency?: string;
}

export interface SplitCheckoutResult {
  id: string;
  sessionId: string;
  boardId: string;
  curatorId: string;
  curatorUsername: string;
  buyerUserId: string | null;
  totalCents: number;
  currency: string;
  status: "READY" | "PENDING" | "COMPLETED" | "EXPIRED";
  checkoutUrl: string;
  ucpLineItems: Array<{
    skuId: string;
    title: string;
    priceCents: number;
    currency: string;
    quantity: number;
    sellerName: string;
    imageUrl?: string | null;
  }>;
  affiliateItems: Array<{
    saveId: string;
    title: string;
    priceCents?: number | null;
    sellerName: string;
    destinationUrl: string;
    affiliateAttributedUrl: string;
  }>;
  createdAt: string;
  expiresAt: string;
}

/**
 * Partitions board items into Google UCP line items and creator-attributed affiliate offers,
 * and persists the session into checkout_sessions.
 */
export async function createBoardSplitCheckoutSession(
  params: CreateSplitCheckoutParams
): Promise<SplitCheckoutResult> {
  const { boardId, buyerUserId, currency = "USD" } = params;

  // 1. Resolve Board
  const [board] = await db
    .select()
    .from(smartLists)
    .where(or(eq(smartLists.id, boardId), eq(smartLists.slug, boardId)))
    .limit(1);

  if (!board) {
    throw new Error(`Board not found: ${boardId}`);
  }

  // 2. Resolve Curator
  const [curator] = await db
    .select()
    .from(users)
    .where(eq(users.id, board.userId))
    .limit(1);

  if (!curator) {
    throw new Error(`Curator user not found for board: ${boardId}`);
  }

  // 3. Resolve Items for Board
  const rows = await db
    .select({
      listItem: listItems,
      save: userSaves,
      entity: globalEntities,
      source: entitySources,
    })
    .from(listItems)
    .innerJoin(userSaves, eq(listItems.saveId, userSaves.id))
    .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
    .leftJoin(entitySources, eq(userSaves.preferredSourceId, entitySources.id))
    .where(eq(listItems.listId, board.id))
    .orderBy(desc(listItems.isPinned), asc(listItems.positionIndex));

  const ucpLineItems: SplitCheckoutResult["ucpLineItems"] = [];
  const affiliateItems: SplitCheckoutResult["affiliateItems"] = [];

  for (const row of rows) {
    const { save, entity, source } = row;
    const title = entity?.title || save.privateTitle || "Curated Item";
    const priceCents = source?.priceCents ?? entity?.priceCents ?? null;
    const itemCurrency = source?.currency || entity?.currency || currency;
    const sellerName = source?.sellerName || "Direct Retailer";
    const destinationUrl = source?.sourceUrl || entity?.canonicalUrl || "#";

    const hasUcpSku = Boolean(entity?.ucpSkuId);

    if (hasUcpSku && entity?.ucpSkuId) {
      ucpLineItems.push({
        skuId: entity.ucpSkuId,
        title,
        priceCents: priceCents ?? 0,
        currency: itemCurrency,
        quantity: 1,
        sellerName: source?.sellerName || "Google UCP Merchant",
        imageUrl: entity?.heroImageUrl || null,
      });
    } else {
      const affiliateAttributedUrl = buildAffiliateUrl(
        destinationUrl,
        sellerName,
        source?.affiliateTemplate,
        curator.affiliateTags as UserAffiliateTags | null
      );

      affiliateItems.push({
        saveId: save.id,
        title,
        priceCents,
        sellerName,
        destinationUrl,
        affiliateAttributedUrl,
      });
    }
  }

  const totalCents = ucpLineItems.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0
  );

  const sessionId = `ucp_ses_${crypto.randomUUID()}`;
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const checkoutUrl =
    ucpLineItems.length > 0
      ? `https://pay.google.com/gp/p/ui/pay?session=${sessionId}`
      : "";

  await db.insert(checkoutSessions).values({
    id: sessionId,
    boardId: board.id,
    curatorId: curator.id,
    buyerUserId: buyerUserId || null,
    totalCents,
    currency,
    status: "READY",
    ucpLineItems,
    affiliateItems,
    createdAt,
    expiresAt,
  });

  return {
    id: sessionId,
    sessionId,
    boardId: board.id,
    curatorId: curator.id,
    curatorUsername: curator.username,
    buyerUserId: buyerUserId || null,
    totalCents,
    currency,
    status: "READY",
    checkoutUrl,
    ucpLineItems,
    affiliateItems,
    createdAt,
    expiresAt,
  };
}

/**
 * Retrieves an existing checkout session by ID.
 */
export async function getCheckoutSession(sessionId: string) {
  const [session] = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, sessionId))
    .limit(1);

  return session || null;
}
