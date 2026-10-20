"use client";

import React from "react";
import { Tag, TrendingDown } from "lucide-react";

export interface PriceTagProps {
  priceCents: number;
  currency?: string;
  merchantCount?: number;
  originalPriceCents?: number;
  className?: string;
}

export function PriceTag({
  priceCents,
  currency = "USD",
  merchantCount,
  originalPriceCents,
  className = "",
}: PriceTagProps) {
  const formattedPrice = (priceCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency,
  });

  const hasDrop = originalPriceCents && originalPriceCents > priceCents;
  const dropPercent = hasDrop
    ? Math.round(((originalPriceCents - priceCents) / originalPriceCents) * 100)
    : 0;

  return (
    <div
      data-testid="price-tag"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-mono font-bold shadow-xs ${className}`}
    >
      <Tag className="w-3 h-3 text-neutral-400" />
      <span>{formattedPrice}</span>

      {merchantCount && merchantCount > 1 && (
        <span className="text-[10px] text-neutral-400 font-sans font-normal ml-0.5">
          ({merchantCount} stores)
        </span>
      )}

      {hasDrop && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 dark:text-emerald-600 text-[10px] font-bold">
          <TrendingDown className="w-2.5 h-2.5" />
          <span>-{dropPercent}%</span>
        </span>
      )}
    </div>
  );
}
