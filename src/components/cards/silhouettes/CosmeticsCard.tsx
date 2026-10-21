"use client";

import React from "react";
import { Sparkles, ShieldCheck, Heart, Circle } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function CosmeticsCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const brand = entity.brandOrCreator || data.brand || "Maison Beauté";
  const productName = entity.title;
  const shadeName = data.shade || data.color || "Shade 02 / Sand";
  const shadeHex = data.shadeHex || data.colorHex || "#d8a47f";
  const cleanBadge = data.cleanBadge || "Clean & Cruelty-Free";
  const skinTypes = data.skinTypes || ["Sensitive", "Normal", "Combination"];
  const volume = data.volume || data.size || "30 ml / 1.0 fl. oz.";

  return (
    <div
      data-testid="cosmetics-card"
      className="group relative rounded-2xl bg-[#fdfbf9] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-lg transition-all duration-300 border border-neutral-200/90 dark:border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex flex-col">
        {/* Header: Brand & Clean Certification */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
            {brand}
          </span>
          <div
            data-testid="clean-beauty-badge"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-mono font-medium"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>{cleanBadge}</span>
          </div>
        </div>

        {/* Product Hero Image or Palette */}
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
            <Sparkles className="w-8 h-8 text-rose-400 stroke-1" />
          </div>
        )}

        {/* Title & Volume */}
        <h3 className="font-serif text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1 leading-snug">
          {productName}
        </h3>
        <span className="text-[11px] font-mono text-neutral-400 mb-3 block">
          {volume}
        </span>

        {/* Shade Swatch Circular Palette */}
        <div
          data-testid="shade-palette"
          className="flex items-center gap-2.5 p-2 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 mb-3"
        >
          <div
            data-testid="shade-swatch"
            className="w-5 h-5 rounded-full border-2 border-white dark:border-neutral-900 shadow-xs ring-1 ring-neutral-300 dark:ring-neutral-700 shrink-0"
            style={{ backgroundColor: shadeHex }}
          />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 block truncate">
              {shadeName}
            </span>
          </div>
        </div>

        {/* Skin-Type Suitability Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase mr-0.5">Suitable:</span>
          {skinTypes.map((type: string) => (
            <span
              key={type}
              data-testid={`skin-type-${type.toLowerCase()}`}
              className="px-2 py-0.5 rounded-md bg-neutral-200/60 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[10px] font-medium"
            >
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Disambiguation Swapper Bar */}
      <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={onSwapped}
        />

      {/* Footer Waterfall */}
      <CardFooterWaterfall
        entity={entity}
        primarySource={primarySource}
        creatorAffiliateTags={creatorAffiliateTags}
      />
    </div>
  );
}
