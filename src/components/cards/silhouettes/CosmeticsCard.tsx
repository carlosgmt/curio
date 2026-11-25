"use client";

import React from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

const MAX_SKIN_TYPE_PILLS = 3;

export function CosmeticsCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const ext = (typeof entity.extendedAttributes === "object" && entity.extendedAttributes) || {};
  const brand = entity.brandOrCreator || data.brand || ext.brand || "Beauty";
  const productName = entity.title;
  const shadeName = data.shade || data.color || null;
  const shadeHex = data.shadeHex || data.colorHex || null;
  const cleanBadge = data.cleanBadge || null;
  const skinTypes: string[] = Array.isArray(data.skinTypes) ? data.skinTypes.filter(Boolean) : [];
  const volume = data.volume || data.volumeOrWeight || data.size || null;

  const visibleSkinTypes = skinTypes.slice(0, MAX_SKIN_TYPE_PILLS);
  const overflowSkinTypes = Math.max(0, skinTypes.length - visibleSkinTypes.length);

  return (
    <div
      data-testid="cosmetics-card"
      className="group relative rounded-2xl bg-[#fdfbf9] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-lg transition-shadow duration-200 border border-neutral-200/90 dark:border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Header: Brand & Optional Clean Certification */}
        <div className="flex items-center justify-between gap-2 mb-2.5 pr-16 sm:pr-0">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
            {brand}
          </span>
          {cleanBadge && (
            <div
              data-testid="clean-beauty-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-mono font-medium shrink-0"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-500" aria-hidden="true" />
              <span>{cleanBadge}</span>
            </div>
          )}
        </div>

        {/* Product Hero Image or Placeholder */}
        {entity.heroImageUrl ? (
          <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 mb-3">
            <img
              src={entity.heroImageUrl}
              alt={productName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
            />
          </div>
        ) : (
          <div className="w-full aspect-16/9 rounded-xl bg-gradient-to-tr from-rose-50 to-amber-50 dark:from-neutral-800 dark:to-neutral-850 flex items-center justify-center mb-3 border border-rose-100 dark:border-neutral-800">
            <Sparkles className="w-8 h-8 text-rose-400 stroke-1" aria-hidden="true" />
          </div>
        )}

        {/* Title & Volume */}
        <h3 className="font-serif text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1 leading-snug">
          {productName}
        </h3>
        {volume && (
          <span className="text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400 mb-2.5 block">
            {volume}
          </span>
        )}

        {/* Shade Swatch (only when shade or swatch exists) */}
        {(shadeName || shadeHex) && (
          <div
            data-testid="shade-palette"
            className="flex items-center gap-2 py-2 border-t border-neutral-100 dark:border-neutral-800 mb-1"
          >
            {shadeHex && (
              <div
                data-testid="shade-swatch"
                className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-700 shrink-0"
                style={{ backgroundColor: shadeHex }}
              />
            )}
            {shadeName && (
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">
                {shadeName}
              </span>
            )}
          </div>
        )}

        {/* Skin-Type Suitability Pills (only when real data exists, capped to 3 + N) */}
        {visibleSkinTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {visibleSkinTypes.map((type: string) => (
              <span
                key={type}
                data-testid={`skin-type-${type.toLowerCase()}`}
                className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[10px] font-medium"
              >
                {type}
              </span>
            ))}
            {overflowSkinTypes > 0 && (
              <span className="text-[10px] font-mono tabular-nums text-neutral-400">
                +{overflowSkinTypes}
              </span>
            )}
          </div>
        )}

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={onSwapped}
        />
      </div>

      {/* Footer Waterfall */}
      <CardFooterWaterfall
        entity={entity}
        primarySource={primarySource}
        creatorAffiliateTags={creatorAffiliateTags}
        isWishlist={Boolean(save.wishlist)}
      />
    </div>
  );
}
