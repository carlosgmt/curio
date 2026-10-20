"use client";

import React, { useState } from "react";
import { RefreshCw, Sparkles, Check, FileText, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export interface CandidateFallback {
  title: string;
  url: string;
  snippet: string;
  coreType: string;
  typePath?: string;
  badgeLabel?: string;
}

interface DisambiguationBarProps {
  saveId: string;
  candidates: CandidateFallback[];
  onSwapped?: (chosenCandidate: CandidateFallback) => void;
}

function getBadge(cand: CandidateFallback): { label: string; className: string } {
  const badge = (cand.badgeLabel || "").toUpperCase();
  const typePath = (cand.typePath || "").toLowerCase();
  const core = (cand.coreType || "").toUpperCase();

  if (badge === "FILM" || typePath.includes("film") || typePath.includes("movie")) {
    return {
      label: "FILM",
      className:
        "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    };
  }
  if (badge === "BOOK" || typePath.includes("book") || core === "BOOK") {
    return {
      label: "BOOK",
      className:
        "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    };
  }
  if (badge === "SONG" || typePath.includes("music") || typePath.includes("vinyl")) {
    return {
      label: "SONG",
      className:
        "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    };
  }
  if (badge === "WINE" || typePath.includes("wine")) {
    return {
      label: "WINE",
      className:
        "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    };
  }
  if (badge === "PLACE" || typePath.includes("place") || core === "PLACE") {
    return {
      label: "PLACE",
      className:
        "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    };
  }
  if (badge === "GAME" || typePath.includes("videogame") || core === "VIDEOGAME") {
    return {
      label: "GAME",
      className:
        "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    };
  }
  if (badge === "ART" || typePath.includes("art")) {
    return {
      label: "ART",
      className:
        "bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    };
  }
  if (badge === "RECIPE" || typePath.includes("recipe") || core === "CULINARY") {
    return {
      label: "RECIPE",
      className:
        "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    };
  }

  return {
    label: badge || core || "ITEM",
    className:
      "bg-neutral-200/80 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-600",
  };
}

export function DisambiguationBar({
  saveId,
  candidates,
  onSwapped,
}: DisambiguationBarProps) {
  const [isSwapping, setIsSwapping] = useState<string | null>(null);
  const [swappedUrl, setSwappedUrl] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || !candidates || candidates.length === 0) {
    return null;
  }

  // Limit runner-ups to max 2 items
  const displayedCandidates = candidates.slice(0, 2);

  const handleSwap = async (candidate: CandidateFallback) => {
    if (isSwapping) return;
    setIsSwapping(candidate.url);

    try {
      const res = await apiFetch("/api/v1/capture/disambiguate", {
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
      setIsDismissed(true);
      if (onSwapped) {
        onSwapped(candidate);
      }
    } catch (err) {
      console.error("Disambiguation error:", err);
    } finally {
      setIsSwapping(null);
    }
  };

  const handleSaveAsTextNote = async () => {
    if (isSwapping) return;
    setIsSwapping("text-note");

    try {
      const res = await apiFetch(`/api/v1/saves/${saveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPrivateMemo: true,
          typePath: "/memo/personal",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to convert save to text note");
      }

      setIsDismissed(true);
      if (onSwapped) {
        onSwapped({
          title: "Text Note",
          url: "",
          snippet: "Saved as text note",
          coreType: "NOTE",
          typePath: "/memo/personal",
        });
      }
    } catch (err) {
      console.error("Save as text note error:", err);
    } finally {
      setIsSwapping(null);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
      <div className="flex items-center justify-between gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 font-medium mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Not what you meant? 1-tap switch:</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDismissed(true);
          }}
          className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition cursor-pointer"
          title="Dismiss suggestions"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {displayedCandidates.map((cand) => {
          const isCurrent = isSwapping === cand.url;
          const isDone = swappedUrl === cand.url;
          const badge = getBadge(cand);

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
              className={`group flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all text-left cursor-pointer ${
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
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${badge.className}`}
                >
                  {badge.label}
                </span>
              )}
              <span className="max-w-[180px] sm:max-w-[240px] truncate font-medium">
                {cand.title}
              </span>
            </button>
          );
        })}

        {/* 1-tap Save as text note */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSaveAsTextNote();
          }}
          disabled={Boolean(isSwapping)}
          title="Convert card to a text note"
          className="group flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-700 dark:text-neutral-300 transition-all text-left cursor-pointer"
        >
          {isSwapping === "text-note" ? (
            <RefreshCw className="w-3 h-3 animate-spin text-neutral-600 dark:text-neutral-400" />
          ) : (
            <FileText className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
          )}
          <span className="font-medium">Save as text note</span>
        </button>
      </div>
    </div>
  );
}
