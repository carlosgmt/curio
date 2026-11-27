"use client";

import React from "react";
import { Plus, Heart, Lock, Globe } from "lucide-react";
import type { SmartList } from "@/db";

export interface ListTabsBarProps {
  lists: Array<SmartList & { itemCount: number }>;
  activeListSlug: string | null; // null = Stream
  totalAllSavesCount?: number;
  onSelectList: (slug: string | null) => void;
  onCreateListClick: () => void;
  wishlistActive?: boolean;
  wishlistCount?: number;
  onToggleWishlist?: () => void;
}

export function resolveRootBoardForSlug(
  lists: Array<SmartList & { itemCount: number }>,
  activeSlug: string | null
): (SmartList & { itemCount: number }) | null {
  if (!activeSlug) return null;
  const byId = new Map(lists.map((l) => [l.id, l]));
  let current = lists.find((l) => l.slug === activeSlug) || null;
  if (!current) return null;
  const visited = new Set<string>();
  while (current.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
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

  const activeRootBoard = React.useMemo(
    () => resolveRootBoardForSlug(lists, activeListSlug),
    [lists, activeListSlug]
  );

  // Level A shows only top-level root boards (sub-boards appear in Level B SubBoardsBar).
  // Orphans whose parentId isn't in `lists` are surfaced cleanly as fallback roots.
  const displayLists = React.useMemo(() => {
    const idSet = new Set(lists.map((l) => l.id));
    return lists.filter((l) => !l.parentId || !idSet.has(l.parentId));
  }, [lists]);

  return (
    <nav
      aria-label="Top-level boards"
      className="flex items-center gap-5 sm:gap-6 overflow-x-auto border-b border-border pb-0 mb-4 scrollbar-none"
    >
      {/* "Stream" Root Tab */}
      <button
        type="button"
        onClick={() => onSelectList(null)}
        className={`group inline-flex items-baseline gap-1.5 pb-2.5 -mb-px text-xs sm:text-[13px] whitespace-nowrap border-b-[1.5px] transition-colors duration-150 cursor-pointer shrink-0 ${
          activeListSlug === null && !wishlistActive
            ? "border-[var(--brand)] text-foreground font-medium"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <span>Stream</span>
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

      {/* User Curated Root Boards */}
      {displayLists.map((list) => {
        const isActive =
          activeListSlug === list.slug || activeRootBoard?.id === list.id;
        const subBoardCount = childCountMap.get(list.id) || 0;

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

export interface SubBoardsBarProps {
  rootBoard: SmartList & { itemCount: number };
  subBoards: Array<SmartList & { itemCount: number }>;
  activeListSlug: string;
  isPublic?: boolean;
  onSelectList: (slug: string) => void;
  onAddSubBoard?: () => void;
  rightActions?: React.ReactNode;
}

/**
 * Level B: Sub-boards of the selected top-level board + contextual board tools & 3-state exposure cue.
 */
export function SubBoardsBar({
  rootBoard,
  subBoards,
  activeListSlug,
  isPublic = false,
  onSelectList,
  onAddSubBoard,
  rightActions,
}: SubBoardsBarProps) {
  return (
    <div
      data-testid="sub-boards-bar"
      className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-border/70"
    >
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
        {subBoards.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => onSelectList(rootBoard.slug)}
              className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap transition-colors duration-150 cursor-pointer border ${
                activeListSlug === rootBoard.slug
                  ? "bg-[var(--brand)] text-[var(--brand-foreground)] border-[var(--brand)]"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              All {rootBoard.title}
            </button>

            {subBoards.map((sub) => {
              const isSubActive = activeListSlug === sub.slug;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onSelectList(sub.slug)}
                  className={`inline-flex items-baseline gap-1.5 px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap transition-colors duration-150 cursor-pointer border ${
                    isSubActive
                      ? "bg-[var(--brand)] text-[var(--brand-foreground)] border-[var(--brand)]"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  <span>{sub.title}</span>
                  <span className="text-[10px] tabular-nums opacity-75">
                    {sub.itemCount}
                  </span>
                </button>
              );
            })}
          </>
        )}

        {onAddSubBoard && (
          <button
            type="button"
            onClick={onAddSubBoard}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono text-muted-foreground hover:text-[var(--brand)] border border-dashed border-border hover:border-[var(--brand)]/50 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3 h-3" aria-hidden="true" />
            <span>Sub-Board</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 ml-auto">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-mono ${
            isPublic ? "text-[var(--brand)]" : "text-muted-foreground"
          }`}
        >
          {isPublic ? (
            <>
              <Globe className="w-3 h-3" aria-hidden="true" />
              <span>Shared · Editorial</span>
            </>
          ) : (
            <>
              <Lock className="w-3 h-3" aria-hidden="true" />
              <span>Private · Local Vault</span>
            </>
          )}
        </span>
        {rightActions}
      </div>
    </div>
  );
}
