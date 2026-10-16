"use client";

import React from "react";
import { Folder, Sparkles, Plus, Layers, Lock, Globe, EyeOff } from "lucide-react";
import type { SmartList } from "@/db";

export interface ListTabsBarProps {
  lists: Array<SmartList & { itemCount: number }>;
  activeListSlug: string | null; // null = "All Curations"
  totalAllSavesCount?: number;
  onSelectList: (slug: string | null) => void;
  onCreateListClick: () => void;
}

export function ListTabsBar({
  lists,
  activeListSlug,
  totalAllSavesCount,
  onSelectList,
  onCreateListClick,
}: ListTabsBarProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-6 scrollbar-none">
      {/* "All Curations" Tab */}
      <button
        type="button"
        onClick={() => onSelectList(null)}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
          activeListSlug === null
            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
            : "bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400"
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>All Saves</span>
        {totalAllSavesCount !== undefined && (
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeListSlug === null
                ? "bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
            }`}
          >
            {totalAllSavesCount}
          </span>
        )}
      </button>

      {/* User Curated Boards */}
      {lists.map((list) => {
        const isActive = activeListSlug === list.slug;
        const hasAutoRules = !!list.autoRules;

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
            {hasAutoRules ? (
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-neutral-500" />
            )}
            <span>{list.title}</span>
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
