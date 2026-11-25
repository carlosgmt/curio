"use client";

import React from "react";
import { ShoppingBag, Tag, Barcode, Cpu, Shirt, Sparkles } from "lucide-react";
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

  const brand =
    data.brand || ext.brand || entity.brandOrCreator || userVals.brand || "Object";
  const model = data.model || ext.model || data.modelNumber || ext.modelNumber || userVals.model;
  const ean = data.ean || ext.ean || data.upc || data.asin || data.sku;
  const eanLabel = data.asin
    ? `ASIN ${data.asin}`
    : data.ean
    ? `EAN ${data.ean}`
    : data.upc
    ? `UPC ${data.upc}`
    : ean
    ? `ID ${ean}`
    : null;
  const isPurchaseHub = Boolean(ext.purchaseHubProductId || ext.source === "purchase-hub");
  const explicitAvailability = data.availability || ext.availability || null;
  const retailer =
    typeof ext.retailers === "string" && ext.retailers.trim()
      ? ext.retailers.trim()
      : typeof data.retailer === "string" && data.retailer.trim()
      ? data.retailer.trim()
      : null;

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
  const currency = primarySource?.currency || entity.currency || "CHF";
  const formattedPrice =
    typeof priceCents === "number" && priceCents > 0
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency || "CHF",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(priceCents / 100)
      : null;

  const rawChips: Array<{ label: string; icon?: React.ReactNode } | null> = [
    eanLabel ? { label: eanLabel, icon: <Barcode className="w-3 h-3 text-neutral-400" aria-hidden="true" /> } : null,
    garmentSize ? { label: `Size ${garmentSize}` } : null,
    garmentMaterial ? { label: String(garmentMaterial) } : null,
    cosmeticVolume ? { label: String(cosmeticVolume) } : null,
    cosmeticForm ? { label: String(cosmeticForm) } : null,
    techSpecs ? { label: String(techSpecs) } : null,
    techConnectivity ? { label: String(techConnectivity) } : null,
  ];
  const specChips = rawChips
    .filter((c): c is { label: string; icon?: React.ReactNode } => Boolean(c))
    .slice(0, 2);

  return (
    <div
      data-testid="product-card"
      className="group relative rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs hover:shadow-lg transition-shadow duration-200 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Main Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        {/* Quiet Hairline Header: Brand & Owned/Retailer or Explicit Availability */}
        <div className="pb-2.5 mb-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2 pr-16 sm:pr-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {isGarment ? (
              <Shirt className="w-3.5 h-3.5 text-neutral-500 shrink-0" aria-hidden="true" />
            ) : isCosmetics ? (
              <Sparkles className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-hidden="true" />
            ) : isElectronics ? (
              <Cpu className="w-3.5 h-3.5 text-blue-500 shrink-0" aria-hidden="true" />
            ) : (
              <Tag className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
            )}
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 truncate">
              {brand}
            </span>
          </div>

          {isPurchaseHub ? (
            <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 truncate shrink-0">
              {retailer || "Owned"}
            </span>
          ) : explicitAvailability ? (
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 shrink-0">
              {String(explicitAvailability).replace(/_/g, " ")}
            </span>
          ) : null}
        </div>

        {/* Product Image Stage */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800/60 mb-3 border border-neutral-200/50 dark:border-neutral-700/50 flex items-center justify-center">
          {entity.heroImageUrl ? (
            <img
              src={entity.heroImageUrl}
              alt={entity.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-103"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-neutral-400 p-4 text-center">
              <ShoppingBag className="w-8 h-8 mb-1.5 opacity-60" aria-hidden="true" />
              <span className="text-xs font-mono">{brand}</span>
            </div>
          )}
        </div>

        {/* Title, Single Price Placement & Model */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-sans text-base font-bold text-neutral-900 dark:text-neutral-50 tracking-tight leading-snug line-clamp-2">
              {entity.title}
            </h3>
            {formattedPrice && (
              <span
                data-testid="product-card-price"
                className="text-xs font-mono tabular-nums font-semibold text-neutral-800 dark:text-neutral-200 shrink-0 pt-0.5"
              >
                {formattedPrice}
              </span>
            )}
          </div>

          {model && (
            <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 mb-2 truncate">
              Model {model}
            </p>
          )}

          {/* Capped Specs (max 2) */}
          {specChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px] font-mono">
              {specChips.map((chip, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700/60"
                >
                  {chip.icon}
                  <span className="truncate max-w-[140px]">{chip.label}</span>
                </span>
              ))}
            </div>
          )}

          {entity.summary && !isPurchaseHub && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-1 leading-relaxed">
              {entity.summary}
            </p>
          )}
        </div>

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={(swappedEntity) => {
            onSwapped?.({
              ...save,
              entity: swappedEntity,
            } as any);
          }}
        />
      </div>

      {/* Universal Commercial / Owned Footer */}
      <CardFooterWaterfall
        entity={{
          ...entity,
          priceCents,
          currency,
        }}
        primarySource={primarySource}
        creatorAffiliateTags={creatorAffiliateTags}
        customUtilityLabel="Buy Online"
        isWishlist={Boolean(save.wishlist)}
        hidePrice
      />
    </div>
  );
}
