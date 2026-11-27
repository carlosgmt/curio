"use client";

import React, { useState } from "react";
import { Frame, X } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function ArtFrameCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const artist = data.artist || entity.brandOrCreator || null;
  const year = data.year || null;
  const medium = data.medium || null;
  const dimensions = data.dimensions || null;
  const collection = data.galleryOrMuseum || null;

  const plaqueDetails = [medium, dimensions].filter(Boolean).join(" · ");

  return (
    <div
      data-testid="art-frame-card"
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      {/* Clean Museum Print Frame */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-[var(--well-surface)]">
          {entity.heroImageUrl ? (
            <img
              src={entity.heroImageUrl}
              alt={entity.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <Frame className="w-9 h-9 mb-2 stroke-1" aria-hidden="true" />
              <span className="font-serif italic text-sm">{entity.title}</span>
            </div>
          )}
        </div>

        {/* Clean Exhibition Wall Label */}
        <div className="mt-3">
          <h4 className="font-serif-editorial text-base font-medium text-foreground leading-snug">
            {entity.title}
            {year ? `, ${year}` : ""}
          </h4>
          {(artist || plaqueDetails) && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {[artist, plaqueDetails].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={() => onSwapped?.(save)}
        />
      </div>

      {/* Hover/Focus-Revealed Footer */}
      <div className="curio-hover-footer">
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/product/art",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="View High-Res"
          isWishlist={Boolean(save.wishlist)}
          onUtilityClick={entity.heroImageUrl ? () => setIsLightboxOpen(true) : undefined}
        />
      </div>

      {/* High-Res Artwork Lightbox */}
      {isLightboxOpen && entity.heroImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setIsLightboxOpen(false);
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsLightboxOpen(false);
            }}
            aria-label="Close high-res artwork"
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
          <img
            src={entity.heroImageUrl}
            alt={entity.title}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-neutral-800"
          />
          <div className="mt-4 text-center max-w-lg">
            <h3 className="font-serif text-lg font-bold text-white tracking-tight">
              {entity.title} {year ? `(${year})` : ""}
            </h3>
            {(artist || collection) && (
              <p className="font-serif italic text-sm text-neutral-400 mt-0.5">
                {[artist ? `by ${artist}` : null, collection].filter(Boolean).join(" · ")}
              </p>
            )}
            {plaqueDetails && (
              <span className="block text-[10px] font-mono text-neutral-500 uppercase mt-1">
                {plaqueDetails}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
