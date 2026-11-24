"use client";

import React, { useState, useEffect, useId } from "react";
import { X, Layers, Sparkles, Globe, Lock, EyeOff, Loader2, Trash2 } from "lucide-react";
import type { SmartList } from "@/db";
import { apiFetch } from "@/lib/apiClient";

export interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (list: SmartList) => void;
  onUpdated?: (list: SmartList) => void;
  onDeleted?: (slug: string) => void;
  editingBoard?: SmartList | null;
  defaultParentId?: string | null;
  availableBoards?: Array<{ id: string; title: string }>;
}

export function CreateListModal({
  isOpen,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  editingBoard = null,
  defaultParentId = null,
  availableBoards,
}: CreateListModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string | null>(defaultParentId);
  const [boardsList, setBoardsList] = useState<Array<{ id: string; title: string }>>(availableBoards || []);
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">("PUBLIC");
  const [isSmartRuleEnabled, setIsSmartRuleEnabled] = useState(false);
  const [ruleTypePathPrefix, setRuleTypePathPrefix] = useState<string>("");
  const [ruleCoreType, setRuleCoreType] = useState<string>("");
  const [ruleTags, setRuleTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();

  useEffect(() => {
    if (!isOpen) return;
    if (editingBoard) {
      setTitle(editingBoard.title || "");
      setDescription(editingBoard.description || "");
      setParentId(editingBoard.parentId || null);
      setVisibility(
        (editingBoard.visibility as "PUBLIC" | "UNLISTED" | "PRIVATE") || "PUBLIC"
      );
      const rules = editingBoard.autoRules || null;
      if (rules && (rules.typePathPrefix || rules.coreType || (rules.tagsInclude && rules.tagsInclude.length > 0))) {
        setIsSmartRuleEnabled(true);
        setRuleTypePathPrefix(rules.typePathPrefix || "");
        setRuleCoreType(rules.coreType || "");
        setRuleTags((rules.tagsInclude || []).join(", "));
      } else {
        setIsSmartRuleEnabled(false);
        setRuleTypePathPrefix("");
        setRuleCoreType("");
        setRuleTags("");
      }
      setError(null);
    } else {
      setTitle("");
      setDescription("");
      setParentId(defaultParentId || null);
      setVisibility("PUBLIC");
      setIsSmartRuleEnabled(false);
      setRuleTypePathPrefix("");
      setRuleCoreType("");
      setRuleTags("");
      setError(null);
    }
  }, [isOpen, editingBoard, defaultParentId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      if (availableBoards) {
        setBoardsList(
          editingBoard
            ? availableBoards.filter((b) => b.id !== editingBoard.id)
            : availableBoards
        );
      } else {
        apiFetch("/api/v1/lists")
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.lists) {
              const mapped = data.lists.map((l: any) => ({ id: l.id, title: l.title }));
              setBoardsList(
                editingBoard ? mapped.filter((b: any) => b.id !== editingBoard.id) : mapped
              );
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, availableBoards, editingBoard]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const autoRules = isSmartRuleEnabled
        ? {
            typePathPrefix: ruleTypePathPrefix || undefined,
            coreType: ruleCoreType || undefined,
            tagsInclude: ruleTags
              ? ruleTags
                  .split(",")
                  .map((t) => t.trim().toLowerCase())
                  .filter(Boolean)
              : undefined,
          }
        : editingBoard
        ? null
        : undefined;

      if (editingBoard) {
        const res = await apiFetch(`/api/v1/lists/${editingBoard.slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            parentId: parentId || null,
            visibility,
            autoRules,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update board");
        }

        const { list } = await res.json();
        onUpdated?.(list);
        onClose();
        return;
      }

      const res = await apiFetch("/api/v1/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          parentId: parentId || null,
          visibility,
          autoRules,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create board");
      }

      const { list } = await res.json();
      onCreated?.(list);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingBoard || isDeleting) return;
    if (!confirm(`Delete "${editingBoard.title}"? Your saved cards will remain safely in your library.`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/lists/${editingBoard.slug}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete board");
      }
      onDeleted?.(editingBoard.slug);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
            <h2 id={headingId} className="text-lg font-bold font-serif text-neutral-900 dark:text-neutral-100">
              {editingBoard ? "Edit Curated Board" : "Create Curated Board"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close board modal"
            className="rounded-full p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto overscroll-contain py-4 space-y-4 flex-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 font-bold mb-1.5">
              Board Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Paris 2026 Guide, Dinner Party Menu..."
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-medium"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 font-bold mb-1.5">
              Curator Editorial Note (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A few words setting the aesthetic or sensory context..."
              className="w-full text-xs px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            />
          </div>

          {/* Parent Board Selector */}
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 font-bold mb-1.5">
              Parent Board (Nesting)
            </label>
            <select
              value={parentId || ""}
              onChange={(e) => setParentId(e.target.value ? e.target.value : null)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-medium"
            >
              <option value="">None (Top-Level Board)</option>
              {boardsList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>

          {/* Visibility Selector */}
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 font-bold mb-1.5">
              Privacy & Sharing
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setVisibility("PUBLIC")}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition cursor-pointer ${
                  visibility === "PUBLIC"
                    ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800 font-semibold"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-500"
                }`}
              >
                <Globe className="w-4 h-4 text-emerald-500" />
                <span className="text-[11px]">Public</span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility("UNLISTED")}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition cursor-pointer ${
                  visibility === "UNLISTED"
                    ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800 font-semibold"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-500"
                }`}
              >
                <EyeOff className="w-4 h-4 text-blue-500" />
                <span className="text-[11px]">Unlisted</span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility("PRIVATE")}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition cursor-pointer ${
                  visibility === "PRIVATE"
                    ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800 font-semibold"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-500"
                }`}
              >
                <Lock className="w-4 h-4 text-amber-500" />
                <span className="text-[11px]">Private</span>
              </button>
            </div>
          </div>

          {/* Smart List Dynamic Filter Toggle */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Dynamic Auto-Rule (Smart List)
                </span>
              </div>
              <input
                type="checkbox"
                checked={isSmartRuleEnabled}
                onChange={(e) => setIsSmartRuleEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-neutral-900 cursor-pointer"
              />
            </div>

            {isSmartRuleEnabled && (
              <div className="space-y-3 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 animate-in fade-in">
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 font-bold mb-1">
                    Filter by Exact Type Prefix (Recommended)
                  </label>
                  <select
                    value={ruleTypePathPrefix}
                    onChange={(e) => setRuleTypePathPrefix(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                  >
                    <option value="">Any Type Path</option>
                    <option value="/media/film">Films & Cinema (/media/film)</option>
                    <option value="/media/music">Music & Vinyl (/media/music)</option>
                    <option value="/media/videogame">Video Games (/media/videogame)</option>
                    <option value="/product/book">Books (/product/book)</option>
                    <option value="/product/garment">Wardrobe Garments (/product/garment)</option>
                    <option value="/style/outfit">Outfits & Looks (/style/outfit)</option>
                    <option value="/product/beverage/wine">Wine Cellar (/product/beverage/wine)</option>
                    <option value="/culinary/recipe">Recipes (/culinary/recipe)</option>
                    <option value="/place">Places & Spots (/place)</option>
                    <option value="/quote">Quotes (/quote)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 font-bold mb-1">
                    Broad Core Category (Optional)
                  </label>
                  <select
                    value={ruleCoreType}
                    onChange={(e) => setRuleCoreType(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                  >
                    <option value="">Any Core Category</option>
                    <option value="MEDIA">All Media (Cinema + Music)</option>
                    <option value="BOOK">Books & Literature</option>
                    <option value="PRODUCT">Products & Goods</option>
                    <option value="PLACE">Places, Passes & Trails</option>
                    <option value="CULINARY">Culinary & Wine</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 font-bold mb-1">
                    Matching Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={ruleTags}
                    onChange={(e) => setRuleTags(e.target.value)}
                    placeholder="e.g. natural wine, criterion, tokyo"
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <div>
              {editingBoard && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Delete</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{editingBoard ? "Saving..." : "Creating..."}</span>
                  </>
                ) : (
                  <span>{editingBoard ? "Save Board" : "Create Board"}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
