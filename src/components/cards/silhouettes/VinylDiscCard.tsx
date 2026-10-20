"use client";

import React, { useState } from "react";
import { Disc3 } from "lucide-react";
import { CardFooterWaterfall, type UserAffiliateTags } from "../CardFooterWaterfall";
import { DisambiguationBar, type CandidateFallback } from "../DisambiguationBar";

export interface SilhouetteCardProps {
  save: {
    id: string;
    isPrivateMemo?: boolean;
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
    <div className="group relative rounded-3xl bg-neutral-900 text-white p-5 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-neutral-800 flex flex-col justify-between overflow-hidden">
      {/* Ambient blurred cover glow */}
      {hasCover && (
        <div
          className="absolute inset-0 opacity-15 blur-2xl scale-110 pointer-events-none"
          style={{
            backgroundImage: `url(${entity.heroImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      {/* Top Header Badge */}
      <div className="flex items-center justify-between mb-4 z-10">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-wider uppercase text-neutral-300 bg-neutral-800/85 px-2.5 py-1 rounded-full border border-neutral-700/60 font-semibold">
          <Disc3 className="w-3.5 h-3.5 text-amber-400" />
          {badgeLabel}
        </span>
        {releaseYear && (
          <span className="text-[11px] font-mono text-neutral-400 font-medium">
            {releaseYear}
          </span>
        )}
      </div>

      {/* Centerpiece: Clean 1:1 Album Cover Art with subtle tactile border */}
      <div className="relative my-2 w-full flex items-center justify-center z-10">
        <div className="relative aspect-square w-full max-w-[240px] sm:max-w-[260px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-neutral-950 flex items-center justify-center">
          {hasCover ? (
            <img
              src={entity.heroImageUrl!}
              alt={entity.title}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-950 flex flex-col items-center justify-center p-6 text-center">
              <Disc3 className="w-12 h-12 text-amber-400/80 mb-3" />
              <span className="text-sm font-bold text-neutral-200 line-clamp-2">{entity.title}</span>
              <span className="text-xs text-neutral-400 mt-1 line-clamp-1">{artist}</span>
            </div>
          )}
          {/* Subtle tactile inner edge highlight */}
          <div className="absolute inset-0 ring-1 ring-inset ring-white/15 rounded-2xl pointer-events-none" />
        </div>
      </div>

      {/* Typography & Pressing Specifications */}
      <div className="mt-4 text-center z-10 space-y-1">
        <h3 className="text-base sm:text-lg font-bold text-neutral-100 tracking-tight leading-snug line-clamp-1">
          {entity.title}
        </h3>
        <p className="text-xs sm:text-sm text-neutral-300 font-medium line-clamp-1">
          {artist}
        </p>

        {/* Spec Strip: Year • Label • Track Count */}
        <div className="pt-1 flex items-center justify-center gap-2 text-[11px] font-mono text-neutral-400">
          {recordLabel && <span className="truncate max-w-[140px]">{recordLabel}</span>}
          {recordLabel && trackCount ? <span>•</span> : null}
          {trackCount ? <span>{trackCount} tracks</span> : null}
        </div>
      </div>

      {/* Discreet Wrong Entity Disambiguation */}
      {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
        <div className="mt-2 flex justify-center z-10">
          <DisambiguationBar
            saveId={save.id}
            candidates={save.candidateFallbacks}
            onSwapped={() => onSwapped?.(save)}
          />
        </div>
      )}

      {/* Standardized Dual-Slot Waterfall Footer with 3 Actions */}
      <div className="mt-3 pt-2 border-t border-neutral-800/80 z-10">
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: effectiveTypePath,
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Play on Spotify"
        />
      </div>
    </div>
  );
}

