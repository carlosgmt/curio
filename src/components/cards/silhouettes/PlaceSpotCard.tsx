"use client";

import React from "react";
import { MapPin, Navigation, ExternalLink, Compass, Sparkles } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function PlaceSpotCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const spotName = entity?.title || "Place";
  const city = data.city || entity?.brandOrCreator?.split(",")[0]?.trim();
  const country = data.country || entity?.brandOrCreator?.split(",")[1]?.trim();
  const locationLabel = city ? (country ? `${city}, ${country}` : city) : entity?.brandOrCreator || "Verified Location";
  const category = data.category || data.spotCategory || "Place & Cultural Venue";
  const address = data.address;
  const latitude = data.latitude;
  const longitude = data.longitude;
  const coordsFormatted =
    typeof latitude === "number" && typeof longitude === "number"
      ? `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`
      : null;

  const mapsUrl = data.googleMapsUrl || entity?.canonicalUrl || `https://maps.google.com/?q=${encodeURIComponent(spotName)}`;

  return (
    <div
      data-testid="place-spot-card"
      className="group relative rounded-2xl bg-[#fbf9f6] dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm hover:shadow-lg transition-all duration-300 border-2 border-stone-200 dark:border-stone-800 flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex flex-col">
        {/* Top Header Location & Category Ribbon */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-dashed border-stone-300 dark:border-stone-700">
          <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs font-mono uppercase font-semibold tracking-wider truncate">
              {locationLabel}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 text-[10px] font-mono font-medium shrink-0">
            {category}
          </span>
        </div>

        {/* Hero Photo if available */}
        {entity?.heroImageUrl ? (
          <div className="relative aspect-16/10 w-full rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-800 mb-3">
            <img
              src={entity.heroImageUrl}
              alt={spotName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
            />
          </div>
        ) : null}

        {/* Spot Name */}
        <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-50 mb-1 leading-tight">
          {spotName}
        </h3>

        {/* Coordinates / Address */}
        {coordsFormatted && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-stone-500 dark:text-stone-400 mb-2">
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>{coordsFormatted}</span>
          </div>
        )}

        {/* Description / Summary */}
        {entity?.summary && (
          <p className="text-xs font-serif text-stone-600 dark:text-stone-300 line-clamp-3 leading-relaxed mb-4">
            {entity.summary}
          </p>
        )}

        {/* Address text if available */}
        {address && address !== locationLabel && (
          <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 line-clamp-2 mb-4 bg-stone-100 dark:bg-stone-800/60 p-2 rounded-lg">
            {address}
          </p>
        )}

        {/* Direct Google Maps Navigation Button */}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="maps-link"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-900 text-white dark:bg-white dark:text-stone-900 text-xs font-semibold hover:bg-stone-800 active:scale-98 transition shadow-xs mt-auto"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Open in Maps</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        )}
      </div>

      {/* Disambiguation Swapper Bar */}
      {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks}
          onSwapped={onSwapped}
        />
      )}

      {/* Footer Waterfall */}
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
