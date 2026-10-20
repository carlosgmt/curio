"use client";

import React, { useState } from "react";
import { Camera, Maximize2, Aperture, Eye } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function PhotoCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
}: SilhouetteCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const data = (typeof entity?.coreStructuredData === "object" && entity.coreStructuredData) || {};

  const title = entity?.title || "Photograph";
  const photographer = entity?.brandOrCreator || data.photographer || "Curated Eye";
  const imageUrl = entity?.heroImageUrl || data.imageUrl || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80";

  const camera = data.camera || data.body || "Leica M11";
  const lens = data.lens || "Summilux-M 35mm f/1.4";
  const exposure = data.exposure || "1/500s";
  const aperture = data.aperture || "f/2.8";
  const iso = data.iso || "ISO 200";

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

        {/* Top Badges: Camera & Lens */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10 shadow-xs">
            <Camera className="w-3 h-3 text-amber-400" />
            <span className="truncate max-w-[140px]">{camera}</span>
          </div>

          <div className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-white/80 hover:text-white border border-white/10 transition">
            <Maximize2 className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Bottom EXIF HUD Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end">
          <h3 className="font-serif text-lg font-bold text-white mb-0.5 leading-snug drop-shadow-md">
            {title}
          </h3>
          <p className="text-xs font-mono text-neutral-300 mb-2">{photographer}</p>

          <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-300 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg w-fit border border-white/10">
            <Aperture className="w-3 h-3 text-amber-400" />
            <span>{lens}</span>
            <span className="text-neutral-500">·</span>
            <span>{exposure}</span>
            <span className="text-neutral-500">·</span>
            <span>{aperture}</span>
            <span className="text-neutral-500">·</span>
            <span>{iso}</span>
          </div>
        </div>
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
