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
  Zap,
  Wine,
  Frame,
  Lock,
} from "lucide-react";

import { buildAffiliateUrl, type UserAffiliateTags } from "@/lib/commerce/affiliate";
import { resolveCardUtility } from "@/lib/commerce/utilityDeepLinks";

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
  // 1. Determine Contextual Left Slot (Utility Connector via Deep-Link Engine)
  const utility = resolveCardUtility({
    entity,
    customUtilityLabel,
    primarySource,
    onUtilityClick,
  });

  const renderUtilityIcon = () => {
    switch (utility.iconName) {
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
      case "lock":
        return <Lock className="w-3.5 h-3.5" />;
      default:
        return <ExternalLink className="w-3.5 h-3.5" />;
    }
  };

  // 2. Determine Right Slot (Monetized Accent CTA)
  const priceCents = primarySource?.priceCents ?? entity.priceCents;
  const currency = primarySource?.currency || entity.currency || "USD";
  const sellerName = primarySource?.sellerName || (entity.ucpSkuId ? "Google UCP" : "Merchant");
  const targetUrl = primarySource?.sourceUrl || entity.canonicalUrl || "#";
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

  return (
    <div className="w-full pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-2 text-xs">
      {/* Left Slot: Contextual Utility Connector */}
      {onUtilityClick ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUtilityClick();
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 font-medium transition cursor-pointer"
        >
          {renderUtilityIcon()}
          <span className="truncate max-w-[130px]">{utility.label}</span>
        </button>
      ) : (
        <a
          href={utility.href}
          target={utility.targetBlank ? "_blank" : undefined}
          rel={utility.targetBlank ? "noreferrer" : undefined}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 font-medium transition cursor-pointer"
        >
          {renderUtilityIcon()}
          <span className="truncate max-w-[130px]">{utility.label}</span>
        </a>
      )}

      {/* Right Slot: Monetized Accent Action / Affiliate CTA */}
      <a
        href={outboundUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium shadow-2xs transition active:scale-95 cursor-pointer text-xs shrink-0 ${
          isUcp
            ? "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600"
            : "bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        }`}
      >
        {isUcp ? <Zap className="w-3.5 h-3.5 fill-current" /> : <ShoppingBag className="w-3.5 h-3.5" />}
        <span>
          {isUcp
            ? formattedPrice
              ? `1-Click ${formattedPrice}`
              : "Google Pay"
            : formattedPrice
            ? `Buy ${formattedPrice}`
            : `Get on ${sellerName}`}
        </span>
      </a>
    </div>
  );
}
