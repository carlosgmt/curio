"use client";

import React from "react";

export interface StatBadgeProps {
  value: string | number;
  unit?: string;
  label?: string;
  className?: string;
}

export function StatBadge({ value, unit, label, className = "" }: StatBadgeProps) {
  return (
    <div
      data-testid="stat-badge"
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-700/80 text-xs font-mono ${className}`}
    >
      {label && <span className="text-[10px] uppercase text-neutral-400 mr-0.5">{label}</span>}
      <span className="font-bold">{value}</span>
      {unit && <span className="text-[10px] text-neutral-500 font-normal">{unit}</span>}
    </div>
  );
}
