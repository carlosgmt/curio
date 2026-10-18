"use client";

import React from "react";
import { ShoppingBag, Tag, CheckCircle2, ShieldCheck, Barcode, Cpu, Shirt, Sparkles } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function ProductCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const ext = (typeof entity.extendedAttributes === "object" && entity.extendedAttributes) || {};
  const userVals = (typeof save.userCustomValues === "object" && save.userCustomValues) || {};

  const brand = data.brand || ext.brand || entity.brandOrCreator || userVals.brand || "Curio Selection";
  const model = data.model || ext.model || data.modelNumber || userVals.model;
  const ean = data.ean || ext.ean || data.upc || data.asin || data.sku;
  const eanLabel = data.asin ? `ASIN ${data.asin}` : data.ean ? `EAN ${data.ean}` : data.upc ? `UPC ${data.upc}` : ean ? `ID ${ean}` : null;
  const availability = data.availability || ext.availability || "in_stock";

  // Subproduct-specific spec pills
  const typePath = (entity.typePath || save.typePath || "").toLowerCase();
  const isGarment = typePath.includes("garment") || typePath.includes("apparel") || typePath.includes("clothing");
  const isCosmetics = typePath.includes("cosmetic") || typePath.includes("beauty") || typePath.includes("skincare");
  const isElectronics = typePath.includes("electronic") || typePath.includes("tech") || typePath.includes("hardware");

  const garmentSize = data.size || ext.size || userVals.size;
  const garmentMaterial = data.material || ext.material || userVals.material;
  const cosmeticVolume = data.volumeOrWeight || ext.volumeOrWeight || userVals.volumeOrWeight;
  const cosmeticForm = data.formulation || ext.formulation || userVals.formulation;
  const techSpecs = data.specsSummary || ext.specsSummary || userVals.specsSummary;
  const techConnectivity = data.connectivity || ext.connectivity || userVals.connectivity;

  const priceCents = primarySource?.priceCents ?? entity.priceCents;
  const currency = primarySource?.currency || entity.currency || "USD";
  const formattedPrice =
    priceCents != null
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency || "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(priceCents / 100)
      : null;

  return (
    <div className="group relative rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs hover:shadow-xl transition-all duration-300 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between overflow-hidden">
      {/* Top Banner: Brand & Availability Status */}
      <div className="px-4 py-2.5 bg-neutral-50/80 dark:bg-neutral-800/40 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isGarment ? (
            <Shirt className="w-3.5 h-3.5 text-neutral-500" />
          ) : isCosmetics ? (
            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
          ) : isElectronics ? (
            <Cpu className="w-3.5 h-3.5 text-blue-500" />
          ) : (
            <Tag className="w-3.5 h-3.5 text-amber-500" />
          )}
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
            {brand}
          </span>
        </div>

        {availability === "in_stock" ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            IN STOCK
          </span>
        ) : (
          <span className="text-[9px] font-mono text-neutral-400">AVAILABLE</span>
        )}
      </div>

      {/* Main Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        {/* Product Image Stage */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800/60 mb-3 border border-neutral-200/50 dark:border-neutral-700/50 flex items-center justify-center">
          {entity.heroImageUrl ? (
            <img
              src={entity.heroImageUrl}
              alt={entity.title}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-neutral-400 p-4 text-center">
              <ShoppingBag className="w-8 h-8 mb-1.5 opacity-60" />
              <span className="text-xs font-mono">{brand}</span>
            </div>
          )}

          {/* Floating Price Pill */}
          {formattedPrice && (
            <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-neutral-900/90 dark:bg-white/90 text-white dark:text-neutral-900 backdrop-blur-xs text-xs font-bold font-mono shadow-md">
              {formattedPrice}
            </div>
          )}
        </div>

        {/* Title & Model */}
        <div>
          <h3 className="font-sans text-base font-bold text-neutral-900 dark:text-neutral-50 tracking-tight leading-snug line-clamp-2 mb-1">
            {entity.title}
          </h3>
          {model && (
            <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 mb-2">
              Model: {model}
            </p>
          )}

          {/* Subproduct Specific Specs */}
          {(garmentSize || garmentMaterial || cosmeticVolume || cosmeticForm || techSpecs || techConnectivity || eanLabel) && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px] font-mono">
              {eanLabel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-700/60">
                  <Barcode className="w-3 h-3 text-neutral-400" />
                  {eanLabel}
                </span>
              )}
              {garmentSize && (
                <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold border border-neutral-200/60 dark:border-neutral-700/60">
                  Size {garmentSize}
                </span>
              )}
              {garmentMaterial && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                  {garmentMaterial}
                </span>
              )}
              {cosmeticVolume && (
                <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  {cosmeticVolume}
                </span>
              )}
              {cosmeticForm && (
                <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  {cosmeticForm}
                </span>
              )}
              {techSpecs && (
                <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  {techSpecs}
                </span>
              )}
              {techConnectivity && (
                <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  {techConnectivity}
                </span>
              )}
            </div>
          )}

          {/* Summary */}
          {entity.summary && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-2 leading-relaxed">
              {entity.summary}
            </p>
          )}
        </div>

        {/* Disambiguation Bar */}
        {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
          <div className="mb-2">
            <DisambiguationBar
              saveId={save.id}
              candidates={save.candidateFallbacks}
              onSwapped={(swappedEntity) => {
                onSwapped?.({
                  ...save,
                  entity: swappedEntity,
                } as any);
              }}
            />
          </div>
        )}

        {/* Universal Commercial Waterfall Footer */}
        <CardFooterWaterfall
          entity={{
            ...entity,
            priceCents,
            currency,
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Buy Online"
        />
      </div>
    </div>
  );
}
