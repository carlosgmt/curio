"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Loader2,
  Plus,
  Repeat,
  ShoppingBag,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { FilmView, WatchStatus } from "@/lib/cinema/library";
import { getCinemaSearchLinks } from "@/lib/commerce/utilityDeepLinks";

export interface FilmInspectorDrawerProps {
  film: FilmView | null;
  onUpdated: (updatedSave: any, updatedEntity?: any) => void;
  onOpenFullModal: (film: FilmView, presentation?: "standard" | "press") => void;
  onSelectDirector?: (director: string) => void;
  onSelectGenre?: (genre: string) => void;
}

const HALF_STAR_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export function FilmInspectorDrawer({
  film,
  onUpdated,
  onOpenFullModal,
  onSelectDirector,
  onSelectGenre,
}: FilmInspectorDrawerProps) {
  const [notesDraft, setNotesDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setNotesDraft(film?.personalNotes || "");
    setTagDraft("");
    setSavedToast(false);
  }, [film?.saveId, film?.personalNotes]);

  if (!film) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center border-t xl:border-t-0 xl:border-l border-border">
        <Film className="w-8 h-8 text-muted-foreground/40 mb-3" />
        <p className="font-serif-editorial text-lg text-muted-foreground">
          Select a film to inspect reviews, tags, and watch status.
        </p>
      </div>
    );
  }

  const rawCustomValues =
    film.card.save.userCustomValues &&
    typeof film.card.save.userCustomValues === "object"
      ? (film.card.save.userCustomValues as Record<string, any>)
      : {};

  const patchSave = async (payload: Record<string, any>) => {
    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/v1/saves/${film.saveId}`, {
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

  const handleStatusChange = (nextStatus: WatchStatus) => {
    const nextWishlist = film.isOwned ? false : nextStatus === "WATCHLIST";
    const nextCv: Record<string, any> = {
      ...rawCustomValues,
      watchStatus: nextStatus,
    };
    if (nextStatus === "WATCHED" && !nextCv.dateWatched) {
      nextCv.dateWatched = new Date().toISOString().slice(0, 10);
    }
    void patchSave({
      wishlist: nextWishlist,
      userCustomValues: nextCv,
    });
  };

  const handleToggleOwned = () => {
    const nextOwned = !film.isOwned;
    void patchSave({
      wishlist: nextOwned ? false : film.watchStatus === "WATCHLIST",
      userCustomValues: {
        ...rawCustomValues,
        owned: nextOwned,
        filmSource: nextOwned ? "OWNED" : "LOGGED",
      },
    });
  };

  const handleToggleRewatch = () => {
    void patchSave({
      userCustomValues: {
        ...rawCustomValues,
        rewatch: !film.rewatch,
      },
    });
  };

  const handleRating = (nextRating: number) => {
    const toggled = film.rating === nextRating ? null : nextRating;
    void patchSave({
      userCustomValues: {
        ...rawCustomValues,
        rating: toggled,
      },
    });
  };

  const handleSaveNotes = () => {
    void patchSave({
      personalNotes: notesDraft.trim() || null,
    });
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tagDraft.trim().replace(/^#/, "");
    if (!clean) return;
    setTagDraft("");
    const currentAuto = Array.isArray(film.card.save.autoTags)
      ? film.card.save.autoTags
      : [];
    if (currentAuto.some((t) => t.toLowerCase() === clean.toLowerCase())) return;
    void patchSave({
      autoTags: [...currentAuto, clean],
    });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const targetLower = tagToRemove.toLowerCase();
    const currentAuto = Array.isArray(film.card.save.autoTags)
      ? film.card.save.autoTags
      : [];
    const nextAuto = currentAuto.filter((t) => t.toLowerCase() !== targetLower);
    const nextLbTags = film.letterboxdTags.filter(
      (t) => t.toLowerCase() !== targetLower
    );
    void patchSave({
      autoTags: nextAuto,
      userCustomValues: {
        ...rawCustomValues,
        letterboxdTags: nextLbTags,
      },
    });
  };

  const notesDirty = notesDraft.trim() !== (film.personalNotes || "").trim();
  const searchLinks = getCinemaSearchLinks(film.title);

  return (
    <aside
      data-testid="film-inspector-drawer"
      className="flex flex-col justify-between h-full border-t xl:border-t-0 xl:border-l border-border bg-card text-card-foreground"
    >
      <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
        {/* Header Metadata */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-24 rounded-lg bg-muted border border-border overflow-hidden shrink-0 shadow-xs">
            {film.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={film.posterUrl}
                alt={film.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-1 text-center font-serif-editorial text-[10px] text-muted-foreground">
                {film.title.slice(0, 24)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleOwned}
                title="Toggle Physical Edition (Blu-ray / 4K)"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider border cursor-pointer transition-colors ${
                  film.isOwned
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {film.isOwned ? (
                  <>
                    <ShoppingBag className="w-2.5 h-2.5" />
                    Owned
                  </>
                ) : (
                  <>
                    <Film className="w-2.5 h-2.5" />
                    Logged
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleToggleRewatch}
                title="Toggle Rewatch flag"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider border cursor-pointer transition-colors ${
                  film.rewatch
                    ? "bg-amber-500/15 border-amber-500/35 text-amber-700 dark:text-amber-300"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Repeat className="w-2.5 h-2.5" />
                {film.rewatch ? "Rewatch" : "1st Watch"}
              </button>
              {film.retailer && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  via {film.retailer}
                </span>
              )}
              {savedToast && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3 h-3" />
                  Saved
                </span>
              )}
            </div>

            <h2 className="font-serif-editorial text-xl sm:text-2xl leading-tight text-foreground">
              {film.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {onSelectDirector &&
              film.director &&
              film.director.toLowerCase() !== "unknown director" ? (
                <button
                  type="button"
                  onClick={() => onSelectDirector(film.director)}
                  className="underline underline-offset-4 decoration-dotted hover:text-foreground cursor-pointer"
                >
                  {film.director}
                </button>
              ) : (
                film.director
              )}
              {film.releaseYear ? ` · ${film.releaseYear}` : ""}
              {film.runtimeMinutes ? ` · ${film.runtimeMinutes} min` : ""}
            </p>
            {film.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {film.genres.map((g) =>
                  onSelectGenre ? (
                    <button
                      key={g}
                      type="button"
                      onClick={() => onSelectGenre(g)}
                      className="px-2 py-0.5 rounded-full bg-secondary border border-border font-mono text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {g}
                    </button>
                  ) : (
                    <span
                      key={g}
                      className="px-2 py-0.5 rounded-full bg-secondary border border-border font-mono text-[10px] text-muted-foreground"
                    >
                      {g}
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Watch Status Selector */}
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Watch Status
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { id: "WATCHED", label: "Watched", icon: CheckCircle2 },
                { id: "WATCHLIST", label: "Watchlist", icon: Clock },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = film.watchStatus === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleStatusChange(opt.id)}
                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-colors cursor-pointer ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Half-Star Rating & Watched Date */}
        <div className="space-y-2 pt-1 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Half-Star Rating {film.rating !== null ? `(${film.rating} ★)` : ""}
            </span>
            {film.dateWatched && (
              <div className="text-right font-mono text-[11px] text-muted-foreground">
                Watched {film.dateWatched}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {HALF_STAR_STEPS.map((step) => {
              const active = film.rating === step;
              const filled = film.rating !== null && step <= film.rating;
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => handleRating(step)}
                  aria-label={`Rate ${step} stars`}
                  className={`px-1.5 py-1 rounded-md font-mono text-[10px] tabular-nums border transition-colors cursor-pointer ${
                    active
                      ? "bg-amber-500 text-black border-amber-500 font-semibold"
                      : filled
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {step}
                </button>
              );
            })}
          </div>
        </div>

        {/* Comments & Review */}
        <div className="space-y-2 pt-1 border-t border-border">
          <div className="flex items-center justify-between">
            <label
              htmlFor="film-comments-textarea"
              className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              Comments &amp; Review
            </label>
            {notesDirty && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveNotes}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-foreground text-background font-mono text-[10px] cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
              </button>
            )}
          </div>
          <textarea
            id="film-comments-textarea"
            data-testid="film-comments-textarea"
            rows={4}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Write your film notes, scenes that stayed with you, or Letterboxd review..."
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {notesDirty && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveNotes}
                data-testid="save-film-comments-btn"
                className="px-3 py-1 rounded-full bg-foreground text-background font-mono text-[11px] cursor-pointer"
              >
                Save Comments
              </button>
            </div>
          )}
        </div>

        {/* Tags & Letterboxd Tags */}
        <div className="space-y-2 pt-1 border-t border-border">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Tags &amp; Letterboxd Lists
          </div>
          <div className="flex flex-wrap gap-1.5">
            {film.tags.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">No tags yet.</span>
            ) : (
              film.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary border border-border font-mono text-[11px]"
                >
                  #{tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => handleRemoveTag(tag)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))
            )}
          </div>
          <form onSubmit={handleAddTag} className="flex items-center gap-1.5">
            <input
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder="Add tag (e.g. theater, noir)..."
              className="flex-1 px-3 py-1.5 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={!tagDraft.trim()}
              className="p-1.5 rounded-xl border border-border hover:bg-muted disabled:opacity-40 cursor-pointer"
              aria-label="Add tag"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Streaming & Discovery Deep Links */}
        <div className="space-y-2 pt-1 border-t border-border">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Watch &amp; Catalog Links
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { label: "MUBI", href: searchLinks.mubi },
                { label: "Apple TV", href: searchLinks.appleTv },
                { label: "JustWatch", href: searchLinks.justWatch },
                { label: "TMDB", href: searchLinks.tmdb },
              ] as const
            ).map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-background font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{link.label}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="px-5 py-3.5 border-t border-border flex items-center justify-between gap-2 bg-card">
        <a
          href={film.canonicalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          <span>
            {film.canonicalUrl?.includes("letterboxd.com")
              ? "Letterboxd"
              : film.canonicalUrl?.includes("filmaffinity.com")
              ? "FilmAffinity"
              : film.canonicalUrl?.includes("themoviedb.org")
              ? "TMDB"
              : "Source"}
          </span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenFullModal(film, "standard")}
            className="px-3 py-1.5 rounded-full border border-border text-[11px] font-mono hover:bg-muted cursor-pointer"
          >
            Dossier
          </button>
          <button
            type="button"
            onClick={() => onOpenFullModal(film, "press")}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-foreground text-background text-[11px] font-mono hover:opacity-90 cursor-pointer"
          >
            <Box className="w-3 h-3" />
            <span>3D Stage</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
