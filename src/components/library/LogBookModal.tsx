"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Loader2, Plus, Search, Star, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type {
  BookFormat,
  BookSource,
  LibraryBookView,
  ReadingStatus,
} from "@/lib/books/library";
import type { BookSearchCandidate } from "@/lib/books/enrichBoughtBook";

export interface LogBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (book: LibraryBookView) => void;
  existingTags?: string[];
}

const SOURCE_OPTIONS: Array<{ id: BookSource; label: string; format: BookFormat }> = [
  { id: "READ_ONLINE", label: "Read Online", format: "ONLINE" },
  { id: "BORROWED", label: "Borrowed", format: "PHYSICAL" },
  { id: "OWNED", label: "Owned", format: "PHYSICAL" },
];

const STATUS_OPTIONS: Array<{ id: ReadingStatus; label: string }> = [
  { id: "FINISHED", label: "Finished" },
  { id: "READING", label: "Reading" },
  { id: "WANT_TO_READ", label: "Want to Read" },
];

export function LogBookModal({
  isOpen,
  onClose,
  onSaved,
  existingTags = [],
}: LogBookModalProps) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<BookSearchCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [year, setYear] = useState("");
  const [publisher, setPublisher] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");

  const [bookSource, setBookSource] = useState<BookSource>("READ_ONLINE");
  const [format, setFormat] = useState<BookFormat>("ONLINE");
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>("FINISHED");
  const [rating, setRating] = useState<number | null>(null);
  const [dateRead, setDateRead] = useState(() => new Date().toISOString().slice(0, 10));
  const [personalNotes, setPersonalNotes] = useState("");
  const [quoteText, setQuoteText] = useState("");
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
          `/api/v1/library/lookup?q=${encodeURIComponent(trimmed)}`
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

  const selectCandidate = (cand: BookSearchCandidate) => {
    setTitle(cand.title);
    setAuthor(cand.author || "");
    setIsbn(cand.isbn || "");
    setPageCount(cand.pageCount ? String(cand.pageCount) : "");
    setYear(cand.year ? String(cand.year) : "");
    setPublisher(cand.publisher || "");
    setCoverUrl(cand.coverUrl || "");
    setSummary(cand.summary || "");
    setCanonicalUrl(cand.canonicalUrl || "");
    setCandidates([]);
    setManualMode(true);
  };

  const addTag = (raw: string) => {
    const clean = raw.replace(/^#+/, "").trim();
    if (!clean) return;
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setTags((prev) => [...prev, clean]);
    }
    setTagDraft("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveTitle = title.trim() || query.trim();
    if (!effectiveTitle) {
      setError("Enter a book title first.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/library/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: effectiveTitle,
          author: author.trim() || null,
          isbn: isbn.trim() || null,
          pageCount: pageCount ? parseInt(pageCount, 10) || null : null,
          year: year ? parseInt(year, 10) || null : null,
          publisher: publisher.trim() || null,
          coverUrl: coverUrl.trim() || null,
          summary: summary.trim() || null,
          canonicalUrl: canonicalUrl.trim() || null,
          readingStatus,
          bookSource,
          format,
          rating,
          dateRead: readingStatus === "FINISHED" ? dateRead || null : null,
          personalNotes: personalNotes.trim() || null,
          tags,
          marginQuotes: quoteText.trim() ? [quoteText.trim()] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save book");
      }

      // Reset form state for next entry
      setQuery("");
      setTitle("");
      setAuthor("");
      setIsbn("");
      setPageCount("");
      setYear("");
      setPublisher("");
      setCoverUrl("");
      setSummary("");
      setCanonicalUrl("");
      setPersonalNotes("");
      setQuoteText("");
      setRating(null);
      setTags([]);
      setManualMode(false);

      onSaved(data.book);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save book");
    } finally {
      setIsSubmitting(false);
    }
  };

  const suggestedTags = existingTags
    .filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase()))
    .slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-3xl bg-card border border-border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Personal Library Entry
            </span>
            <h2 className="font-serif-editorial text-2xl font-medium text-foreground">
              Log Book Read Online or Owned
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Book Lookup Bar */}
          {!manualMode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Find book by title, author, or ISBN
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (query.trim() && !title) setTitle(query.trim());
                    setManualMode(true);
                  }}
                  className="font-mono text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Enter details manually
                </button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. The Design of Everyday Things Don Norman"
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {isSearching && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}
              </div>

              {candidates.length > 0 && (
                <div className="divide-y divide-border rounded-2xl border border-border bg-background overflow-hidden">
                  {candidates.map((cand, idx) => (
                    <button
                      key={`${cand.title}-${idx}`}
                      type="button"
                      onClick={() => selectCandidate(cand)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/60 transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-14 rounded-md bg-muted shrink-0 overflow-hidden border border-border flex items-center justify-center">
                        {cand.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cand.coverUrl}
                            alt={cand.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <BookOpen className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-serif-editorial text-base font-medium text-foreground truncate">
                          {cand.title}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground truncate">
                          {[
                            cand.author,
                            cand.year ? String(cand.year) : null,
                            cand.pageCount ? `${cand.pageCount} pp` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-border text-muted-foreground">
                        Select
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-4 p-4 rounded-2xl border border-border bg-secondary/40">
              <div className="w-16 h-24 rounded-lg bg-muted shrink-0 overflow-hidden border border-border flex items-center justify-center">
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Book title *"
                  required
                  className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-medium focus:outline-none"
                />
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Author"
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={pageCount}
                    onChange={(e) => setPageCount(e.target.value)}
                    placeholder="Pages"
                    className="w-1/2 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none"
                  />
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="Year"
                    className="w-1/2 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setManualMode(false)}
                  className="sm:col-span-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  ← Search catalog again
                </button>
              </div>
            </div>
          )}

          {/* Source & Reading Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                How you read / hold it
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {SOURCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setBookSource(opt.id);
                      setFormat(opt.format);
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      bookSource === opt.id
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
                Reading status
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReadingStatus(opt.id)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      readingStatus === opt.id
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Format (for online reads), Rating & Date Read */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Format
              </span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as BookFormat)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none"
              >
                <option value="ONLINE">Online / Web</option>
                <option value="KINDLE">Kindle</option>
                <option value="EBOOK">EPUB / PDF</option>
                <option value="AUDIOBOOK">Audiobook</option>
                <option value="PHYSICAL">Physical Copy</option>
              </select>
            </div>

            <div>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Rating
              </span>
              <div className="flex items-center gap-1 py-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(rating === star ? null : star)}
                    aria-label={`${star} stars`}
                    className="p-1 cursor-pointer transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        rating !== null && star <= rating
                          ? "fill-amber-500 text-amber-500"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {readingStatus === "FINISHED" && (
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Date Read
                </label>
                <input
                  type="date"
                  value={dateRead}
                  onChange={(e) => setDateRead(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Comments & Review */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Comments &amp; Notes
            </label>
            <textarea
              rows={3}
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
              placeholder="What stayed with you from this book? Key takeaways, review, or reflections..."
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
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-xs font-mono text-foreground"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                    className="text-muted-foreground hover:text-foreground"
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
                placeholder="Add tag + Enter"
                className="flex-1 min-w-[120px] bg-transparent text-xs font-mono px-1.5 py-1 focus:outline-none"
              />
            </div>
            {suggestedTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestedTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addTag(t)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Optional Passage */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Highlight / Quote (optional)
            </label>
            <input
              type="text"
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value)}
              placeholder="Paste a memorable line..."
              className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs font-serif-editorial italic focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-xs font-mono">
              {error}
            </div>
          )}

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!title.trim() && !query.trim())}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-foreground text-background text-xs font-mono font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? "Saving..." : "Save to Library"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
