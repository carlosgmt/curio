"use client";

import React from "react";
import { Wine, Award, MapPin, Sparkles, ShieldCheck } from "lucide-react";
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
  const producer = data.producer || entity.brandOrCreator || "Domaine de la Curio";
  const cuvee = data.cuvee || entity.title;
  const vintage = data.vintage || "2022";
  const appellation = data.appellation || "Appellation d'Origine Protégée";
  const region = data.region ? `${data.region}, ${data.country || "France"}` : "Burgundy, France";
  const varietal = data.varietal || "Pinot Noir";
  const farming = data.farming || "Biodynamic & Unfined";
  const abv = data.abv ? `${data.abv}% ABV` : "12.5% ABV";

  return (
    <div className="group relative rounded-2xl bg-[#faf8f5] dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm hover:shadow-lg transition-all duration-300 border-2 border-stone-300/80 dark:border-stone-800 flex flex-col justify-between overflow-hidden">
      {/* Wine Label Canvas */}
      <div className="p-6 relative flex flex-col items-center text-center">
        {/* Subtle vintage border frame */}
        <div className="absolute inset-3 border border-stone-300/60 dark:border-stone-700/60 pointer-events-none rounded-xl" />

        {/* Embossed Bronze/Gold Foil Crest */}
        <div className="w-10 h-10 rounded-full border border-amber-600/40 bg-gradient-to-b from-amber-100 to-amber-200/80 dark:from-amber-900/40 dark:to-stone-800 flex items-center justify-center text-amber-800 dark:text-amber-300 shadow-inner mb-3">
          <Wine className="w-5 h-5" />
        </div>

        {/* Producer & Vintage */}
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-1">
          {producer}
        </span>
        <h3 className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50 mb-1">
          {cuvee}
        </h3>
        <span className="font-serif text-base italic text-amber-800 dark:text-amber-400 font-semibold mb-3">
          {vintage}
        </span>

        {/* Micro-Appellation Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-200/60 dark:bg-stone-800/80 text-[10px] font-serif text-stone-700 dark:text-stone-300 border border-stone-300/60 dark:border-stone-700 mb-4">
          <MapPin className="w-3 h-3 text-stone-500" />
          <span>{appellation} • {region}</span>
        </div>

        {/* Label Specs Grid */}
        <div className="w-full grid grid-cols-3 gap-2 border-t border-stone-200 dark:border-stone-800 pt-3 text-[10px] font-mono uppercase text-stone-500 dark:text-stone-400">
          <div>
            <span className="block text-[8px] text-stone-400">Varietal</span>
            <span className="font-semibold text-stone-800 dark:text-stone-200 truncate block">
              {varietal}
            </span>
          </div>
          <div>
            <span className="block text-[8px] text-stone-400">Farming</span>
            <span className="font-semibold text-stone-800 dark:text-stone-200 truncate block">
              {farming}
            </span>
          </div>
          <div>
            <span className="block text-[8px] text-stone-400">Alc / Vol</span>
            <span className="font-semibold text-stone-800 dark:text-stone-200 truncate block">
              {abv}
            </span>
          </div>
        </div>
      </div>

      {/* Disambiguation Fallback */}
      {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
        <div className="px-5 pt-1">
          <DisambiguationBar
            saveId={save.id}
            candidates={save.candidateFallbacks}
            onSwapped={() => onSwapped?.(save)}
          />
        </div>
      )}

      {/* Footer */}
      <div className="p-4 bg-stone-100/50 dark:bg-stone-900/80 border-t border-stone-200 dark:border-stone-800">
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/product/beverage/wine",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Vivino Review"
        />
      </div>
    </div>
  );
}
