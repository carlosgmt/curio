"use client";

import React from "react";
import type { CulturalPresentationMode } from "../registry";
import { ShoppingBag, BookOpen, Layers, Eye, Tag, ExternalLink } from "lucide-react";

export interface CulturalModeWrapperProps {
  mode?: CulturalPresentationMode;
  entity?: any;
  save?: any;
  children: React.ReactNode;
}

export function CulturalModeWrapper({
  mode = "gallery",
  entity,
  save,
  children,
}: CulturalModeWrapperProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity?.coreStructuredData) || {};
  const title = entity?.title || save?.privateTitle || "Item";
  const brand = entity?.brandOrCreator || "Curator Collection";

  if (!mode || mode === "gallery") {
    // Gallery: Visual-first, museum matting, uncropped hero art
    return (
      <div data-testid="cultural-mode-gallery" className="p-3 bg-stone-100/70 dark:bg-stone-900/40 rounded-3xl border border-stone-200/60 dark:border-stone-800">
        <div className="relative rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-stone-900">
          {children}
        </div>
      </div>
    );
  }

  if (mode === "collector") {
    // Collector: Archival specs, catalog number, edition, matrix code
    const catalogNo = data.catalogNo || data.matrixCode || `CUR-${save?.id?.slice(0, 6).toUpperCase() || "ARCH"}`;
    const edition = data.edition || "First Edition (Archive)";
    return (
      <div data-testid="cultural-mode-collector" className="p-3 bg-neutral-900 text-neutral-100 rounded-3xl border border-neutral-800 shadow-md">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-[10px] font-mono text-amber-400">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            <span>CAT: {catalogNo}</span>
          </span>
          <span className="text-neutral-400">{edition}</span>
        </div>
        {children}
      </div>
    );
  }

  if (mode === "academic") {
    // Academic: Citation-first, MLA/Chicago bibliography, margin annotations
    const citation = `${brand}. "${title}." Curio Archive Repository, ${new Date().getFullYear()}.`;
    return (
      <div data-testid="cultural-mode-academic" className="p-4 bg-amber-50/40 dark:bg-stone-950 rounded-3xl border border-amber-200/60 dark:border-stone-800 font-serif">
        <div className="text-[11px] font-serif italic text-stone-600 dark:text-stone-400 pb-2 mb-2 border-b border-stone-200 dark:border-stone-800">
          {citation}
        </div>
        {children}
      </div>
    );
  }

  if (mode === "minimalist") {
    // Minimalist: Strict Swiss reduction, typography only, zero framing
    return (
      <div data-testid="cultural-mode-minimalist" className="p-2 border-l-2 border-neutral-900 dark:border-neutral-100 font-sans">
        {children}
      </div>
    );
  }

  if (mode === "bazaar") {
    // Bazaar: Commerce-first, multi-merchant comparison table, discount badges
    return (
      <div data-testid="cultural-mode-bazaar" className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-3xl border border-emerald-500/40 shadow-sm">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-200 dark:border-neutral-800 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
          <span className="flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" />
            <span>Bazaar Mode • Best Sourced Offer</span>
          </span>
          <span>Verified Merchant</span>
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
