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
} from "lucide-react";

import { buildAffiliateUrl, type UserAffiliateTags } from "@/lib/commerce/affiliate";

export { buildAffiliateUrl, type UserAffiliateTags };

export interface CardFooterWaterfallProps {
  entity: {
    title: string;
    canonicalUrl?: string;
    coreType: string;
    typePath?: string | null;
    priceCents?: number | null;
    currency?: string | null;
    ucpSkuId?: string | null;
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
  const typePath = entity.typePath || "";
  const coreType = entity.coreType.toUpperCase();

  // 1. Determine Contextual Left Slot (Utility Connector)
  let utilityIcon = <ExternalLink className="w-3.5 h-3.5" />;
  let utilityText = customUtilityLabel || "Learn More";
  let utilityHref = entity.canonicalUrl || "#";

  if (typePath.startsWith("/media/film") || coreType === "MEDIA") {
    utilityIcon = <Play className="w-3.5 h-3.5 fill-current" />;
    utilityText = customUtilityLabel || "Watch on MUBI";
  } else if (typePath.startsWith("/media/music") || typePath.includes("vinyl")) {
    utilityIcon = <Music className="w-3.5 h-3.5" />;
    utilityText = customUtilityLabel || "Play on Spotify";
  } else if (typePath.startsWith("/product/book") || coreType === "BOOK") {
    utilityIcon = <BookOpen className="w-3.5 h-3.5" />;
    utilityText = customUtilityLabel || "Read Sample";
  } else if (typePath.startsWith("/place") || coreType === "PLACE") {
    utilityIcon = <MapPin className="w-3.5 h-3.5" />;
    utilityText = customUtilityLabel || "Google Maps";
  } else if (typePath.startsWith("/culinary") || coreType === "CULINARY") {
    utilityIcon = <Utensils className="w-3.5 h-3.5" />;
    utilityText = customUtilityLabel || "Cook Mode";
  }

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
          {utilityIcon}
          <span className="truncate max-w-[130px]">{utilityText}</span>
        </button>
      ) : (
        <a
          href={utilityHref}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 font-medium transition cursor-pointer"
        >
          {utilityIcon}
          <span className="truncate max-w-[130px]">{utilityText}</span>
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
