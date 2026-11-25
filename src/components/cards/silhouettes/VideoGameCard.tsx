"use client";

import React from "react";
import { Gamepad2, Clock } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

const MAX_PLATFORM_PILLS = 3;

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

  const developer =
    data.developer || ext.developer || entity.brandOrCreator || userVals.developer || "Game";
  const publisher = data.publisher || ext.publisher || userVals.publisher || null;
  const releaseYear = data.releaseYear || data.year || userVals.releaseYear || null;
  const genre = data.genre || ext.genre || userVals.genre || null;
  const playtimeHours = data.playtimeHours || ext.playtimeHours || userVals.playtimeHours || null;
  const esrbRating = data.esrbRating || ext.esrbRating || userVals.esrbRating || null;

  let platforms: string[] = [];
  if (Array.isArray(data.platforms) && data.platforms.length > 0) {
    platforms = data.platforms.filter(Boolean);
  } else if (Array.isArray(ext.platforms) && ext.platforms.length > 0) {
    platforms = ext.platforms.filter(Boolean);
  } else if (typeof data.platforms === "string" && data.platforms.trim()) {
    platforms = data.platforms.split(",").map((p: string) => p.trim()).filter(Boolean);
  }

  const visiblePlatforms = platforms.slice(0, MAX_PLATFORM_PILLS);
  const overflowPlatforms = Math.max(0, platforms.length - visiblePlatforms.length);

  return (
    <div
      data-testid="videogame-card"
      className="group relative rounded-2xl bg-neutral-950 text-white shadow-lg hover:shadow-xl transition-shadow duration-200 border border-neutral-800/80 flex flex-col justify-between overflow-hidden"
    >
      {/* Top Jewel Case Spine Band */}
      <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-800/80 flex items-center justify-between gap-2 pr-16 sm:pr-4">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Gamepad2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-300 truncate">
            {developer}
          </span>
        </div>

        {(releaseYear || esrbRating) && (
          <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
            {releaseYear && (
              <span className="font-mono text-[10px] text-neutral-400">
                {releaseYear}
              </span>
            )}
            {esrbRating && (
              <span className="font-mono text-[9px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
                {esrbRating}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Game Jewel Case Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between relative">
        <div>
          {/* Game Cover Art Stage */}
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-neutral-900 mb-3 border border-neutral-800 flex items-center justify-center group-hover:border-indigo-500/30 transition-colors">
            {entity.heroImageUrl ? (
              <img
                src={entity.heroImageUrl}
                alt={entity.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-103"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-neutral-900 to-neutral-950">
                <Gamepad2 className="w-12 h-12 text-neutral-700 mb-2 group-hover:text-indigo-400 transition-colors" aria-hidden="true" />
                <span className="font-sans font-bold text-sm tracking-tight text-neutral-400">
                  {entity.title}
                </span>
                {genre && <span className="text-[10px] font-mono text-neutral-500 mt-1">{genre}</span>}
              </div>
            )}

            <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />

            {(genre || playtimeHours) && (
              <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
                {genre ? (
                  <span className="px-2 py-0.5 rounded-lg bg-neutral-950/85 backdrop-blur-md text-[10px] font-mono font-medium text-neutral-300 border border-white/10 shadow-sm">
                    {genre}
                  </span>
                ) : (
                  <span />
                )}

                {playtimeHours && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-950/90 backdrop-blur-md text-[10px] font-mono tabular-nums font-semibold text-indigo-300 border border-indigo-700/50 shadow-sm">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    ~{playtimeHours}h
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Title & Publisher */}
          <div className="mb-2">
            <h3 className="font-sans text-base font-bold tracking-tight text-white mb-0.5 line-clamp-1 group-hover:text-neutral-200 transition-colors">
              {entity.title}
            </h3>
            {publisher && publisher !== developer && (
              <p className="text-[11px] font-mono text-neutral-400">
                Pub. {publisher}
              </p>
            )}
          </div>

          {/* Platform Pills (only when real platforms exist, capped to 3 + N) */}
          {visiblePlatforms.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mb-2.5">
              {visiblePlatforms.map((plat) => (
                <span
                  key={plat}
                  className="text-[9px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800"
                >
                  {plat}
                </span>
              ))}
              {overflowPlatforms > 0 && (
                <span className="text-[10px] font-mono tabular-nums text-neutral-400">
                  +{overflowPlatforms}
                </span>
              )}
            </div>
          )}

          {entity.summary && (
            <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed mb-2">
              {entity.summary}
            </p>
          )}
        </div>

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={() => onSwapped?.(save)}
        />

        {/* Action Footer */}
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/media/videogame",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Play on Steam"
          isWishlist={Boolean(save.wishlist)}
          tone="dark"
          flush
        />
      </div>
    </div>
  );
}
