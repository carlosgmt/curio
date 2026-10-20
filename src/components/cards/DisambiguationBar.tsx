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

  if (badge === "ALBUM" || typePath.includes("album")) {
    return {
      label: "ALBUM",
      className:
        "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    };
  }
  if (badge === "SONG" || typePath.includes("song") || typePath.includes("music") || typePath.includes("vinyl")) {
    return {
      label: "SONG",
      className:
        "bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    };
  }
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
  if (badge === "WATCH" || typePath.includes("watch")) {
    return {
      label: "WATCH",
      className:
        "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
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
  const [isOpen, setIsOpen] = useState(false);
  const [isSwapping, setIsSwapping] = useState<string | null>(null);
  const [swappedUrl, setSwappedUrl] = useState<string | null>(null);

  if (!candidates || candidates.length === 0) {
    return null;
  }

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
      setIsOpen(false);
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

      setIsOpen(false);
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

  if (!isOpen) {
    return (
      <div className="flex items-center justify-center pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 hover:text-neutral-200 dark:text-neutral-500 dark:hover:text-neutral-300 py-0.5 px-2.5 rounded-full hover:bg-white/5 transition cursor-pointer"
          title="Wrong entity? Click to disambiguate or save as note"
        >
          <Sparkles className="w-3 h-3 text-amber-500/80" />
          <span>Wrong entity?</span>
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 p-3.5 rounded-2xl bg-neutral-900 border border-neutral-700/80 text-white shadow-xl space-y-2.5 z-20 text-xs text-left"
    >
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-1.5 font-medium text-neutral-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Disambiguate Entity</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-neutral-400">
        Select the intended entity below, or save as a text note:
      </p>

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {candidates.map((cand) => {
          const isCurrent = isSwapping === cand.url;
          const isDone = swappedUrl === cand.url;
          const badge = getBadge(cand);

          return (
            <button
              key={cand.url}
              type="button"
              onClick={() => handleSwap(cand)}
              disabled={Boolean(isSwapping)}
              className={`w-full flex items-center justify-between gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
                isDone
                  ? "bg-emerald-950/60 border-emerald-700 text-emerald-200"
                  : "bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700/60 text-neutral-200"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${badge.className}`}
                >
                  {badge.label}
                </span>
                <div className="min-w-0">
                  <span className="font-semibold block truncate text-xs text-neutral-100">
                    {cand.title}
                  </span>
                  {cand.snippet && (
                    <span className="text-[10px] text-neutral-400 block truncate">
                      {cand.snippet}
                    </span>
                  )}
                </div>
              </div>

              {isCurrent ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-400 shrink-0" />
              ) : isDone ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : null}
            </button>
          );
        })}

        {/* 1-Tap Save as text note */}
        <button
          type="button"
          onClick={() => handleSaveAsTextNote()}
          disabled={Boolean(isSwapping)}
          className="w-full flex items-center gap-2 p-2 rounded-xl border border-neutral-700/60 bg-neutral-800/40 hover:bg-neutral-800 text-neutral-300 transition text-left cursor-pointer"
        >
          {isSwapping === "text-note" ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-400" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
          )}
          <span className="font-medium text-xs">Save as text note</span>
        </button>
      </div>
    </div>
  );
}
