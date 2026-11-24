"use client";

import React from "react";
import { Shirt, Sparkles, Droplets, Wind, Scissors, ExternalLink } from "lucide-react";
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
  const material = data.material || data.fabric || (data.closetId ? null : "100% Organic Cotton");
  const weight = data.weight || (data.closetId ? null : "320 GSM Heavyweight");
  const activeFit = (data.fit || "Regular").toLowerCase();
  const swatchHex = data.colorHex || "#2b2b2b";
  const careInstructions = data.care || (data.closetId ? null : ["Wash 30°C", "Hang Dry", "Low Iron"]);

  const custom = (typeof save.userCustomValues === "object" && save.userCustomValues) || {};
  const autoTags = ((save as any).autoTags || []) as string[];
  const category = data.category || custom.category || autoTags.find((t: string) => ["footwear", "tops", "bottoms", "outerwear", "accessories"].includes(t.toLowerCase()));
  const subtype = data.subtype || custom.subtype;
  const size = data.size || custom.size;
  const season = data.season || custom.season;
  const timesWorn = custom.timesWorn ?? data.timesWorn;
  const isWaterproof = Boolean(custom.isWaterproof ?? data.isWaterproof);
  const inLaundry = Boolean(custom.inLaundry ?? data.inLaundry);
  const closetUrl = typeof data.closetUrl === "string" ? data.closetUrl : null;
  const heroUrl = entity.heroImageUrl || "";
  const isCutoutImage =
    Boolean(data.hasCutout) ||
    heroUrl.includes("/cutouts/") ||
    heroUrl.toLowerCase().endsWith(".png");

  return (
    <div
      data-testid="garment-card"
      className="group relative rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-lg transition-all duration-300 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Visual Header / Garment Canvas */}
      <div className="p-5 flex flex-col">
        {/* Brand & Fabric Crest */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400 truncate">
            {brand}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {closetUrl && (
              <a
                href={closetUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 transition"
                title="Open in Closet"
              >
                <span>Closet</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
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
          <div
            className={`relative aspect-4/3 w-full rounded-xl overflow-hidden mb-3 ${
              isCutoutImage
                ? "bg-gradient-to-b from-neutral-50 via-neutral-100/80 to-neutral-200/50 dark:from-neutral-800/70 dark:via-neutral-850 dark:to-neutral-900 border border-neutral-200/60 dark:border-neutral-800 flex items-center justify-center"
                : "bg-neutral-100 dark:bg-neutral-800"
            }`}
          >
            <img
              src={entity.heroImageUrl}
              alt={garmentName}
              referrerPolicy="no-referrer"
              className={`w-full h-full group-hover:scale-102 transition-transform duration-500 ${
                isCutoutImage ? "object-contain p-3 drop-shadow-md" : "object-cover"
              }`}
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

        {/* Characteristics Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {category && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700">
              {category}
            </span>
          )}
          {subtype && subtype.toLowerCase() !== (category || "").toLowerCase() && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-neutral-50 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 border border-neutral-200/50 dark:border-neutral-700">
              {subtype}
            </span>
          )}
          {size && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
              Size: {size}
            </span>
          )}
          {season && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/50 dark:border-neutral-700">
              {season}
            </span>
          )}
          {timesWorn !== undefined && timesWorn > 0 && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/30">
              Worn {timesWorn}x
            </span>
          )}
          {inLaundry && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/60">
              In Laundry
            </span>
          )}
          {isWaterproof && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 flex items-center gap-1">
              <Droplets className="w-2.5 h-2.5" /> Waterproof
            </span>
          )}
        </div>

        {/* Fabric & Weave Spec */}
        {(material || weight) && (
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-3">
            <Scissors className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="truncate">{[material, weight].filter(Boolean).join(" • ")}</span>
          </div>
        )}

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
        {careInstructions && (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
            <Droplets className="w-3 h-3 text-neutral-400" />
            {Array.isArray(careInstructions) ? (
              careInstructions.map((care: string, idx: number) => (
                <span key={idx} className="after:content-['•'] last:after:content-[''] after:ml-1.5">
                  {care}
                </span>
              ))
            ) : (
              <span>{String(careInstructions)}</span>
            )}
          </div>
        )}
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
