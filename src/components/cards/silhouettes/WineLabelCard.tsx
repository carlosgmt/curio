"use client";

import React from "react";
import { Wine, MapPin } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function WineLabelCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const producer = data.producer || entity.brandOrCreator || null;
  const cuvee = data.cuvee || entity.title;
  const vintage = data.vintage || null;
  const appellation = data.appellation || null;
  const region = data.region
    ? data.country
      ? `${data.region}, ${data.country}`
      : data.region
    : data.country || null;
  const varietal = data.varietal || null;
  const farming = data.farming || null;
  const abv = data.abv ? `${data.abv}% ABV` : null;

  const originText = [appellation, region].filter(Boolean).join(" · ");
  const specEntries = [
    varietal ? { label: "Varietal", value: varietal } : null,
    farming ? { label: "Farming", value: farming } : null,
    abv ? { label: "Alc / Vol", value: abv } : null,
  ].filter((x): x is { label: string; value: string } => Boolean(x));

  return (
    <div
      data-testid="wine-label-card"
      className="group relative rounded-2xl bg-[#faf8f5] dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm hover:shadow-lg transition-shadow duration-200 border border-stone-200 dark:border-stone-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Wine Label Canvas */}
      <div className="p-5 sm:p-6 relative flex flex-col items-center text-center flex-1">
        {/* Subtle vintage border frame */}
        <div className="absolute inset-3 border border-stone-300/60 dark:border-stone-700/60 pointer-events-none rounded-xl" />

        {/* Embossed Crest */}
        <div className="w-9 h-9 rounded-full border border-amber-600/40 bg-gradient-to-b from-amber-100 to-amber-200/80 dark:from-amber-900/40 dark:to-stone-800 flex items-center justify-center text-amber-800 dark:text-amber-300 shadow-inner mb-3">
          <Wine className="w-4 h-4" aria-hidden="true" />
        </div>

        {/* Producer & Vintage */}
        {producer && (
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-1">
            {producer}
          </span>
        )}
        <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50 mb-1">
          {cuvee}
        </h3>
        {vintage && (
          <span className="font-serif text-base italic tabular-nums text-amber-800 dark:text-amber-400 font-semibold mb-2.5">
            {vintage}
          </span>
        )}

        {/* Micro-Appellation Pill (only when real origin data exists) */}
        {originText && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-200/60 dark:bg-stone-800/80 text-[11px] font-serif text-stone-700 dark:text-stone-300 border border-stone-300/60 dark:border-stone-700 mb-3">
            <MapPin className="w-3 h-3 text-stone-500 shrink-0" aria-hidden="true" />
            <span>{originText}</span>
          </div>
        )}

        {/* Label Specs Grid (only for populated fields) */}
        {specEntries.length > 0 && (
          <div
            className={`w-full grid gap-2 border-t border-stone-200 dark:border-stone-800 pt-3 mt-1 text-[10px] font-mono uppercase text-stone-500 dark:text-stone-400 ${
              specEntries.length === 1
                ? "grid-cols-1"
                : specEntries.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
            }`}
          >
            {specEntries.map((spec) => (
              <div key={spec.label}>
                <span className="block text-[8px] text-stone-400">{spec.label}</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 truncate block tabular-nums">
                  {spec.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={() => onSwapped?.(save)}
        />
      </div>

      {/* Footer */}
      <CardFooterWaterfall
        entity={{
          ...entity,
          typePath: entity.typePath || "/product/beverage/wine",
        }}
        primarySource={primarySource}
        creatorAffiliateTags={creatorAffiliateTags}
        customUtilityLabel="Vivino Review"
        isWishlist={Boolean(save.wishlist)}
      />
    </div>
  );
}
