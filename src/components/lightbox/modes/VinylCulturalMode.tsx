"use client";

import React, { useState } from "react";
import { Disc3, Music2, Volume2, ShoppingBag, ExternalLink, Play, Pause } from "lucide-react";
import type { CulturalModeProps } from "./CinemaCulturalMode";
import { buildAffiliateUrl } from "@/components/cards/CardFooterWaterfall";

interface Track {
  number?: string | number;
  title: string;
  duration?: string;
}

export function VinylCulturalMode({ save, entity, primarySource }: CulturalModeProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const data = (typeof entity?.coreStructuredData === "object" && entity?.coreStructuredData) || {};

  const artist = data.artist || entity?.brandOrCreator || "Unknown Artist";
  const releaseYear = data.releaseYear || data.year || "33 ⅓ RPM";
  const rpm = data.rpm || "33 ⅓ RPM";
  const recordLabel = data.recordLabel || data.label || "Curio Pressed Recordings";
  const catalogNumber = data.catalogNumber || "CR-1049";

  const defaultTracklist: Track[] = [
    { number: "A1", title: "Opening Movement", duration: "5:24" },
    { number: "A2", title: "Theme in Reverie", duration: "4:12" },
    { number: "A3", title: "Midnight Soliloquy", duration: "6:48" },
    { number: "B1", title: "Cadence of Shadows", duration: "5:03" },
    { number: "B2", title: "Acoustic Reprise", duration: "7:15" },
  ];

  const tracks: Track[] = Array.isArray(data.tracklist) && data.tracklist.length > 0
    ? data.tracklist
    : defaultTracklist;

  const vinylStoreUrl = primarySource?.sourceUrl
    ? buildAffiliateUrl(primarySource.sourceUrl, primarySource.sellerName)
    : "https://www.discogs.com";

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl">
      {/* Turntable Plinth Stage */}
      <div className="relative p-8 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 flex flex-col items-center justify-center overflow-hidden border-b border-neutral-800/80">
        {/* Needle Drop Arm (Visual) */}
        <div
          className={`absolute top-6 right-8 w-2 h-36 origin-top bg-gradient-to-b from-neutral-400 to-amber-400 rounded-full shadow-2xl transition-transform duration-700 pointer-events-none z-20 ${
            isPlaying ? "rotate-20" : "-rotate-12 opacity-70"
          }`}
        >
          <div className="w-4 h-6 -ml-1 mt-32 rounded bg-neutral-900 border border-amber-300 shadow-md" />
        </div>

        {/* 12" Physical Grooved Vinyl Disc */}
        <div
          onClick={() => setIsPlaying(!isPlaying)}
          className={`relative w-56 h-56 sm:w-64 sm:h-64 rounded-full shadow-2xl transition-transform duration-700 ease-out flex items-center justify-center cursor-pointer border-4 border-neutral-950 ${
            isPlaying ? "animate-[spin_4s_linear_infinite]" : "hover:rotate-6"
          }`}
          style={{
            background:
              "repeating-radial-gradient(circle at center, #171717 0, #171717 3px, #262626 4px, #0a0a0a 5px, #1f1f1f 7px)",
          }}
          title={isPlaying ? "Stop Turntable" : "Drop Needle"}
        >
          {/* Subtle light reflection on grooves */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

          {/* Center Label Plaque */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-amber-500 text-neutral-950 p-2 flex flex-col items-center justify-center text-center shadow-inner overflow-hidden border-2 border-amber-300">
            {entity?.heroImageUrl ? (
              <img
                src={entity.heroImageUrl}
                alt={entity.title}
                className="absolute inset-0 w-full h-full object-cover opacity-85"
              />
            ) : null}
            <div className="relative z-10 bg-amber-500/90 rounded-full p-2 w-full h-full flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-tight line-clamp-1">
                {artist}
              </span>
              <span className="text-[8px] font-mono text-neutral-800">
                {releaseYear} • {rpm}
              </span>
              {/* Spindle hole */}
              <div className="w-4 h-4 rounded-full bg-neutral-950 border border-neutral-800 shadow-inner mt-1" />
            </div>
          </div>
        </div>

        {/* Play / Needle Trigger */}
        <div className="mt-6 flex items-center gap-3 z-10">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-white text-neutral-950 hover:bg-neutral-100 transition shadow-md active:scale-95 cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Lift Tonearm</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Drop Needle</span>
              </>
            )}
          </button>

          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-400 bg-neutral-900/80 px-3 py-1.5 rounded-full border border-neutral-800">
            <Disc3 className="w-3.5 h-3.5 text-amber-400" />
            <span>{rpm}</span>
          </span>
        </div>
      </div>

      {/* Tracklist Inspector & Pressing Specs */}
      <div className="p-5 space-y-4 flex-1 overflow-y-auto">
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-2">
            Tracklist ({tracks.length} Tracks)
          </span>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
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

        {/* Pressing Specs & Merchant CTAs */}
        <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="font-mono text-[10px] text-neutral-400 space-y-0.5">
            <p>LABEL: <strong className="text-neutral-300">{recordLabel}</strong></p>
            <p>CATALOG: <strong className="text-neutral-300">{catalogNumber}</strong></p>
          </div>

          <a
            href={vinylStoreUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition cursor-pointer shadow-md"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Find Vinyl LP Pressing</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
          </a>
        </div>
      </div>
    </div>
  );
}
