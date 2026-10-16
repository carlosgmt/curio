"use client";

import React from "react";
import { MapPin, Navigation, Compass, ExternalLink, Clock, Building } from "lucide-react";
import type { CulturalModeProps } from "./CinemaCulturalMode";

export function PlaceCulturalMode({ save, entity, primarySource }: CulturalModeProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity?.coreStructuredData) || {};

  const coordinates = data.coordinates || "35.6712° N · 139.6891° E";
  const address = data.address || entity?.summary || "1-1-1 Shibuya, Tokyo, Japan";
  const neighborhood = data.neighborhood || "Shibuya / Yoyogi-Koen";
  const hours = data.hours || "08:00 – 23:00 Daily";
  const category = data.category || "Specialty Cafe & Roastery";

  const searchQuery = encodeURIComponent(`${entity?.title || ""} ${address}`);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${searchQuery}`;

  return (
    <div className="flex flex-col h-full bg-[#f6f5f0] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xl">
      {/* Postal Transit Header */}
      <div className="p-5 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between bg-white/60 dark:bg-neutral-950/40">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-neutral-700 dark:text-neutral-300">
            {coordinates}
          </span>
        </div>

        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-200/80 dark:border-neutral-700">
          {category}
        </span>
      </div>

      {/* Stylized Cartographic Pass / Hero Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
        {entity?.heroImageUrl ? (
          <img
            src={entity.heroImageUrl}
            alt={entity.title}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Vector Cartographic Grid Simulation */
          <div className="w-full h-full flex flex-col items-center justify-center relative p-8 bg-[#ece8dc] dark:bg-neutral-950">
            <svg
              className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center shadow-lg animate-pulse mb-3">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {entity?.title}
              </h3>
              <p className="font-mono text-xs text-neutral-500 mt-1">{neighborhood}</p>
            </div>
          </div>
        )}

        {/* Pulsing Pin Indicator */}
        <div className="absolute top-4 left-4 z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-black/75 backdrop-blur-md text-white border border-white/10 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Curated Location</span>
          </span>
        </div>
      </div>

      {/* Transit Pass Details & Navigation Launchers */}
      <div className="p-5 space-y-4 flex-1">
        <div>
          <h2 className="text-2xl font-bold font-serif text-neutral-900 dark:text-neutral-100 mb-1">
            {entity?.title}
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5 leading-relaxed">
            <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
            <span>{address}</span>
          </p>
        </div>

        {/* Operating Hours & Neighborhood */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80">
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 uppercase font-bold mb-1">
              <Clock className="w-3 h-3" />
              <span>Hours</span>
            </div>
            <span className="text-neutral-800 dark:text-neutral-200">{hours}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80">
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 uppercase font-bold mb-1">
              <Building className="w-3 h-3" />
              <span>Area</span>
            </div>
            <span className="text-neutral-800 dark:text-neutral-200 truncate block">{neighborhood}</span>
          </div>
        </div>

        {/* 1-Tap Navigation Launchers */}
        <div className="pt-2">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-2">
            Open in Navigation Apps
          </span>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition cursor-pointer shadow-sm"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Google Maps</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
            </a>

            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 transition cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-neutral-500" />
              <span>Apple Maps</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
