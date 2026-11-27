"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Box, Eye, RefreshCw, RotateCcw } from "lucide-react";
import type { CardData } from "@/components/cards/PolymorphicCard";
import type { VirtualBookshelfItem } from "./VirtualBookshelf3D";

const VirtualBookshelf3D = dynamic(() => import("./VirtualBookshelf3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center font-mono text-xs uppercase tracking-widest opacity-60">
      Loading 3D Bookshelf...
    </div>
  ),
});
import {
  type PressPalette,
  formatSpineMeta,
  getArchetypeSpec,
  getDeterministicClothPalette,
  resolveSameOriginImageUrl,
} from "@/lib/press/archetypes";
import { extractPaletteFromImageUrl } from "@/lib/press/palette";
import { formatBookSourceLabel, resolveBookSources } from "@/lib/books/library";

export interface ShelfLayoutProps {
  items: CardData[];
  onOpenObject: (card: CardData, presentation?: "standard" | "press") => void;
  onSelectCreator?: (creator: string) => void;
  shelfLabel?: string;
  compact?: boolean;
}

const VIRTUAL_WINDOW = 12;

export function ShelfLayout({
  items,
  onOpenObject,
  onSelectCreator,
  shelfLabel = "CURIO PRESS ARCHIVE",
  compact = false,
}: ShelfLayoutProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.save.id ?? null
  );
  const [palettesBySaveId, setPalettesBySaveId] = useState<
    Record<string, PressPalette>
  >({});
  const [inspectMode, setInspectMode] = useState<"front" | "spine">("front");
  const [resetSignal, setResetSignal] = useState(0);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const wheelLockRef = useRef<number>(0);
  const wheelAccumRef = useRef<number>(0);
  const touchStartXRef = useRef<number | null>(null);

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

  // Extract WCAG-safe palettes asynchronously for visible neighborhood
  useEffect(() => {
    if (visibleSlice.length === 0) return;
    let cancelled = false;

    const extractWindow = async () => {
      // Prioritize active item first so backdrop adapts immediately
      const ordered = [...visibleSlice].sort(
        (a, b) => Math.abs(a.index - safeIdx) - Math.abs(b.index - safeIdx)
      );
      for (const { card } of ordered) {
        if (cancelled) break;
        const saveId = card.save.id;
        if (palettesBySaveId[saveId]) continue;
        const fallback = getDeterministicClothPalette(card);
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

    void extractWindow();
    return () => {
      cancelled = true;
    };
  }, [visibleSlice, safeIdx, palettesBySaveId]);

  const activePalette = useMemo<PressPalette>(() => {
    if (!activeCard) {
      return {
        id: "empty",
        surface: "#1D1E20",
        surfaceSecondary: "#151618",
        ink: "#F2EFE9",
        muted: "#BAB7B0",
        accent: "#DFBF74",
        rule: "#393B3F",
        coverBg: "#2A2B2E",
        coverInk: "#F2EFE9",
      };
    }
    return (
      palettesBySaveId[activeCard.save.id] ||
      getDeterministicClothPalette(activeCard)
    );
  }, [activeCard, palettesBySaveId]);

  const activeMeta = useMemo(
    () => (activeCard ? formatSpineMeta(activeCard) : null),
    [activeCard]
  );
  const activeSpec = useMemo(
    () => (activeCard ? getArchetypeSpec(activeCard) : null),
    [activeCard]
  );
  const shelfItems3D = useMemo<VirtualBookshelfItem[]>(
    () =>
      items.map((card) => {
        const csd =
          card.entity?.coreStructuredData &&
          typeof card.entity.coreStructuredData === "object"
            ? (card.entity.coreStructuredData as Record<string, any>)
            : {};
        const cv =
          card.save?.userCustomValues &&
          typeof card.save.userCustomValues === "object"
            ? (card.save.userCustomValues as Record<string, any>)
            : {};
        const rawPages = csd.pageCount ?? csd.pages ?? csd.numberOfPagesMedian;
        const parsedPages =
          typeof rawPages === "number" ? rawPages : parseInt(String(rawPages || ""), 10);
        return {
          saveId: card.save.id,
          spec: getArchetypeSpec(card),
          meta: formatSpineMeta(card),
          palette:
            palettesBySaveId[card.save.id] || getDeterministicClothPalette(card),
          imageUrl: resolveSameOriginImageUrl(card.entity?.heroImageUrl),
          pageCount: Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : null,
          rating: typeof cv.rating === "number" ? cv.rating : typeof cv.myRating === "number" ? cv.myRating : null,
        };
      }),
    [items, palettesBySaveId]
  );

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
        onOpenObject(activeCard, "press");
      }
    },
    [items.length, safeIdx, setActiveByIndex, activeCard, onOpenObject]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) && !e.shiftKey) return;
      const dominant =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(dominant) < 6) return;

      const now = performance.now();
      wheelAccumRef.current += dominant;
      if (now - wheelLockRef.current < 160) return;

      if (Math.abs(wheelAccumRef.current) >= 32) {
        const dir = wheelAccumRef.current > 0 ? 1 : -1;
        wheelAccumRef.current = 0;
        wheelLockRef.current = now;
        setActiveByIndex(safeIdx + dir);
      }
    },
    [safeIdx, setActiveByIndex]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (touchStartXRef.current === null) return;
      const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
      const dx = endX - touchStartXRef.current;
      touchStartXRef.current = null;
      if (Math.abs(dx) >= 36) {
        setActiveByIndex(safeIdx + (dx < 0 ? 1 : -1));
      }
    },
    [safeIdx, setActiveByIndex]
  );

  if (items.length === 0 || !activeCard || !activeMeta || !activeSpec) {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 px-6 py-16 text-center">
        <p className="font-serif-editorial text-xl text-neutral-600 dark:text-neutral-300">
          No objects on this shelf yet.
        </p>
      </div>
    );
  }

  return (
    <section
      ref={stageRef}
      tabIndex={0}
      role="region"
      aria-label={`${shelfLabel} Press Shelf`}
      onKeyDown={handleKeyDown}
      onWheel={webglUnavailable ? handleWheel : undefined}
      onTouchStart={webglUnavailable ? handleTouchStart : undefined}
      onTouchEnd={webglUnavailable ? handleTouchEnd : undefined}
      className="relative w-full overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
      style={{
        backgroundColor: "#201819",
        color: "#F2EFE9",
        transition: "background-color 600ms ease, color 600ms ease",
      }}
    >
      {/* Ambient Cloth-Palette Bindery Stage Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-75"
        style={{
          background: `radial-gradient(circle at 50% 42%, ${activePalette.coverBg}55 0%, #201819 70%)`,
          transition: "background 600ms ease",
        }}
      />

      {/* Minimal Top Bindery Ledger */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-5 sm:px-8 pt-4 pb-1 text-xs">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A8A196] truncate">
          {shelfLabel}
        </span>

        <span className="font-mono text-[11px] tabular-nums text-[#A8A196]">
          {String(safeIdx + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
        </span>

        {!webglUnavailable ? (
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <button
              type="button"
              data-testid="press-shelf-flip-spine"
              onClick={() =>
                setInspectMode((m) => (m === "spine" ? "front" : "spine"))
              }
              className="text-[#F2EFE9] hover:text-[#C89572] transition-colors cursor-pointer"
            >
              {inspectMode === "spine" ? "Show Cover" : "Flip Spine"}
            </button>
            <button
              type="button"
              aria-label="Reset 3D shelf angle"
              onClick={() => {
                setInspectMode("front");
                setResetSignal((n) => n + 1);
              }}
              className="text-[#A8A196] hover:text-[#F2EFE9] transition-colors cursor-pointer"
              title="Reset angle"
            >
              Reset
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setActiveByIndex(safeIdx - 1)}
              disabled={safeIdx <= 0}
              aria-label="Previous shelf object"
              className="disabled:opacity-30 hover:text-[#C89572] cursor-pointer"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setActiveByIndex(safeIdx + 1)}
              disabled={safeIdx >= items.length - 1}
              aria-label="Next shelf object"
              className="disabled:opacity-30 hover:text-[#C89572] cursor-pointer"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Interactive Continuous 3D Virtual Bookshelf (WebGL + CSS Fallback) */}
      {!webglUnavailable ? (
        <div className="relative z-10 w-full">
          <VirtualBookshelf3D
            items={shelfItems3D}
            activeIndex={safeIdx}
            inspectMode={inspectMode}
            onSelectIndex={(idx) => {
              setInspectMode("front");
              setActiveByIndex(idx);
            }}
            onActivateActiveItem={() => {
              if (activeCard) onOpenObject(activeCard, "standard");
            }}
            onToggleInspectMode={() =>
              setInspectMode((m) => (m === "spine" ? "front" : "spine"))
            }
            onWebglUnavailable={() => setWebglUnavailable(true)}
            compact={compact}
            resetSignal={resetSignal}
          />
        </div>
      ) : (
      <div
        className={`relative z-10 w-full overflow-hidden flex flex-col justify-end ${
          compact ? "pt-6 pb-3" : "pt-8 sm:pt-10 pb-4"
        }`}
      >
        <div
          className="press-stage mx-auto flex w-full items-end justify-center px-4 sm:px-8"
          style={{ minHeight: compact ? 248 : 278 }}
        >
          <div className="flex items-end justify-center gap-1 sm:gap-1.5">
            {visibleSlice.map(({ card, index }) => {
              const spec = getArchetypeSpec(card);
              const meta = formatSpineMeta(card);
              const pal =
                palettesBySaveId[card.save.id] ||
                getDeterministicClothPalette(card);
              const imgUrl = resolveSameOriginImageUrl(card.entity?.heroImageUrl);
              const isActive = index === safeIdx;
              const isLeft = index < safeIdx;
              const dist = Math.abs(index - safeIdx);
              const scale = compact ? 0.86 : 1;

              const w = Math.round(spec.shelfPx.width * scale);
              const h = Math.round(spec.shelfPx.height * scale);
              const t = Math.round(spec.shelfPx.thickness * scale);
              const slotWidth = isActive
                ? w + (spec.hasPeekingDisc ? 28 : 16)
                : Math.max(38, t + 14);

              const slabClass = isActive
                ? "is-front"
                : isLeft
                ? "is-spine-left"
                : "is-spine-right";

              const zIdx = 50 - Math.min(40, dist);
              const opacity = dist > 9 ? 0.45 : dist > 6 ? 0.72 : 1;

              return (
                <button
                  key={card.save.id}
                  type="button"
                  data-testid={`press-shelf-item-${index}`}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`${meta.title} — ${meta.creator}${
                    isActive ? " (Selected: click to inspect in 3D Stage)" : ""
                  }`}
                  onClick={() => {
                    if (isActive) {
                      onOpenObject(card, "press");
                    } else {
                      setActiveByIndex(index);
                    }
                  }}
                  className="press-slot group relative flex shrink-0 items-end justify-center cursor-pointer bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-sm"
                  style={{
                    width: slotWidth,
                    height: h + 14,
                    zIndex: zIdx,
                    opacity,
                  }}
                >
                  <div
                    className={`press-slab relative ${slabClass}`}
                    style={{
                      width: w,
                      height: h,
                      boxShadow: isActive
                        ? "0 22px 40px -12px rgba(0, 0, 0, 0.58), 0 4px 12px rgba(0, 0, 0, 0.35)"
                        : "0 10px 18px -8px rgba(0, 0, 0, 0.45)",
                    }}
                  >
                    {/* Peeking LP vinyl disc on active vinyl sleeve */}
                    {spec.hasPeekingDisc && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute top-2 right-0 rounded-full flex items-center justify-center transition-transform duration-500"
                        style={{
                          width: h - 16,
                          height: h - 16,
                          transform: `translateZ(${-1}px) translateX(${
                            isActive ? Math.round(w * 0.22) : 0
                          }px)`,
                          background:
                            "radial-gradient(circle, #18181b 24%, #09090b 25%, #27272a 26%, #09090b 38%, #18181b 55%, #09090b 72%, #27272a 98%)",
                          boxShadow: "0 8px 18px rgba(0,0,0,0.45)",
                        }}
                      >
                        <div
                          className="rounded-full flex items-center justify-center"
                          style={{
                            width: "30%",
                            height: "30%",
                            backgroundColor: pal.accent,
                          }}
                        >
                          <div className="h-2 w-2 rounded-full bg-neutral-900" />
                        </div>
                      </div>
                    )}

                    {/* Front Cover Face (+Z) */}
                    <div
                      className="press-face press-linen-grain absolute inset-0 overflow-hidden rounded-r-[3px] flex flex-col justify-between text-left"
                      style={{
                        transform: `translateZ(${Math.round(t / 2)}px)`,
                        backgroundColor: meta.isWishlist ? pal.surfaceSecondary : pal.coverBg,
                        color: pal.coverInk,
                        border: meta.isWishlist
                          ? `1.5px dashed ${pal.accent}`
                          : `1px solid rgba(255,255,255,0.12)`,
                      }}
                    >
                      {/* Spine hinge crease */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-0 w-3.5 z-20"
                        style={{
                          background:
                            "linear-gradient(90deg, rgba(0,0,0,0.34) 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
                        }}
                      />

                      {imgUrl ? (
                        spec.id === "archival_box" ||
                        spec.id === "linen_folio" ? (
                          <div className="relative flex h-full w-full flex-col justify-between p-3.5">
                            <span
                              className="font-mono text-[9px] uppercase tracking-[0.14em]"
                              style={{ color: pal.accent }}
                            >
                              {spec.label}
                            </span>
                            <div className="relative my-1.5 flex-1 overflow-hidden rounded-[2px] border border-white/15 bg-black/25">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imgUrl}
                                alt={meta.title}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <p className="font-serif-editorial text-xs font-medium leading-tight line-clamp-2">
                              {meta.title}
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={meta.title}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-0 bottom-0 h-14"
                              style={{
                                background:
                                  "linear-gradient(to top, rgba(0,0,0,0.52), transparent)",
                              }}
                            />
                          </>
                        )
                      ) : (
                        <div className="relative flex h-full w-full flex-col justify-between p-4 pl-5">
                          <div
                            className="h-full w-full p-2.5 flex flex-col justify-between"
                            style={{
                              borderWidth: "1px",
                              borderStyle: meta.isWishlist ? "dashed" : "solid",
                              borderColor: meta.isWishlist ? pal.accent : `${pal.coverInk}44`,
                            }}
                          >
                            <span
                              className="font-mono text-[9px] uppercase tracking-[0.14em]"
                              style={{ color: pal.accent }}
                            >
                              {meta.isWishlist ? `Wishlist · ${spec.label}` : spec.label}
                            </span>
                            <h4 className="font-serif-editorial text-[15px] leading-[1.15] font-medium line-clamp-4">
                              {meta.title}
                            </h4>
                            <div className="pt-1.5 border-t" style={{ borderColor: `${pal.coverInk}33` }}>
                              <span className="font-mono text-[9px] uppercase tracking-[0.1em] block truncate opacity-85">
                                {meta.creator}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Back Face (-Z) */}
                    <div
                      aria-hidden="true"
                      className="press-face absolute inset-0 rounded-l-[3px]"
                      style={{
                        transform: `rotateY(180deg) translateZ(${Math.round(
                          t / 2
                        )}px)`,
                        backgroundColor: pal.surfaceSecondary,
                      }}
                    />

                    {/* Left Spine Face (-X) */}
                    <div
                      aria-hidden="true"
                      className="press-face press-linen-grain absolute top-0 left-0 flex flex-col items-center justify-between py-2.5 overflow-hidden"
                      style={{
                        width: t,
                        height: h,
                        transform: `translateX(${-Math.round(
                          t / 2
                        )}px) rotateY(-90deg)`,
                        backgroundColor: pal.coverBg,
                        color: pal.coverInk,
                        borderLeft: "1px solid rgba(255,255,255,0.12)",
                        borderRight: "1px solid rgba(0,0,0,0.3)",
                      }}
                    >
                      <span
                        className="press-writing-v font-serif-editorial text-[11px] font-medium tracking-wide max-h-[68%] overflow-hidden text-ellipsis whitespace-nowrap"
                      >
                        {meta.title}
                      </span>
                      <span
                        className="font-mono text-[8px] uppercase tracking-wider opacity-75 truncate max-w-[90%]"
                        style={{ color: pal.accent }}
                      >
                        {meta.yearOrPrice || spec.label.slice(0, 4)}
                      </span>
                    </div>

                    {/* Right Edge / Neighboring Spine Face (+X) */}
                    <div
                      aria-hidden="true"
                      className="press-face press-linen-grain absolute top-0 flex flex-col items-center justify-between py-2.5 overflow-hidden"
                      style={{
                        left: w - Math.round(t / 2),
                        width: t,
                        height: h,
                        transform: "rotateY(90deg)",
                        backgroundColor:
                          isActive && spec.hasPageBlock ? "#E7E1D3" : pal.coverBg,
                        color:
                          isActive && spec.hasPageBlock
                            ? "#5B5448"
                            : pal.coverInk,
                        borderLeft: "1px solid rgba(0,0,0,0.22)",
                        borderRight: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      {isActive && spec.hasPageBlock ? (
                        <div
                          className="h-full w-full opacity-55"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)",
                          }}
                        />
                      ) : (
                        <>
                          <span className="press-writing-v font-serif-editorial text-[11px] font-medium tracking-wide max-h-[68%] overflow-hidden text-ellipsis whitespace-nowrap">
                            {meta.title}
                          </span>
                          <span
                            className="font-mono text-[8px] uppercase tracking-wider opacity-75 truncate max-w-[90%]"
                            style={{ color: pal.accent }}
                          >
                            {meta.yearOrPrice || spec.label.slice(0, 4)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Top Edge (+Y) */}
                    <div
                      aria-hidden="true"
                      className="press-face absolute top-0 left-0"
                      style={{
                        width: w,
                        height: t,
                        transform: `translateY(${-Math.round(
                          t / 2
                        )}px) rotateX(90deg)`,
                        backgroundColor: spec.hasPageBlock
                          ? "#EAE4D6"
                          : pal.surfaceSecondary,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Continuous shelf datum ledge */}
        <div
          aria-hidden="true"
          className="mx-6 sm:mx-10 h-px"
          style={{ backgroundColor: activePalette.rule }}
        />
      </div>
      )}

      {/* Museum Label & Whisper-Quiet Stripe Press Tick-Scale Scrubber */}
      <div className="relative z-10 px-5 sm:px-8 pt-2 pb-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <h3 className="font-serif-editorial text-2xl sm:text-[28px] leading-[1.15] font-normal tracking-tight text-[#F2EFE9]">
              {activeMeta.title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#A8A196]">
              {onSelectCreator &&
              activeMeta.creator &&
              activeMeta.creator.toLowerCase() !== "unknown author" ? (
                <button
                  type="button"
                  onClick={() => onSelectCreator(activeMeta.creator)}
                  className="text-[#C89572] hover:underline underline-offset-4 cursor-pointer text-left"
                  title={`View all books by ${activeMeta.creator}`}
                >
                  {activeMeta.creator}
                </button>
              ) : (
                <span>{activeMeta.creator}</span>
              )}
              {activeMeta.yearOrPrice && (
                <span className="font-mono tabular-nums">· {activeMeta.yearOrPrice}</span>
              )}
              {activeMeta.isWishlist && (
                <span className="font-mono text-[10px] text-[#C89572]">· Wishlist</span>
              )}
              {(activeCard.entity?.coreType === "BOOK" ||
                activeCard.save.typePath === "/product/book") &&
                resolveBookSources(activeCard.save as any, activeCard.entity as any).map(
                  (src) => (
                    <span key={src} className="font-mono text-[10px] opacity-80">
                      · {formatBookSourceLabel(src)}
                    </span>
                  )
                )}
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono text-xs shrink-0">
            <button
              type="button"
              onClick={() => onOpenObject(activeCard, "standard")}
              className="text-[#A8A196] hover:text-[#F2EFE9] transition-colors cursor-pointer"
            >
              Dossier
            </button>
            <button
              type="button"
              data-testid="press-open-stage"
              onClick={() => onOpenObject(activeCard, "press")}
              className="text-[#C89572] hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              Open Volume →
            </button>
          </div>
        </div>

        {/* Hairline Tick-Mark Index Ruler */}
        {items.length > 1 && (
          <div
            role="slider"
            tabIndex={0}
            aria-label="Jump to item on Press Shelf"
            aria-valuemin={1}
            aria-valuemax={items.length}
            aria-valuenow={safeIdx + 1}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
              setActiveByIndex(Math.round(ratio * (items.length - 1)));
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setActiveByIndex(safeIdx + 1);
              if (e.key === "ArrowLeft") setActiveByIndex(safeIdx - 1);
            }}
            className="flex items-end justify-between h-5 pt-1 border-t border-white/10 cursor-pointer select-none"
          >
            {(() => {
              const tickCount = Math.min(items.length, 48);
              const activeTick =
                items.length <= 1
                  ? 0
                  : Math.round((safeIdx / (items.length - 1)) * (tickCount - 1));
              return Array.from({ length: tickCount }, (_, i) => {
                const isAct = i === activeTick;
                return (
                  <span
                    key={i}
                    className="block transition-all duration-150"
                    style={{
                      width: "1px",
                      height: isAct ? "15px" : i % 6 === 0 ? "9px" : "5px",
                      backgroundColor: isAct ? "#C89572" : "rgba(242, 239, 233, 0.24)",
                    }}
                  />
                );
              });
            })()}
          </div>
        )}
      </div>
    </section>
  );
}
