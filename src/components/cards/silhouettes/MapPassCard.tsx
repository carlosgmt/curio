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
    <div className="group relative rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-xl transition-all duration-300 border border-neutral-300 dark:border-neutral-800 flex flex-col justify-between overflow-hidden">
      {/* Top Header Ticket Band */}
      <div className="bg-neutral-950 text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeaderIcon className={`w-4 h-4 ${iconColor}`} />
          <span className={`font-mono text-[10px] uppercase tracking-widest font-bold ${iconColor}`}>
            {passType}
          </span>
        </div>
        {priceTier && (
          <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
            {priceTier}
          </span>
        )}
      </div>

      {/* Main Ticket Body */}
      <div className="p-5 flex-1 flex flex-col justify-between relative">
        {/* Ticket Perforation Notch (Left & Right) */}
        <div className="absolute top-1/2 -left-3 w-6 h-6 rounded-full bg-[#fafaf9] dark:bg-[#0c0a09] border border-neutral-300 dark:border-neutral-800 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-[#fafaf9] dark:bg-[#0c0a09] border border-neutral-300 dark:border-neutral-800 -translate-y-1/2 pointer-events-none" />

        <div>
          {coordinates && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono mb-1">
              <Compass className="w-3.5 h-3.5 text-blue-500" />
              <span>{coordinates}</span>
            </div>
          )}

          <h3 className="font-sans text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-1">
            {entity.title}
          </h3>

          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="line-clamp-1">{location}</span>
          </p>

          {/* Stat / Venue Badges */}
          {isTrail && (elevation || distance) ? (
            <div className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-800/60 p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 mb-2">
              {elevation && (
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Mountain className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[9px] font-mono uppercase text-neutral-400">
                      Elevation
                    </span>
                    <span className="font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100">
                      {elevation}
                    </span>
                  </div>
                </div>
              )}

              {distance && (
                <>
                  <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700" />
                  <div className="flex-1 pl-2">
                    <span className="block text-[9px] font-mono uppercase text-neutral-400">
                      Distance
                    </span>
                    <span className="font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100">
                      {distance}
                    </span>
                  </div>
                </>
              )}

              <div className="shrink-0 text-neutral-400">
                <QrCode className="w-6 h-6" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/60 p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-200/80 dark:bg-neutral-750 text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0">
                  <HeaderIcon className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-[9px] font-mono uppercase text-neutral-400">
                    Category
                  </span>
                  <span className="font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100 capitalize">
                    {category || "Place"}
                  </span>
                </div>
              </div>

              {openingHours && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-600 dark:text-neutral-300">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{openingHours}</span>
                </div>
              )}

              <div className="shrink-0 text-neutral-400">
                <QrCode className="w-5 h-5 opacity-60" />
              </div>
            </div>
          )}
        </div>

        {/* Perforated Dashed Tear Line */}
        <div className="my-4 border-b border-dashed border-neutral-300 dark:border-neutral-700" />

        {/* Disambiguation Bar */}
        {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
          <div className="mb-2">
            <DisambiguationBar
              saveId={save.id}
              candidates={save.candidateFallbacks}
              onSwapped={() => onSwapped?.(save)}
            />
          </div>
        )}

        {/* Action Footer */}
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/place",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Google Maps"
        />
      </div>
    </div>
  );
}
