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
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      {/* Main Body */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
        {/* Studio Image Well */}
        <div className="relative aspect-[4/3.4] w-full overflow-hidden rounded-[8px] bg-[var(--well-surface)] mb-3 flex items-center justify-center">
          {entity.heroImageUrl ? (
            <img
              src={entity.heroImageUrl}
              alt={entity.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
              <ShoppingBag className="w-7 h-7 mb-1.5 opacity-60" aria-hidden="true" />
              <span className="text-xs font-mono">{brand}</span>
            </div>
          )}
        </div>

        {/* Title, Single Price Placement & Clean Spec Metadata */}
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm sm:text-[15px] font-medium text-foreground tracking-tight leading-snug line-clamp-2">
              {entity.title}
            </h3>
            {formattedPrice && (
              <span
                data-testid="product-card-price"
                className="text-xs font-mono tabular-nums font-medium text-[var(--brand)] shrink-0"
              >
                {formattedPrice}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {[
              brand,
              isPurchaseHub ? retailer || "Owned" : explicitAvailability ? String(explicitAvailability).replace(/_/g, " ") : null,
              model ? `Model ${model}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {/* Capped Specs (max 2, inline tabular text) */}
          {specChips.length > 0 && (
            <p className="mt-1 text-[11px] font-mono tabular-nums text-muted-foreground/85 truncate">
              {specChips.map((chip) => chip.label).join(" · ")}
            </p>
          )}

          {entity.summary && !isPurchaseHub && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
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

      {/* Hover/Focus-Revealed Commercial / Owned Footer */}
      <div className="curio-hover-footer">
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
    </div>
  );
}
