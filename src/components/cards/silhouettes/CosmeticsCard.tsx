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
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        {/* Product Hero Image */}
        {entity.heroImageUrl ? (
          <div className="relative aspect-[4/3.5] w-full rounded-[8px] overflow-hidden bg-[var(--well-surface)] mb-3">
            <img
              src={entity.heroImageUrl}
              alt={productName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="w-full aspect-[4/3] rounded-[8px] bg-[var(--well-surface)] flex items-center justify-center mb-3 text-muted-foreground">
            <Sparkles className="w-7 h-7 stroke-1" aria-hidden="true" />
          </div>
        )}

        {/* Title & Brand / Volume */}
        <h3 className="text-sm sm:text-[15px] font-medium text-foreground leading-snug line-clamp-2">
          {productName}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {[brand, volume].filter(Boolean).join(" · ")}
        </p>

        {cleanBadge && (
          <div
            data-testid="clean-beauty-badge"
            className="mt-2 inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--well-surface)] border border-[var(--gallery-hairline)] text-[10px] font-mono text-muted-foreground"
          >
            <ShieldCheck className="w-3 h-3 text-[var(--brand)]" aria-hidden="true" />
            <span>{cleanBadge}</span>
          </div>
        )}

        {/* Shade Swatch (only when shade or swatch exists) */}
        {(shadeName || shadeHex) && (
          <div
            data-testid="shade-palette"
            className="flex items-center gap-2 pt-2 mt-2 border-t border-[var(--gallery-hairline)]"
          >
            {shadeHex && (
              <div
                data-testid="shade-swatch"
                className="w-3.5 h-3.5 rounded-full border border-[var(--gallery-hairline)] shrink-0"
                style={{ backgroundColor: shadeHex }}
              />
            )}
            {shadeName && (
              <span className="text-xs text-muted-foreground truncate">
                {shadeName}
              </span>
            )}
          </div>
        )}

        {/* Skin-Type Suitability (capped to 3 + N) */}
        {visibleSkinTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {visibleSkinTypes.map((type: string) => (
              <span
                key={type}
                data-testid={`skin-type-${type.toLowerCase()}`}
                className="px-2 py-0.5 rounded bg-[var(--well-surface)] border border-[var(--gallery-hairline)] text-muted-foreground text-[10px] font-mono"
              >
                {type}
              </span>
            ))}
            {overflowSkinTypes > 0 && (
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
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

      {/* Hover/Focus-Revealed Footer Waterfall */}
      <div className="curio-hover-footer">
        <CardFooterWaterfall
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          isWishlist={Boolean(save.wishlist)}
        />
      </div>
    </div>
  );
}
