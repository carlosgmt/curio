"use client";

import React, { useState, useEffect } from "react";
import { MapPin, Navigation, Compass, ExternalLink, Clock, Camera, Map, Globe } from "lucide-react";
import { PlaceMapPreview } from "../../cards/silhouettes/PlaceMapPreview";
import { parseCoordinates } from "@/lib/geo/slippyMap";
import type { CulturalModeProps } from "./CinemaCulturalMode";

function extractValidWebsite(data: Record<string, any>, ext: Record<string, any>, userVals: Record<string, any>, canonicalUrl?: string | null): string | null {
  const explicit = data.website || ext.website || userVals.website || data.url || ext.url;
  if (typeof explicit === "string" && explicit.trim()) {
    const trimmed = explicit.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
  if (canonicalUrl && /^https?:\/\//i.test(canonicalUrl)) {
    const lower = canonicalUrl.toLowerCase();
    const isAggregator =
      lower.includes("google.com/maps") ||
      lower.includes("maps.google.") ||
      lower.includes("maps.app.goo.gl") ||
      lower.includes("wikipedia.org") ||
      lower.includes("wikidata.org") ||
      lower.includes("openstreetmap.org") ||
      lower.includes("duckduckgo.com") ||
      lower.includes("foursquare.com") ||
      lower.includes("curio.local");
    if (!isAggregator) {
      return canonicalUrl;
    }
  }
  return null;
}

export function PlaceCulturalMode({ save, entity }: CulturalModeProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity?.coreStructuredData) || {};
  const ext = (typeof entity?.extendedAttributes === "object" && entity?.extendedAttributes) || {};
  const userVals = (typeof save?.userCustomValues === "object" && save?.userCustomValues) || {};

  const address = data.address || ext.address || userVals.address || entity?.summary || "";
  const hours = data.hours || data.openingHours || ext.hours || ext.openingHours || userVals.hours || userVals.openingHours || null;
  const category = data.category || ext.category || "Place";
  const websiteUrl = extractValidWebsite(data, ext, userVals, entity?.canonicalUrl);
  const websiteLabel = websiteUrl
    ? websiteUrl.replace(/^https?:\/\/(?:www\.)?/i, "").replace(/\/+$/, "")
    : null;

  const parsedCoords = parseCoordinates(
    typeof data.latitude === "number" && typeof data.longitude === "number"
      ? { latitude: data.latitude, longitude: data.longitude }
      : data.coordinates
  );

  const latitude = parsedCoords?.latitude;
  const longitude = parsedCoords?.longitude;
  const hasCoordinates = typeof latitude === "number" && typeof longitude === "number";
  const hasPhoto = Boolean(entity?.heroImageUrl);

  const [viewMode, setViewMode] = useState<"photo" | "map">(
    hasPhoto ? "photo" : "map"
  );
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    }
  }, []);

  const searchQuery = encodeURIComponent(
    [entity?.title, address || data.city].filter(Boolean).join(" ").trim() || "Place"
  );
  const googleMapsUrl =
    data.googleMapsUrl ||
    (hasCoordinates
      ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${searchQuery}`);
  const appleMapsUrl = `https://maps.apple.com/?q=${searchQuery}`;

  const coordinatesDisplay = hasCoordinates
    ? `${latitude!.toFixed(4)}° · ${longitude!.toFixed(4)}°`
    : entity?.brandOrCreator || "Verified Location";

  return (
    <div className="flex flex-col h-full bg-[#f6f5f0] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xl">
      {/* Postal Transit Header */}
      <div className="p-5 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between bg-white/60 dark:bg-neutral-950/40">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-neutral-700 dark:text-neutral-300">
            {coordinatesDisplay}
          </span>
        </div>

        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-200/80 dark:border-neutral-700">
          {category}
        </span>
      </div>

      {/* Stylized Cartographic Pass / Hero Image / Map Preview */}
      {(hasPhoto || hasCoordinates) && (
        <div className="relative aspect-[4/3] min-h-[240px] w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 group/hero">
          {viewMode === "photo" && entity?.heroImageUrl ? (
            <img
              src={entity.heroImageUrl}
              alt={entity.title}
              className="w-full h-full object-cover"
            />
          ) : hasCoordinates ? (
            <PlaceMapPreview
              latitude={latitude!}
              longitude={longitude!}
              spotName={entity?.title}
              address={address}
              mapsUrl={googleMapsUrl}
              aspectRatio="h-full w-full"
              className="border-0 shadow-none rounded-none"
            />
          ) : null}

          {/* Pulsing Pin Indicator on Photo */}
          {viewMode === "photo" && entity?.heroImageUrl && (
            <div className="absolute top-4 left-4 z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-black/75 backdrop-blur-md text-white border border-white/10 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Curated Location</span>
              </span>
            </div>
          )}

          {/* Photo / Map Switcher Pills */}
          {hasPhoto && hasCoordinates && (
            <div
              data-testid="lightbox-place-view-switcher"
              className="absolute top-4 right-4 z-30 flex items-center bg-black/75 backdrop-blur-md p-0.5 rounded-lg border border-white/20 text-xs font-mono shadow-lg"
            >
              <button
                type="button"
                data-testid="lightbox-switcher-photo-btn"
                onClick={() => setViewMode("photo")}
                aria-label="Show photo"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === "photo"
                    ? "bg-white text-stone-900 font-semibold shadow-xs"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Photo</span>
              </button>
              <button
                type="button"
                data-testid="lightbox-switcher-map-btn"
                onClick={() => setViewMode("map")}
                aria-label="Show map"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
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

      {/* Place Details, Optional Website / Hours & Navigation */}
      <div className="p-5 space-y-4 flex-1">
        <div>
          <h2 className="text-2xl font-bold font-serif text-neutral-900 dark:text-neutral-100 mb-1">
            {entity?.title}
          </h2>
          {address && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5 leading-relaxed">
              <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
              <span>{address}</span>
            </p>
          )}
        </div>

        {/* Optional Metadata Row: Website (only if available) & Hours (only if available) */}
        {(websiteUrl || hours) && (
          <div className={`grid ${websiteUrl && hours ? "grid-cols-2" : "grid-cols-1"} gap-2 text-xs font-mono`}>
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="place-website-field"
                className="p-2.5 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80 hover:border-neutral-400 dark:hover:border-neutral-500 transition block group"
              >
                <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-bold mb-1">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    <span>Website</span>
                  </span>
                  <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition" />
                </div>
                <span className="text-neutral-800 dark:text-neutral-200 truncate block underline decoration-neutral-400/50 underline-offset-2">
                  {websiteLabel}
                </span>
              </a>
            )}

            {hours && (
              <div
                data-testid="place-hours-field"
                className="p-2.5 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80"
              >
                <div className="flex items-center gap-1 text-[10px] text-neutral-400 uppercase font-bold mb-1">
                  <Clock className="w-3 h-3" />
                  <span>Hours</span>
                </div>
                <span className="text-neutral-800 dark:text-neutral-200 truncate block">{hours}</span>
              </div>
            )}
          </div>
        )}

        {/* 1-Tap Navigation Launcher (Google Maps on Android/Desktop; Apple Maps added only on iOS) */}
        <div className="pt-2">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-2">
            Navigation
          </span>
          <div className={`grid ${isIOS ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition cursor-pointer shadow-sm"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Google Maps</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
            </a>

            {isIOS && (
              <a
                href={appleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 transition cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-neutral-500" />
                <span>Apple Maps</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
