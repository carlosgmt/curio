"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Heart, Maximize2, X } from "lucide-react";
import type { CardData } from "@/components/cards/PolymorphicCard";
import {
  formatSpineMeta,
  getDeterministicClothPalette,
} from "@/lib/press/archetypes";
import { apiFetch } from "@/lib/apiClient";

export interface BoardExhibitionModalProps {
  isOpen: boolean;
  items: CardData[];
  initialIndex?: number;
  boardTitle?: string;
  readOnly?: boolean;
  onClose: () => void;
  onInspectCard?: (card: CardData) => void;
  onWishToggled?: (saveId: string, wishlist: boolean) => void;
}

/**
 * Full-screen 100dvh horizontal CSS scroll-snap exhibition deck for immersive
 * mobile & desktop exploration. Tap canvas to toggle the frosted action HUD.
 */
export function BoardExhibitionModal({
  isOpen,
  items,
  initialIndex = 0,
  boardTitle = "Exhibition",
  readOnly = false,
  onClose,
  onInspectCard,
  onWishToggled,
}: BoardExhibitionModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pendingTargetRef = useRef<number | null>(null);
  const scrollFallbackTimerRef = useRef<number | null>(null);

  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, Math.min(Math.max(0, items.length - 1), initialIndex))
  );
  const [hudVisible, setHudVisible] = useState(true);
  const [wishOverrides, setWishOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      const clamped = Math.max(0, Math.min(Math.max(0, items.length - 1), initialIndex));
      setActiveIndex(clamped);
      setHudVisible(true);
      dialog.showModal();
      requestAnimationFrame(() => {
        const track = trackRef.current;
        if (track && track.clientWidth > 0) {
          track.scrollTo({ left: clamped * track.clientWidth, behavior: "auto" });
        }
      });
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, initialIndex, items.length]);

  const scrollToSlide = useCallback(
    (nextIdx: number) => {
      if (items.length === 0) return;
      const clamped = Math.max(0, Math.min(items.length - 1, nextIdx));
      setActiveIndex(clamped);
      const track = trackRef.current;
      if (!track || track.clientWidth <= 0) return;
      pendingTargetRef.current = clamped;
      track.scrollTo({
        left: clamped * track.clientWidth,
        behavior: "smooth",
      });
    },
    [items.length]
  );

  const settleScrollIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth <= 0) return;
    const width = track.clientWidth;
    const computed = Math.round(track.scrollLeft / width);
    const clamped = Math.max(0, Math.min(Math.max(0, items.length - 1), computed));
    if (pendingTargetRef.current !== null) {
      if (clamped === pendingTargetRef.current) {
        pendingTargetRef.current = null;
      } else {
        return;
      }
    }
    setActiveIndex(clamped);
  }, [items.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleScrollEnd = () => {
      if (scrollFallbackTimerRef.current !== null) {
        window.clearTimeout(scrollFallbackTimerRef.current);
        scrollFallbackTimerRef.current = null;
      }
      pendingTargetRef.current = null;
      settleScrollIndex();
    };

    const handleScroll = () => {
      // Skip per-frame updates while a scripted smooth scroll target is pending so Safari never stutters
      if (pendingTargetRef.current !== null) return;
      if (scrollFallbackTimerRef.current !== null) {
        window.clearTimeout(scrollFallbackTimerRef.current);
      }
      scrollFallbackTimerRef.current = window.setTimeout(() => {
        settleScrollIndex();
      }, 110);
    };

    track.addEventListener("scrollend", handleScrollEnd);
    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      track.removeEventListener("scrollend", handleScrollEnd);
      track.removeEventListener("scroll", handleScroll);
      if (scrollFallbackTimerRef.current !== null) {
        window.clearTimeout(scrollFallbackTimerRef.current);
      }
    };
  }, [settleScrollIndex]);

  const activeCard = items[activeIndex] ?? null;
  const activePalette = useMemo(
    () =>
      activeCard
        ? getDeterministicClothPalette(activeCard)
        : {
            id: "obsidian",
            surface: "#121110",
            surfaceSecondary: "#0B0A09",
            ink: "#F2EFE9",
            muted: "#A8A196",
            accent: "#4CA382",
            rule: "#2E2A25",
            coverBg: "#2B343E",
            coverInk: "#F2EFE9",
          },
    [activeCard]
  );

  const activeMeta = useMemo(
    () => (activeCard ? formatSpineMeta(activeCard) : null),
    [activeCard]
  );

  const isWished = activeCard
    ? wishOverrides[activeCard.save.id] ?? Boolean(activeCard.save.wishlist)
    : false;

  const toggleActiveWish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeCard || readOnly) return;
    const next = !isWished;
    setWishOverrides((prev) => ({ ...prev, [activeCard.save.id]: next }));
    try {
      const res = await apiFetch(`/api/v1/saves/${activeCard.save.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishlist: next }),
      });
      if (!res.ok) throw new Error("wish failed");
      onWishToggled?.(activeCard.save.id, next);
    } catch {
      setWishOverrides((prev) => ({ ...prev, [activeCard.save.id]: !next }));
    }
  };

  return (
    <dialog
      ref={dialogRef}
      data-testid="board-exhibition-modal"
      aria-label={`${boardTitle} Exhibition`}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          scrollToSlide(activeIndex + 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          scrollToSlide(activeIndex - 1);
        }
      }}
      className="w-screen max-w-none h-[100dvh] max-h-none m-0 p-0 bg-[#121110] text-[#F2EFE9] border-0 overflow-hidden"
    >
      <div
        className="relative w-full h-full flex flex-col justify-between select-none"
        style={{
          background: `radial-gradient(circle at 50% 42%, ${activePalette.coverBg}59 0%, #121110 72%)`,
          transition: "background 600ms ease",
        }}
      >
        {/* Top Minimal HUD */}
        <div
          className={`relative z-20 flex items-center justify-between px-4 sm:px-8 pt-[max(0.875rem,env(safe-area-inset-top))] pb-2 text-xs transition-opacity duration-200 ${
            hudVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A8A196] truncate max-w-[55vw]">
            {boardTitle}
          </span>
          <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
            <span className="text-[#A8A196]">
              {items.length > 0 ? `${activeIndex + 1} / ${items.length}` : "0 / 0"}
            </span>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/15 bg-white/10 backdrop-blur-md text-[#F2EFE9] hover:bg-white/15 transition cursor-pointer"
              aria-label="Close exhibition"
            >
              <span>Close</span>
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Horizontal Scroll-Snap Track */}
        <div
          ref={trackRef}
          onClick={() => setHudVisible((v) => !v)}
          className="flex-1 flex w-full overflow-x-auto snap-x snap-mandatory cursor-pointer [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            overscrollBehaviorX: "contain",
            touchAction: "manipulation",
          }}
        >
          {items.map((card, idx) => {
            const meta = formatSpineMeta(card);
            const csd =
              card.entity?.coreStructuredData &&
              typeof card.entity.coreStructuredData === "object"
                ? (card.entity.coreStructuredData as Record<string, any>)
                : {};
            const custom =
              card.save?.userCustomValues &&
              typeof card.save.userCustomValues === "object"
                ? (card.save.userCustomValues as Record<string, any>)
                : {};
            const imgUrl = card.entity?.heroImageUrl || csd.imageUrl || null;
            const quoteText =
              custom.text ||
              custom.quote_text ||
              csd.text ||
              csd.quote_text ||
              null;
            const isCutout =
              Boolean(csd.hasCutout) ||
              (typeof imgUrl === "string" &&
                (imgUrl.includes("/cutouts/") || imgUrl.toLowerCase().endsWith(".png")));

            return (
              <section
                key={card.save.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${idx + 1} of ${items.length}`}
                className="w-full shrink-0 snap-center flex flex-col items-center justify-center px-6 sm:px-14 py-4"
              >
                {imgUrl ? (
                  <div className="relative w-full max-w-md max-h-[60dvh] flex items-center justify-center">
                    <img
                      src={imgUrl}
                      alt={meta.title}
                      referrerPolicy="no-referrer"
                      className={`max-h-[58dvh] max-w-full rounded-lg ${
                        isCutout
                          ? "object-contain drop-shadow-[0_24px_38px_rgba(0,0,0,0.65)]"
                          : "object-contain shadow-[0_24px_48px_rgba(0,0,0,0.68)]"
                      }`}
                    />
                  </div>
                ) : quoteText ? (
                  <blockquote className="max-w-lg text-center px-4">
                    <p className="font-serif-editorial text-2xl sm:text-3xl leading-relaxed text-[#F2EFE9]">
                      &ldquo;{String(quoteText)}&rdquo;
                    </p>
                  </blockquote>
                ) : (
                  <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.04] p-7 text-center space-y-2 shadow-2xl">
                    <p className="font-serif-editorial text-2xl text-[#F2EFE9]">
                      {meta.title}
                    </p>
                    {meta.subtitle && (
                      <p className="text-sm text-[#A8A196] leading-relaxed">
                        {meta.subtitle}
                      </p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Accessible Slide Announcement */}
        <div className="sr-only" aria-live="polite">
          {activeMeta
            ? `${activeMeta.title}, slide ${activeIndex + 1} of ${items.length}`
            : ""}
        </div>

        {/* Bottom Museum Label + 1-Tap Frosted HUD */}
        <div className="relative z-20 px-5 sm:px-8 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/75 via-black/35 to-transparent space-y-3">
          {activeMeta && (
            <div className="max-w-lg mx-auto text-center space-y-0.5">
              <h2 className="font-serif-editorial text-xl sm:text-2xl text-[#F2EFE9] line-clamp-1">
                {activeMeta.title}
              </h2>
              <p className="text-xs font-mono text-[#A8A196] truncate">
                {[activeMeta.creator, activeMeta.yearOrPrice].filter(Boolean).join(" · ")}
              </p>
            </div>
          )}

          {/* Hairline Tick Progress */}
          {items.length > 1 && (
            <div className="max-w-md mx-auto flex items-center gap-1 h-2">
              {Array.from({ length: Math.min(items.length, 32) }, (_, i) => {
                const tickIdx = Math.round(
                  (activeIndex / Math.max(1, items.length - 1)) *
                    Math.max(0, Math.min(items.length, 32) - 1)
                );
                const isAct = i === tickIdx;
                return (
                  <span
                    key={i}
                    className="flex-1 rounded-full transition-all duration-150"
                    style={{
                      height: isAct ? "3px" : "1.5px",
                      backgroundColor: isAct ? "#4CA382" : "rgba(242, 239, 233, 0.22)",
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* 1-Tap Frosted Dark-Glass Action Row */}
          {hudVisible && activeCard && (
            <div className="mx-auto w-fit flex items-center gap-2 sm:gap-3 px-3 py-1.5 rounded-full border border-white/15 bg-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] text-xs font-mono">
              <button
                type="button"
                disabled={activeIndex <= 0}
                onClick={() => scrollToSlide(activeIndex - 1)}
                aria-label="Previous item"
                className="p-1 text-[#F2EFE9] disabled:opacity-30 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              {!readOnly && (
                <button
                  type="button"
                  onClick={toggleActiveWish}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition cursor-pointer ${
                    isWished ? "text-[#4CA382]" : "text-[#F2EFE9] hover:text-[#4CA382]"
                  }`}
                >
                  <Heart className={`w-3 h-3 ${isWished ? "fill-current" : ""}`} aria-hidden="true" />
                  <span>{isWished ? "Wished" : "Wish"}</span>
                </button>
              )}

              {onInspectCard && (
                <button
                  type="button"
                  onClick={() => {
                    const current = activeCard;
                    dialogRef.current?.close();
                    onInspectCard(current);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[#F2EFE9] hover:text-[#4CA382] transition cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" aria-hidden="true" />
                  <span>Dossier</span>
                </button>
              )}

              <button
                type="button"
                disabled={activeIndex >= items.length - 1}
                onClick={() => scrollToSlide(activeIndex + 1)}
                aria-label="Next item"
                className="p-1 text-[#F2EFE9] disabled:opacity-30 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
