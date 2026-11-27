"use client";

import React from "react";
import {
  Play,
  Music,
  BookOpen,
  MapPin,
  Utensils,
  ExternalLink,
  ShoppingBag,
  Gamepad2,
  Zap,
  Wine,
  Frame,
  Lock,
  Info,
} from "lucide-react";

import { buildAffiliateUrl, type UserAffiliateTags } from "@/lib/commerce/affiliate";
import { type ActionProviderSlot } from "@/lib/commerce/utilityDeepLinks";
import { resolveAuthenticFooterActions } from "@/lib/cards/capabilities";

export { buildAffiliateUrl, type UserAffiliateTags };

export interface CardFooterWaterfallProps {
  entity: {
    id?: string;
    title: string;
    canonicalUrl?: string;
    coreType: string;
    typePath?: string | null;
    heroImageUrl?: string | null;
    brandOrCreator?: string | null;
    priceCents?: number | null;
    currency?: string | null;
    ucpSkuId?: string | null;
    coreStructuredData?: any;
    extendedAttributes?: any;
  };
  primarySource?: {
    sellerName: string;
    sourceUrl: string;
    priceCents?: number | null;
    currency?: string | null;
    affiliateTemplate?: string | null;
  } | null;
  creatorAffiliateTags?: UserAffiliateTags | null;
  customUtilityLabel?: string;
  isWishlist?: boolean;
  hidePrice?: boolean;
  flush?: boolean;
  tone?: "auto" | "dark";
  onUtilityClick?: () => void;
}

