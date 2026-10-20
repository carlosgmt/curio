"use client";

import React from "react";
import { Film, Clapperboard, Star } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function MoviePosterCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const director = data.director;
  const releaseYear = data.releaseYear || data.year;
  const runtime = data.runtimeMinutes ? `${data.runtimeMinutes} MIN` : null;
  const cinematographer = data.cinematographer;
  const distributor = data.distributor;

  const hasBillingBlock = Boolean(director || runtime || cinematographer || distributor);

  return (
    <div className="group relative rounded-2xl bg-neutral-950 text-white shadow-lg hover:shadow-2xl transition-all duration-300 border border-neutral-800/80 flex flex-col justify-between overflow-hidden">
      {/* 2:3 Cinematic Poster Frame */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-900">
        {entity.heroImageUrl ? (
          <img
            src={entity.heroImageUrl}
            alt={entity.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-950 p-6 text-center">
            <Clapperboard className="w-12 h-12 text-neutral-600 mb-3" />
            <span className="font-serif text-lg tracking-widest uppercase text-neutral-400">
              {entity.title}
            </span>
          </div>
        )}

        {/* Criterion Collection inspired corner glyph */}
        {releaseYear ? (
          <div className="absolute top-3 left-3 bg-neutral-950/80 backdrop-blur-md text-white text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-white/20 tracking-wider">
            № {releaseYear}
          </div>
        ) : null}

        {/* Bottom vignette gradient for billing block readability */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent flex flex-col justify-end p-4">
          <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white mb-1 drop-shadow-md">
            {entity.title}
          </h3>

          {entity.summary ? (
            <p className="text-xs text-neutral-300 font-sans tracking-wide mb-3 line-clamp-2 drop-shadow-sm">
              {entity.summary}
            </p>
          ) : null}

          {/* Authentic Criterion-Style Billing Block (rendered only if metadata exists) */}
          {hasBillingBlock && (
            <div className="border-t border-white/20 pt-2 text-[8px] font-mono uppercase tracking-widest text-neutral-400 space-y-0.5">
              {(director || runtime) && (
                <div className="flex justify-between items-center text-white/90 font-medium">
                  <span>{director ? `DIR. ${director}` : ""}</span>
                  <span>{runtime || ""}</span>
                </div>
              )}
              {(cinematographer || distributor) && (
                <div className="flex justify-between items-center text-neutral-400 text-[7.5px]">
                  <span>{cinematographer ? `PHOTO: ${cinematographer}` : ""}</span>
                  <span>{distributor || ""}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Disambiguation fallback bar if candidate runner-ups exist */}
      {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
        <div className="px-4 pt-2">
          <DisambiguationBar
            saveId={save.id}
            candidates={save.candidateFallbacks}
            onSwapped={() => onSwapped?.(save)}
          />
        </div>
      )}

      {/* Action Footer */}
      <div className="p-3 bg-neutral-950 border-t border-neutral-900">
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/media/film",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Watch Film"
        />
      </div>
    </div>
  );
}
