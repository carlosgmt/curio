"use client";

import React, { useState, useEffect, useId } from "react";
import { FolderPlus, Check, Plus, Loader2, X, BookmarkCheck, Sparkles } from "lucide-react";
import type { SmartList } from "@/db";
import { apiFetch } from "@/lib/apiClient";

export interface AddToListPopoverProps {
  saveId: string;
  isOpen: boolean;
  onClose: () => void;
  onListUpdated?: () => void;
}

type BoardMembershipRow = SmartList & {
  itemCount: number;
  isMember?: boolean;
  isAutoMatched?: boolean;
};

interface FlatBoardWithDepth {
  list: BoardMembershipRow;
  depth: number;
}

function flattenBoardTree(lists: BoardMembershipRow[]): FlatBoardWithDepth[] {
  const childrenMap = new Map<string | null, BoardMembershipRow[]>();

  for (const l of lists) {
    const pId = l.parentId || null;
    if (!childrenMap.has(pId)) {
      childrenMap.set(pId, []);
    }
    childrenMap.get(pId)!.push(l);
  }

  const result: FlatBoardWithDepth[] = [];

  function traverse(parentId: string | null, depth: number) {
    const children = childrenMap.get(parentId) || [];
    for (const child of children) {
      result.push({ list: child, depth });
      traverse(child.id, depth + 1);
    }
  }

  traverse(null, 0);

  // If there are orphaned boards whose parent isn't in lists, append at depth 0
  const visited = new Set(result.map((r) => r.list.id));
  for (const l of lists) {
    if (!visited.has(l.id)) {
      result.push({ list: l, depth: 0 });
    }
  }

  return result;
}

export function AddToListPopover({
  saveId,
  isOpen,
  onClose,
  onListUpdated,
}: AddToListPopoverProps) {
  const [lists, setLists] = useState<BoardMembershipRow[]>([]);
  const [assignedListIds, setAssignedListIds] = useState<Set<string>>(new Set());
  const [autoMatchedIds, setAutoMatchedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const headingId = useId();

  // Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Single O(1) query for boards + memberships + auto-rule status
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    apiFetch(`/api/v1/lists/memberships?saveId=${encodeURIComponent(saveId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        const userBoards: BoardMembershipRow[] = Array.isArray(data?.boards) ? data.boards : [];
        setLists(userBoards);
        setAssignedListIds(new Set(userBoards.filter((b) => b.isMember).map((b) => b.id)));
        setAutoMatchedIds(new Set(userBoards.filter((b) => b.isAutoMatched).map((b) => b.id)));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch board memberships:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, saveId]);

  const handleToggle = async (list: BoardMembershipRow) => {
    if (isSaving) return;
    const isCurrentlyAssigned = assignedListIds.has(list.id);
    const nextAssigned = new Set(assignedListIds);

    if (isCurrentlyAssigned) {
      nextAssigned.delete(list.id);
    } else {
      nextAssigned.add(list.id);
    }

    setAssignedListIds(nextAssigned);
    setIsSaving(true);

    try {
      if (isCurrentlyAssigned) {
        const res = await apiFetch(`/api/v1/lists/${list.slug}/items?saveId=${encodeURIComponent(saveId)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to remove item");
      } else {
        const res = await apiFetch(`/api/v1/lists/${list.slug}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saveId }),
        });
        if (!res.ok) throw new Error("Failed to add item");
      }

      setLists((prev) =>
        prev.map((b) =>
          b.id === list.id
            ? {
                ...b,
                isMember: !isCurrentlyAssigned,
                itemCount: b.isAutoMatched
                  ? b.itemCount
                  : Math.max(0, b.itemCount + (isCurrentlyAssigned ? -1 : 1)),
              }
            : b
        )
      );
      onListUpdated?.();
    } catch (err) {
      console.error("Failed to toggle list item:", err);
      setAssignedListIds(assignedListIds);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const res = await apiFetch("/api/v1/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), visibility: "PUBLIC" }),
      });

      if (res.ok) {
        const { list } = await res.json();
        await apiFetch(`/api/v1/lists/${list.slug}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saveId }),
        });

        setLists((prev) => [{ ...list, itemCount: 1, isMember: true }, ...prev]);
        setAssignedListIds((prev) => new Set([...prev, list.id]));
        setNewTitle("");
        onListUpdated?.();
      }
    } catch (err) {
      console.error("Failed to create list:", err);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const flatBoards = flattenBoardTree(lists);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-2xs animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
            <h3 id={headingId} className="text-sm font-bold font-serif text-neutral-900 dark:text-neutral-100">
              Add to Curated Board
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close board selector"
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lists Container (Hierarchical Tree) */}
        <div className="py-3 overflow-y-auto overscroll-contain space-y-1.5 flex-1 min-h-[140px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-neutral-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading boards...</span>
            </div>
          ) : flatBoards.length === 0 ? (
            <p className="text-center py-6 text-xs text-neutral-400">
              No curated boards yet. Create your first board below.
            </p>
          ) : (
            flatBoards.map(({ list, depth }) => {
              const isManual = assignedListIds.has(list.id);
              const isAuto = autoMatchedIds.has(list.id);
              const isHighlighted = isManual || isAuto;
              return (
                <button
                  key={list.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isHighlighted}
                  onClick={() => handleToggle(list)}
                  style={{ paddingLeft: `${10 + depth * 14}px` }}
                  className={`w-full text-left flex items-center justify-between py-2.5 pr-2.5 rounded-xl text-xs cursor-pointer select-none transition border ${
                    isHighlighted
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-2xs"
                      : "bg-neutral-50 dark:bg-neutral-950/50 border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {depth > 0 && (
                      <span className="text-neutral-400 select-none font-mono text-[11px] shrink-0">
                        └
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="block font-medium truncate">{list.title}</span>
                        {isAuto && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-amber-500/20 text-amber-300 dark:text-amber-700 shrink-0">
                            <Sparkles className="w-2.5 h-2.5" />
                            Auto
                          </span>
                        )}
                      </div>
                      <span
                        className={`block text-[10px] ${
                          isHighlighted
                            ? "text-neutral-300 dark:text-neutral-600"
                            : "text-neutral-400"
                        }`}
                      >
                        /list/{list.slug} • {list.itemCount} items
                      </span>
                    </div>
                  </div>

                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                      isHighlighted
                        ? "bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white border-transparent"
                        : "border-neutral-300 dark:border-neutral-600"
                    }`}
                  >
                    {isHighlighted && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Quick New List Form */}
        <form
          onSubmit={handleCreateAndAdd}
          className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-1.5"
        >
          <input
            type="text"
            aria-label="New board title"
            placeholder="New board title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || isCreating}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40 transition cursor-pointer shrink-0"
          >
            {isCreating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Create</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
