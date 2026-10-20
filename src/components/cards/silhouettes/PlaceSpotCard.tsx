"use client";

import React from "react";
import { MapPin, Ticket, ExternalLink, Utensils, Volume2, Sparkles } from "lucide-react";
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
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const spotName = entity.title;
  const neighborhood = data.neighborhood || data.city || entity.brandOrCreator || "Marais, Paris";
  const category = data.spotCategory || data.category || "Wine Bar & Small Plates";
  const noiseLevel = data.noiseLevel || "Lively / Moderate";
  const specialties = data.specialties || ["Orange Wine", "Sourdough & Butter", "Raw Scallops"];
  const reservationUrl = data.reservationUrl || data.bookingUrl || entity.canonicalUrl;
  const reservationPlatform = data.reservationPlatform || "Resy";

  return (
    <div
      data-testid="place-spot-card"
      className="group relative rounded-2xl bg-[#fbf9f6] dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm hover:shadow-lg transition-all duration-300 border-2 border-stone-200 dark:border-stone-800 flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex flex-col">
        {/* Ticket Header Banner */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-dashed border-stone-300 dark:border-stone-700">
          <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
            <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-mono uppercase font-semibold tracking-wider">
              {neighborhood}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 text-[10px] font-mono font-medium">
            {category}
          </span>
        </div>

        {/* Hero Photo if available */}
        {entity.heroImageUrl ? (
          <div className="relative aspect-16/10 w-full rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-800 mb-3">
            <img
              src={entity.heroImageUrl}
              alt={spotName}
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
            />
          </div>
        ) : null}

        {/* Spot Name */}
        <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-50 mb-1 leading-tight">
          {spotName}
        </h3>

        {/* Noise Level & Atmosphere Gauge */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-stone-500 dark:text-stone-400 mb-3">
          <Volume2 className="w-3.5 h-3.5 text-stone-400" />
          <span>Atmosphere: {noiseLevel}</span>
        </div>

        {/* Culinary Specialties */}
        <div className="space-y-1.5 mb-4">
          <span className="text-[10px] font-mono uppercase text-stone-400 block tracking-wider">
            Signature Provisions:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {specialties.map((spec: string, idx: number) => (
              <span
                key={idx}
                data-testid={`specialty-${idx}`}
                className="px-2 py-0.5 rounded-md bg-stone-200/70 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-[10px] font-medium"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>

        {/* Direct Reservation Ticket Link */}
        {reservationUrl && (
          <a
            href={reservationUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="reservation-link"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-900 text-white dark:bg-white dark:text-stone-900 text-xs font-semibold hover:bg-stone-800 active:scale-98 transition shadow-xs"
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Book Table ({reservationPlatform})</span>
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
      <CardFooterWaterfall
        entity={entity}
        primarySource={primarySource}
        creatorAffiliateTags={creatorAffiliateTags}
      />
    </div>
  );
}
