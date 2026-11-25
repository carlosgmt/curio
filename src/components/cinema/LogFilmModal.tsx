"use client";

import React, { useEffect, useState } from "react";
import { Film, Loader2, Plus, Repeat, Search, ShoppingBag, Star, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { FilmView, WatchStatus } from "@/lib/cinema/library";
import type { FilmSearchCandidate } from "@/lib/cinema/searchFilms";

export interface LogFilmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (film: FilmView) => void;
  existingTags?: string[];
}

const HALF_STAR_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export function LogFilmModal({
  isOpen,
  onClose,
  onSaved,
  existingTags = [],
}: LogFilmModalProps) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<FilmSearchCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const [title, setTitle] = useState("");
  const [director, setDirector] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [runtimeMinutes, setRuntimeMinutes] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [tmdbId, setTmdbId] = useState("");

  const [watchStatus, setWatchStatus] = useState<WatchStatus>("WATCHED");
  const [isOwned, setIsOwned] = useState(false);
  const [rewatch, setRewatch] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [dateWatched, setDateWatched] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [personalNotes, setPersonalNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || manualMode) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setCandidates([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiFetch(
          `/api/v1/cinema/lookup?q=${encodeURIComponent(trimmed)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.candidates)) {
          setCandidates(data.candidates);
        }
      } catch {
        // ignore transient lookup failures
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, isOpen, manualMode]);

  if (!isOpen) return null;

  const selectCandidate = (c: FilmSearchCandidate) => {
    setTitle(c.title || "");
    setDirector(c.director || "");
    setReleaseYear(c.releaseYear ? String(c.releaseYear) : "");
    setRuntimeMinutes(c.runtimeMinutes ? String(c.runtimeMinutes) : "");
    setPosterUrl(c.posterUrl || "");
    setSummary(c.summary || "");
    setCanonicalUrl(c.canonicalUrl || "");
    setTmdbId(c.tmdbId || "");
    setCandidates([]);
    setQuery("");
  };

  const addTag = (raw: string) => {
    const clean = raw.trim().replace(/^#/, "");
    if (!clean) return;
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setTags((prev) => [...prev, clean]);
    }
    setTagDraft("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Film title is required.");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const parsedYear = parseInt(releaseYear, 10);
      const parsedRuntime = parseInt(runtimeMinutes, 10);
      const res = await apiFetch("/api/v1/cinema/films", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          director: director.trim() || undefined,
          releaseYear:
            Number.isFinite(parsedYear) && parsedYear > 1880 ? parsedYear : undefined,
          runtimeMinutes:
            Number.isFinite(parsedRuntime) && parsedRuntime > 0
              ? parsedRuntime
              : undefined,
          posterUrl: posterUrl.trim() || undefined,
          summary: summary.trim() || undefined,
          canonicalUrl: canonicalUrl.trim() || undefined,
          tmdbId: tmdbId.trim() || undefined,
          watchStatus,
          isOwned,
          rewatch: watchStatus === "WATCHED" ? rewatch : false,
          rating: watchStatus === "WATCHED" ? rating : null,
          dateWatched:
            watchStatus === "WATCHED" && dateWatched ? dateWatched : undefined,
          personalNotes: personalNotes.trim() || undefined,
          tags,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save film");
      }

      onSaved(data.film);
      setTitle("");
      setDirector("");
      setReleaseYear("");
      setRuntimeMinutes("");
      setPosterUrl("");
      setSummary("");
      setCanonicalUrl("");
      setTmdbId("");
      setRating(null);
      setRewatch(false);
      setIsOwned(false);
      setPersonalNotes("");
      setTags([]);
      setTagDraft("");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to log film");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Log Film"
        className="w-full max-w-2xl rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Film className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="font-serif-editorial text-xl text-foreground">
              Log Film
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Quick Search Lookup */}
          {!manualMode && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Search Film Catalog
                </label>
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="font-mono text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
                >
                  Enter manually instead
                </button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search film title or director (e.g. Past Lives, Wong Kar-wai)..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {isSearching && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}
              </div>

              {candidates.length > 0 && (
                <div className="rounded-2xl border border-border bg-background divide-y divide-border max-h-56 overflow-y-auto">
                  {candidates.map((c, idx) => (
                    <button
                      key={`${c.title}-${idx}`}
                      type="button"
                      onClick={() => selectCandidate(c)}
                      className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-muted/60 transition-colors cursor-pointer"
                    >
                      <div className="w-9 h-13 rounded-md bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
                        {c.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.posterUrl}
                            alt={c.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Film className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-foreground truncate">
                          {c.title}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.director || "Director unknown"}
                          {c.releaseYear ? ` · ${c.releaseYear}` : ""}
                          {c.runtimeMinutes ? ` · ${c.runtimeMinutes} min` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {manualMode && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setManualMode(false)}
                className="font-mono text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
              >
                Back to film search
              </button>
            </div>
          )}

          {/* Core Film Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2 flex gap-3.5 items-start">
              {posterUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={posterUrl}
                  alt={title || "Film poster"}
                  referrerPolicy="no-referrer"
                  className="w-14 h-21 rounded-lg object-cover border border-border shrink-0"
                />
              )}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Film title"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Director
                  </label>
                  <input
                    type="text"
                    value={director}
                    onChange={(e) => setDirector(e.target.value)}
                    placeholder="e.g. Celine Song"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(e.target.value)}
                  placeholder="2023"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Runtime (min)
                </label>
                <input
                  type="number"
                  value={runtimeMinutes}
                  onChange={(e) => setRuntimeMinutes(e.target.value)}
                  placeholder="106"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Poster URL
              </label>
              <input
                type="url"
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none"
              />
            </div>
          </div>

          {/* Watch Status + Ownership / Rewatch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Watch Status
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: "WATCHED", label: "Watched" },
                    { id: "WATCHLIST", label: "Watchlist" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setWatchStatus(opt.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      watchStatus === opt.id
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Edition &amp; Flags
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsOwned((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    isOwned
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Owned (Blu-ray / 4K)</span>
                </button>
                {watchStatus === "WATCHED" && (
                  <button
                    type="button"
                    onClick={() => setRewatch((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      rewatch
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Rewatch</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Half-Star Rating & Date Watched */}
          {watchStatus === "WATCHED" && (
            <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr] gap-4 items-end">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Half-Star Rating
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-foreground">
                    {rating !== null ? `${rating} ★` : "Unrated"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {HALF_STAR_STEPS.map((step) => {
                    const active = rating === step;
                    const filled = rating !== null && step <= rating;
                    return (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setRating(active ? null : step)}
                        aria-label={`Rate ${step} stars`}
                        className={`px-2 py-1.5 rounded-lg font-mono text-[11px] tabular-nums border transition-colors cursor-pointer ${
                          active
                            ? "bg-amber-500 text-black border-amber-500 font-semibold"
                            : filled
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
                            : "bg-background border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {step}★
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Date Watched
                </label>
                <input
                  type="date"
                  value={dateWatched}
                  onChange={(e) => setDateWatched(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Review & Comments */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Comments &amp; Review
            </label>
            <textarea
              rows={3}
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
              placeholder="Visuals, cinematography, theater notes, or personal thoughts..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-border bg-background">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary font-mono text-[11px] text-foreground"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() =>
                      setTags((prev) => prev.filter((item) => item !== tag))
                    }
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-3 h-3" />
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
                    addTag(tagDraft);
                  }
                }}
                placeholder="Add tag (e.g. theater, 35mm, criterion)..."
                className="flex-1 min-w-[160px] px-2 py-1 text-xs bg-transparent focus:outline-none"
              />
              {tagDraft.trim() && (
                <button
                  type="button"
                  onClick={() => addTag(tagDraft)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-foreground text-background text-[10px] font-mono cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              )}
            </div>
            {existingTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {existingTags.slice(0, 8).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addTag(t)}
                    className="px-2 py-0.5 rounded-full border border-border font-mono text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/40 cursor-pointer"
                  >
                    +{t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-card">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-border text-xs font-mono text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit as any}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-foreground text-background text-xs font-mono font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Star className="w-3.5 h-3.5" />
            )}
            <span>{isSubmitting ? "Saving..." : "Save to Cinema"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
