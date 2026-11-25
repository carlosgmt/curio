"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
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
import {
  formatFilmSourceLabel,
  type FilmView,
  type WatchStatus,
} from "@/lib/cinema/library";
import { getCinemaSearchLinks } from "@/lib/commerce/utilityDeepLinks";

export interface FilmDetailModalProps {
  film: FilmView | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedSave?: any, updatedEntity?: any) => void;
  onOpenFullDossier?: (film: FilmView) => void;
  onSelectDirector?: (director: string) => void;
  onSelectGenre?: (genre: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const HALF_STAR_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export function FilmDetailModal({
  film,
  isOpen,
  onClose,
  onUpdated,
  onOpenFullDossier,
  onSelectDirector,
  onSelectGenre,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: FilmDetailModalProps) {
  const [notesDraft, setNotesDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setNotesDraft(film?.personalNotes || "");
    setTagDraft("");
    setSavedToast(false);
  }, [film?.saveId, film?.personalNotes]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && hasNext && onNext) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, hasPrev, hasNext, onPrev, onNext]);

  if (!isOpen || !film) return null;

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
    void patchSave({ wishlist: nextWishlist, userCustomValues: nextCv });
  };

  const handleToggleRewatch = () => {
    void patchSave({
      userCustomValues: { ...rawCustomValues, rewatch: !film.rewatch },
    });
  };

  const handleRating = (step: number) => {
    const nextRating = film.rating === step ? null : step;
    void patchSave({
      userCustomValues: { ...rawCustomValues, rating: nextRating },
    });
  };

  const handleSaveNotes = () => {
    void patchSave({ personalNotes: notesDraft.trim() || null });
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
    void patchSave({ autoTags: [...currentAuto, clean] });
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
      userCustomValues: { ...rawCustomValues, letterboxdTags: nextLbTags },
    });
  };

  const notesDirty = notesDraft.trim() !== (film.personalNotes || "").trim();
  const searchLinks = getCinemaSearchLinks(film.title);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={film.title}
        data-testid="film-detail-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-3xl bg-neutral-950 text-neutral-100 border border-neutral-800 shadow-2xl overflow-hidden my-auto"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800">
          <div className="flex items-center gap-1.5">
            {(hasPrev || hasNext) && (
              <>
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  aria-label="Previous film"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-mono disabled:opacity-35 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  aria-label="Next film"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-mono disabled:opacity-35 cursor-pointer"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {savedToast && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close film modal"
              className="p-2 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[270px_1fr] gap-6 p-6">
          {/* Poster Column */}
          <div className="space-y-3">
            <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-xl">
              {film.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={film.posterUrl}
                  alt={film.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                  <Film className="w-10 h-10 text-neutral-600 mb-3" />
                  <span className="font-serif-editorial text-lg text-neutral-300">
                    {film.title}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {film.sources.map((src) => (
                <span
                  key={src}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 font-mono text-[10px] uppercase tracking-wider text-neutral-300"
                >
                  {src === "MY_STUFF" && <ShoppingBag className="w-2.5 h-2.5 text-emerald-400" />}
                  {formatFilmSourceLabel(src)}
                </span>
              ))}
            </div>
          </div>

          {/* Details Column — Direct Movie Title (no extra Curator Title) */}
          <div className="space-y-5 min-w-0">
            <div className="space-y-1.5">
              <h2 className="font-serif-editorial text-3xl sm:text-4xl leading-tight text-white">
                {film.title}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-300">
                <span>Directed by</span>
                {onSelectDirector &&
                film.director &&
                film.director.toLowerCase() !== "unknown director" ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDirector(film.director);
                      onClose();
                    }}
                    className="font-medium text-amber-300 underline underline-offset-4 decoration-dotted hover:text-amber-200 cursor-pointer"
                    title={`Show all films by ${film.director}`}
                  >
                    {film.director}
                  </button>
                ) : (
                  <span className="font-medium text-neutral-200">{film.director}</span>
                )}
                {film.releaseYear && <span className="text-neutral-400">· {film.releaseYear}</span>}
                {film.runtimeMinutes && (
                  <span className="text-neutral-400">· {film.runtimeMinutes} min</span>
                )}
              </div>

              {film.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {film.genres.map((g) =>
                    onSelectGenre ? (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          onSelectGenre(g);
                          onClose();
                        }}
                        className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 hover:border-amber-400/60 font-mono text-[11px] text-amber-200 cursor-pointer transition"
                        title={`Show all ${g} films`}
                      >
                        {g}
                      </button>
                    ) : (
                      <span
                        key={g}
                        className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 font-mono text-[11px] text-neutral-300"
                      >
                        {g}
                      </span>
                    )
                  )}
                </div>
              )}
            </div>

            {film.summary && (
              <p className="text-sm leading-relaxed text-neutral-300 max-h-28 overflow-y-auto">
                {film.summary}
              </p>
            )}

            {/* Watch Status + Rewatch */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange("WATCHED")}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono border cursor-pointer ${
                  film.watchStatus === "WATCHED"
                    ? "bg-white text-black border-white font-semibold"
                    : "bg-neutral-900 border-neutral-800 text-neutral-300"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Watched
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange("WATCHLIST")}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono border cursor-pointer ${
                  film.watchStatus === "WATCHLIST"
                    ? "bg-white text-black border-white font-semibold"
                    : "bg-neutral-900 border-neutral-800 text-neutral-300"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Want to Watch
              </button>
              <button
                type="button"
                onClick={handleToggleRewatch}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono border cursor-pointer ${
                  film.rewatch
                    ? "bg-amber-500/20 border-amber-400/50 text-amber-200"
                    : "bg-neutral-900 border-neutral-800 text-neutral-400"
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                {film.rewatch ? "Rewatch" : "1st Watch"}
              </button>
            </div>

            {/* Half-Star Rating */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                <span>Rating {film.rating ? `(${film.rating} ★)` : ""}</span>
                {film.dateWatched && <span>Watched {film.dateWatched}</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {HALF_STAR_STEPS.map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => handleRating(step)}
                    className={`px-2 py-1 rounded-lg font-mono text-[11px] tabular-nums border cursor-pointer ${
                      film.rating === step
                        ? "bg-amber-400 text-black border-amber-400 font-bold"
                        : film.rating !== null && step <= film.rating
                        ? "bg-amber-500/15 border-amber-500/35 text-amber-200"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400"
                    }`}
                  >
                    {step}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes & Review */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                  Notes &amp; Review
                </span>
                {notesDirty && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveNotes}
                    className="px-3 py-0.5 rounded-full bg-white text-black font-mono text-[11px] cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Write film reflections or Letterboxd/FilmAffinity review..."
                className="w-full px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              />
            </div>

            {/* Labels */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {film.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 font-mono text-[11px] text-neutral-300"
                  >
                    #{tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => handleRemoveTag(tag)}
                      className="text-neutral-500 hover:text-white cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddTag} className="flex gap-1.5">
                <input
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  placeholder="Add label..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-xs text-neutral-100 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!tagDraft.trim()}
                  className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-200 disabled:opacity-40 cursor-pointer"
                  aria-label="Add film label"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Bottom links */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-800">
              <div className="flex flex-wrap gap-2">
                <a
                  href={film.canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-400 hover:text-white"
                >
                  <span>Source Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={searchLinks.justWatch}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-400 hover:text-white"
                >
                  <span>JustWatch</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {onOpenFullDossier && (
                <button
                  type="button"
                  onClick={() => onOpenFullDossier(film)}
                  className="px-3 py-1 rounded-full border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 font-mono text-[11px] text-neutral-200 cursor-pointer"
                >
                  Connections &amp; Card Settings
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
