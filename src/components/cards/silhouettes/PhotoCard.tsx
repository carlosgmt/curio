"use client";

import React, { useState } from "react";
import { Camera, Maximize2, Aperture } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function PhotoCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const data = (typeof entity?.coreStructuredData === "object" && entity.coreStructuredData) || {};

  const title = (save as any).privateTitle || entity?.title || "Photograph";
  const photographer = entity?.brandOrCreator || data.photographer || null;
  const imageUrl =
    entity?.heroImageUrl ||
    data.imageUrl ||
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80";

  const camera = data.camera || data.body || null;
  const lens = data.lens || null;
  const exposure = data.exposure || null;
  const aperture = data.aperture || null;
  const iso = data.iso || null;
  const exifSpecs = [lens, exposure, aperture, iso].filter(Boolean);
  const igMeta = (entity?.extendedAttributes as Record<string, any> | undefined)?.instagram;
  const igBadge = igMeta?.videoUrl
    ? "Reel"
    : Array.isArray(igMeta?.carouselItems) && igMeta.carouselItems.length > 1
    ? `1/${igMeta.carouselItems.length}`
    : null;

  return (
    <div
      data-testid="photo-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      {/* Sartorialist / MACK Books Clean Gallery Print */}
      <div className="p-2.5 sm:p-3 flex flex-col">
        <div className="relative aspect-[4/3.6] w-full overflow-hidden rounded-[8px] bg-[var(--well-surface)]">
          <img
            src={imageUrl}
            alt={title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500 ease-out"
          />

          {(camera || igBadge) && (
            <div className="curio-hover-chrome absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-mono border border-white/15">
              {camera && <Camera className="w-3 h-3 text-[#C89572]" aria-hidden="true" />}
              <span className="truncate max-w-[140px]">{camera || igBadge}</span>
            </div>
          )}
        </div>

        {/* Clean Museum Caption on Gallery Stock */}
        <div className="mt-2.5 px-0.5 flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-1">
              {title}
            </h3>
            {photographer && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{photographer}</p>
            )}
          </div>
          {exifSpecs.length > 0 && (
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0 truncate max-w-[140px]">
              {exifSpecs.slice(0, 2).join(" · ")}
            </span>
          )}
        </div>

        {/* Disambiguation trigger */}
        {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
          <div className="mt-2">
            <DisambiguationBar
              saveId={save.id}
              candidates={save.candidateFallbacks}
              initialQuery={title}
              onSwapped={() => onSwapped?.(save)}
            />
          </div>
        )}
      </div>

      {/* Hover/Focus-Revealed Footer */}
      {entity && (
        <div className="curio-hover-footer">
          <CardFooterWaterfall
            entity={entity}
            primarySource={primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
            isWishlist={Boolean(save.wishlist)}
          />
        </div>
      )}
    </div>
  );
}
