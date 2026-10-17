import { buildAffiliateUrl, type UserAffiliateTags } from "./affiliate";

export interface UcpLineItem {
  id: string;
  entityId?: string | null;
  saveId?: string;
  title: string;
  brandOrCreator?: string | null;
  skuId: string;
  priceCents: number;
  currency: string;
  quantity: number;
  imageUrl?: string | null;
}

export interface UcpProductOffer {
  offerId: string;
  skuId: string;
  sellerName: string;
  priceCents: number;
  currency: string;
  inStock: boolean;
  destinationUrl: string;
  affiliateAttributedUrl?: string;
}

export interface UcpMerchantCapability {
  instantCheckout: boolean;
  supportedPaymentMethods: string[];
  currency: string;
  locale?: string;
}

export interface UcpCreatorAttribution {
  curatorId: string;
  curatorUsername?: string;
  affiliateTags?: UserAffiliateTags | null;
  attributedCommissionRate: number; // 1.0 = 100% of affiliate commission
}

export interface UcpSplitBagSession {
  sessionId: string;
  checkoutUrl: string;
  protocol: "UCP/1.0";
  status: "READY" | "PENDING" | "COMPLETED";
  buyerUserId?: string | null;
  lineItems: UcpLineItem[];
  attribution: UcpCreatorAttribution;
  totalCents: number;
  currency: string;
  createdAt: string;
  expiresAt: string;
  metadata?: Record<string, any>;
}

export interface CreateUcpCheckoutSessionParams {
  saveId?: string;
  entity: {
    id?: string;
    title: string;
    brandOrCreator?: string | null;
    priceCents?: number | null;
    bestPriceCents?: number | null;
    currency?: string | null;
    ucpSkuId?: string | null;
    canonicalUrl?: string;
    heroImageUrl?: string | null;
  };
  primarySource?: {
    sellerName: string;
    sourceUrl: string;
    priceCents?: number | null;
    currency?: string | null;
    affiliateTemplate?: string | null;
  } | null;
  curator: {
    id: string;
    username: string;
    affiliateTags?: UserAffiliateTags | null;
  };
  buyerUserId?: string | null;
}

const activeUcpSessions = new Map<string, UcpSplitBagSession>();

/**
 * Generates a standardized Universal Commerce Protocol (UCP) checkout session
 * with full creator attribution metadata and SKU resolution.
 */
export function createUcpCheckoutSession(params: CreateUcpCheckoutSessionParams): UcpSplitBagSession {
  const priceCents =
    params.primarySource?.priceCents ??
    params.entity.bestPriceCents ??
    params.entity.priceCents ??
    0;

  const currency =
    params.primarySource?.currency ||
    params.entity.currency ||
    "USD";

  const skuId =
    params.entity.ucpSkuId ||
    `sku_${params.entity.id || "curio"}_${Date.now()}`;

  const sessionId = `ucp_ses_${crypto.randomUUID()}`;

  const destinationUrl = params.primarySource?.sourceUrl || params.entity.canonicalUrl || "#";
  const affiliateUrl = buildAffiliateUrl(
    destinationUrl,
    params.primarySource?.sellerName,
    params.primarySource?.affiliateTemplate,
    params.curator.affiliateTags
  );

  const isDirectUcp = Boolean(params.entity.ucpSkuId);
  const checkoutUrl = isDirectUcp
    ? `https://pay.google.com/gp/p/ui/pay?session=${sessionId}&sku=${skuId}`
    : affiliateUrl;

  const lineItem: UcpLineItem = {
    id: `li_${crypto.randomUUID()}`,
    entityId: params.entity.id || null,
    saveId: params.saveId,
    title: params.entity.title,
    brandOrCreator: params.entity.brandOrCreator || null,
    skuId,
    priceCents,
    currency,
    quantity: 1,
    imageUrl: params.entity.heroImageUrl || null,
  };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const session: UcpSplitBagSession = {
    sessionId,
    checkoutUrl,
    protocol: "UCP/1.0",
    status: "READY",
    buyerUserId: params.buyerUserId || null,
    lineItems: [lineItem],
    attribution: {
      curatorId: params.curator.id,
      curatorUsername: params.curator.username,
      affiliateTags: params.curator.affiliateTags || null,
      attributedCommissionRate: 1.0,
    },
    totalCents: priceCents,
    currency,
    createdAt: now.toISOString(),
    expiresAt,
    metadata: {
      sellerName: params.primarySource?.sellerName || (isDirectUcp ? "Google UCP Merchant" : "Direct Retailer"),
      isAgenticCheckout: true,
      hasDirectUcp: isDirectUcp,
    },
  };

  activeUcpSessions.set(sessionId, session);
  return session;
}

export function getUcpSession(sessionId: string): UcpSplitBagSession | undefined {
  return activeUcpSessions.get(sessionId);
}

export function clearUcpSessions(): void {
  activeUcpSessions.clear();
}
