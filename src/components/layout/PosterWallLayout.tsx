"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Film, RefreshCw, Repeat, RotateCcw, Star } from "lucide-react";
import type { CardData } from "@/components/cards/PolymorphicCard";
import type { VirtualPosterItem } from "./VirtualPosterWall3D";
import {
  type PressPalette,
  getDeterministicClothPalette,
  resolveSameOriginImageUrl,
} from "@/lib/press/archetypes";
import { extractPaletteFromImageUrl } from "@/lib/press/palette";

const VirtualPosterWall3D = dynamic(() => import("./VirtualPosterWall3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[340px] items-center justify-center font-mono text-xs uppercase tracking-widest opacity-60">
      Loading 3D Cinema Gallery...
    </div>
  ),
});

export interface PosterWallLayoutProps {
  items: CardData[];
  onOpenObject: (card: CardData, presentation?: "standard" | "press") => void;
  galleryLabel?: string;
  compact?: boolean;
}

const VIRTUAL_WINDOW = 12;

function toPosterItem(
  card: CardData,
  palette: PressPalette
): VirtualPosterItem {
  const ent = card.entity;
  const csd =
    ent?.coreStructuredData && typeof ent.coreStructuredData === "object"
      ? (ent.coreStructuredData as Record<string, any>)
      : {};
  const ext =
    ent?.extendedAttributes && typeof ent.extendedAttributes === "object"
      ? (ent.extendedAttributes as Record<string, any>)
      : {};
  const cv =
    card.save?.userCustomValues && typeof card.save.userCustomValues === "object"
      ? (card.save.userCustomValues as Record<string, any>)
      : {};

  const title = (card.save.privateTitle || ent?.title || "Untitled Film").trim();
  const director = String(
    csd.director || ent?.brandOrCreator || "Director Unknown"
  ).trim();
  const rawYear = csd.releaseYear ?? csd.year;
  const parsedYear =
    typeof rawYear === "number" ? rawYear : parseInt(String(rawYear || ""), 10);
  const rawRuntime = csd.runtimeMinutes ?? csd.runtime;
  const parsedRuntime =
    typeof rawRuntime === "number"
      ? rawRuntime
      : parseInt(String(rawRuntime || ""), 10);
  const rawRating = cv.rating ?? cv.myRating ?? csd.rating;
  const parsedRating =
    typeof rawRating === "number" ? rawRating : parseFloat(String(rawRating || ""));

  return {
    saveId: card.save.id,
    title,
    director,
    year: Number.isFinite(parsedYear) && parsedYear > 1880 ? parsedYear : null,
    runtimeMinutes:
      Number.isFinite(parsedRuntime) && parsedRuntime > 0 ? parsedRuntime : null,
    rating:
      Number.isFinite(parsedRating) && parsedRating > 0 && parsedRating <= 5
        ? parsedRating
        : null,
    watchStatus:
      typeof cv.watchStatus === "string"
        ? cv.watchStatus.toUpperCase()
        : card.save.wishlist
        ? "WATCHLIST"
        : "WATCHED",
    rewatch: Boolean(cv.rewatch),
    isOwned: Boolean(cv.owned || ext.source === "purchase-hub" || ext.owned),
    posterUrl: resolveSameOriginImageUrl(ent?.heroImageUrl),
    palette,
  };
}

