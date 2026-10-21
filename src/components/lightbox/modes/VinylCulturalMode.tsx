"use client";

import React from "react";
import { Disc3 } from "lucide-react";
import type { CulturalModeProps } from "./CinemaCulturalMode";
import { CardFooterWaterfall } from "@/components/cards/CardFooterWaterfall";

interface Track {
  number?: string | number;
  title: string;
  duration?: string;
}

export function VinylCulturalMode({ save, entity, primarySource, creatorAffiliateTags }: CulturalModeProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity?.coreStructuredData) || {};

  const artist = data.artist || entity?.brandOrCreator || "Unknown Artist";
  const recordLabel = data.recordLabel || data.label || "Curio Pressed Recordings";
  const catalogNumber = data.catalogNumber || "CR-1049";

  const tracks: Track[] = Array.isArray(data.tracklist) ? data.tracklist : [];

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl">
      {/* Turntable Plinth & Album Cover Jacket Stage */}
      <div className="relative p-6 sm:p-8 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 flex flex-col items-center justify-center overflow-hidden border-b border-neutral-800/80">
        {/* Album Jacket + Grooved Vinyl Disc */}
        <div
          className="relative flex items-center justify-center w-full max-w-[300px] h-52 sm:h-56"
        >
          {/* Square Album Cover Jacket Sleeve */}
          <div className="relative z-20 w-44 h-44 sm:w-48 sm:h-48 -ml-10 rounded-xl overflow-hidden shadow-2xl border border-white/15 bg-neutral-900 shrink-0">
            {entity?.heroImageUrl ? (
              <img
                src={entity.heroImageUrl}
                alt={entity.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-neutral-800 via-neutral-900 to-amber-950/60 p-4 flex flex-col justify-between">
                <Disc3 className="w-6 h-6 text-amber-400/80" />
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400/90 truncate">
                    {artist}
                  </p>
                  <p className="text-sm font-serif font-bold text-white line-clamp-2 leading-snug mt-0.5">
                    {entity?.title}
                  </p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10 pointer-events-none" />
          </div>

          {/* 12" Physical Grooved Vinyl Disc peeking from sleeve */}
          <div
            className={`relative z-10 -ml-20 w-44 h-44 sm:w-48 sm:h-48 rounded-full shadow-2xl transition-transform duration-700 ease-out flex items-center justify-center border-4 border-neutral-950 shrink-0 hover:translate-x-3 hover:rotate-6`}
            style={{
              background:
                "repeating-radial-gradient(circle at center, #171717 0, #171717 3px, #262626 4px, #0a0a0a 5px, #1f1f1f 7px)",
            }}
          >
            {/* Subtle light reflection on grooves */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />

            {/* Center Label Plaque */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500 text-neutral-950 p-1.5 flex flex-col items-center justify-center text-center shadow-inner overflow-hidden border-2 border-amber-300">
              {entity?.heroImageUrl ? (
                <>
                  <img
                    src={entity.heroImageUrl}
                    alt={entity.title}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="relative z-10 w-3.5 h-3.5 rounded-full bg-neutral-950 border border-white/40 shadow-inner" />
                </>
              ) : (
                <div className="relative z-10 rounded-full p-1 w-full h-full flex flex-col items-center justify-center">
                  <span className="text-[8px] font-bold uppercase tracking-tight line-clamp-1">
                    {artist}
                  </span>
                  <div className="w-3.5 h-3.5 rounded-full bg-neutral-950 border border-neutral-800 shadow-inner mt-0.5" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tracklist Inspector & Pressing Specs */}
      <div className="p-5 space-y-4 flex-1 overflow-y-auto flex flex-col justify-between">
        {tracks.length > 0 ? (
          <div>
            <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-2">
              Tracklist ({tracks.length} Tracks)
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {tracks.map((track, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800/60 text-xs transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-[10px] text-amber-400 font-bold w-5 shrink-0">
                      {track.number || `A${i + 1}`}
                    </span>
                    <span className="font-medium text-neutral-200 truncate">{track.title}</span>
                  </div>
                  {track.duration && (
                    <span className="font-mono text-[10px] text-neutral-500 shrink-0">
                      {track.duration}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 space-y-2">
            <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
              Album Liner Notes
            </span>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {entity?.summary || `Full studio recording release by ${artist}.`}
            </p>
          </div>
        )}

        {/* Pressing Specs & 3-Action Providers */}
        <div className="pt-3 border-t border-neutral-800 space-y-2">
          <div className="flex items-center justify-between font-mono text-[10px] text-neutral-400">
            <span>LABEL: <strong className="text-neutral-300">{recordLabel}</strong></span>
            <span>CATALOG: <strong className="text-neutral-300">{catalogNumber}</strong></span>
          </div>

          {entity && (
            <div className="bg-white/95 dark:bg-neutral-900 rounded-xl px-3 py-1 text-neutral-900 dark:text-neutral-100">
              <CardFooterWaterfall
                entity={entity}
                primarySource={primarySource}
                creatorAffiliateTags={creatorAffiliateTags}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
