"use client";

import React from "react";
import { ChevronRight, Home, Folder } from "lucide-react";

export interface BreadcrumbItem {
  id: string;
  title: string;
  slug: string;
}

export interface BreadcrumbNavProps {
  ancestors: BreadcrumbItem[];
  currentTitle?: string;
  onSelectBoard: (slug: string | null) => void;
  className?: string;
}

export function BreadcrumbNav({
  ancestors,
  currentTitle,
  onSelectBoard,
  className = "",
}: BreadcrumbNavProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 overflow-x-auto py-1 scrollbar-none ${className}`}
    >
      <button
        type="button"
        onClick={() => onSelectBoard(null)}
        className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer shrink-0 font-medium"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Home</span>
      </button>

      {ancestors.map((item) => (
        <React.Fragment key={item.id}>
          <ChevronRight className="w-3 h-3 text-neutral-400 shrink-0" />
          <button
            type="button"
            onClick={() => onSelectBoard(item.slug)}
            className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer shrink-0 font-medium"
          >
            <Folder className="w-3 h-3 text-neutral-400" />
            <span className="truncate max-w-[140px]">{item.title}</span>
          </button>
        </React.Fragment>
      ))}

      {currentTitle && (
        <>
          <ChevronRight className="w-3 h-3 text-neutral-400 shrink-0" />
          <span className="font-semibold text-neutral-900 dark:text-neutral-100 shrink-0 truncate max-w-[180px]">
            {currentTitle}
          </span>
        </>
      )}
    </nav>
  );
}
