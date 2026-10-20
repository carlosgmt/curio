"use client";

import React, { useState } from "react";
import { Disc3, Music2, Volume2 } from "lucide-react";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [imgError, setImgError] = useState(false);
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const artist = data.artist || entity.brandOrCreator || entity.summary || "Unknown Artist";
  const releaseYear = data.releaseYear || data.year || null;
  const effectiveTypePath = (save.typePath || entity.typePath || "/media/music/album").toLowerCase();
  const isSong = effectiveTypePath === "/media/music/song" || effectiveTypePath.endsWith("/song");
  const badgeLabel = isSong ? "Song" : "Album";
  const hasCover = Boolean(entity.heroImageUrl) && !imgError;

  return (
    <div className="group relative rounded-3xl bg-neutral-900 text-white p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-neutral-800 flex flex-col justify-between overflow-hidden">
      {/* Ambient blurred cover glow */}
      {hasCover && (
        <div
          className="absolute inset-0 opacity-20 blur-2xl scale-110 pointer-events-none"
          style={{
            backgroundImage: `url(${entity.heroImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      {/* Top Header Badge */}
      <div className="flex items-center justify-between mb-4 z-10">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-wider uppercase text-neutral-300 bg-neutral-800/85 px-2.5 py-0.5 rounded-full border border-neutral-700/60">
          <Disc3 className="w-3.5 h-3.5 text-amber-400" />
          {badgeLabel}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsPlaying(!isPlaying);
          }}
          className="text-neutral-400 hover:text-white p-1 rounded-full transition cursor-pointer"
          title={isPlaying ? "Stop Needle" : "Drop Needle"}
        >
          {isPlaying ? <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" /> : <Music2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Centerpiece: Square Album Cover Sleeve + Peeking Grooved Vinyl Disc */}
      <div
        className="relative my-3 flex items-center justify-center z-10 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setIsPlaying(!isPlaying);
        }}
      >
        <div className="relative flex items-center justify-center pr-10 sm:pr-12">
          {/* Square Album Jacket Sleeve */}
          <div className="relative z-20 w-36 h-36 sm:w-44 sm:h-44 rounded-xl overflow-hidden shadow-2xl border border-white/15 bg-neutral-800 shrink-0">
            {hasCover ? (
              <img
                src={entity.heroImageUrl!}
                alt={entity.title}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-950 flex flex-col items-center justify-center p-4 text-center">
                <Disc3 className="w-10 h-10 text-amber-400/80 mb-2" />
                <span className="text-xs font-bold text-neutral-200 line-clamp-2">{entity.title}</span>
                <span className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">{artist}</span>
              </div>
            )}
            {/* Subtle spine highlight */}
            <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-white/25 to-transparent pointer-events-none" />
          </div>

          {/* Peeking Grooved Vinyl Record */}
          <div
            className={`absolute right-0 z-10 w-32 h-32 sm:w-40 sm:h-40 rounded-full shadow-2xl transition-all duration-700 ease-out flex items-center justify-center border-2 border-neutral-950 translate-x-4 sm:translate-x-5 group-hover:translate-x-7 ${
              isPlaying ? "animate-[spin_4s_linear_infinite] translate-x-8" : ""
            }`}
            style={{
              background:
                "repeating-radial-gradient(circle at center, #141414 0, #141414 3px, #262626 4px, #0a0a0a 5px, #1f1f1f 7px)",
            }}
          >
            {/* Subtle light reflection on grooves */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />

            {/* Vinyl Center Label (shows actual cover art when available without opaque overlay) */}
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-inner overflow-hidden border border-amber-300/80">
              {hasCover ? (
                <img
                  src={entity.heroImageUrl!}
                  alt={entity.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : null}
              {/* Spindle hole */}
              <div className="relative z-10 w-3 h-3 rounded-full bg-neutral-950 border border-white/20 shadow-inner" />
            </div>
          </div>
        </div>
      </div>

      {/* Typography & Details */}
      <div className="mt-3 text-center z-10">
        <h3 className="text-base font-bold text-neutral-100 tracking-tight leading-snug line-clamp-1">
          {entity.title}
        </h3>
        <p className="text-xs text-neutral-400 font-medium mt-0.5 line-clamp-1">
          {artist} {releaseYear ? `• ${releaseYear}` : ""}
        </p>
      </div>

      {/* FR-2.3 1-Tap Candidate Disambiguation */}
      {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
        <div className="mt-2 z-10">
          <DisambiguationBar
            saveId={save.id}
            candidates={save.candidateFallbacks}
            onSwapped={() => onSwapped?.(save)}
          />
        </div>
      )}

      {/* Standardized Dual-Slot Waterfall Footer */}
      <div className="z-10">
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

