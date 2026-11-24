"use client";

import React from "react";
import { Folder, Sparkles, Plus, Layers, Heart } from "lucide-react";
import type { SmartList } from "@/db";

export interface ListTabsBarProps {
  lists: Array<SmartList & { itemCount: number }>;
  activeListSlug: string | null; // null = "All Curations"
  totalAllSavesCount?: number;
  onSelectList: (slug: string | null) => void;
  onCreateListClick: () => void;
  wishlistActive?: boolean;
  wishlistCount?: number;
  onToggleWishlist?: () => void;
}

export function ListTabsBar({
  lists,
  activeListSlug,
  totalAllSavesCount,
  onSelectList,
  onCreateListClick,
  wishlistActive = false,
  wishlistCount,
  onToggleWishlist,
}: ListTabsBarProps) {
  // Map child board count per parent board
  const childCountMap = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lists) {
      if (l.parentId) {
        map.set(l.parentId, (map.get(l.parentId) || 0) + 1);
      }
    }
    return map;
  }, [lists]);

  // Display root boards by default, but always include the currently active board even if nested
  const displayLists = React.useMemo(() => {
    const roots = lists.filter((l) => !l.parentId);
    const active = lists.find((l) => l.slug === activeListSlug);
    if (active && active.parentId && !roots.some((r) => r.id === active.id)) {
      return [...roots, active];
    }
    return roots;
  }, [lists, activeListSlug]);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-6 scrollbar-none">
      {/* "All my stuff" Tab */}
      <button
        type="button"
        onClick={() => onSelectList(null)}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
          activeListSlug === null && !wishlistActive
            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
            : "bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400"
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>All my stuff</span>
        {totalAllSavesCount !== undefined && (
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeListSlug === null && !wishlistActive
                ? "bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
            }`}
          >
            {totalAllSavesCount}
          </span>
        )}
      </button>

      {/* Wishlist filter */}
      {onToggleWishlist && (
        <button
          type="button"
          data-testid="wishlist-filter"
          onClick={onToggleWishlist}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
            wishlistActive
              ? "bg-rose-500 text-white shadow-xs"
              : "bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400"
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${wishlistActive ? "fill-current" : "text-rose-500"}`} />
          <span>Wishlist</span>
          {wishlistCount !== undefined && <span className="text-[10px] font-mono opacity-80">{wishlistCount}</span>}
        </button>
      )}

      {/* User Curated Boards */}
      {displayLists.map((list) => {
        const isActive = activeListSlug === list.slug;
        const hasAutoRules = !!list.autoRules;
        const subBoardCount = childCountMap.get(list.id) || 0;
        const isNested = Boolean(list.parentId);

        return (
          <button
            key={list.id}
            type="button"
            onClick={() => onSelectList(list.slug)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
              isActive
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                : "bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400"
            }`}
          >
            {isNested && <span className="text-neutral-400 text-[10px]">↳</span>}
            {hasAutoRules ? (
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-neutral-500" />
            )}
            <span>{list.title}</span>

            {/* Sub-boards indicator */}
            {subBoardCount > 0 && (
              <span
                className={`text-[9px] px-1 py-0.2 rounded-md font-mono ${
                  isActive
                    ? "bg-neutral-700 text-white dark:bg-neutral-300 dark:text-neutral-900"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                }`}
                title={`${subBoardCount} sub-boards`}
              >
                +{subBoardCount}
              </span>
            )}

            {/* Card count badge */}
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isActive
                  ? "bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
              }`}
            >
              {list.itemCount}
            </span>
          </button>
        );
      })}

      {/* "+ New Board" Button */}
      <button
        type="button"
        onClick={onCreateListClick}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 transition cursor-pointer shrink-0"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>New Board</span>
      </button>
    </div>
  );
}
