"use client";

import React from "react";

export interface MeterGaugeProps {
  value: number;
  max?: number;
  label?: string;
  showScore?: boolean;
  className?: string;
}

export function MeterGauge({
  value,
  max = 5,
  label,
  showScore = true,
  className = "",
}: MeterGaugeProps) {
  const normalizedValue = Math.max(0, Math.min(value, max));
  const segments = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div data-testid="meter-gauge" className={`flex flex-col gap-1 ${className}`}>
      {(label || showScore) && (
        <div className="flex items-center justify-between text-[11px] font-mono">
          {label && <span className="text-neutral-500 uppercase tracking-wider text-[10px]">{label}</span>}
          {showScore && (
            <span className="font-bold text-neutral-800 dark:text-neutral-200">
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-1">
        {segments.map((seg) => {
          const filled = seg <= normalizedValue;
          return (
            <div
              key={seg}
              data-testid={`meter-gauge-segment-${seg}`}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                filled
                  ? "bg-amber-500 dark:bg-amber-400"
                  : "bg-neutral-200 dark:bg-neutral-800"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