export function CardFooterWaterfall({
  entity,
  primarySource,
  creatorAffiliateTags,
  customUtilityLabel,
  isWishlist = false,
  hidePrice = false,
  flush = false,
  tone = "auto",
  onUtilityClick,
}: CardFooterWaterfallProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const ext = (typeof entity.extendedAttributes === "object" && entity.extendedAttributes) || {};
  const isClosetItem = Boolean(data.closetId);
  const isPurchaseHubItem = Boolean(ext.purchaseHubProductId || ext.source === "purchase-hub");
  const isOwnedSynced = (isClosetItem || isPurchaseHubItem) && !isWishlist;
  const isDarkSurface = tone === "dark";

  const authenticActions = resolveAuthenticFooterActions(entity, primarySource, isWishlist);
  const infoSlot = authenticActions.find((a) => a.slot === "info") || null;
  const experienceSlot = authenticActions.find((a) => a.slot === "experience") || null;
  const buySlot = authenticActions.find((a) => a.slot === "buy") || null;
  const ownedSlot = authenticActions.find((a) => a.slot === "owned") || null;

  const renderSlotIcon = (iconName: ActionProviderSlot["iconName"]) => {
    switch (iconName) {
      case "info":
        return <Info className="w-3.5 h-3.5" />;
      case "play":
        return <Play className="w-3.5 h-3.5 fill-current" />;
      case "music":
        return <Music className="w-3.5 h-3.5" />;
      case "book-open":
        return <BookOpen className="w-3.5 h-3.5" />;
      case "map-pin":
        return <MapPin className="w-3.5 h-3.5" />;
      case "wine":
        return <Wine className="w-3.5 h-3.5" />;
      case "utensils":
        return <Utensils className="w-3.5 h-3.5" />;
      case "frame":
        return <Frame className="w-3.5 h-3.5" />;
      case "gamepad-2":
        return <Gamepad2 className="w-3.5 h-3.5" />;
      case "shopping-bag":
        return <ShoppingBag className="w-3.5 h-3.5" />;
      case "lock":
        return <Lock className="w-3.5 h-3.5" />;
      default:
        return <ExternalLink className="w-3.5 h-3.5" />;
    }
  };

  const priceCents = primarySource?.priceCents ?? entity.priceCents;
  const currency = primarySource?.currency || entity.currency || "USD";
  const sellerName =
    primarySource?.sellerName ||
    buySlot?.providerName ||
    (entity.ucpSkuId ? "Google UCP" : "Shop");
  const targetUrl = buySlot?.href || "#";
  const outboundUrl = buildAffiliateUrl(
    targetUrl,
    sellerName,
    primarySource?.affiliateTemplate,
    creatorAffiliateTags
  );

  const formatPrice = (cents?: number | null, curr = "USD") => {
    if (cents == null) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  };

  const formattedPrice = hidePrice ? null : formatPrice(priceCents, currency);
  const isUcp = Boolean(entity.ucpSkuId);

  const experienceHref = experienceSlot?.href || "#";
  const experienceLabel =
    experienceSlot && customUtilityLabel ? customUtilityLabel : experienceSlot?.label || "";
  const experienceIcon = experienceSlot?.iconName || "external-link";

  const containerClass = flush
    ? `w-full pt-2.5 mt-3 border-t flex items-center justify-between gap-2 text-xs ${
        isDarkSurface ? "border-white/10" : "border-[var(--gallery-hairline)]"
      }`
    : `w-full px-3.5 sm:px-4 py-2.5 border-t flex items-center justify-between gap-2 text-xs ${
        isDarkSurface ? "border-white/10" : "border-[var(--gallery-hairline)]"
      }`;

  const mutedLinkClass = isDarkSurface
    ? "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 font-medium transition-colors duration-150 cursor-pointer shrink-0"
    : "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 font-medium transition-colors duration-150 cursor-pointer shrink-0";

  if (isOwnedSynced) {
    const closetTarget =
      typeof data.closetUrl === "string" && data.closetUrl.trim()
        ? data.closetUrl.trim()
        : data.closetId
        ? `/closet/#garment-${data.closetId}`
        : "/closet/";
    const purchaseHubTarget = ext.purchaseHubProductId
      ? `/my-stuff/#product-${ext.purchaseHubProductId}`
      : "/my-stuff/";
    const primaryOwnedHref = isClosetItem ? closetTarget : purchaseHubTarget;
    const primaryOwnedLabel = isClosetItem ? "Open in Closet" : "Open in My Stuff";

    const rawExternalSource =
      primarySource?.sourceUrl ||
      (typeof data.sourceUrl === "string" ? data.sourceUrl : null) ||
      (entity.canonicalUrl &&
      /^https?:\/\//i.test(entity.canonicalUrl) &&
      !entity.canonicalUrl.includes("/closet/#") &&
      !entity.canonicalUrl.includes("/my-stuff/#")
        ? entity.canonicalUrl
        : null);

    const safeExternalSource =
      rawExternalSource && /^https?:\/\//i.test(rawExternalSource) ? rawExternalSource : null;
    const manualHref =
      typeof ext.manualUrl === "string" &&
      (ext.manualUrl.trim().startsWith("https://") ||
        ext.manualUrl.trim().startsWith("http://") ||
        ext.manualUrl.trim().startsWith("/"))
        ? ext.manualUrl.trim()
        : null;

    return (
      <div className={containerClass} data-testid="owned-synced-footer">
        <div className="flex items-center gap-1 min-w-0">
          {safeExternalSource && (
            <a
              href={safeExternalSource}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={mutedLinkClass}
              title={primarySource?.sellerName || "Original source"}
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="truncate max-w-[100px]">{primarySource?.sellerName || "Source"}</span>
            </a>
          )}
          {manualHref && (
            <a
              href={manualHref}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={mutedLinkClass}
              title="Open product manual"
            >
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Manual</span>
            </a>
          )}
        </div>

        <a
          href={primaryOwnedHref}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium transition-colors duration-150 cursor-pointer shrink-0 ${
            isDarkSurface
              ? "text-neutral-300 hover:text-white"
              : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white"
          }`}
        >
          <span>{primaryOwnedLabel}</span>
          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
        </a>
      </div>
    );
  }

  if (authenticActions.length === 0) {
    return null;
  }

  return (
    <div className={containerClass}>
      {/* Left + Center Slots: Authentic Info / Experience Links */}
      <div className="flex items-center gap-1 min-w-0">
        {infoSlot && (
          <a
            href={infoSlot.href}
            target="_blank"
            rel="noreferrer"
            title={`${infoSlot.label} (${infoSlot.providerName})`}
            onClick={(e) => e.stopPropagation()}
            className={mutedLinkClass}
          >
            {renderSlotIcon(infoSlot.iconName)}
            <span className="truncate max-w-[100px]">{infoSlot.label}</span>
          </a>
        )}

        {experienceSlot &&
          (onUtilityClick ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUtilityClick();
              }}
              title={`${experienceLabel} (${experienceSlot.providerName})`}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-medium transition-colors duration-150 cursor-pointer min-w-0 ${
                isDarkSurface
                  ? "text-neutral-300 hover:text-white hover:bg-neutral-800/80"
                  : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80"
              }`}
            >
              {renderSlotIcon(experienceIcon)}
              <span className="truncate max-w-[115px]">{experienceLabel}</span>
            </button>
          ) : (
            <a
              href={experienceHref}
              target="_blank"
              rel="noreferrer"
              title={`${experienceLabel} (${experienceSlot.providerName})`}
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-medium transition-colors duration-150 cursor-pointer min-w-0 ${
                isDarkSurface
                  ? "text-neutral-300 hover:text-white hover:bg-neutral-800/80"
                  : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80"
              }`}
            >
              {renderSlotIcon(experienceIcon)}
              <span className="truncate max-w-[115px]">{experienceLabel}</span>
            </a>
          ))}
      </div>

      {/* Right Slot: Synced App Deep-Link (Open in Chef) or Verified Merchant CTA */}
      {ownedSlot ? (
        <a
          href={ownedSlot.href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium transition-colors duration-150 cursor-pointer shrink-0 ${
            isDarkSurface
              ? "text-neutral-300 hover:text-white"
              : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white"
          }`}
        >
          <span>{ownedSlot.label}</span>
          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
        </a>
      ) : (
        buySlot && (
          <a
            href={outboundUrl}
            target="_blank"
            rel="noreferrer"
            title={`${buySlot.label} via ${sellerName}`}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium shadow-2xs transition-colors duration-150 active:scale-95 cursor-pointer text-xs shrink-0 ${
              isUcp
                ? "bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)]"
                : isDarkSurface
                ? "bg-white hover:bg-neutral-200 text-neutral-950"
                : "bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            }`}
          >
            {isUcp ? (
              <Zap className="w-3.5 h-3.5 fill-current" />
            ) : (
              renderSlotIcon(buySlot.iconName)
            )}
            <span className="tabular-nums">
              {isUcp
                ? formattedPrice
                  ? `1-Click ${formattedPrice}`
                  : "Google Pay"
                : formattedPrice
                ? `Buy ${formattedPrice}`
                : buySlot.label}
            </span>
          </a>
        )
      )}
    </div>
  );
}

