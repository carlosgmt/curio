"use client";

import React, { useState } from "react";
import { Film, Play, Star, Clapperboard, Tv, ExternalLink, X } from "lucide-react";
import { buildAffiliateUrl } from "@/components/cards/CardFooterWaterfall";

export interface CulturalModeProps {
  save: any;
  entity: any;
  primarySource?: any;
}

export function CinemaCulturalMode({ save, entity, primarySource }: CulturalModeProps) {
  const [showTrailer, setShowTrailer] = useState(false);
  const data = (typeof entity?.coreStructuredData === "object" && entity?.coreStructuredData) || {};

  const director = data.director || entity?.brandOrCreator || "Visionary Director";
  const cinematographer = data.cinematographer || "35mm Color";
  const releaseYear = data.releaseYear || data.year || "2024";
  const runtime = data.runtimeMinutes ? `${data.runtimeMinutes} MIN` : "118 MIN";
  const distributor = data.distributor || "CURIO CINEMATHEQUE";
  const rating = data.tmdbRating || data.rating || "8.4";
  const trailerUrl = data.trailerUrl || "https://www.youtube.com/embed/dQw4w9WgXcQ";

  const streamPlatforms = [
    { name: "MUBI", url: "https://mubi.com", color: "bg-blue-600" },
    { name: "Apple TV", url: "https://tv.apple.com", color: "bg-neutral-800" },
    { name: "Google TV", url: "https://tv.google.com", color: "bg-red-600" },
  ];

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl">
      {/* 2:3 Theatrical Presentation Frame */}
      <div className="relative aspect-[2/3] w-full bg-neutral-900 overflow-hidden group">
        {entity?.heroImageUrl ? (
          <img
            src={entity.heroImageUrl}
            alt={entity.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-102"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-t from-black via-neutral-900 to-neutral-800">
            <Film className="w-12 h-12 text-neutral-600 mb-4" />
            <h2 className="font-serif text-3xl font-bold tracking-tight text-white mb-2">
              {entity?.title || "Untitled Film"}
            </h2>
            <p className="text-xs font-mono tracking-widest uppercase text-neutral-400">
              Directed by {director}
            </p>
          </div>
        )}

        {/* Gradient shadow overlay for typography */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent pointer-events-none" />

        {/* Rating and Trailer Badge */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-black/70 backdrop-blur-md border border-white/10 text-amber-400">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>{rating} TMDB</span>
          </span>

          <button
            type="button"
            onClick={() => setShowTrailer(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/90 hover:bg-white text-neutral-950 backdrop-blur-md shadow-lg transition active:scale-95 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current text-neutral-950" />
            <span>Watch Trailer</span>
          </button>
        </div>

        {/* Bottom Poster Title Overlay */}
        <div className="absolute bottom-4 left-5 right-5 z-10">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
            {distributor} • {runtime}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white mt-0.5 leading-tight">
            {entity?.title}
          </h2>
        </div>
      </div>

      {/* Criterion-Style Condensed Billing Block */}
      <div className="p-5 bg-neutral-950 border-t border-neutral-800/80 space-y-4">
        <div className="text-center font-mono text-[9px] uppercase tracking-widest text-neutral-400 leading-relaxed border border-neutral-800/60 p-2.5 rounded-xl bg-neutral-900/40">
          <p className="font-bold text-neutral-200">{distributor} PRESENTS A FILM DIRECTED BY {director.toUpperCase()}</p>
          <p>CINEMATOGRAPHY BY {cinematographer.toUpperCase()} • RELEASED IN {releaseYear} • RUNTIME {runtime}</p>
        </div>

        {/* Streaming Availability & CTAs */}
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold mb-2">
            Streaming & Digital Release
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {streamPlatforms.map((platform) => (
              <a
                key={platform.name}
                href={primarySource?.sourceUrl ? buildAffiliateUrl(primarySource.sourceUrl, platform.name) : platform.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-200 transition cursor-pointer"
              >
                <Tv className="w-3.5 h-3.5 text-neutral-400" />
                <span>{platform.name}</span>
                <ExternalLink className="w-2.5 h-2.5 text-neutral-500" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Trailer Modal Overlay */}
      {showTrailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl aspect-video rounded-3xl overflow-hidden bg-black border border-neutral-800 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowTrailer(false)}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/70 text-white hover:bg-black transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
              <Clapperboard className="w-12 h-12 text-neutral-600 mb-3 animate-pulse" />
              <p className="text-sm font-mono text-neutral-300">Theatrical Trailer Preview</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                Embedded trailer player for {entity?.title}. In production, links directly to official YouTube or Apple Trailers stream.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
