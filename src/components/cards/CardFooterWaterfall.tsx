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
import {
  resolveCardUtility,
  resolveTypeActionProviders,
  type ActionProviderSlot,
} from "@/lib/commerce/utilityDeepLinks";

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
  onUtilityClick?: () => void;
}

export function CardFooterWaterfall({
  entity,
  primarySource,
  creatorAffiliateTags,
  customUtilityLabel,
  onUtilityClick,
}: CardFooterWaterfallProps) {
  const utility = resolveCardUtility({
    entity,
    customUtilityLabel,
    primarySource,
    onUtilityClick,
  });

  const providers = resolveTypeActionProviders(entity, primarySource);
  const { infoAction, playAction, buyAction } = providers;

  const renderSlotIcon = (iconName: ActionProviderSlot["iconName"] | typeof utility.iconName) => {
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

  // Monetized / Buy Slot (never links to Wikipedia)
  const priceCents = primarySource?.priceCents ?? entity.priceCents;
  const currency = primarySource?.currency || entity.currency || "USD";
  const sellerName =
    primarySource?.sellerName ||
    buyAction?.providerName ||
    (entity.ucpSkuId ? "Google UCP" : "Shop");
  const targetUrl = buyAction?.href || "#";
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

  const formattedPrice = formatPrice(priceCents, currency);
  const isUcp = Boolean(entity.ucpSkuId);

  const experienceHref = playAction?.href || utility.href;
  const experienceLabel = customUtilityLabel || playAction?.label || utility.label;
  const experienceIcon = playAction?.iconName || utility.iconName;

  return (
    <div className="w-full pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-1.5 text-xs">
      {/* Left + Center Slots: 1. More Info & 2. Play/Experience Action */}
      <div className="flex items-center gap-1 min-w-0">
        {infoAction.href !== "#" ? (
          <a
            href={infoAction.href}
            target="_blank"
            rel="noreferrer"
            title={`${infoAction.label} (${infoAction.providerName})`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 font-medium transition cursor-pointer shrink-0"
          >
            {renderSlotIcon("info")}
            <span className="hidden sm:inline">{infoAction.label}</span>
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 font-medium">
            {renderSlotIcon(infoAction.iconName)}
            <span>{infoAction.label}</span>
          </span>
        )}

        {playAction &&
          (onUtilityClick ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUtilityClick();
              }}
              title={`${experienceLabel} (${playAction.providerName})`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 font-medium transition cursor-pointer min-w-0"
            >
              {renderSlotIcon(experienceIcon)}
              <span className="truncate max-w-[115px]">{experienceLabel}</span>
            </button>
          ) : (
            <a
              href={experienceHref}
              target="_blank"
              rel="noreferrer"
              title={`${experienceLabel} (${playAction.providerName})`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 font-medium transition cursor-pointer min-w-0"
            >
              {renderSlotIcon(experienceIcon)}
              <span className="truncate max-w-[115px]">{experienceLabel}</span>
            </a>
          ))}
      </div>

      {/* Right Slot: 3. Buy / Acquire Action (never points to Wikipedia) */}
      {buyAction && (
        <a
          href={outboundUrl}
          target="_blank"
          rel="noreferrer"
          title={`${buyAction.label} via ${sellerName}`}
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium shadow-2xs transition active:scale-95 cursor-pointer text-xs shrink-0 ${
            isUcp
              ? "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600"
              : "bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          }`}
        >
          {isUcp ? (
            <Zap className="w-3.5 h-3.5 fill-current" />
          ) : (
            renderSlotIcon(buyAction.iconName)
          )}
          <span>
            {isUcp
              ? formattedPrice
                ? `1-Click ${formattedPrice}`
                : "Google Pay"
              : formattedPrice
              ? `Buy ${formattedPrice}`
              : buyAction.label}
          </span>
        </a>
      )}
    </div>
  );
}