export function PosterWallLayout({
  items,
  onOpenObject,
  galleryLabel = "CURIO CINEMA POSTERS",
  compact = false,
}: PosterWallLayoutProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.save.id ?? null
  );
  const [palettesBySaveId, setPalettesBySaveId] = useState<
    Record<string, PressPalette>
  >({});
  const [wallMode, setWallMode] = useState<"gallery" | "marquee">("gallery");
  const [inspectBack, setInspectBack] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const safeIdx = useMemo(() => {
    if (items.length === 0) return -1;
    if (!selectedId) return 0;
    const found = items.findIndex((it) => it.save.id === selectedId);
    return found >= 0 ? found : 0;
  }, [items, selectedId]);

  const activeCard = safeIdx >= 0 ? items[safeIdx] : null;

  const setActiveByIndex = useCallback(
    (nextIdx: number) => {
      if (items.length === 0) return;
      const clamped = Math.max(0, Math.min(items.length - 1, nextIdx));
      setSelectedId(items[clamped].save.id);
    },
    [items]
  );

  const startIdx = Math.max(0, safeIdx - VIRTUAL_WINDOW);
  const endIdx = Math.min(items.length - 1, safeIdx + VIRTUAL_WINDOW);

  const visibleSlice = useMemo(() => {
    if (safeIdx < 0) return [];
    const slice: { card: CardData; index: number }[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      slice.push({ card: items[i], index: i });
    }
    return slice;
  }, [items, safeIdx, startIdx, endIdx]);

  useEffect(() => {
    if (visibleSlice.length === 0) return;
    let cancelled = false;

    const run = async () => {
      const ordered = [...visibleSlice].sort(
        (a, b) => Math.abs(a.index - safeIdx) - Math.abs(b.index - safeIdx)
      );
      for (const { card } of ordered) {
        if (cancelled) break;
        const saveId = card.save.id;
        if (palettesBySaveId[saveId]) continue;
        const fallback = getDeterministicClothPalette(card, "media_case");
        const sameOriginUrl = resolveSameOriginImageUrl(card.entity?.heroImageUrl);
        if (!sameOriginUrl) {
          if (!cancelled) {
            setPalettesBySaveId((prev) =>
              prev[saveId] ? prev : { ...prev, [saveId]: fallback }
            );
          }
          continue;
        }
        const extracted = await extractPaletteFromImageUrl(sameOriginUrl, fallback);
        if (!cancelled) {
          setPalettesBySaveId((prev) =>
            prev[saveId] ? prev : { ...prev, [saveId]: extracted }
          );
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [visibleSlice, safeIdx, palettesBySaveId]);

  const activePalette = useMemo<PressPalette>(() => {
    if (!activeCard) {
      return {
        id: "obsidian",
        surface: "#151619",
        surfaceSecondary: "#0F1012",
        ink: "#F4F1EA",
        muted: "#B5B2AA",
        accent: "#E3B867",
        rule: "#303237",
        coverBg: "#212328",
        coverInk: "#F4F1EA",
      };
    }
    return (
      palettesBySaveId[activeCard.save.id] ||
      getDeterministicClothPalette(activeCard, "media_case")
    );
  }, [activeCard, palettesBySaveId]);

  const posterItems = useMemo<VirtualPosterItem[]>(
    () =>
      items.map((card) =>
        toPosterItem(
          card,
          palettesBySaveId[card.save.id] ||
            getDeterministicClothPalette(card, "media_case")
        )
      ),
    [items, palettesBySaveId]
  );

  const activePoster = safeIdx >= 0 ? posterItems[safeIdx] : null;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (items.length === 0 || safeIdx < 0) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveByIndex(safeIdx + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveByIndex(safeIdx - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveByIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveByIndex(items.length - 1);
      } else if (e.key === "Enter" && activeCard) {
        e.preventDefault();
        onOpenObject(activeCard, "standard");
      }
    },
    [items.length, safeIdx, setActiveByIndex, activeCard, onOpenObject]
  );

  if (items.length === 0 || !activeCard || !activePoster) {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 px-6 py-16 text-center">
        <p className="font-serif-editorial text-xl text-neutral-600 dark:text-neutral-300">
          No posters to screen on this wall yet.
        </p>
      </div>
    );
  }

  return (
    <section
      ref={stageRef}
      tabIndex={0}
      role="region"
      data-testid="poster-wall-layout"
      aria-label={`${galleryLabel} Poster Gallery`}
      onKeyDown={handleKeyDown}
      className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        backgroundColor: activePalette.surface,
        borderColor: activePalette.rule,
        color: activePalette.ink,
        transition: "background-color 420ms ease, color 420ms ease, border-color 420ms ease",
      }}
    >
      {/* Top Theater Ledger Bar */}
      <div
        className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-7 py-3 border-b"
        style={{ borderColor: activePalette.rule }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Film className="w-3.5 h-3.5 shrink-0" style={{ color: activePalette.accent }} />
          <span
            className="font-mono text-[11px] uppercase tracking-[0.14em] truncate"
            style={{ color: activePalette.accent }}
          >
            {galleryLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
          <button
            type="button"
            onClick={() =>
              setWallMode((m) => (m === "gallery" ? "marquee" : "gallery"))
            }
            className="px-2.5 py-1 rounded-md border text-[10px] uppercase tracking-wider cursor-pointer"
            style={{
              borderColor: activePalette.rule,
              backgroundColor: activePalette.surfaceSecondary,
              color: activePalette.ink,
            }}
          >
            {wallMode === "gallery" ? "Gallery" : "Marquee"}
          </button>
          <button
            type="button"
            onClick={() => setInspectBack((b) => !b)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[10px] uppercase tracking-wider cursor-pointer"
            style={{
              borderColor: activePalette.rule,
              backgroundColor: activePalette.surfaceSecondary,
              color: activePalette.ink,
            }}
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>{inspectBack ? "Poster" : "Credits"}</span>
          </button>
          <button
            type="button"
            aria-label="Reset poster gallery angle"
            onClick={() => {
              setInspectBack(false);
              setResetSignal((n) => n + 1);
            }}
            className="p-1.5 rounded-md border cursor-pointer"
            style={{
              borderColor: activePalette.rule,
              backgroundColor: activePalette.surfaceSecondary,
              color: activePalette.ink,
            }}
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => setActiveByIndex(safeIdx - 1)}
            disabled={safeIdx <= 0}
            aria-label="Previous poster"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border transition-opacity disabled:opacity-30 cursor-pointer ml-1"
            style={{
              borderColor: activePalette.rule,
              backgroundColor: activePalette.surfaceSecondary,
              color: activePalette.ink,
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <span style={{ color: activePalette.muted }}>
            {String(safeIdx + 1).padStart(2, "0")} /{" "}
            {String(items.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => setActiveByIndex(safeIdx + 1)}
            disabled={safeIdx >= items.length - 1}
            aria-label="Next poster"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border transition-opacity disabled:opacity-30 cursor-pointer"
            style={{
              borderColor: activePalette.rule,
              backgroundColor: activePalette.surfaceSecondary,
              color: activePalette.ink,
            }}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 3D WebGL Poster Wall or Theatrical CSS Carousel Fallback */}
      {!webglUnavailable ? (
        <div className="relative z-10 w-full">
          <VirtualPosterWall3D
            items={posterItems}
            activeIndex={safeIdx}
            wallMode={wallMode}
            inspectBack={inspectBack}
            onSelectIndex={(idx) => {
              setInspectBack(false);
              setActiveByIndex(idx);
            }}
            onActivateActiveItem={() => onOpenObject(activeCard, "standard")}
            onWebglUnavailable={() => setWebglUnavailable(true)}
            compact={compact}
            resetSignal={resetSignal}
          />
        </div>
      ) : (
        <div className="relative z-10 px-6 py-10 flex items-end justify-center gap-4 overflow-x-auto min-h-[340px]">
          {visibleSlice.map(({ card, index }) => {
            const p = posterItems[index];
            const isAct = index === safeIdx;
            return (
              <button
                key={card.save.id}
                type="button"
                onClick={() =>
                  isAct ? onOpenObject(card, "standard") : setActiveByIndex(index)
                }
                className={`shrink-0 rounded-lg overflow-hidden border transition-all duration-200 cursor-pointer ${
                  isAct
                    ? "w-44 aspect-[2/3] -translate-y-2 shadow-2xl scale-105"
                    : "w-28 aspect-[2/3] opacity-70 hover:opacity-95"
                }`}
                style={{
                  borderColor: isAct ? activePalette.accent : activePalette.rule,
                  backgroundColor: p.palette.coverBg,
                }}
              >
                {p.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.posterUrl}
                    alt={p.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                    <span className="font-serif-editorial text-sm leading-tight">
                      {p.title}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom Film Marquee + Scrubber */}
      <div
        className="relative z-10 border-t px-4 sm:px-7 py-4 space-y-3"
        style={{
          borderColor: activePalette.rule,
          backgroundColor: `${activePalette.surfaceSecondary}CC`,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
              <span style={{ color: activePalette.accent }}>
                {activePoster.director}
                {activePoster.year ? ` · ${activePoster.year}` : ""}
                {activePoster.runtimeMinutes
                  ? ` · ${activePoster.runtimeMinutes} min`
                  : ""}
              </span>
              {activePoster.rating && (
                <span className="inline-flex items-center gap-0.5 text-amber-400">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  {activePoster.rating}
                </span>
              )}
              {activePoster.rewatch && (
                <span className="inline-flex items-center gap-0.5 opacity-80">
                  <Repeat className="w-2.5 h-2.5" />
                  Rewatch
                </span>
              )}
            </div>
            <h3 className="font-serif-editorial text-xl sm:text-2xl truncate mt-0.5">
              {activePoster.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => onOpenObject(activeCard, "standard")}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-mono text-xs font-medium shrink-0 cursor-pointer transition hover:opacity-90"
            style={{
              backgroundColor: activePalette.accent,
              color: activePalette.surfaceSecondary,
            }}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Open Film Details</span>
          </button>
        </div>

        {items.length > 3 && (
          <input
            type="range"
            min={0}
            max={items.length - 1}
            value={safeIdx}
            aria-label="Scrub movie posters"
            onChange={(e) => setActiveByIndex(Number(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
            style={{ accentColor: activePalette.accent }}
          />
        )}
      </div>
    </section>
  );
}
