"use client";

import React from "react";
import { Shirt, Droplets } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function GarmentCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  wearLinkCount = 0,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const brand = entity.brandOrCreator || data.brand || "Wardrobe";
  const garmentName = entity.title;
  const material = data.material || data.fabric || null;
  const weight = data.weight || null;
  const swatchHex = data.colorHex || null;
  const colorLabel = data.color || null;

  const custom = (typeof save.userCustomValues === "object" && save.userCustomValues) || {};
  const autoTags = ((save as any).autoTags || []) as string[];
  const category =
    data.category ||
    custom.category ||
    autoTags.find((t: string) =>
      ["footwear", "tops", "bottoms", "outerwear", "accessories"].includes(t.toLowerCase())
    );
  const subtype = data.subtype || custom.subtype;
  const size = data.size || custom.size;
  const season = data.season || custom.season;
  const rawTimesWorn = Number(custom.timesWorn ?? data.timesWorn ?? 0);
  const totalWears = Math.max(Number.isFinite(rawTimesWorn) ? rawTimesWorn : 0, wearLinkCount || 0);
  const isWaterproof = Boolean(custom.isWaterproof ?? data.isWaterproof);
  const inLaundry = Boolean(custom.inLaundry ?? data.inLaundry);
  const heroUrl = entity.heroImageUrl || "";
  const isCutoutImage =
    Boolean(data.hasCutout) ||
    heroUrl.includes("/cutouts/") ||
    heroUrl.toLowerCase().endsWith(".png");

  const metaParts = [
    category,
    subtype && String(subtype).toLowerCase() !== String(category || "").toLowerCase()
      ? subtype
      : null,
    size ? `Size ${size}` : null,
  ].filter(Boolean);

  const statusPills: Array<{ key: string; label: string; tone: string }> = [];
  if (inLaundry) {
    statusPills.push({
      key: "laundry",
      label: "In Laundry",
      tone: "text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border-sky-200/60 dark:border-sky-800/60",
    });
  }
  if (isWaterproof) {
    statusPills.push({
      key: "waterproof",
      label: "Waterproof",
      tone: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-800/60",
    });
  }

  return (
    <div
      data-testid="garment-card"
      className="group relative rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-lg transition-shadow duration-200 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Visual Header / Garment Canvas */}
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Brand & Color Swatch */}
        <div className="flex items-center justify-between mb-2.5 gap-2 pr-16 sm:pr-0">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
            {brand}
          </span>
          {(swatchHex || colorLabel) && (
            <div className="flex items-center gap-1.5 shrink-0">
              {swatchHex && (
                <div
                  data-testid="garment-swatch"
                  className="w-3.5 h-3.5 rounded-sm border border-neutral-300 dark:border-neutral-700 shadow-2xs"
                  style={{ backgroundColor: swatchHex }}
                  title={`Swatch: ${swatchHex}`}
                />
              )}
              {colorLabel && (
                <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                  {colorLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Hero Image */}
        {heroUrl ? (
          <div
            className={`relative aspect-4/3 w-full rounded-xl overflow-hidden mb-3 ${
              isCutoutImage
                ? "bg-gradient-to-b from-neutral-50 via-neutral-100/80 to-neutral-200/50 dark:from-neutral-800/70 dark:via-neutral-850 dark:to-neutral-900 border border-neutral-200/60 dark:border-neutral-800 flex items-center justify-center"
                : "bg-neutral-100 dark:bg-neutral-800"
            }`}
          >
            <img
              src={heroUrl}
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
        <h3 className="font-serif text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1 leading-snug">
          {garmentName}
        </h3>

        {/* Single Metadata Line */}
        {metaParts.length > 0 && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums mb-1.5 truncate">
            {metaParts.join(" · ")}
          </p>
        )}

        {/* Wear Count, Season & High-Signal Status (max 2 pills) */}
        {(totalWears > 0 || season || statusPills.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
            {totalWears > 0 && (
              <span
                data-testid="garment-wear-count"
                className="font-semibold text-neutral-700 dark:text-neutral-300"
              >
                Worn {totalWears}×
              </span>
            )}
            {season && <span className="truncate max-w-[160px]">{season}</span>}
            {statusPills.slice(0, 2).map((pill) => (
              <span
                key={pill.key}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${pill.tone}`}
              >
                {pill.key === "waterproof" && <Droplets className="w-2.5 h-2.5" aria-hidden="true" />}
                <span>{pill.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Real Material Spec (only when present) */}
        {(material || weight) && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 truncate">
            {[material, weight].filter(Boolean).join(" · ")}
          </p>
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
