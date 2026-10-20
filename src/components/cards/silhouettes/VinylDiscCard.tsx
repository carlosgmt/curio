"use client";

import React, { useState } from "react";
import { Disc3, Music2, Sparkles, Volume2 } from "lucide-react";
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
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const artist = data.artist || entity.summary || "Unknown Artist";
  const releaseYear = data.releaseYear || data.year || "33 ⅓ RPM";

  return (
    <div className="group relative rounded-3xl bg-neutral-900 text-white p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-neutral-800 flex flex-col justify-between overflow-hidden">
      {/* Top Header Badge */}
      <div className="flex items-center justify-between mb-4 z-10">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-wider uppercase text-neutral-400 bg-neutral-800/80 px-2.5 py-0.5 rounded-full border border-neutral-700/50">
          <Disc3 className="w-3.5 h-3.5 text-amber-400" />
          Vinyl LP
        </span>
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="text-neutral-400 hover:text-white p-1 rounded-full transition cursor-pointer"
          title={isPlaying ? "Stop Needle" : "Drop Needle"}
        >
          {isPlaying ? <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" /> : <Music2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Centerpiece: Physical Grooved Vinyl Disc */}
      <div className="relative my-4 flex items-center justify-center">
        <div
          className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-full shadow-2xl transition-transform duration-700 ease-out flex items-center justify-center cursor-pointer border-4 border-neutral-950 ${
            isPlaying ? "animate-[spin_4s_linear_infinite]" : "group-hover:rotate-12"
          }`}
          style={{
            background:
              "repeating-radial-gradient(circle at center, #171717 0, #171717 3px, #262626 4px, #0a0a0a 5px, #1f1f1f 7px)",
          }}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {/* Subtle light reflection on grooves */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

          {/* Center Label */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-500 text-neutral-950 p-2 flex flex-col items-center justify-center text-center shadow-inner overflow-hidden border border-amber-300">
            {entity.heroImageUrl ? (
              <img
                src={entity.heroImageUrl}
                alt={entity.title}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-85"
              />
            ) : null}
            <div className="relative z-10 bg-amber-500/90 rounded-full p-1 w-full h-full flex flex-col items-center justify-center">
              <span className="text-[9px] font-bold uppercase tracking-tight line-clamp-1">
                {artist}
              </span>
              <span className="text-[7px] font-mono text-neutral-800">
                {releaseYear}
              </span>
              {/* Spindle hole */}
              <div className="w-3.5 h-3.5 rounded-full bg-neutral-950 border border-neutral-800 shadow-inner mt-0.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Typography & Details */}
      <div className="mt-2 text-center z-10">
        <h3 className="text-base font-bold text-neutral-100 tracking-tight leading-snug line-clamp-1">
          {entity.title}
        </h3>
        <p className="text-xs text-neutral-400 font-medium mt-0.5 line-clamp-1">
          {artist} {data.releaseYear ? `• ${data.releaseYear}` : ""}
        </p>
      </div>

      {/* FR-2.3 1-Tap Candidate Disambiguation */}
      {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
        <div className="mt-2">
          <DisambiguationBar
            saveId={save.id}
            candidates={save.candidateFallbacks}
            onSwapped={() => onSwapped?.(save)}
          />
        </div>
      )}

      {/* Standardized Dual-Slot Waterfall Footer */}
      <CardFooterWaterfall
        entity={{
          ...entity,
          typePath: entity.typePath || "/media/music/vinyl",
        }}
        primarySource={primarySource}
        creatorAffiliateTags={creatorAffiliateTags}
        customUtilityLabel="Play on Spotify"
      />
    </div>
  );
}
