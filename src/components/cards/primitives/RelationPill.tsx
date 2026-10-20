"use client";

import React from "react";
import { Link2, ArrowUpRight } from "lucide-react";

export interface RelationPillProps {
  relationType?: string;
  targetTitle: string;
  targetId?: string;
  onClick?: () => void;
  className?: string;
}

export function RelationPill({
  relationType = "RELATED_TO",
  targetTitle,
  targetId,
  onClick,
  className = "",
}: RelationPillProps) {
  const formattedRelation = relationType.replace(/_/g, " ").toUpperCase();

  return (
    <button
      type="button"
      data-testid="relation-pill"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs hover:bg-amber-100 dark:hover:bg-amber-900/60 active:scale-95 transition cursor-pointer group ${className}`}
    >
      <Link2 className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-[9px] font-mono font-bold tracking-wider opacity-70">
        {formattedRelation}:
      </span>
      <span className="font-medium truncate max-w-[140px]">{targetTitle}</span>
      <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
