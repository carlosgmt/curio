"use client";

import React from "react";

export interface HairlineTickRulerProps {
  total: number;
  activeIndex: number;
  onChange: (nextIndex: number) => void;
  ariaLabel?: string;
  maxTicks?: number;
  accentColor?: string;
  ruleColor?: string;
  tickColor?: string;
  className?: string;
}

/**
 * Architectural 1px vertical hairline tick ruler shared by 3D stages, exhibition decks,
 * and quantitative archival instruments (biometrics, timelines).
 */
export function HairlineTickRuler({
  total,
  activeIndex,
  onChange,
  ariaLabel = "Scrub index",
  maxTicks = 48,
  accentColor = "var(--brand)",
  ruleColor = "rgba(255, 255, 255, 0.1)",
  tickColor = "rgba(242, 239, 233, 0.24)",
  className = "",
}: HairlineTickRulerProps) {
  if (total <= 1) return null;

  const safeIdx = Math.max(0, Math.min(total - 1, activeIndex));
  const tickCount = Math.min(total, maxTicks);
  const activeTick = Math.round((safeIdx / Math.max(1, total - 1)) * (tickCount - 1));

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={safeIdx + 1}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(
          0,
          Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))
        );
        onChange(Math.round(ratio * (total - 1)));
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange(Math.min(total - 1, safeIdx + 1));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(Math.max(0, safeIdx - 1));
        } else if (e.key === "Home") {
          e.preventDefault();
          onChange(0);
        } else if (e.key === "End") {
          e.preventDefault();
          onChange(total - 1);
        }
      }}
      className={`flex items-end justify-between h-5 pt-1 border-t cursor-pointer select-none ${className}`}
      style={{ borderColor: ruleColor }}
    >
      {Array.from({ length: tickCount }, (_, i) => {
        const isAct = i === activeTick;
        return (
          <span
            key={i}
            className="block transition-all duration-150"
            style={{
              width: "1px",
              height: isAct ? "15px" : i % 6 === 0 ? "9px" : "5px",
              backgroundColor: isAct ? accentColor : tickColor,
            }}
          />
        );
      })}
    </div>
  );
}
