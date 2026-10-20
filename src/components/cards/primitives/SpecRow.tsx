"use client";

import React from "react";

export interface SpecRowProps {
  label: string;
  value: string | number;
  mono?: boolean;
  unit?: string;
  className?: string;
}

export function SpecRow({
  label,
  value,
  mono = true,
  unit,
  className = "",
}: SpecRowProps) {
  return (
    <div
      data-testid="spec-row"
      className={`flex items-baseline justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 text-xs ${className}`}
    >
      <span className="text-neutral-500 uppercase tracking-wider text-[10px] font-sans">
        {label}
      </span>
      <span
        className={`font-semibold text-neutral-800 dark:text-neutral-200 ${
          mono ? "font-mono" : "font-sans"
        }`}
      >
        {value}
        {unit && <span className="ml-1 text-[10px] text-neutral-400 font-normal">{unit}</span>}
      </span>
    </div>
  );
}
