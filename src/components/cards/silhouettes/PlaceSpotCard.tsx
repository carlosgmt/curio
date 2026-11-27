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
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      <div className="p-3.5 sm:p-4 flex flex-col">
        {/* Hero Visual: Editorial Photo OR Interactive Map Preview */}
        {(hasPhoto || hasCoordinates) && (
          <div className="relative aspect-[16/10] min-h-[200px] w-full rounded-[8px] overflow-hidden bg-[var(--well-surface)] mb-3 group/hero">
            {viewMode === "photo" && entity?.heroImageUrl ? (
              <img
                src={entity.heroImageUrl}
                alt={spotName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
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

            {/* Photo / Map Switcher Pills */}
            {hasPhoto && hasCoordinates && (
              <div
                data-testid="place-view-switcher"
                className="curio-hover-chrome absolute top-2.5 left-2.5 z-30 flex items-center bg-card/90 backdrop-blur-md p-0.5 rounded-lg border border-[var(--gallery-hairline)] text-[10px] font-mono shadow-sm"
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
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
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
                      ? "bg-[var(--brand)] text-[var(--primary-foreground)] font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>Map</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Spot Name & Location */}
        <h3 className="font-serif-editorial text-lg font-medium text-foreground leading-snug">
          {spotName}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {[locationLabel, category].filter(Boolean).join(" · ")}
        </p>

        {coordsFormatted && (
          <p className="text-[11px] font-mono tabular-nums text-muted-foreground/80 mt-1">
            {coordsFormatted}
          </p>
        )}

        {entity?.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1.5">
            {entity.summary}
          </p>
        )}

        {(websiteUrl || mapsUrl) && (
          <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs font-mono">
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                data-testid="maps-link"
                className="inline-flex items-center gap-1 text-[var(--brand)] hover:underline underline-offset-4"
              >
                <Navigation className="w-3 h-3" />
                <span>Google Maps</span>
              </a>
            )}
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                data-testid="place-card-website-link"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground truncate max-w-[160px]"
              >
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {websiteUrl.replace(/^https?:\/\/(?:www\.)?/i, "").replace(/\/+$/, "")}
                </span>
              </a>
            )}
          </div>
        )}
      </div>

      <DisambiguationBar
        saveId={save.id}
        candidates={save.candidateFallbacks || []}
        onSwapped={onSwapped}
      />

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
