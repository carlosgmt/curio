"use client";

import React, { useState } from "react";
import { RefreshCw, ExternalLink, Sparkles, Check } from "lucide-react";

export interface CandidateFallback {
  title: string;
  url: string;
  snippet: string;
  coreType: string;
}

interface DisambiguationBarProps {
  saveId: string;
  candidates: CandidateFallback[];
  onSwapped?: (chosenCandidate: CandidateFallback) => void;
}

export function DisambiguationBar({
  saveId,
  candidates,
  onSwapped,
}: DisambiguationBarProps) {
  const [isSwapping, setIsSwapping] = useState<string | null>(null);
  const [swappedUrl, setSwappedUrl] = useState<string | null>(null);

  if (!candidates || candidates.length === 0) {
    return null;
  }

  const handleSwap = async (candidate: CandidateFallback) => {
    if (isSwapping) return;
    setIsSwapping(candidate.url);

    try {
      const res = await fetch("/api/v1/capture/disambiguate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId,
          targetUrl: candidate.url,
        }),
      });

      if (!res.ok) {
        throw new Error("Disambiguation swap failed");
      }

      setSwappedUrl(candidate.url);
      if (onSwapped) {
        onSwapped(candidate);
      }
    } catch (err) {
      console.error("Disambiguation error:", err);
    } finally {
      setIsSwapping(null);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 font-medium mb-2">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>Not what you meant? 1-tap switch:</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {candidates.map((cand) => {
          const isCurrent = isSwapping === cand.url;
          const isDone = swappedUrl === cand.url;

          return (
            <button
              key={cand.url}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSwap(cand);
              }}
              disabled={Boolean(isSwapping)}
              title={cand.snippet}
              className={`group flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all text-left ${
                isDone
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                  : "bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200/80 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-700 dark:text-neutral-300"
              }`}
            >
              {isCurrent ? (
                <RefreshCw className="w-3 h-3 animate-spin text-neutral-600" />
              ) : isDone ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.2 bg-neutral-200/80 dark:bg-neutral-700 rounded text-neutral-600 dark:text-neutral-400">
                  {cand.coreType}
                </span>
              )}
              <span className="max-w-[180px] sm:max-w-[240px] truncate font-medium">
                {cand.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
