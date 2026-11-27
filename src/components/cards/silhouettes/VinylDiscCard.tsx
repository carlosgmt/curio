"use client";

import React, { useState } from "react";
import { Disc3 } from "lucide-react";
import { CardFooterWaterfall, type UserAffiliateTags } from "../CardFooterWaterfall";
import { DisambiguationBar, type CandidateFallback } from "../DisambiguationBar";

export interface SilhouetteCardProps {
  save: {
    id: string;
    isPrivateMemo?: boolean;
    wishlist?: boolean | null;
    personalNotes?: string | null;
    userCustomValues?: any;
    typePath?: string | null;
    candidateFallbacks?: CandidateFallback[] | null;
    createdAt: string | Date;
  };
  entity: {
    id: string;
    title: string;
    summary?: string | null;
    heroImageUrl?: string | null;
    coreType: string;
    typePath?: string | null;
    brandOrCreator?: string | null;
    canonicalUrl: string;
    priceCents?: number | null;
    currency?: string | null;
    ucpSkuId?: string | null;
    coreStructuredData?: any;
    extendedAttributes?: any;
  };
  primarySource?: any;
  creatorAffiliateTags?: UserAffiliateTags | null;
  wearLinkCount?: number;
  onSwapped?: (item: any) => void;
}

export function VinylDiscCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const [imgError, setImgError] = useState(false);
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const artist = data.artist || entity.brandOrCreator || entity.summary || "Unknown Artist";
  const releaseYear = data.releaseYear || data.year || null;
  const recordLabel = data.recordLabel || data.label || null;
  const trackCount = data.trackCount || (Array.isArray(data.tracklist) ? data.tracklist.length : null);
  const effectiveTypePath = (save.typePath || entity.typePath || "/media/music/album").toLowerCase();
  const isSong = effectiveTypePath === "/media/music/song" || effectiveTypePath.endsWith("/song");
  const badgeLabel = isSong ? "SONG" : "ALBUM";
  const hasCover = Boolean(entity.heroImageUrl) && !imgError;

  return (
    <div className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden">
      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        {/* Clean 1:1 Album Sleeve Well */}
        <div className="relative aspect-square w-full rounded-[8px] overflow-hidden bg-[var(--well-surface)] flex items-center justify-center mb-3">
          {hasCover ? (
            <img
              src={entity.heroImageUrl!}
              alt={entity.title}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#181715] text-[#F2EFE9]">
              <Disc3 className="w-10 h-10 text-[#4CA382] mb-2" />
              <span className="font-serif-editorial text-sm line-clamp-2">{entity.title}</span>
              <span className="text-xs text-[#A8A196] mt-1 line-clamp-1">{artist}</span>
            </div>
          )}
        </div>

        {/* Museum Label */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-[15px] font-medium text-foreground leading-snug line-clamp-1">
              {entity.title}
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {[artist, recordLabel].filter(Boolean).join(" · ")}
            </p>
          </div>
          {(releaseYear || trackCount) && (
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
              {[releaseYear, trackCount ? `${trackCount} trk` : badgeLabel].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>

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

      {/* Hover/Focus-Revealed Waterfall Footer */}
      <div className="curio-hover-footer">
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: effectiveTypePath,
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Play on Spotify"
          isWishlist={Boolean(save.wishlist)}
        />
      </div>
    </div>
  );
}

