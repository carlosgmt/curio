"use client";

import React from "react";
import { Compass, Mountain, MapPin, QrCode, Ticket } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function MapPassCard({
  save,
  entity,
  primarySource,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const coordinates = data.coordinates || "35.3606° N, 138.7274° E";
  const elevation = data.elevationGainMeters ? `▲ ${data.elevationGainMeters}m gain` : "▲ 840m gain";
  const distance = data.distanceKm ? `${data.distanceKm} km` : "12.4 km";
  const location = data.location || entity.summary || "Honshu, Japan";
  const passType = data.passType ? data.passType.replace("_", " ").toUpperCase() : "SUMMIT & TRAIL PERMIT";

  return (
    <div className="group relative rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-xl transition-all duration-300 border border-neutral-300 dark:border-neutral-800 flex flex-col justify-between overflow-hidden">
      {/* Top Header Ticket Band */}
      <div className="bg-neutral-950 text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
            {passType}
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">
          SEC 04 • GATE 12
        </span>
      </div>

      {/* Main Ticket Body */}
      <div className="p-5 flex-1 flex flex-col justify-between relative">
        {/* Ticket Perforation Notch (Left & Right) */}
        <div className="absolute top-1/2 -left-3 w-6 h-6 rounded-full bg-[#fafaf9] dark:bg-[#0c0a09] border border-neutral-300 dark:border-neutral-800 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-[#fafaf9] dark:bg-[#0c0a09] border border-neutral-300 dark:border-neutral-800 -translate-y-1/2 pointer-events-none" />

        <div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono mb-1">
            <Compass className="w-3.5 h-3.5 text-blue-500" />
            <span>{coordinates}</span>
          </div>

          <h3 className="font-sans text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-1">
            {entity.title}
          </h3>

          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-neutral-400" />
            {location}
          </p>

          {/* Elevation & Distance Stat Badges */}
          <div className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-800/60 p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80">
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

            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

            <div className="flex-1 pl-2">
              <span className="block text-[9px] font-mono uppercase text-neutral-400">
                Route Distance
              </span>
              <span className="font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100">
                {distance}
              </span>
            </div>

            <div className="shrink-0 text-neutral-400">
              <QrCode className="w-6 h-6" />
            </div>
          </div>
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
            typePath: entity.typePath || "/place/transit_trail",
          }}
          primarySource={primarySource}
          customUtilityLabel="Google Maps"
        />
      </div>
    </div>
  );
}
