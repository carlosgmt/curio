"use client";

import React from "react";
import { Gamepad2, Clock, Trophy, Disc, Sparkles, Monitor, Tv } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function VideoGameCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const ext = (typeof entity.extendedAttributes === "object" && entity.extendedAttributes) || {};
  const userVals = (typeof save.userCustomValues === "object" && save.userCustomValues) || {};

  const developer = data.developer || ext.developer || entity.brandOrCreator || userVals.developer || "Studio";
  const publisher = data.publisher || ext.publisher || userVals.publisher;
  const releaseYear = data.releaseYear || data.year || userVals.releaseYear || "2024";
  const genre = data.genre || ext.genre || userVals.genre || "Interactive";
  const playtimeHours = data.playtimeHours || ext.playtimeHours || userVals.playtimeHours;
  const esrbRating = data.esrbRating || ext.esrbRating || userVals.esrbRating || "M";

  // Platforms array handling
  let platforms: string[] = [];
  if (Array.isArray(data.platforms) && data.platforms.length > 0) {
    platforms = data.platforms;
  } else if (Array.isArray(ext.platforms) && ext.platforms.length > 0) {
    platforms = ext.platforms;
  } else if (typeof data.platforms === "string") {
    platforms = data.platforms.split(",").map((p: string) => p.trim());
  } else {
    platforms = ["PC", "PS5", "Switch"];
  }

  return (
    <div className="group relative rounded-2xl bg-neutral-950 text-white shadow-lg hover:shadow-2xl transition-all duration-300 border border-neutral-800/80 flex flex-col justify-between overflow-hidden">
      {/* Top Jewel Case Spine Band */}
      <div className="px-4 py-2 bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-800 border-b border-neutral-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Gamepad2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-300 truncate">
            {developer}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[9px] font-semibold text-neutral-400 bg-neutral-800/80 px-1.5 py-0.5 rounded border border-neutral-700/60">
            {releaseYear}
          </span>
          <span className="font-mono text-[9px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
            {esrbRating}
          </span>
        </div>
      </div>

      {/* Main Game Jewel Case Body */}
      <div className="p-4 flex-1 flex flex-col justify-between relative">
        <div>
          {/* Game Cover Art Stage with Jewel Case Gloss */}
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-neutral-900 mb-3 border border-neutral-800 flex items-center justify-center group-hover:border-indigo-500/30 transition-colors">
            {entity.heroImageUrl ? (
              <img
                src={entity.heroImageUrl}
                alt={entity.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-neutral-900 to-neutral-950">
                <Gamepad2 className="w-12 h-12 text-neutral-700 mb-2 group-hover:text-indigo-400 transition-colors" />
                <span className="font-sans font-bold text-sm tracking-tight text-neutral-400">
                  {entity.title}
                </span>
                <span className="text-[10px] font-mono text-neutral-600 mt-1">{genre}</span>
              </div>
            )}

            {/* Left Jewel Case Hinge Gloss Highlight */}
            <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />

            {/* Bottom floating Genre & Playtime pill */}
            <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
              <span className="px-2 py-0.5 rounded-lg bg-neutral-950/85 backdrop-blur-md text-[10px] font-mono font-medium text-neutral-300 border border-white/10 shadow-sm">
                {genre}
              </span>

              {playtimeHours && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-950/90 backdrop-blur-md text-[10px] font-mono font-semibold text-indigo-300 border border-indigo-700/50 shadow-sm">
                  <Clock className="w-3 h-3" />
                  ~{playtimeHours}h
                </span>
              )}
            </div>
          </div>

          {/* Title & Publisher */}
          <div className="mb-2.5">
            <h3 className="font-sans text-base font-bold tracking-tight text-white mb-0.5 line-clamp-1 group-hover:text-indigo-200 transition-colors">
              {entity.title}
            </h3>
            {publisher && publisher !== developer ? (
              <p className="text-[11px] font-mono text-neutral-400">
                Pub. {publisher}
              </p>
            ) : null}
          </div>

          {/* Platform Pills */}
          <div className="flex flex-wrap gap-1 mb-3">
            {platforms.map((plat) => (
              <span
                key={plat}
                className="text-[9px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800"
              >
                {plat}
              </span>
            ))}
          </div>

          {entity.summary && (
            <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed mb-3">
              {entity.summary}
            </p>
          )}
        </div>

        {/* Candidate Disambiguation Bar */}
        <div className="mb-2">
            <DisambiguationBar
              saveId={save.id}
              candidates={save.candidateFallbacks || []}
              onSwapped={() => onSwapped?.(save)}
            />
          </div>

        {/* Action Footer */}
        <div className="pt-2 border-t border-neutral-900">
          <CardFooterWaterfall
            entity={{
              ...entity,
              typePath: entity.typePath || "/media/videogame",
            }}
            primarySource={primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
            customUtilityLabel="Play on Steam"
          />
        </div>
      </div>
    </div>
  );
}
