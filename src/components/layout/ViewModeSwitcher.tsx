"use client";

import React from "react";
import { LayoutGrid, Columns3, Clock, Layers, Minimize2, Maximize2, BookOpen, Film } from "lucide-react";
import type { SilhouetteDensity } from "@/components/cards/registry";

export type LayoutEngineType = "masonry" | "grid" | "timeline" | "shelf" | "posters";

export interface ViewModeSwitcherProps {
  layout: LayoutEngineType;
  density: SilhouetteDensity;
  onLayoutChange: (layout: LayoutEngineType) => void;
  onDensityChange: (density: SilhouetteDensity) => void;
  className?: string;
}

export function ViewModeSwitcher({
  layout,
  density,
  onLayoutChange,
  onDensityChange,
  className = "",
}: ViewModeSwitcherProps) {
  const showDensity = layout !== "shelf" && layout !== "posters";

  return (
    <div
      data-testid="view-mode-switcher"
      className={`inline-flex items-center gap-1.5 p-1 rounded-xl bg-card border border-[var(--gallery-hairline)] shadow-2xs ${className}`}
    >
      {/* Layout Engine Switcher */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onLayoutChange("masonry")}
          title="Masonry Layout (Adaptive Aspect Ratios)"
          data-testid="switch-masonry"
          className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer flex items-center gap-1 ${
            layout === "masonry"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Columns3 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px] font-mono">Masonry</span>
        </button>

        <button
          type="button"
          onClick={() => onLayoutChange("grid")}
          title="Grid Layout (Uniform)"
          data-testid="switch-grid"
          className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer flex items-center gap-1 ${
            layout === "grid"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px] font-mono">Grid</span>
        </button>

        <button
          type="button"
          onClick={() => onLayoutChange("timeline")}
          title="Chronological Timeline Layout"
          data-testid="switch-timeline"
          className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer flex items-center gap-1 ${
            layout === "timeline"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px] font-mono">Timeline</span>
        </button>

        <button
          type="button"
          onClick={() => onLayoutChange("shelf")}
          title="Press Shelf Layout (3D)"
          data-testid="switch-shelf"
          className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer flex items-center gap-1 ${
            layout === "shelf"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px] font-mono">Shelf</span>
        </button>

        <button
          type="button"
          onClick={() => onLayoutChange("posters")}
          title="Cinema Poster Gallery (3D)"
          data-testid="switch-posters"
          className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer flex items-center gap-1 ${
            layout === "posters"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px] font-mono">Posters</span>
        </button>
      </div>

      {/* Density Switcher (omitted in 3D Shelf & Posters views where density has no effect) */}
      {showDensity && (
        <div className="flex items-center gap-0.5 pl-1.5 border-l border-[var(--gallery-hairline)]">
          <button
            type="button"
            onClick={() => onDensityChange("compact")}
            title="Compact Density (Index Rows)"
            data-testid="switch-density-compact"
            className={`p-1 rounded-lg text-xs transition-colors duration-150 cursor-pointer ${
              density === "compact"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDensityChange("standard")}
            title="Standard Density"
            data-testid="switch-density-standard"
            className={`p-1 rounded-lg text-xs transition-colors duration-150 cursor-pointer ${
              density === "standard"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDensityChange("expanded")}
            title="Expanded In-Situ Density"
            data-testid="switch-density-expanded"
            className={`p-1 rounded-lg text-xs transition-colors duration-150 cursor-pointer ${
              density === "expanded"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
