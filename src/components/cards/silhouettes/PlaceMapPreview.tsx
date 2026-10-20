"use client";

import React, { useMemo } from "react";
import { MapPin, Navigation, ExternalLink, Compass } from "lucide-react";
import { getSurroundingTiles } from "@/lib/geo/slippyMap";

export interface PlaceMapPreviewProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  spotName?: string;
  address?: string;
  mapsUrl?: string;
  className?: string;
  aspectRatio?: string;
  interactive?: boolean;
}

export function PlaceMapPreview({
  latitude,
  longitude,
  zoom = 15,
  spotName,
  address,
  mapsUrl,
  className = "",
  aspectRatio = "aspect-[16/10] min-h-[220px]",
  interactive = true,
}: PlaceMapPreviewProps) {
  const targetMapsUrl = useMemo(() => {
    if (mapsUrl) return mapsUrl;
    const query = spotName
      ? address
        ? `${spotName}, ${address}`
        : spotName
      : `${latitude},${longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }, [mapsUrl, spotName, address, latitude, longitude]);

  // Compute surrounding raster tiles to cover card viewports up to 640x420
  const tiles = useMemo(() => {
    return getSurroundingTiles(latitude, longitude, zoom, 640, 420);
  }, [latitude, longitude, zoom]);

  const coordsLabel = `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;

  const content = (
    <div
      data-testid="place-map-preview"
      className={`relative w-full ${aspectRatio} overflow-hidden rounded-xl bg-[#e5e3df] dark:bg-[#1f1f1f] border border-stone-200/80 dark:border-stone-800 shadow-inner group/map ${className}`}
    >
      {/* Slippy Raster Tile Grid Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {tiles.map((tile) => (
          <React.Fragment key={tile.key}>
            {/* Light Mode: CartoDB Voyager */}
            <img
              src={tile.url}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="absolute pointer-events-none block dark:hidden transition-opacity duration-300"
              style={{
                width: 256,
                height: 256,
                left: `calc(50% + ${tile.offsetFromCenterX}px)`,
                top: `calc(50% + ${tile.offsetFromCenterY}px)`,
              }}
              onError={(e) => {
                // OpenStreetMap fallback
                const target = e.currentTarget as HTMLImageElement;
                if (target.src !== tile.osmUrl) {
                  target.src = tile.osmUrl;
                }
              }}
            />
            {/* Dark Mode: CartoDB Dark Matter */}
            <img
              src={tile.darkUrl}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="absolute pointer-events-none hidden dark:block transition-opacity duration-300"
              style={{
                width: 256,
                height: 256,
                left: `calc(50% + ${tile.offsetFromCenterX}px)`,
                top: `calc(50% + ${tile.offsetFromCenterY}px)`,
              }}
              onError={(e) => {
                // OpenStreetMap fallback
                const target = e.currentTarget as HTMLImageElement;
                if (target.src !== tile.osmUrl) {
                  target.src = tile.osmUrl;
                }
              }}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Subtle Map Grid Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-radial from-transparent via-transparent to-black/10 dark:to-black/40" />

      {/* Center Tactical Amber Pin with Pulse Glow */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex flex-col items-center justify-center"
        aria-hidden="true"
      >
        {/* Ground Pulse Rings at exact geo coordinates */}
        <div className="absolute flex items-center justify-center">
          <span className="absolute w-8 h-8 rounded-full bg-amber-500/35 dark:bg-amber-400/35 animate-ping" />
          <span className="absolute w-4 h-4 rounded-full bg-amber-500/50 dark:bg-amber-400/50 blur-[1px]" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-600 dark:bg-amber-400 border-2 border-white dark:border-stone-900 shadow-md" />
        </div>

        {/* Tactical Curio Pin Marker hovering slightly above the ground dot */}
        <div className="absolute -top-7 flex flex-col items-center group-hover/map:-translate-y-1 transition-transform duration-200">
          <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-900/40 border-2 border-white dark:border-stone-900 ring-2 ring-amber-500/20">
            <MapPin className="w-3.5 h-3.5 fill-white" />
          </div>
          <div className="-mt-1 w-1.5 h-1.5 bg-amber-600 rotate-45 border-r border-b border-white dark:border-stone-900" />
        </div>
      </div>

      {/* Top Left Compass Coordinates Badge */}
      <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-black/65 dark:bg-black/75 backdrop-blur-md text-white border border-white/10 shadow-xs">
          <Compass className="w-3 h-3 text-amber-400" />
          <span>{coordsLabel}</span>
        </span>
      </div>

      {/* Bottom Right 'Open in Maps' Hover Pill */}
      {interactive && (
        <div className="absolute bottom-2.5 right-2.5 z-20">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold font-sans bg-stone-900/90 text-white dark:bg-white/95 dark:text-stone-900 backdrop-blur-md shadow-md border border-white/10 dark:border-stone-200 hover:scale-102 active:scale-98 transition duration-200">
            <Navigation className="w-2.5 h-2.5" />
            <span>Open in Maps</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
          </span>
        </div>
      )}

      {/* Attribution Watermark */}
      <div className="absolute bottom-1 left-2.5 z-20 pointer-events-none">
        <span className="text-[8px] font-mono text-stone-500/70 dark:text-stone-400/60 select-none">
          © CARTO © OpenStreetMap
        </span>
      </div>
    </div>
  );

  if (interactive) {
    return (
      <a
        href={targetMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 rounded-xl"
        title={spotName ? `Open ${spotName} in Maps` : "Open in Maps"}
      >
        {content}
      </a>
    );
  }

  return content;
}
