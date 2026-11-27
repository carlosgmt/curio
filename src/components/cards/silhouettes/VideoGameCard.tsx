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
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Cover Art Stage */}
          <div className="relative aspect-[3/3.6] w-full overflow-hidden rounded-[8px] bg-[#161513] mb-3 flex items-center justify-center">
            {entity.heroImageUrl ? (
              <img
                src={entity.heroImageUrl}
                alt={entity.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#F2EFE9]">
                <Gamepad2 className="w-10 h-10 text-[#C89572] mb-2" aria-hidden="true" />
                <span className="font-serif-editorial text-sm">{entity.title}</span>
              </div>
            )}
          </div>

          {/* Caption */}
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm sm:text-[15px] font-medium text-foreground line-clamp-1">
              {entity.title}
            </h3>
            {releaseYear && (
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0">
                {releaseYear}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {[developer, publisher && publisher !== developer ? publisher : null, genre, playtimeHours ? `~${playtimeHours}h` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {/* Platform Pills (capped to 3 + N) */}
          {visiblePlatforms.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-2">
              {visiblePlatforms.map((plat) => (
                <span
                  key={plat}
                  className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--well-surface)] text-muted-foreground border border-[var(--gallery-hairline)]"
                >
                  {plat}
                </span>
              ))}
              {overflowPlatforms > 0 && (
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                  +{overflowPlatforms}
                </span>
              )}
            </div>
          )}
        </div>

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={() => onSwapped?.(save)}
        />
      </div>

      {/* Hover/Focus-Revealed Footer */}
      <div className="curio-hover-footer">
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/media/videogame",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Play on Steam"
          isWishlist={Boolean(save.wishlist)}
        />
      </div>
    </div>
  );
}
