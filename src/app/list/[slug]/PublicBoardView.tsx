"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Share2, Check, BookmarkPlus, ShoppingBag, Loader2, Maximize2, SlidersHorizontal } from "lucide-react";
import type { CardData } from "@/components/cards/PolymorphicCard";
import { SectionGroupView } from "@/components/lists/SectionGroupView";
import { SplitBagCheckoutDrawer } from "@/components/commerce/SplitBagCheckoutDrawer";
import { CardLightboxModal } from "@/components/lightbox/CardLightboxModal";
import { BoardFilterSheet } from "@/components/lists/BoardFilterSheet";
import { BoardExhibitionModal } from "@/components/lists/BoardExhibitionModal";
import { CurioLogo, CurioMark } from "@/components/layout/CurioLogo";
import type { ListWithSections } from "@/lib/lists/service";
import { apiFetch } from "@/lib/apiClient";

export function PublicBoardView({
  data,
  isOwner = false,
}: {
  data: ListWithSections;
  isOwner?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [selectedPresentation, setSelectedPresentation] = useState<"standard" | "press">("standard");
  const [isExhibitionOpen, setIsExhibitionOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [mobileBarHidden, setMobileBarHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const { list, owner, itemCount, sections } = data;

  const exhibitionItems = useMemo<CardData[]>(
    () => sections.flatMap((s) => s.items as unknown as CardData[]),
    [sections]
  );

  useEffect(() => {
    const onScroll = () => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const y = Math.max(0, Math.min(window.scrollY, maxScroll));
      const delta = y - lastScrollYRef.current;
      if (y <= 48) {
        setMobileBarHidden(false);
      } else if (delta > 8 && y > 64) {
        setMobileBarHidden(true);
      } else if (delta < -6) {
        setMobileBarHidden(false);
      }
      lastScrollYRef.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloneBoard = async () => {
    setCloning(true);
    try {
      const res = await apiFetch(`/api/v1/lists/${list.slug}/clone`, {
        method: "POST",
      });
      if (res.ok) {
        setCloned(true);
        setTimeout(() => setCloned(false), 3000);
      }
    } catch (err) {
      console.error("Failed to clone board:", err);
    } finally {
      setCloning(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground pb-16">
      {/* < 48px Auto-Hiding Mobile Sticky Header */}
      <div
        className={`md:hidden sticky top-0 z-30 h-11 px-3 flex items-center justify-between gap-2 bg-background/90 backdrop-blur-md border-b border-border transition-transform duration-150 ${
          mobileBarHidden ? "-translate-y-full focus-within:translate-y-0" : "translate-y-0"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            aria-label="Back to Curio Stream"
            className="inline-flex items-center gap-1.5 text-foreground hover:opacity-80 transition-opacity shrink-0"
          >
            <CurioMark size={18} variant="compact" />
          </Link>
          <span className="truncate font-serif text-sm text-foreground">
            {list.title}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">
            · {itemCount}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileFilterOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border border-border bg-card text-foreground cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Tools</span>
          </button>
          {exhibitionItems.length > 0 && (
            <button
              type="button"
              data-testid="mobile-open-exhibition-btn"
              onClick={() => setIsExhibitionOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono bg-[var(--brand)] text-[var(--brand-foreground)] cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Immerse</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop Top Navigation */}
      <div className="hidden md:flex max-w-6xl mx-auto px-6 lg:px-8 pt-6 pb-4 items-center justify-between border-b border-border/80 mb-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-foreground hover:opacity-85 transition-opacity"
        >
          <CurioLogo size={24} />
        </Link>

        <div className="flex items-center gap-2">
          {exhibitionItems.length > 0 && (
            <button
              type="button"
              data-testid="open-exhibition-btn"
              onClick={() => setIsExhibitionOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-card border border-border text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>Immerse</span>
            </button>
          )}

          {/* Buy Entire Board UCP Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsCheckoutOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--brand-soft)] hover:opacity-90 text-[var(--brand)] border border-[var(--brand)]/25 transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Buy Entire Board</span>
          </button>

          {/* Save to My Curio Clone Flow */}
          <button
            type="button"
            onClick={handleCloneBoard}
            disabled={cloning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {cloning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Cloning...</span>
              </>
            ) : cloned ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved to Library</span>
              </>
            ) : (
              <>
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Save to My Curio</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-card border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[var(--brand)]" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Board</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editorial Board Hero Header */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center pt-6 md:pt-2 mb-10 md:mb-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--brand)] mb-3 tabular-nums">
          Shared · Editorial Collection · {itemCount} {itemCount === 1 ? "Item" : "Items"}
        </p>

        <h1 className="text-4xl sm:text-5xl font-serif font-normal tracking-tight text-foreground mb-4">
          {list.title}
        </h1>

        {list.description && (
          <p className="text-base sm:text-lg font-serif italic text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-5">
            &ldquo;{list.description}&rdquo;
          </p>
        )}

        {/* Quiet Inline Curator Attribution */}
        {owner && (
          <div className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground">
            {owner.avatarUrl ? (
              <img
                src={owner.avatarUrl}
                alt={owner.username}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
                {owner.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span>
              Curated by <strong className="font-medium text-foreground">@{owner.username}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Sections and Cards Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionGroupView
          sections={sections}
          creatorAffiliateTags={owner?.affiliateTags}
          readOnly={!isOwner}
          onCardClick={(card, presentation) => {
            setSelectedPresentation(presentation || "standard");
            setSelectedCard(card);
          }}
        />
      </div>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 text-center mt-20 pt-8 border-t border-border text-xs text-muted-foreground">
        <p>
          Curated with <strong className="text-foreground font-serif">Curio</strong>.
          Every card links to canonical merchant sources with verified curation provenance.
        </p>
      </footer>

      {/* Mobile Filter & Board Actions Sheet */}
      <BoardFilterSheet
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        title={list.title}
        subtitle={`${itemCount} ${itemCount === 1 ? "Item" : "Items"}`}
      >
        <div className="flex flex-col gap-2.5">
          {exhibitionItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsMobileFilterOpen(false);
                setIsExhibitionOpen(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono bg-[var(--brand)] text-[var(--brand-foreground)] cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Open Exhibition Mode</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsMobileFilterOpen(false);
              setIsCheckoutOpen(true);
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/25 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Buy Entire Board</span>
          </button>
          <button
            type="button"
            onClick={handleCloneBoard}
            disabled={cloning}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono bg-card border border-border text-foreground cursor-pointer disabled:opacity-50"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>{cloning ? "Cloning..." : cloned ? "Saved to Library" : "Save to My Curio"}</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono bg-card border border-border text-muted-foreground cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copied ? "Link Copied" : "Share Board"}</span>
          </button>
        </div>
      </BoardFilterSheet>

      {/* Immersive Mobile & Desktop Scroll-Snap Exhibition Deck */}
      <BoardExhibitionModal
        isOpen={isExhibitionOpen}
        items={exhibitionItems}
        boardTitle={list.title}
        readOnly={!isOwner}
        onClose={() => setIsExhibitionOpen(false)}
        onInspectCard={(card) => {
          setIsExhibitionOpen(false);
          setSelectedPresentation("standard");
          setSelectedCard(card);
        }}
      />

      {/* Lightbox Dossier / Press Reader */}
      <CardLightboxModal
        card={selectedCard}
        isOpen={Boolean(selectedCard)}
        readOnly={!isOwner}
        creatorAffiliateTags={owner?.affiliateTags}
        initialPresentation={selectedPresentation}
        onClose={() => setSelectedCard(null)}
      />

      {/* Split-Bag UCP Checkout Slide-Over Drawer */}
      <SplitBagCheckoutDrawer
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        boardId={list.id}
        boardTitle={list.title}
      />
    </main>
  );
}
