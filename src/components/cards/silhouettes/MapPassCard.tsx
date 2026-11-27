"use client";

import React from "react";
import { Compass, Mountain, MapPin, QrCode, Ticket, Utensils, Coffee, Hotel, ShoppingBag, Wine, Clock, DollarSign } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function MapPassCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const ext = (typeof entity.extendedAttributes === "object" && entity.extendedAttributes) || {};
  const userVals = (typeof save.userCustomValues === "object" && save.userCustomValues) || {};

  const category = (data.category || ext.category || userVals.category || "").toLowerCase();
  const address = data.address || ext.address || userVals.address;
  const neighborhood = data.neighborhood || ext.neighborhood || userVals.neighborhood;
  const city = data.city || ext.city || userVals.city;
  const priceTier = data.priceTier || ext.priceTier || userVals.priceTier;
  const openingHours = data.openingHours || ext.openingHours || userVals.openingHours;
  const coordinates = data.coordinates || ext.coordinates || userVals.coordinates;

  const isTrail = data.elevationGainMeters != null || data.distanceKm != null || data.passType != null;
  const elevation = data.elevationGainMeters ? `▲ ${data.elevationGainMeters}m gain` : null;
  const distance = data.distanceKm ? `${data.distanceKm} km` : null;

  // Compute location line
  const locationParts = [neighborhood, city, address].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(", ") : data.location || entity.summary || "Location";

  // Header band label & icon
  let passType = "VENUE GUIDE";
  let HeaderIcon = Ticket;
  let iconColor = "text-emerald-400";

  if (isTrail) {
    passType = data.passType ? data.passType.replace("_", " ").toUpperCase() : "SUMMIT & TRAIL PERMIT";
    HeaderIcon = Mountain;
    iconColor = "text-emerald-400";
  } else if (category.includes("restaurant") || category.includes("dining")) {
    passType = "RESTAURANT & DINING";
    HeaderIcon = Utensils;
    iconColor = "text-amber-400";
  } else if (category.includes("cafe") || category.includes("coffee")) {
    passType = "CAFE & ESPRESSO BAR";
    HeaderIcon = Coffee;
    iconColor = "text-amber-300";
  } else if (category.includes("hotel") || category.includes("stay") || category.includes("lodging")) {
    passType = "HOTEL & HOSPITALITY";
    HeaderIcon = Hotel;
    iconColor = "text-blue-400";
  } else if (category.includes("shop") || category.includes("boutique") || category.includes("retail")) {
    passType = "SHOP & BOUTIQUE";
    HeaderIcon = ShoppingBag;
    iconColor = "text-purple-400";
  } else if (category.includes("bar") || category.includes("cocktail") || category.includes("wine")) {
    passType = "BAR & LOUNGE";
    HeaderIcon = Wine;
    iconColor = "text-rose-400";
  } else if (category) {
    passType = category.toUpperCase();
    HeaderIcon = Compass;
    iconColor = "text-emerald-400";
  }

  return (
    <div className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden">
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[var(--gallery-hairline)]">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--brand)]">
              <HeaderIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{passType}</span>
            </span>
            {priceTier && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {priceTier}
              </span>
            )}
          </div>

          <h3 className="font-serif-editorial text-lg font-medium tracking-tight text-foreground mb-1">
            {entity.title}
          </h3>

          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
            <span className="line-clamp-1">{location}</span>
          </p>

          {(coordinates || elevation || distance || openingHours) && (
            <div className="pt-2.5 border-t border-[var(--gallery-hairline)] grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums text-muted-foreground">
              {elevation && <span>{elevation}</span>}
              {distance && <span>{distance}</span>}
              {openingHours && <span className="truncate">{openingHours}</span>}
              {coordinates && <span className="truncate">{coordinates}</span>}
            </div>
          )}
        </div>

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={() => onSwapped?.(save)}
        />
      </div>

      {/* Hover/Focus-Revealed Action Footer */}
      <div className="curio-hover-footer">
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/place",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Google Maps"
          isWishlist={Boolean(save.wishlist)}
        />
      </div>
    </div>
  );
}
