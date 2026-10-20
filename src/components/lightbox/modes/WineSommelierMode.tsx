"use client";

import React, { useState, useEffect } from "react";
import {
  Wine,
  Thermometer,
  Clock,
  Calendar,
  Sparkles,
  MapPin,
  UtensilsCrossed,
  Award,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import type { CulturalModeProps } from "./CinemaCulturalMode";

export function WineSommelierMode({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
}: CulturalModeProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity?.coreStructuredData) || {};
  const producer = data.producer || entity?.brandOrCreator || "Domaine Grand Cru";
  const cuvee = data.cuvee || entity?.title || "Cuvée Spéciale";
  const vintage = data.vintage || "2018";
  const appellation = data.appellation || "Appellation d'Origine Contrôlée";
  const region = data.region ? `${data.region}, ${data.country || "France"}` : "Burgundy, France";
  const varietal = data.varietal || "100% Pinot Noir";

  // Sommelier Tasting Radar Specs
  const radar = data.tastingRadar || {
    tannin: data.tannin ?? 7,
    acidity: data.acidity ?? 8,
    body: data.body ?? 7,
    fruit: data.fruit ?? 8,
    minerality: data.minerality ?? 9,
    oak: data.oak ?? 6,
  };

  // Temperature, Decanting & Cellaring
  const servingTemp = data.servingTemp || "16°C – 18°C (61°F – 64°F)";
  const decantingMinutes = data.decantingMinutes || 45;
  const drinkingWindow = data.drinkingWindow || `${Number(vintage) + 4} – ${Number(vintage) + 18}`;
  const terroir = data.terroir || "Kimmeridgian limestone clay with steep south-facing exposure.";
  const pairings = data.cellarPairings || [
    "Roasted duck breast with morel reduction",
    "Aged 36-month Comté cheese",
    "Wild chanterelle risotto",
  ];

  // Interactive Decanting Timer
  const [secondsRemaining, setSecondsRemaining] = useState(decantingMinutes * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (timerRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (secondsRemaining === 0) {
      setTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [timerRunning, secondsRemaining]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      data-testid="wine-sommelier-mode"
      className="flex flex-col h-full bg-[#181514] text-stone-100 rounded-3xl overflow-y-auto border border-stone-800 shadow-2xl p-6"
    >
      {/* Header Crest */}
      <div className="flex items-start justify-between pb-4 border-b border-stone-800/80 mb-5">
        <div>
          <div className="flex items-center gap-1.5 text-amber-500/90 text-xs font-mono uppercase tracking-widest mb-1">
            <Wine className="w-4 h-4" />
            <span>Sommelier Lightbox Stage</span>
          </div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-stone-50">
            {producer}
          </h2>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="font-serif text-lg text-stone-200">{cuvee}</span>
            <span className="font-serif text-lg italic text-amber-500 font-semibold">{vintage}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-400 font-mono mt-1">
            <MapPin className="w-3.5 h-3.5 text-stone-500" />
            <span>{appellation} • {region}</span>
          </div>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
          <Award className="w-6 h-6 stroke-[1.5]" />
        </div>
      </div>

      {/* Sommelier Tasting Radar & Radar Metrics */}
      <div className="mb-6 p-4 rounded-2xl bg-stone-900/60 border border-stone-800/80">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400/90 font-bold">
            Sommelier Tasting Radar
          </span>
          <span className="text-[10px] font-mono text-stone-400">{varietal}</span>
        </div>

        <div data-testid="tasting-radar-grid" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(radar).map(([metric, score]) => (
            <div key={metric} className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800">
              <div className="flex justify-between items-center text-[10px] font-mono uppercase text-stone-400 mb-1">
                <span>{metric}</span>
                <span className="text-amber-400 font-bold">{String(score)}/10</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden">
                <div
                  data-testid={`radar-bar-${metric}`}
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full"
                  style={{ width: `${(Number(score) / 10) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sommelier Service Telemetry: Temp, Decant, Window */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {/* Serving Temperature */}
        <div data-testid="serving-temperature" className="p-3.5 rounded-2xl bg-stone-900/60 border border-stone-800 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-amber-400/80 font-mono uppercase mb-2">
            <Thermometer className="w-4 h-4 text-rose-400" />
            <span>Serving Temp</span>
          </div>
          <div className="font-mono text-sm font-bold text-stone-100">
            {servingTemp}
          </div>
          <span className="text-[10px] text-stone-500 mt-1">Slight cellar chill</span>
        </div>

        {/* Decanting Timer Guide */}
        <div data-testid="decanting-guide" className="p-3.5 rounded-2xl bg-stone-900/60 border border-stone-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-amber-400/80 font-mono uppercase">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Decanting Guide</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTimerRunning(!timerRunning)}
                className="p-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                title={timerRunning ? "Pause timer" : "Start timer"}
              >
                {timerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setSecondsRemaining(decantingMinutes * 60);
                }}
                className="p-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                title="Reset timer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="font-mono text-base font-bold text-amber-300">
            {formatTimer(secondsRemaining)}
          </div>
          <span className="text-[10px] text-stone-500 mt-1">Recommended: {decantingMinutes} mins</span>
        </div>

        {/* Drinking Window */}
        <div data-testid="drinking-window" className="p-3.5 rounded-2xl bg-stone-900/60 border border-stone-800 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-amber-400/80 font-mono uppercase mb-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Cellar Window</span>
          </div>
          <div className="font-mono text-sm font-bold text-stone-100">
            {drinkingWindow}
          </div>
          <span className="text-[10px] text-stone-500 mt-1">Optimal longevity</span>
        </div>
      </div>

      {/* Terroir & Weather Notes */}
      <div className="mb-6 p-4 rounded-2xl bg-stone-900/40 border border-stone-800 text-xs">
        <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 block mb-1">
          Terroir & Weather Profile
        </span>
        <p className="text-stone-300 leading-relaxed font-serif text-sm italic">
          "{terroir}"
        </p>
      </div>

      {/* Cellar Pairing Suggestions */}
      <div data-testid="cellar-pairings" className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
        <div className="flex items-center gap-1.5 text-xs font-mono uppercase text-amber-400/90 font-bold mb-2.5">
          <UtensilsCrossed className="w-4 h-4 text-amber-400" />
          <span>Cellar Gastronomic Pairings</span>
        </div>
        <div className="space-y-1.5">
          {pairings.map((pairing: string, idx: number) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2 rounded-xl bg-stone-950/60 border border-stone-800/60 text-xs text-stone-300"
            >
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
              <span>{pairing}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
