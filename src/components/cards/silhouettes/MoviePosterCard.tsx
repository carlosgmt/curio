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
  const rawDirector = typeof data.director === "string" ? data.director.trim() : "";
  const director =
    rawDirector && !/^(?:unknown|visionary)\s+director$/i.test(rawDirector) ? rawDirector : null;
  const releaseYear = data.releaseYear || data.year;
  const runtime = data.runtimeMinutes ? `${data.runtimeMinutes} MIN` : null;
  const rawCinematographer =
    typeof data.cinematographer === "string" ? data.cinematographer.trim() : "";
  const cinematographer =
    rawCinematographer && !/^35mm\s+color$/i.test(rawCinematographer) ? rawCinematographer : null;
  const rawDistributor = typeof data.distributor === "string" ? data.distributor.trim() : "";
  const distributor =
    rawDistributor && !/^(?:curio\s+)?cinematheque$/i.test(rawDistributor) ? rawDistributor : null;

  const hasBillingBlock = Boolean(director || runtime || cinematographer || distributor);

  return (
    <div className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden">
      <div className="p-3 sm:p-3.5 flex flex-col flex-1">
        {/* 2:3 Poster Frame Inside Gallery Mount */}
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[8px] bg-[#161513]">
          {entity.heroImageUrl ? (
            <img
              src={entity.heroImageUrl}
              alt={entity.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#F2EFE9]">
              <Clapperboard className="w-10 h-10 text-[#C89572] mb-3" />
              <span className="font-serif-editorial text-lg tracking-wide">
                {entity.title}
              </span>
            </div>
          )}

          {releaseYear ? (
            <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md text-white text-[10px] font-mono tabular-nums px-2 py-0.5 rounded border border-white/15 tracking-wider">
              {releaseYear}
            </div>
          ) : null}
        </div>

        {/* Clean Museum Caption Below Poster */}
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-serif-editorial text-base sm:text-[17px] font-medium tracking-tight text-foreground leading-snug line-clamp-2">
              {entity.title}
            </h3>
            {runtime && (
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
                {runtime}
              </span>
            )}
          </div>
          {hasBillingBlock && (director || cinematographer || distributor) && (
            <p className="text-xs font-mono text-muted-foreground mt-1 truncate">
              {[
                director ? `DIR. ${director}` : null,
                cinematographer ? `PHOTO: ${cinematographer}` : null,
                distributor,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        {/* Disambiguation fallback bar if candidate runner-ups exist */}
        {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
          <div className="mt-2">
            <DisambiguationBar
              saveId={save.id}
              candidates={save.candidateFallbacks}
              onSwapped={() => onSwapped?.(save)}
            />
          </div>
        )}
      </div>

      {/* Hover/Focus-Revealed Action Footer */}
      <div className="curio-hover-footer">
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/media/film",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Watch Film"
          isWishlist={Boolean(save.wishlist)}
        />
      </div>
    </div>
  );
}
