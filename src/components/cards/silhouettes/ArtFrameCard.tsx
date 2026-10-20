"use client";

import React, { useState } from "react";
import { Frame, Eye, Sparkles, X } from "lucide-react";
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
  const artist = data.artist || entity.brandOrCreator || "Unknown Artist";
  const year = data.year || "c. 1968";
  const medium = data.medium || "Oil on Linen";
  const dimensions = data.dimensions || "120 × 90 cm";
  const collection = data.galleryOrMuseum || "Private Collection";

  return (
    <div className="group relative rounded-2xl bg-neutral-900 text-white shadow-md hover:shadow-2xl transition-all duration-300 border-4 border-neutral-800 flex flex-col justify-between overflow-hidden">
      {/* Passepartout Beveled Matting Border */}
      <div className="p-5 sm:p-6 bg-stone-100 dark:bg-stone-900 shadow-inner flex flex-col items-center">
        {/* Inner Canvas with Art Image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded shadow-md border border-neutral-300 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-800">
          {entity.heroImageUrl ? (
            <img
              src={entity.heroImageUrl}
              alt={entity.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-103"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-neutral-500">
              <Frame className="w-10 h-10 mb-2 stroke-1" />
              <span className="font-serif italic text-sm">{entity.title}</span>
            </div>
          )}
        </div>

        {/* Engraved Brass Plaque Centered at Bottom of Matting */}
        <div className="mt-4 px-4 py-2 rounded-xs border border-amber-400/80 bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-amber-950 text-center shadow-xs max-w-[280px]">
          <h4 className="font-serif text-xs font-bold uppercase tracking-widest leading-tight">
            {artist}
          </h4>
          <p className="font-serif text-[11px] italic text-amber-900 leading-tight mt-0.5">
            "{entity.title}", {year}
          </p>
          <span className="block text-[8px] font-mono uppercase tracking-wider text-amber-800/80 mt-0.5">
            {medium} • {dimensions}
          </span>
        </div>
      </div>

      {/* Disambiguation Fallback */}
      {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
        <div className="px-4 pt-2 bg-neutral-950">
          <DisambiguationBar
            saveId={save.id}
            candidates={save.candidateFallbacks}
            onSwapped={() => onSwapped?.(save)}
          />
        </div>
      )}

      {/* Action Footer */}
      <div className="p-3 bg-neutral-950 border-t border-neutral-800">
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/product/art",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="View High-Res"
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
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-6 h-6" />
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
            <p className="font-serif italic text-sm text-neutral-400 mt-0.5">
              by {artist} • {collection}
            </p>
            <span className="block text-[10px] font-mono text-neutral-500 uppercase mt-1">
              {medium} • {dimensions}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
