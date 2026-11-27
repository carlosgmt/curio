"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Film, RefreshCw, Repeat, RotateCcw, Star } from "lucide-react";
import type { CardData } from "@/components/cards/PolymorphicCard";
import type { VirtualPosterItem } from "./VirtualPosterWall3D";
import { HairlineTickRuler } from "@/components/ui/HairlineTickRuler";
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
  onSelectDirector?: (director: string) => void;
  onSelectGenre?: (genre: string) => void;
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
  onSelectDirector,
  onSelectGenre,
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
      className="relative w-full overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
      style={{
        backgroundColor: "#141312",
        color: "#F2EFE9",
        transition: "background-color 600ms ease, color 600ms ease",
      }}
    >
      {/* Subtle Ambient Poster Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(circle at 50% 42%, ${activePalette.coverBg}4D 0%, #141312 70%)`,
          transition: "background 600ms ease",
        }}
      />

      {/* Quiet Theater Ledger Top Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-5 sm:px-8 pt-4 pb-1 text-xs">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A8A196] truncate">
          {galleryLabel}
        </span>

        <span className="font-mono text-[11px] tabular-nums text-[#A8A196]">
          {String(safeIdx + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
        </span>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <button
            type="button"
            onClick={() =>
              setWallMode((m) => (m === "gallery" ? "marquee" : "gallery"))
            }
            className="text-[#A8A196] hover:text-[#F2EFE9] transition-colors cursor-pointer"
          >
            {wallMode === "gallery" ? "Gallery" : "Marquee"}
          </button>
          <button
            type="button"
            onClick={() => setInspectBack((b) => !b)}
            className="text-[#F2EFE9] hover:text-[#4CA382] transition-colors cursor-pointer"
          >
            {inspectBack ? "Show Poster" : "Credits"}
          </button>
          <button
            type="button"
            aria-label="Reset poster gallery angle"
            onClick={() => {
              setInspectBack(false);
              setResetSignal((n) => n + 1);
            }}
            className="text-[#A8A196] hover:text-[#F2EFE9] transition-colors cursor-pointer"
          >
            Reset
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

      {/* Museum Caption + Hairline Tick-Mark Film Scrubber */}
      <div className="relative z-10 px-5 sm:px-8 pt-2 pb-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif-editorial text-2xl sm:text-[28px] leading-[1.15] text-[#F2EFE9] truncate">
              {activePoster.title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#A8A196]">
              {onSelectDirector &&
              activePoster.director &&
              activePoster.director.toLowerCase() !== "unknown director" &&
              activePoster.director.toLowerCase() !== "director unknown" ? (
                <button
                  type="button"
                  onClick={() => onSelectDirector(activePoster.director)}
                  className="text-[#4CA382] hover:underline underline-offset-4 cursor-pointer"
                  title={`Filter films by ${activePoster.director}`}
                >
                  {activePoster.director}
                </button>
              ) : (
                <span>{activePoster.director}</span>
              )}
              {(activePoster.year || activePoster.runtimeMinutes) && (
                <span className="font-mono tabular-nums">
                  {activePoster.year ? `· ${activePoster.year}` : ""}
                  {activePoster.runtimeMinutes ? ` · ${activePoster.runtimeMinutes} min` : ""}
                </span>
              )}
              {activePoster.rating && (
                <span className="inline-flex items-center gap-0.5 font-mono text-[#4CA382]">
                  · ★ {activePoster.rating}
                </span>
              )}
              {Array.isArray((activeCard.entity?.coreStructuredData as any)?.genres) &&
                ((activeCard.entity?.coreStructuredData as any).genres as string[])
                  .slice(0, 3)
                  .map((g) =>
                    onSelectGenre ? (
                      <button
                        key={g}
                        type="button"
                        onClick={() => onSelectGenre(g)}
                        className="font-mono text-[10px] hover:text-[#F2EFE9] cursor-pointer"
                      >
                        · {g}
                      </button>
                    ) : (
                      <span key={g} className="font-mono text-[10px]">
                        · {g}
                      </span>
                    )
                  )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenObject(activeCard, "standard")}
            className="font-mono text-xs text-[#4CA382] hover:underline underline-offset-4 shrink-0 cursor-pointer self-start sm:self-end"
          >
            Open Film →
          </button>
        </div>

        <HairlineTickRuler
          total={items.length}
          activeIndex={safeIdx}
          onChange={setActiveByIndex}
          ariaLabel="Scrub movie posters"
          accentColor="#4CA382"
        />
      </div>
    </section>
  );
}
