"use client";

import React, { useState, useEffect } from "react";
import { FolderPlus, Check, Plus, Loader2, X, BookmarkCheck } from "lucide-react";
import type { SmartList } from "@/db";

export interface AddToListPopoverProps {
  saveId: string;
  isOpen: boolean;
  onClose: () => void;
  onListUpdated?: () => void;
}

export function AddToListPopover({
  saveId,
  isOpen,
  onClose,
  onListUpdated,
}: AddToListPopoverProps) {
  const [lists, setLists] = useState<Array<SmartList & { itemCount: number }>>([]);
  const [assignedListIds, setAssignedListIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Load lists and current memberships
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    fetch("/api/v1/lists")
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (!isMounted || !data?.lists) return;
        const userLists: Array<SmartList & { itemCount: number }> = data.lists;
        setLists(userLists);

        // Check each list for membership
        const activeIds = new Set<string>();
        await Promise.all(
          userLists.map(async (l) => {
            try {
              const res = await fetch(`/api/v1/lists/${l.slug}`);
              if (res.ok) {
                const listData = await res.json();
                const hasSave = listData.sections?.some((sec: any) =>
                  sec.items?.some((it: any) => it.save?.id === saveId)
                );
                if (hasSave) {
                  activeIds.add(l.id);
                }
              }
            } catch {}
          })
        );

        if (isMounted) {
          setAssignedListIds(activeIds);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch lists:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, saveId]);

  const handleToggle = async (list: SmartList) => {
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
        // Remove item from list
        await fetch(`/api/v1/lists/${list.slug}/items?saveId=${saveId}`, {
          method: "DELETE",
        });
      } else {
        // Add item to list
        await fetch(`/api/v1/lists/${list.slug}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saveId }),
        });
      }

      onListUpdated?.();
    } catch (err) {
      console.error("Failed to toggle list item:", err);
      // Revert on error
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
      const res = await fetch("/api/v1/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), visibility: "PUBLIC" }),
      });

      if (res.ok) {
        const { list } = await res.json();
        // Add save to newly created list
        await fetch(`/api/v1/lists/${list.slug}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saveId }),
        });

        setLists((prev) => [{ ...list, itemCount: 1 }, ...prev]);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
            <h3 className="text-sm font-bold font-serif text-neutral-900 dark:text-neutral-100">
              Add to Curated Board
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lists Container */}
        <div className="py-3 overflow-y-auto space-y-1.5 flex-1 min-h-[140px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-neutral-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading boards...</span>
            </div>
          ) : lists.length === 0 ? (
            <p className="text-center py-6 text-xs text-neutral-400">
              No curated boards yet. Create your first board below.
            </p>
          ) : (
            lists.map((list) => {
              const isChecked = assignedListIds.has(list.id);
              return (
                <div
                  key={list.id}
                  onClick={() => handleToggle(list)}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer select-none transition border ${
                    isChecked
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-2xs"
                      : "bg-neutral-50 dark:bg-neutral-950/50 border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <span className="block font-medium truncate">{list.title}</span>
                    <span
                      className={`block text-[10px] ${
                        isChecked
                          ? "text-neutral-300 dark:text-neutral-600"
                          : "text-neutral-400"
                      }`}
                    >
                      /list/{list.slug} • {list.itemCount} items
                    </span>
                  </div>

                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                      isChecked
                        ? "bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white border-transparent"
                        : "border-neutral-300 dark:border-neutral-600"
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
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
