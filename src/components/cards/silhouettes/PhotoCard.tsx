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

  return (
    <div
      data-testid="photo-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative rounded-2xl bg-black text-white shadow-md hover:shadow-2xl transition-all duration-300 border border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Full-bleed Photo Container */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-neutral-950">
        <img
          src={imageUrl}
          alt={title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
        />

        {/* Top Subtle Gradient Vignette */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

        {/* Top Badges: Camera (only if real EXIF exists) & Expand */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
          {camera ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10 shadow-xs">
              <Camera className="w-3 h-3 text-amber-400" />
              <span className="truncate max-w-[140px]">{camera}</span>
            </div>
          ) : (
            <span />
          )}

          <div className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-white/80 hover:text-white border border-white/10 transition">
            <Maximize2 className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Bottom Caption & Optional EXIF HUD Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end">
          <h3 className="font-serif text-lg font-bold text-white mb-0.5 leading-snug drop-shadow-md">
            {title}
          </h3>
          {photographer && (
            <p className="text-xs font-mono text-neutral-300 mb-2">{photographer}</p>
          )}

          {exifSpecs.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-300 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg w-fit border border-white/10">
              <Aperture className="w-3 h-3 text-amber-400" />
              <span>{exifSpecs.join(" · ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Disambiguation trigger */}
      <div className="px-4 pt-1.5 bg-neutral-950">
        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          initialQuery={title}
          onSwapped={() => onSwapped?.(save)}
        />
      </div>

      {/* Footer */}
      {entity && (
        <CardFooterWaterfall
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
        />
      )}
    </div>
  );
}
