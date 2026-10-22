"use client";

import React, { useState } from "react";
import { MapPin, Navigation, ExternalLink, Compass, Camera, Map, Globe } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import { PlaceMapPreview } from "./PlaceMapPreview";
import { parseCoordinates } from "@/lib/geo/slippyMap";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function PlaceSpotCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const ext = (typeof entity?.extendedAttributes === "object" && entity.extendedAttributes) || {};
  const spotName = entity?.title || "Place";
  const city = data.city || entity?.brandOrCreator?.split(",")[0]?.trim();
  const country = data.country || entity?.brandOrCreator?.split(",")[1]?.trim();
  const locationLabel = city ? (country ? `${city}, ${country}` : city) : entity?.brandOrCreator || "Verified Location";
  const category = data.category || data.spotCategory || "Place & Cultural Venue";
  const address = data.address;
  const rawWebsite = data.website || ext.website;
  const websiteUrl =
    typeof rawWebsite === "string" && rawWebsite.trim()
      ? /^https?:\/\//i.test(rawWebsite.trim())
        ? rawWebsite.trim()
        : `https://${rawWebsite.trim()}`
      : null;

  const parsedCoords = parseCoordinates(
    typeof data.latitude === "number" && typeof data.longitude === "number"
      ? { latitude: data.latitude, longitude: data.longitude }
      : data.coordinates
  );
  const latitude = parsedCoords?.latitude ?? (typeof data.latitude === "number" ? data.latitude : undefined);
  const longitude = parsedCoords?.longitude ?? (typeof data.longitude === "number" ? data.longitude : undefined);
  const hasCoordinates = typeof latitude === "number" && typeof longitude === "number";
  const hasPhoto = Boolean(entity?.heroImageUrl);

  const [viewMode, setViewMode] = useState<"photo" | "map">(
    hasPhoto ? "photo" : "map"
  );

  const coordsFormatted =
    hasCoordinates
      ? `${latitude!.toFixed(4)}°, ${longitude!.toFixed(4)}°`
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

        {/* Hero Visual: Editorial Photo OR Interactive Map Preview */}
        {(hasPhoto || hasCoordinates) && (
          <div className="relative aspect-[16/10] min-h-[220px] w-full rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-800 mb-3 group/hero">
            {viewMode === "photo" && entity?.heroImageUrl ? (
              <img
                src={entity.heroImageUrl}
                alt={spotName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
              />
            ) : hasCoordinates ? (
              <PlaceMapPreview
                latitude={latitude!}
                longitude={longitude!}
                spotName={spotName}
                address={address}
                mapsUrl={mapsUrl}
                aspectRatio="h-full w-full"
                className="border-0 shadow-none"
              />
            ) : null}

            {/* Photo / Map Switcher Pills (Top-Right Badge) */}
            {hasPhoto && hasCoordinates && (
              <div
                data-testid="place-view-switcher"
                className="absolute top-2.5 right-2.5 z-30 flex items-center bg-black/65 dark:bg-black/80 backdrop-blur-md p-0.5 rounded-lg border border-white/20 text-[10px] font-mono shadow-md"
              >
                <button
                  type="button"
                  data-testid="switcher-photo-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setViewMode("photo");
                  }}
                  aria-label="Show photo"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    viewMode === "photo"
                      ? "bg-white text-stone-900 font-semibold shadow-xs"
                      : "text-stone-300 hover:text-white"
                  }`}
                >
                  <Camera className="w-3 h-3" />
                  <span>Photo</span>
                </button>
                <button
                  type="button"
                  data-testid="switcher-map-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setViewMode("map");
                  }}
                  aria-label="Show map"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    viewMode === "map"
                      ? "bg-amber-500 text-stone-950 font-semibold shadow-xs"
                      : "text-stone-300 hover:text-white"
                  }`}
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>Map</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Spot Name */}
        <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-50 mb-1 leading-tight">
          {spotName}
        </h3>

        {/* Coordinates */}
        {coordsFormatted && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-stone-500 dark:text-stone-400 mb-2">
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>{coordsFormatted}</span>
          </div>
        )}

        {/* Description / Summary */}
        {entity?.summary && (
          <p className="text-xs font-serif text-stone-600 dark:text-stone-300 line-clamp-3 leading-relaxed mb-3">
            {entity.summary}
          </p>
        )}

        {/* Address text if available */}
        {address && address !== locationLabel && (
          <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 line-clamp-2 mb-3 bg-stone-100 dark:bg-stone-800/60 p-2 rounded-lg">
            {address}
          </p>
        )}

        {/* Optional Website Link (visible only if available) */}
        {websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            data-testid="place-card-website-link"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-700 dark:text-amber-400 hover:underline mb-3 truncate"
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {websiteUrl.replace(/^https?:\/\/(?:www\.)?/i, "").replace(/\/+$/, "")}
            </span>
            <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
          </a>
        )}

        {/* Direct Google Maps Navigation Button */}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            data-testid="maps-link"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-900 text-white dark:bg-white dark:text-stone-900 text-xs font-semibold hover:bg-stone-800 active:scale-98 transition shadow-xs mt-auto"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Google Maps</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        )}
      </div>

      {/* Disambiguation Swapper Bar */}
      <DisambiguationBar
        saveId={save.id}
        candidates={save.candidateFallbacks || []}
        onSwapped={onSwapped}
      />

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
