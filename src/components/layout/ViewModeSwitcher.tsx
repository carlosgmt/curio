"use client";

import React from "react";
import { LayoutGrid, Columns3, Clock, Layers, Minimize2, Maximize2 } from "lucide-react";
import type { SilhouetteDensity } from "@/components/cards/registry";

export type LayoutEngineType = "masonry" | "grid" | "timeline";

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
  return (
    <div
      data-testid="view-mode-switcher"
      className={`inline-flex items-center gap-2 p-1 rounded-2xl bg-neutral-100/80 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80 backdrop-blur-md ${className}`}
    >
      {/* Layout Engine Switcher */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs">
        <button
          type="button"
          onClick={() => onLayoutChange("masonry")}
          title="Masonry Layout (Adaptive Aspect Ratios)"
          data-testid="switch-masonry"
          className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
            layout === "masonry"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
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
          className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
            layout === "grid"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
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
          className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
            layout === "timeline"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px] font-mono">Timeline</span>
        </button>
      </div>

      {/* Density Switcher */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs">
        <button
          type="button"
          onClick={() => onDensityChange("compact")}
          title="Compact Density (Index Rows)"
          data-testid="switch-density-compact"
          className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
            density === "compact"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onDensityChange("standard")}
          title="Standard Density"
          data-testid="switch-density-standard"
          className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
            density === "standard"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onDensityChange("expanded")}
          title="Expanded In-Situ Density"
          data-testid="switch-density-expanded"
          className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
            density === "expanded"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
