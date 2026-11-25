"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FlipHorizontal2,
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
  formatBookSourceLabel,
  readingStatusToShelf,
  type LibraryBookView,
  type ReadingStatus,
} from "@/lib/books/library";
import { getDeterministicClothPalette } from "@/lib/press/archetypes";

export interface OpenBook3DModalProps {
  book: LibraryBookView | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedSave?: any, updatedEntity?: any) => void;
  onOpenFullDossier?: (book: LibraryBookView) => void;
  onSelectAuthor?: (author: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function OpenBook3DModal({
  book,
  isOpen,
  onClose,
  onUpdated,
  onOpenFullDossier,
  onSelectAuthor,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: OpenBook3DModalProps) {
  const [notesDraft, setNotesDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [quoteDraft, setQuoteDraft] = useState("");
  const [isAddingQuote, setIsAddingQuote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [coverMode, setCoverMode] = useState(false);
  const [mobilePage, setMobilePage] = useState<"left" | "right">("left");
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });
  const [bookPhase, setBookPhase] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const reducedMotionRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      reducedMotionRef.current = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !book) {
      setBookPhase("closed");
      return;
    }
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (reducedMotionRef.current) {
      setBookPhase("open");
      return;
    }
    setBookPhase("closed");
    let timerId: number | null = null;
    const rafId = window.requestAnimationFrame(() => {
      setBookPhase("opening");
      timerId = window.setTimeout(() => {
        setBookPhase("open");
      }, 560);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
      if (timerId) window.clearTimeout(timerId);
    };
  }, [isOpen, book?.saveId]);

  const handleAnimatedClose = React.useCallback(() => {
    if (reducedMotionRef.current || coverMode) {
      onClose();
      return;
    }
    setBookPhase("closing");
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose, coverMode]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setNotesDraft(book?.personalNotes || "");
    setTagDraft("");
    setQuoteDraft("");
    setIsAddingQuote(false);
    setSavedToast(false);
    setCoverMode(false);
    setMobilePage("left");
  }, [book?.saveId, book?.personalNotes]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleAnimatedClose();
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
  }, [isOpen, handleAnimatedClose, hasPrev, hasNext, onPrev, onNext]);

  const palette = useMemo(
    () =>
      book
        ? getDeterministicClothPalette(book.card, "book")
        : {
            id: "obsidian",
            surface: "#1D1E20",
            surfaceSecondary: "#151618",
            ink: "#F2EFE9",
            muted: "#BAB7B0",
            accent: "#DFBF74",
            rule: "#393B3F",
            coverBg: "#2A2B2E",
            coverInk: "#F2EFE9",
          },
    [book]
  );

  if (!isOpen || !book) return null;

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

  const handleToggleOwned = () => {
    const nextOwned = !book.isOwned;
    void patchSave({
      wishlist: nextOwned ? false : book.readingStatus === "WANT_TO_READ",
      userCustomValues: {
        ...rawCustomValues,
        owned: nextOwned,
        bookSource: nextOwned ? "OWNED" : "READ_ONLINE",
      },
    });
  };

  const handleRating = (star: number) => {
    const nextRating = book.rating === star ? null : star;
    void patchSave({
      userCustomValues: {
        ...rawCustomValues,
        rating: nextRating,
        myRating: nextRating,
      },
    });
  };

  const handleSaveNotes = () => {
    void patchSave({
      personalNotes: notesDraft.trim() || null,
    });
  };

  const handleAddLabel = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tagDraft.trim().replace(/^#/, "");
    if (!clean) return;
    setTagDraft("");
    const currentAuto = Array.isArray(book.card.save.autoTags)
      ? book.card.save.autoTags
      : [];
    if (currentAuto.some((t) => t.toLowerCase() === clean.toLowerCase())) return;
    void patchSave({
      autoTags: [...currentAuto, clean],
    });
  };

  const handleRemoveLabel = (labelToRemove: string) => {
    const targetLower = labelToRemove.toLowerCase();
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

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotionRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({
      rx: Math.max(-3.5, Math.min(3.5, -ny * 3.5)),
      ry: Math.max(-3.5, Math.min(3.5, nx * 3.5)),
    });
  };

  const notesDirty = notesDraft.trim() !== (book.personalNotes || "").trim();
  const isGoodreadsBook =
    Boolean(book.goodreadsBookId) ||
    book.bookSource === "GOODREADS" ||
    book.goodreadsShelves.length > 0 ||
    Boolean(book.canonicalUrl?.includes("goodreads.com"));

  const isSpreadExpanded = bookPhase === "opening" || bookPhase === "open";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={handleAnimatedClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${book.title} — Open Book`}
        data-testid="open-book-3d-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl flex flex-col gap-3 my-auto"
      >
        {/* Top Floating Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-white/90">
          <div className="flex items-center gap-1.5">
            {(hasPrev || hasNext) && (
              <>
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  aria-label="Previous book"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono disabled:opacity-35 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  aria-label="Next book"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono disabled:opacity-35 transition cursor-pointer"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCoverMode((c) => !c)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono transition cursor-pointer"
            >
              <FlipHorizontal2 className="w-3.5 h-3.5" />
              <span>{coverMode ? "Open Pages" : "View Jacket"}</span>
            </button>
            <button
              type="button"
              onClick={handleAnimatedClose}
              aria-label="Close book"
              data-testid="close-open-book-btn"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3D Open Book Spread Stage */}
        <div
          onMouseMove={handleStageMouseMove}
          onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
          style={{ perspective: "2000px" }}
          className="w-full"
        >
          {coverMode ? (
            /* Closed Hardcover Jacket Study */
            <div
              className="mx-auto max-w-md rounded-r-2xl rounded-l-md p-6 sm:p-8 shadow-[0_28px_70px_rgba(0,0,0,0.65)] border border-white/15 flex flex-col justify-between min-h-[520px] transition-transform duration-200 ease-out relative overflow-hidden"
              style={{
                backgroundColor: palette.coverBg,
                color: palette.coverInk,
                transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-7 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to right, rgba(0,0,0,0.42), rgba(255,255,255,0.12) 45%, transparent)",
                }}
              />
              <div className="relative z-10 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] opacity-80">
                <span>{book.isOwned ? "Owned Volume" : "Read Online"}</span>
                {book.pageCount && <span>{book.pageCount} pp</span>}
              </div>

              <div className="relative z-10 my-6 flex flex-col items-center text-center gap-4">
                {book.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    referrerPolicy="no-referrer"
                    className="w-48 h-72 object-cover rounded-r-lg shadow-2xl border border-black/20"
                  />
                )}
                <div>
                  <h2 className="font-serif-editorial text-2xl sm:text-3xl leading-tight">
                    {book.title}
                  </h2>
                  <p className="mt-1.5 text-sm italic opacity-85">{book.author}</p>
                </div>
              </div>

              <div className="relative z-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => setCoverMode(false)}
                  className="px-4 py-1.5 rounded-full font-mono text-xs border cursor-pointer transition hover:opacity-90"
                  style={{
                    backgroundColor: palette.accent,
                    color: palette.surfaceSecondary,
                    borderColor: palette.accent,
                  }}
                >
                  Open Book Spread →
                </button>
              </div>
            </div>
          ) : (
            /* Open Two-Page Book Spread with 3D Hinged Cover Leaf */
            <div
              className="relative rounded-2xl p-2 sm:p-3.5 shadow-[0_32px_80px_rgba(0,0,0,0.68)]"
              style={{
                backgroundColor: palette.coverBg,
                transformStyle: "preserve-3d",
                transform: isSpreadExpanded
                  ? `scale(1) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`
                  : `scale(0.86) rotateX(8deg) rotateY(-8deg)`,
                opacity: bookPhase === "closing" ? 0.15 : 1,
                transition:
                  bookPhase === "open"
                    ? "transform 200ms ease-out"
                    : "transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease",
                boxShadow:
                  "0 30px 75px rgba(0,0,0,0.68), inset 0 0 0 1px rgba(255,255,255,0.12)",
              }}
            >
              {/* Animated 3D Hardcover Door swinging open from center spine (desktop) */}
              {bookPhase !== "open" && (
                <div
                  aria-hidden="true"
                  className="hidden md:block absolute inset-y-2 right-2 w-[calc(50%-0.5rem)] rounded-r-xl pointer-events-none z-40"
                  style={{
                    transformStyle: "preserve-3d",
                    transformOrigin: "left center",
                    transform: isSpreadExpanded ? "rotateY(-180deg)" : "rotateY(0deg)",
                    transition: "transform 540ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                >
                  {/* Front Outer Jacket */}
                  <div
                    className="absolute inset-0 rounded-r-xl overflow-hidden flex flex-col justify-between p-6 shadow-2xl border border-white/15"
                    style={{
                      backgroundColor: palette.coverBg,
                      color: palette.coverInk,
                      backfaceVisibility: "hidden",
                    }}
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-75">
                      {book.isOwned ? "Owned Volume" : "Library Edition"}
                    </div>
                    <div className="my-auto flex flex-col items-center text-center gap-3">
                      {book.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={book.coverUrl}
                          alt=""
                          className="w-40 h-60 object-cover rounded-r-md shadow-xl border border-black/25"
                        />
                      )}
                      <div className="font-serif-editorial text-xl leading-snug line-clamp-2">
                        {book.title}
                      </div>
                    </div>
                    <div className="font-mono text-[10px] opacity-70 truncate text-center">
                      {book.author}
                    </div>
                  </div>
                  {/* Inner Endpaper Face */}
                  <div
                    className="absolute inset-0 rounded-l-xl bg-[#F3ECD8] border border-[#DED2BC]"
                    style={{
                      transform: "rotateY(180deg)",
                      backfaceVisibility: "hidden",
                    }}
                  />
                </div>
              )}
              {/* Stacked Paper Edges (Left/Right/Bottom thickness illusion) */}
              <div
                aria-hidden="true"
                className="hidden sm:block absolute inset-x-4 bottom-1.5 h-2 rounded-b-lg opacity-85"
                style={{
                  background:
                    "repeating-linear-gradient(to bottom, #EAE2D3 0px, #EAE2D3 1px, #D7CCB9 1px, #D7CCB9 2px)",
                }}
              />

              {/* Mobile Page Toggle (< md) */}
              <div className="md:hidden relative z-20 flex items-center gap-1.5 mb-2 px-1">
                <button
                  type="button"
                  onClick={() => setMobilePage("left")}
                  className={`flex-1 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider cursor-pointer transition ${
                    mobilePage === "left"
                      ? "bg-[#FAF6EE] text-[#1E1A16] font-semibold"
                      : "bg-black/30 text-white/80"
                  }`}
                >
                  Edition &amp; Summary
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePage("right")}
                  className={`flex-1 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider cursor-pointer transition ${
                    mobilePage === "right"
                      ? "bg-[#FAF6EE] text-[#1E1A16] font-semibold"
                      : "bg-black/30 text-white/80"
                  }`}
                >
                  Notes &amp; Labels ({book.tags.length})
                </button>
              </div>

              {/* Open Two-Page Rag-Paper Spread */}
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 rounded-xl overflow-hidden bg-[#FAF6EE] text-[#1E1A16] min-h-[540px]">
                {/* Center Book Spine Gutter */}
                <div
                  aria-hidden="true"
                  className="hidden md:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-12 z-20 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to right, rgba(30,22,12,0) 0%, rgba(30,22,12,0.12) 42%, rgba(20,14,8,0.22) 50%, rgba(30,22,12,0.12) 58%, rgba(30,22,12,0) 100%)",
                  }}
                />

                {/* LEFT PAGE: Edition Metadata, Read Status & Summary */}
                <section
                  className={`p-6 sm:p-8 md:pr-10 flex flex-col justify-between gap-5 border-b md:border-b-0 md:border-r border-[#E4DAC7] bg-gradient-to-br from-[#FCF9F2] to-[#F5EFE2] ${
                    mobilePage === "right" ? "hidden md:flex" : "flex"
                  }`}
                  style={{
                    transform: "rotateY(1.2deg)",
                    transformOrigin: "right center",
                  }}
                >
                  <div className="space-y-4">
                    {/* Running Folio Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E4DAC7]">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7A6F5E]">
                        Ex Libris
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleToggleOwned}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider border cursor-pointer transition ${
                            book.isOwned
                              ? "bg-emerald-700/10 border-emerald-700/30 text-emerald-900"
                              : "bg-[#EFE8D9] border-[#D8CCB7] text-[#5D5344]"
                          }`}
                        >
                          {book.isOwned ? (
                            <>
                              <ShoppingBag className="w-2.5 h-2.5" />
                              My Stuff
                            </>
                          ) : (
                            <>
                              <BookOpen className="w-2.5 h-2.5" />
                              Read Online
                            </>
                          )}
                        </button>
                        {book.sources
                          .filter((src) => !(src === "MY_STUFF" && book.isOwned))
                          .map((src) => (
                            <span
                              key={src}
                              className={`px-2 py-0.5 rounded-full border font-mono text-[10px] uppercase tracking-wider ${
                                src === "GOODREADS"
                                  ? "bg-amber-900/10 border-amber-900/25 text-amber-950"
                                  : "bg-[#EFE8D9] border-[#D8CCB7] text-[#5D5344]"
                              }`}
                            >
                              {formatBookSourceLabel(src)}
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* Cover Thumbnail + Title + Author */}
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-28 rounded-r-md bg-[#E9E1D0] border border-[#D8CCB7] overflow-hidden shrink-0 shadow-sm">
                        {book.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-1.5 text-center font-serif-editorial text-[11px] text-[#6B6152]">
                            {book.title.slice(0, 28)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <h2 className="font-serif-editorial text-2xl leading-snug text-[#181410]">
                          {book.title}
                        </h2>
                        <p className="text-sm font-serif italic text-[#4F473B]">
                          by{" "}
                          {onSelectAuthor &&
                          book.author &&
                          book.author.toLowerCase() !== "unknown author" ? (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectAuthor(book.author);
                                onClose();
                              }}
                              className="underline underline-offset-4 decoration-[#9A8E7B] hover:text-[#181410] cursor-pointer"
                              title={`Filter shelf to books by ${book.author}`}
                            >
                              {book.author}
                            </button>
                          ) : (
                            book.author
                          )}
                        </p>
                        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 pt-1 font-mono text-[10px] text-[#7A6F5E]">
                          {book.year && <span>{book.year}</span>}
                          {book.pageCount && <span>{book.pageCount} pages</span>}
                          {book.publisher && <span>{book.publisher}</span>}
                          {book.isbn && <span>ISBN {book.isbn}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Interactive Read Status & Rating */}
                    <div className="p-3.5 rounded-xl bg-[#F2EBD9]/75 border border-[#E2D6C1] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7A6F5E]">
                          Reading Status
                        </span>
                        {book.dateRead && (
                          <span className="font-mono text-[10px] text-[#7A6F5E]">
                            Read {book.dateRead}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: "FINISHED", label: "Read", icon: CheckCircle2 },
                            { id: "READING", label: "Reading", icon: BookOpen },
                            { id: "WANT_TO_READ", label: "Want to Read", icon: Clock },
                          ] as const
                        ).map((opt) => {
                          const Icon = opt.icon;
                          const active = book.readingStatus === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              data-testid={`open-book-status-${opt.id}`}
                              onClick={() => handleStatusChange(opt.id)}
                              className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                                active
                                  ? "bg-[#1E1A16] text-[#FAF6EE] border-[#1E1A16]"
                                  : "bg-[#FAF6EE] border-[#D8CCB7] text-[#5D5344] hover:text-[#1E1A16]"
                              }`}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[#E2D6C1]">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7A6F5E]">
                          Rating
                        </span>
                        <div className="flex items-center gap-0.5">
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
                                    ? "fill-amber-600 text-amber-600"
                                    : "text-[#C9BDA6]"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Synopsis / Summary */}
                    <div className="space-y-1.5">
                      <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7A6F5E]">
                        Summary
                      </h3>
                      <p className="font-serif text-[14px] leading-relaxed text-[#352F26] max-h-44 overflow-y-auto pr-1">
                        {book.summary?.trim() ||
                          "No synopsis recorded yet for this edition. Use Enrich Covers or Full Curio Dossier to fetch metadata."}
                      </p>
                    </div>
                  </div>

                  {/* Left Folio Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#E4DAC7] font-mono text-[10px] text-[#8B7F6D]">
                    <span>{book.retailer ? `Acquired via ${book.retailer}` : "Curio Library"}</span>
                    <span>i</span>
                  </div>
                </section>

                {/* RIGHT PAGE: Labels / Tags, Personal Notes & Margin Quotes */}
                <section
                  className={`p-6 sm:p-8 md:pl-10 flex flex-col justify-between gap-5 bg-gradient-to-bl from-[#FCF9F2] to-[#F5EFE2] ${
                    mobilePage === "left" ? "hidden md:flex" : "flex"
                  }`}
                  style={{
                    transform: "rotateY(-1.2deg)",
                    transformOrigin: "left center",
                  }}
                >
                  <div className="space-y-5">
                    {/* Running Folio Header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#E4DAC7]">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7A6F5E]">
                        Notes &amp; Labels
                      </span>
                      <div className="flex items-center gap-2">
                        {isSaving && (
                          <Loader2 className="w-3 h-3 animate-spin text-[#7A6F5E]" />
                        )}
                        {savedToast && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-800">
                            <Check className="w-3 h-3" />
                            Saved
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Labels & Goodreads Shelves */}
                    <div className="space-y-2">
                      <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[#7A6F5E]">
                        Labels &amp; Goodreads Shelves
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {book.tags.length === 0 ? (
                          <span className="text-xs italic text-[#8B7F6D]">
                            No labels attached yet.
                          </span>
                        ) : (
                          book.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFE8D9] border border-[#D8CCB7] font-mono text-[11px] text-[#352F26]"
                            >
                              #{tag}
                              <button
                                type="button"
                                aria-label={`Remove label ${tag}`}
                                onClick={() => handleRemoveLabel(tag)}
                                className="text-[#7A6F5E] hover:text-[#1E1A16] cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                      <form onSubmit={handleAddLabel} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          placeholder="Add label (e.g. philosophy, 2026)..."
                          className="flex-1 px-3 py-1.5 rounded-lg border border-[#D8CCB7] bg-[#FCF9F2] text-xs text-[#1E1A16] placeholder:text-[#9A8E7B] focus:outline-none focus:ring-1 focus:ring-[#7A6F5E]"
                        />
                        <button
                          type="submit"
                          disabled={!tagDraft.trim()}
                          aria-label="Add label"
                          className="p-1.5 rounded-lg border border-[#D8CCB7] bg-[#EFE8D9] text-[#352F26] hover:bg-[#E5DBCA] disabled:opacity-40 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>

                    {/* Personal Notes / Comments */}
                    <div className="space-y-2 pt-2 border-t border-[#E4DAC7]">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="open-book-notes"
                          className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7A6F5E]"
                        >
                          Reading Notes &amp; Comments
                        </label>
                        {notesDirty && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={handleSaveNotes}
                            data-testid="open-book-save-notes"
                            className="px-2.5 py-0.5 rounded-full bg-[#1E1A16] text-[#FAF6EE] font-mono text-[10px] cursor-pointer"
                          >
                            Save Notes
                          </button>
                        )}
                      </div>
                      <textarea
                        id="open-book-notes"
                        rows={5}
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Record impressions, key arguments, or reflections..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8CCB7] bg-[#FCF9F2] font-serif text-[13px] leading-relaxed text-[#1E1A16] placeholder:text-[#9A8E7B] focus:outline-none focus:ring-1 focus:ring-[#7A6F5E]"
                      />
                    </div>

                    {/* Margin Quotes */}
                    <div className="space-y-2 pt-2 border-t border-[#E4DAC7]">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7A6F5E]">
                          Margin Passages ({book.marginQuotes.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAddingQuote((v) => !v)}
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-[#5D5344] hover:text-[#1E1A16] cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Quote</span>
                        </button>
                      </div>

                      {isAddingQuote && (
                        <form onSubmit={handleAddQuote} className="space-y-1.5">
                          <textarea
                            rows={2}
                            value={quoteDraft}
                            onChange={(e) => setQuoteDraft(e.target.value)}
                            placeholder="Paste a passage from the book..."
                            className="w-full px-3 py-2 rounded-lg border border-[#D8CCB7] bg-[#FCF9F2] font-serif italic text-xs text-[#1E1A16] focus:outline-none"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setIsAddingQuote(false)}
                              className="px-2.5 py-1 text-[10px] font-mono text-[#7A6F5E] cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 rounded-full bg-[#1E1A16] text-[#FAF6EE] text-[10px] font-mono cursor-pointer"
                            >
                              Save Quote
                            </button>
                          </div>
                        </form>
                      )}

                      {book.marginQuotes.length > 0 && (
                        <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                          {book.marginQuotes.map((q, idx) => (
                            <div
                              key={`${idx}-${q.slice(0, 12)}`}
                              className="group relative p-2.5 pr-7 rounded-lg bg-[#F2EBD9]/80 border border-[#E2D6C1] font-serif italic text-xs text-[#352F26]"
                            >
                              <Quote className="w-2.5 h-2.5 inline mr-1 opacity-45" />
                              &ldquo;{q}&rdquo;
                              <button
                                type="button"
                                onClick={() => handleRemoveQuote(idx)}
                                aria-label="Delete quote"
                                className="absolute top-2 right-2 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 text-[#7A6F5E] hover:text-rose-700 transition cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Folio Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#E4DAC7]">
                    <a
                      href={book.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-[#7A6F5E] hover:text-[#1E1A16]"
                    >
                      <span>{isGoodreadsBook ? "Goodreads" : "Catalog Link"}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    {onOpenFullDossier && (
                      <button
                        type="button"
                        onClick={() => onOpenFullDossier(book)}
                        className="px-3 py-1 rounded-full border border-[#D8CCB7] bg-[#EFE8D9] hover:bg-[#E5DBCA] font-mono text-[10px] text-[#1E1A16] cursor-pointer transition"
                      >
                        Full Curio Dossier
                      </button>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
