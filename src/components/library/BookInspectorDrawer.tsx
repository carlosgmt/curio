"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Box,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Plus,
  Quote,
  ShoppingBag,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import {
  readingStatusToShelf,
  type LibraryBookView,
  type ReadingStatus,
} from "@/lib/books/library";

export interface BookInspectorDrawerProps {
  book: LibraryBookView | null;
  onUpdated: (updatedSave: any, updatedEntity?: any) => void;
  onOpenFullModal: (book: LibraryBookView, presentation?: "standard" | "press") => void;
}

export function BookInspectorDrawer({
  book,
  onUpdated,
  onOpenFullModal,
}: BookInspectorDrawerProps) {
  const [notesDraft, setNotesDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [quoteDraft, setQuoteDraft] = useState("");
  const [isAddingQuote, setIsAddingQuote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setNotesDraft(book?.personalNotes || "");
    setTagDraft("");
    setQuoteDraft("");
    setIsAddingQuote(false);
    setSavedToast(false);
  }, [book?.saveId, book?.personalNotes]);

  if (!book) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center border-t xl:border-t-0 xl:border-l border-border">
        <BookOpen className="w-8 h-8 text-muted-foreground/40 mb-3" />
        <p className="font-serif-editorial text-lg text-muted-foreground">
          Select a volume to inspect notes, tags, and reading status.
        </p>
      </div>
    );
  }

  const rawCustomValues =
    book.card.save.userCustomValues &&
    typeof book.card.save.userCustomValues === "object"
      ? (book.card.save.userCustomValues as Record<string, any>)
      : {};

  const patchSave = async (payload: Record<string, any>) => {
    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/v1/saves/${book.saveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      const data = await res.json();
      onUpdated(data.save, data.entity);
      setSavedToast(true);
      window.setTimeout(() => setSavedToast(false), 1800);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = (nextStatus: ReadingStatus) => {
    const nextWishlist = book.isOwned ? false : nextStatus === "WANT_TO_READ";
    const nextCv: Record<string, any> = {
      ...rawCustomValues,
      readingStatus: nextStatus,
      shelf: readingStatusToShelf(nextStatus),
    };
    if (nextStatus === "FINISHED" && !nextCv.dateRead) {
      nextCv.dateRead = new Date().toISOString().slice(0, 10);
    }
    void patchSave({
      wishlist: nextWishlist,
      userCustomValues: nextCv,
    });
  };

  const handleRating = (star: number) => {
    const nextRating = book.rating === star ? null : star;
    const nextCv = { ...rawCustomValues };
    if (nextRating === null) {
      delete nextCv.rating;
      delete nextCv.myRating;
    } else {
      nextCv.rating = nextRating;
      nextCv.myRating = nextRating;
    }
    void patchSave({ userCustomValues: nextCv });
  };

  const handleToggleOwned = () => {
    const nextOwned = !book.isOwned;
    const nextCv = {
      ...rawCustomValues,
      owned: nextOwned,
      bookSource: nextOwned ? "OWNED" : "READ_ONLINE",
    };
    void patchSave({
      wishlist: nextOwned ? false : book.readingStatus === "WANT_TO_READ",
      userCustomValues: nextCv,
    });
  };

  const handleSaveNotes = () => {
    void patchSave({ personalNotes: notesDraft.trim() || null });
  };

  const handleAddTag = (raw: string) => {
    const clean = raw.replace(/^#+/, "").trim();
    if (!clean) return;
    if (book.tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setTagDraft("");
      return;
    }
    const currentAuto = Array.isArray(book.card.save.autoTags)
      ? book.card.save.autoTags
      : [];
    const nextAuto = [...currentAuto, clean];
    setTagDraft("");
    void patchSave({ autoTags: nextAuto });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const targetLower = tagToRemove.toLowerCase();
    const currentAuto = Array.isArray(book.card.save.autoTags)
      ? book.card.save.autoTags
      : [];
    const nextAuto = currentAuto.filter((t) => t.toLowerCase() !== targetLower);
    const nextShelves = book.goodreadsShelves.filter(
      (s) => s.toLowerCase() !== targetLower
    );
    void patchSave({
      autoTags: nextAuto,
      userCustomValues: {
        ...rawCustomValues,
        goodreadsShelves: nextShelves,
      },
    });
  };

  const handleAddQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteDraft.trim()) return;
    const nextQuotes = [...book.marginQuotes, quoteDraft.trim()];
    setQuoteDraft("");
    setIsAddingQuote(false);
    void patchSave({
      userCustomValues: {
        ...rawCustomValues,
        marginQuotes: nextQuotes,
      },
    });
  };

  const handleRemoveQuote = (idx: number) => {
    const nextQuotes = book.marginQuotes.filter((_, i) => i !== idx);
    void patchSave({
      userCustomValues: {
        ...rawCustomValues,
        marginQuotes: nextQuotes,
      },
    });
  };

  const notesDirty = notesDraft.trim() !== (book.personalNotes || "").trim();

  return (
    <aside
      data-testid="book-inspector-drawer"
      className="flex flex-col justify-between h-full border-t xl:border-t-0 xl:border-l border-border bg-card text-card-foreground"
    >
      <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
        {/* Header Metadata */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-24 rounded-lg bg-muted border border-border overflow-hidden shrink-0 shadow-xs">
            {book.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.coverUrl}
                alt={book.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-1 text-center font-serif-editorial text-[10px] text-muted-foreground">
                {book.title.slice(0, 24)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleOwned}
                title="Toggle Owned vs Read Online"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider border cursor-pointer transition-colors ${
                  book.isOwned
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {book.isOwned ? (
                  <>
                    <ShoppingBag className="w-2.5 h-2.5" />
                    Owned
                  </>
                ) : (
                  <>
                    <BookOpen className="w-2.5 h-2.5" />
                    Read Online
                  </>
                )}
              </button>
              {book.retailer && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  via {book.retailer}
                </span>
              )}
              {savedToast && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3 h-3" />
                  Saved
                </span>
              )}
            </div>

            <h3 className="font-serif-editorial text-xl leading-snug font-medium text-foreground">
              {book.title}
            </h3>
            <p className="text-xs text-muted-foreground">{book.author}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] tabular-nums text-muted-foreground pt-0.5">
              {book.year && <span>{book.year}</span>}
              {book.pageCount && <span>· {book.pageCount} pp</span>}
              {book.publisher && <span className="truncate max-w-[140px]">· {book.publisher}</span>}
              {book.dateRead && <span>· Read {book.dateRead}</span>}
            </div>
          </div>
        </div>

        {/* Status & Star Rating */}
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: "WANT_TO_READ", label: "To Read", icon: Clock },
                { id: "READING", label: "Reading", icon: BookOpen },
                { id: "FINISHED", label: "Finished", icon: CheckCircle2 },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = book.readingStatus === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleStatusChange(opt.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Rating
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRating(star)}
                  aria-label={`Rate ${star} stars`}
                  className="p-0.5 cursor-pointer transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-4 h-4 ${
                      book.rating !== null && star <= book.rating
                        ? "fill-amber-500 text-amber-500"
                        : "text-muted-foreground/35"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Comments & Review */}
        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              My Comments &amp; Review
            </label>
            {notesDirty && (
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-foreground text-background font-mono text-[10px] cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
                Save
              </button>
            )}
          </div>
          <textarea
            rows={4}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && notesDirty) {
                e.preventDefault();
                handleSaveNotes();
              }
            }}
            placeholder="Write your comments, takeaways, or review..."
            className="w-full p-3 rounded-xl border border-border bg-background text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Tags / Goodreads Shelves */}
        <div className="pt-3 border-t border-border space-y-2">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Tags &amp; Goodreads Shelves
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {book.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-[11px] font-mono text-foreground"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  handleAddTag(tagDraft);
                }
              }}
              placeholder="+ tag"
              className="w-24 px-2 py-0.5 rounded-full border border-dashed border-border bg-transparent text-[11px] font-mono focus:outline-none focus:w-32 transition-all"
            />
          </div>
        </div>

        {/* Margin Quotes */}
        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Margin Passages ({book.marginQuotes.length})
            </span>
            <button
              type="button"
              onClick={() => setIsAddingQuote((v) => !v)}
              className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
          {isAddingQuote && (
            <form onSubmit={handleAddQuote} className="space-y-1.5">
              <textarea
                rows={2}
                value={quoteDraft}
                onChange={(e) => setQuoteDraft(e.target.value)}
                placeholder="Paste a passage..."
                className="w-full p-2 rounded-xl border border-border bg-background text-xs font-serif-editorial italic focus:outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddingQuote(false)}
                  className="px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-0.5 rounded-full bg-foreground text-background text-[11px] font-mono"
                >
                  Save
                </button>
              </div>
            </form>
          )}
          {book.marginQuotes.length > 0 && (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {book.marginQuotes.map((q, idx) => (
                <div
                  key={idx}
                  className="group relative p-2.5 pr-6 rounded-xl bg-secondary/60 border border-border text-xs font-serif-editorial italic leading-snug"
                >
                  <Quote className="w-3 h-3 inline mr-1 opacity-40" />
                  &ldquo;{q}&rdquo;
                  <button
                    type="button"
                    onClick={() => handleRemoveQuote(idx)}
                    aria-label="Remove passage"
                    className="absolute top-2 right-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-5 sm:px-6 py-3.5 border-t border-border bg-secondary/30 flex items-center justify-between gap-2">
        <a
          href={book.canonicalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="w-3 h-3" />
          Source
        </a>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenFullModal(book, "standard")}
            className="px-3 py-1.5 rounded-full border border-border bg-background text-[11px] font-mono hover:border-foreground/40 cursor-pointer"
          >
            Dossier
          </button>
          <button
            type="button"
            onClick={() => onOpenFullModal(book, "press")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-foreground text-background text-[11px] font-mono font-medium hover:opacity-90 cursor-pointer"
          >
            <Box className="w-3 h-3" />
            3D Stage
          </button>
        </div>
      </div>
    </aside>
  );
}
