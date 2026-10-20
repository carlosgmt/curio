"use client";

import React from "react";
import { Shirt, Sparkles, Droplets, Wind, Scissors } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function GarmentCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const brand = entity.brandOrCreator || data.brand || "Atelier Curio";
  const garmentName = entity.title;
  const material = data.material || data.fabric || "100% Organic Cotton";
  const weight = data.weight || "320 GSM Heavyweight";
  const activeFit = (data.fit || "Regular").toLowerCase();
  const swatchHex = data.colorHex || "#2b2b2b";
  const careInstructions = data.care || ["Wash 30°C", "Hang Dry", "Low Iron"];

  return (
    <div
      data-testid="garment-card"
      className="group relative rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-lg transition-all duration-300 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Visual Header / Garment Canvas */}
      <div className="p-5 flex flex-col">
        {/* Brand & Fabric Crest */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
            {brand}
          </span>
          <div className="flex items-center gap-1.5">
            {/* Color Swatch Square */}
            <div
              data-testid="garment-swatch"
              className="w-4 h-4 rounded-md border border-neutral-300 dark:border-neutral-700 shadow-2xs"
              style={{ backgroundColor: swatchHex }}
              title={`Swatch: ${swatchHex}`}
            />
            <span className="text-[10px] font-mono text-neutral-400 uppercase">
              {data.color || "Noir"}
            </span>
          </div>
        </div>

        {/* Hero Image if available */}
        {entity.heroImageUrl ? (
          <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 mb-3">
            <img
              src={entity.heroImageUrl}
              alt={garmentName}
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
            />
          </div>
        ) : (
          <div className="w-full aspect-16/9 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 flex items-center justify-center text-neutral-400 mb-3 border border-dashed border-neutral-200 dark:border-neutral-700">
            <Shirt className="w-8 h-8 stroke-1 text-neutral-400" />
          </div>
        )}

        {/* Garment Title */}
        <h3 className="font-serif text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1 leading-snug">
          {garmentName}
        </h3>

        {/* Fabric & Weave Spec */}
        <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-3">
          <Scissors className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span className="truncate">{material} • {weight}</span>
        </div>

        {/* Garment Fit Matrix */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800 mb-3">
          <span className="text-[10px] font-mono text-neutral-400 uppercase mr-1">Fit:</span>
          {["slim", "regular", "oversized"].map((fit) => {
            const isCurrentFit = activeFit.includes(fit);
            return (
              <span
                key={fit}
                data-testid={`fit-${fit}`}
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold transition ${
                  isCurrentFit
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                }`}
              >
                {fit}
              </span>
            );
          })}
        </div>

        {/* Care Instruction Glyphs */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
          <Droplets className="w-3 h-3 text-neutral-400" />
          {Array.isArray(careInstructions) ? (
            careInstructions.map((care: string, idx: number) => (
              <span key={idx} className="after:content-['•'] last:after:content-[''] after:ml-1.5">
                {care}
              </span>
            ))
          ) : (
            <span>Dry Clean Only</span>
          )}
        </div>
      </div>

      {/* Disambiguation Swapper Bar */}
      {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks}
          onSwapped={onSwapped}
        />
      )}

      {/* Footer Waterfall */}
      <CardFooterWaterfall
        entity={entity}
        primarySource={primarySource}
        creatorAffiliateTags={creatorAffiliateTags}
      />
    </div>
  );
}
