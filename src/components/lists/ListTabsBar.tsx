"use client";

import React from "react";
import { Folder, Sparkles, Plus, Layers, Heart, BookOpen, Film } from "lucide-react";
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
  // Map child board count and rolled-up descendant item counts per parent board
  const { childCountMap, rolledUpCountMap } = React.useMemo(() => {
    const childMap = new Map<string, number>();
    const childrenByParent = new Map<string, Array<SmartList & { itemCount: number }>>();
    for (const l of lists) {
      if (l.parentId) {
        childMap.set(l.parentId, (childMap.get(l.parentId) || 0) + 1);
        const arr = childrenByParent.get(l.parentId) || [];
        arr.push(l);
        childrenByParent.set(l.parentId, arr);
      }
    }
    const memo = new Map<string, number>();
    const computeTotal = (board: SmartList & { itemCount: number }, seen: Set<string>): number => {
      if (memo.has(board.id)) return memo.get(board.id)!;
      if (seen.has(board.id)) return board.itemCount || 0;
      const nextSeen = new Set(seen);
      nextSeen.add(board.id);
      const kids = childrenByParent.get(board.id) || [];
      let sum = board.itemCount || 0;
      for (const k of kids) {
        sum += computeTotal(k, nextSeen);
      }
      memo.set(board.id, sum);
      return sum;
    };
    for (const l of lists) {
      computeTotal(l, new Set());
    }
    return { childCountMap: childMap, rolledUpCountMap: memo };
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
    <nav
      aria-label="Curated boards"
      className="flex items-center gap-5 sm:gap-6 overflow-x-auto border-b border-border pb-0 mb-8 scrollbar-none"
    >
      {/* "All my stuff" Tab */}
      <button
        type="button"
        onClick={() => onSelectList(null)}
        className={`group inline-flex items-baseline gap-1.5 pb-2.5 -mb-px text-xs sm:text-[13px] whitespace-nowrap border-b-[1.5px] transition-colors duration-150 cursor-pointer shrink-0 ${
          activeListSlug === null && !wishlistActive
            ? "border-[var(--brand)] text-foreground font-medium"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <span>All my stuff</span>
        {totalAllSavesCount !== undefined && (
          <span
            className={`text-[11px] font-mono tabular-nums ${
              activeListSlug === null && !wishlistActive
                ? "text-[var(--brand)]"
                : "text-muted-foreground/75"
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
          className={`inline-flex items-baseline gap-1.5 pb-2.5 -mb-px text-xs sm:text-[13px] whitespace-nowrap border-b-[1.5px] transition-colors duration-150 cursor-pointer shrink-0 ${
            wishlistActive
              ? "border-[var(--brand)] text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart
            className={`w-3 h-3 self-center ${
              wishlistActive ? "fill-[var(--brand)] text-[var(--brand)]" : "text-muted-foreground"
            }`}
            aria-hidden="true"
          />
          <span>Wishlist</span>
          {wishlistCount !== undefined && (
            <span
              className={`text-[11px] font-mono tabular-nums ${
                wishlistActive ? "text-[var(--brand)]" : "text-muted-foreground/75"
              }`}
            >
              {wishlistCount}
            </span>
          )}
        </button>
      )}

      {/* User Curated Boards */}
      {displayLists.map((list) => {
        const isActive = activeListSlug === list.slug;
        const subBoardCount = childCountMap.get(list.id) || 0;
        const isNested = Boolean(list.parentId);

        return (
          <button
            key={list.id}
            type="button"
            onClick={() => onSelectList(list.slug)}
            className={`inline-flex items-baseline gap-1.5 pb-2.5 -mb-px text-xs sm:text-[13px] whitespace-nowrap border-b-[1.5px] transition-colors duration-150 cursor-pointer shrink-0 ${
              isActive
                ? "border-[var(--brand)] text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {isNested && <span className="text-muted-foreground text-[10px]">↳</span>}
            <span>{list.title}</span>

            {subBoardCount > 0 && (
              <span
                className="text-[10px] font-mono tabular-nums text-muted-foreground/70"
                title={`${subBoardCount} sub-boards`}
              >
                +{subBoardCount}
              </span>
            )}

            <span
              className={`text-[11px] font-mono tabular-nums ${
                isActive ? "text-[var(--brand)]" : "text-muted-foreground/75"
              }`}
            >
              {rolledUpCountMap.get(list.id) ?? list.itemCount}
            </span>
          </button>
        );
      })}

      {/* "+ New Board" Button */}
      <button
        type="button"
        onClick={onCreateListClick}
        className="inline-flex items-center gap-1 pb-2.5 -mb-px ml-auto text-xs font-mono whitespace-nowrap text-muted-foreground hover:text-[var(--brand)] border-b-[1.5px] border-transparent transition-colors duration-150 cursor-pointer shrink-0"
      >
        <Plus className="w-3 h-3" aria-hidden="true" />
        <span>New Board</span>
      </button>
    </nav>
  );
}
