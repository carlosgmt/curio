"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Film,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { VirtualBookshelfItem } from "@/components/layout/VirtualBookshelf3D";
import type { CardData } from "@/components/cards/PolymorphicCard";
import {
  formatSpineMeta,
  getArchetypeSpec,
  getDeterministicClothPalette,
  resolveSameOriginImageUrl,
  type PressPalette,
} from "@/lib/press/archetypes";
import { extractPaletteFromImageUrl } from "@/lib/press/palette";
import {
  compareLibraryBooks,
  formatBookSourceLabel,
  type BookSortKey,
  type LibraryBookView,
  type LibraryStats,
  type ReadingStatus,
} from "@/lib/books/library";
import { LogBookModal } from "./LogBookModal";
import { GoodreadsSyncModal, type GoodreadsSyncStatusInfo } from "./GoodreadsSyncModal";
import { BookInspectorDrawer } from "./BookInspectorDrawer";
import { OpenBook3DModal } from "./OpenBook3DModal";
import { CardLightboxModal } from "@/components/lightbox/CardLightboxModal";
import { BoardExhibitionModal } from "@/components/lists/BoardExhibitionModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { CurioMark } from "@/components/layout/CurioLogo";
import { HairlineTickRuler } from "@/components/ui/HairlineTickRuler";

const VirtualBookshelf3D = dynamic(
  () => import("@/components/layout/VirtualBookshelf3D"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[370px] items-center justify-center font-mono text-xs uppercase tracking-widest opacity-60">
        Loading 3D Bookshelf...
      </div>
    ),
  }
);

type ShelfScope = "owned" | "online" | "all";

export function PersonalLibraryView() {
  const [books, setBooks] = useState<LibraryBookView[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [grStatus, setGrStatus] = useState<GoodreadsSyncStatusInfo | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // 3D Shelf State
  const [shelfScope, setShelfScope] = useState<ShelfScope>("owned");
  const initialScopeChosenRef = useRef(false);
  const [shelfMode, setShelfMode] = useState<"showcase" | "spines">("showcase");
  const [inspectMode, setInspectMode] = useState<"front" | "spine">("front");
  const [selectedSaveId, setSelectedSaveId] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [palettesBySaveId, setPalettesBySaveId] = useState<
    Record<string, PressPalette>
  >({});

  // Catalog Filters
  const [statusFilter, setStatusFilter] = useState<"ALL" | ReadingStatus | "NOT_READ">("ALL");
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "MY_STUFF" | "GOODREADS" | "MANUAL">("ALL");
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [isDeduping, setIsDeduping] = useState(false);
  const [openBookSaveId, setOpenBookSaveId] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<BookSortKey>("dateAdded");
  const [catalogLayout, setCatalogLayout] = useState<"grid" | "list">("grid");

  // Modals & Actions
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isQuickSyncing, setIsQuickSyncing] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [lightboxCard, setLightboxCard] = useState<CardData | null>(null);
  const [lightboxPresentation, setLightboxPresentation] = useState<
    "standard" | "press"
  >("standard");
  const [isExhibitionOpen, setIsExhibitionOpen] = useState(false);
  const [mobileBarHidden, setMobileBarHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const y = Math.max(0, Math.min(window.scrollY, maxScroll));
      const delta = y - lastScrollYRef.current;
      if (y <= 48) {
        setMobileBarHidden(false);
      } else if (delta > 8 && y > 64) {
        setMobileBarHidden(true);
      } else if (delta < -6) {
        setMobileBarHidden(false);
      }
      lastScrollYRef.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const loadLibrary = useCallback(async () => {
    try {
      const meRes = await apiFetch("/api/v1/auth/me");
      if (!meRes.ok) {
        setUser(null);
        setLoading(false);
        return;
      }
      const meData = await meRes.json();
      setUser(meData.user);

      const res = await apiFetch("/api/v1/library");
      if (!res.ok) return;
      const data = await res.json();
      const loadedBooks: LibraryBookView[] = Array.isArray(data?.books)
        ? data.books
        : [];
      setBooks(loadedBooks);
      setStats(data.stats || null);
      setGrStatus(data.goodreadsStatus || null);
      setDuplicateCount(typeof data.duplicateCount === "number" ? data.duplicateCount : 0);

      if (!initialScopeChosenRef.current) {
        initialScopeChosenRef.current = true;
        const hasOwned = loadedBooks.some((b) => b.isOwned);
        if (!hasOwned && loadedBooks.length > 0) {
          setShelfScope("all");
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  // Books appearing on the Stripe Press 3D Shelf
  const shelfBooks = useMemo(() => {
    if (shelfScope === "owned") return books.filter((b) => b.isOwned);
    if (shelfScope === "online") return books.filter((b) => !b.isOwned);
    return books;
  }, [books, shelfScope]);

  const activeShelfIdx = useMemo(() => {
    if (shelfBooks.length === 0) return -1;
    if (!selectedSaveId) return 0;
    const idx = shelfBooks.findIndex((b) => b.saveId === selectedSaveId);
    return idx >= 0 ? idx : 0;
  }, [shelfBooks, selectedSaveId]);

  const activeBook = useMemo(() => {
    if (activeShelfIdx >= 0) return shelfBooks[activeShelfIdx];
    if (selectedSaveId) {
      return books.find((b) => b.saveId === selectedSaveId) || books[0] || null;
    }
    return books[0] || null;
  }, [shelfBooks, activeShelfIdx, selectedSaveId, books]);

  const setActiveShelfByIndex = useCallback(
    (nextIdx: number) => {
      if (shelfBooks.length === 0) return;
      const clamped = Math.max(0, Math.min(shelfBooks.length - 1, nextIdx));
      setSelectedSaveId(shelfBooks[clamped].saveId);
    },
    [shelfBooks]
  );

  // Extract WCAG-safe cloth palettes for visible shelf neighborhood
  useEffect(() => {
    if (shelfBooks.length === 0 || activeShelfIdx < 0) return;
    let cancelled = false;
    const start = Math.max(0, activeShelfIdx - 12);
    const end = Math.min(shelfBooks.length - 1, activeShelfIdx + 12);

    const run = async () => {
      const slice: Array<{ book: LibraryBookView; dist: number }> = [];
      for (let i = start; i <= end; i++) {
        slice.push({ book: shelfBooks[i], dist: Math.abs(i - activeShelfIdx) });
      }
      slice.sort((a, b) => a.dist - b.dist);

      for (const { book } of slice) {
        if (cancelled) break;
        if (palettesBySaveId[book.saveId]) continue;
        const fallback = getDeterministicClothPalette(book.card, "book");
        const sameOriginUrl = resolveSameOriginImageUrl(book.coverUrl);
        if (!sameOriginUrl) {
          setPalettesBySaveId((prev) =>
            prev[book.saveId] ? prev : { ...prev, [book.saveId]: fallback }
          );
          continue;
        }
        const extracted = await extractPaletteFromImageUrl(sameOriginUrl, fallback);
        if (!cancelled) {
          setPalettesBySaveId((prev) =>
            prev[book.saveId] ? prev : { ...prev, [book.saveId]: extracted }
          );
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [shelfBooks, activeShelfIdx, palettesBySaveId]);

  const activePalette = useMemo<PressPalette>(() => {
    if (!activeBook) {
      return {
        id: "obsidian",
        surface: "#1D1E20",
        surfaceSecondary: "#151618",
        ink: "#F2EFE9",
        muted: "#BAB7B0",
        accent: "#DFBF74",
        rule: "#393B3F",
        coverBg: "#2A2B2E",
        coverInk: "#F2EFE9",
      };
    }
    return (
      palettesBySaveId[activeBook.saveId] ||
      getDeterministicClothPalette(activeBook.card, "book")
    );
  }, [activeBook, palettesBySaveId]);

  const shelfItems3D = useMemo<VirtualBookshelfItem[]>(
    () =>
      shelfBooks.map((book) => ({
        saveId: book.saveId,
        spec: getArchetypeSpec(book.card, "book"),
        meta: formatSpineMeta(book.card),
        palette:
          palettesBySaveId[book.saveId] ||
          getDeterministicClothPalette(book.card, "book"),
        imageUrl: resolveSameOriginImageUrl(book.coverUrl),
        pageCount: book.pageCount,
        isOwned: book.isOwned,
        readingStatus: book.readingStatus,
        rating: book.rating,
      })),
    [shelfBooks, palettesBySaveId]
  );

  const missingMetadataCount = useMemo(
    () =>
      books.filter(
        (b) => !b.coverUrl || !b.pageCount || b.author === "Unknown Author"
      ).length,
    [books]
  );

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const authorNorm = authorFilter?.trim().toLowerCase() || null;
    const list = books.filter((b) => {
      if (statusFilter === "NOT_READ" && b.readingStatus === "FINISHED") return false;
      if (statusFilter !== "ALL" && statusFilter !== "NOT_READ" && b.readingStatus !== statusFilter) return false;
      if (sourceFilter === "MY_STUFF" && !b.sources.includes("MY_STUFF")) return false;
      if (sourceFilter === "GOODREADS" && !b.sources.includes("GOODREADS")) return false;
      if (sourceFilter === "MANUAL" && !b.sources.includes("MANUAL")) return false;
      if (
        authorNorm &&
        b.author.toLowerCase() !== authorNorm &&
        !b.author.toLowerCase().includes(authorNorm)
      ) {
        return false;
      }
      if (
        tagFilter &&
        !b.tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase())
      ) {
        return false;
      }
      if (q) {
        const hay = `${b.title} ${b.author} ${b.personalNotes || ""} ${b.tags.join(
          " "
        )}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => compareLibraryBooks(a, b, sortBy));
    return sorted;
  }, [books, statusFilter, sourceFilter, authorFilter, tagFilter, searchQuery, sortBy]);

  const handleEnrichCovers = async () => {
    setIsEnriching(true);
    setBannerNotice(null);
    try {
      const res = await apiFetch("/api/v1/library/enrich", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setBannerNotice(
          `Enriched ${data.enrichedCount ?? 0} of ${data.totalChecked ?? 0} books with covers, authors, and page counts.`
        );
        await loadLibrary();
      }
    } finally {
      setIsEnriching(false);
    }
  };

  const handleQuickGoodreadsSync = async () => {
    if (!grStatus?.configured) {
      setIsSyncModalOpen(true);
      return;
    }
    setIsQuickSyncing(true);
    setBannerNotice(null);
    try {
      const res = await apiFetch("/api/v1/library/goodreads-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.status === 401 || data.code === "GOODREADS_COOKIE_EXPIRED") {
        await loadLibrary();
        setIsSyncModalOpen(true);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Goodreads sync failed");
      }
      setBannerNotice(
        `Goodreads synced: ${data.recordsProcessed ?? 0} books (${data.createdSaves ?? 0} added, ${data.updatedSaves ?? 0} updated).`
      );
      await loadLibrary();
    } catch (err: any) {
      setBannerNotice(err?.message || "Goodreads sync failed");
    } finally {
      setIsQuickSyncing(false);
    }
  };

  const focusBookOnShelf = (book: LibraryBookView) => {
    if (shelfScope === "owned" && !book.isOwned) {
      setShelfScope("all");
    } else if (shelfScope === "online" && book.isOwned) {
      setShelfScope("all");
    }
    setSelectedSaveId(book.saveId);
    setInspectMode("front");
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleShelfKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (shelfBooks.length === 0 || activeShelfIdx < 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveShelfByIndex(activeShelfIdx + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveShelfByIndex(activeShelfIdx - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <BookOpen className="w-7 h-7 text-muted-foreground animate-pulse mb-3" />
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Opening Personal Library...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h1 className="font-serif-editorial text-4xl text-foreground">
          Curio Personal Library
        </h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Sign in to explore your 3D bookshelf, Goodreads shelf tags, and reading notes.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-full border border-border text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            ← Back to Curio
          </Link>
          <button
            type="button"
            onClick={() => setIsAuthOpen(true)}
            className="px-5 py-2 rounded-full bg-foreground text-background text-xs font-mono font-medium cursor-pointer"
          >
            Sign In
          </button>
        </div>
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={(u, token) => {
            if (typeof window !== "undefined" && token) {
              localStorage.setItem("curio_token", token);
            }
            setUser(u);
            setIsAuthOpen(false);
            void loadLibrary();
          }}
        />
      </div>
    );
  }

  const allTags = stats?.tagCounts.map((t) => t.tag) || [];
  const activeMeta = activeBook ? formatSpineMeta(activeBook.card) : null;
  const exhibitionItems = (filteredCatalog.length > 0 ? filteredCatalog : shelfBooks).map(
    (b) => b.card
  );

  return (
    <main className="min-h-screen bg-background text-foreground pb-16">
      {/* < 48px Auto-Hiding Mobile Sticky Header */}
      <div
        className={`md:hidden sticky top-0 z-30 h-11 px-3 flex items-center justify-between gap-2 bg-background/90 backdrop-blur-md border-b border-border transition-transform duration-150 ${
          mobileBarHidden ? "-translate-y-full focus-within:translate-y-0" : "translate-y-0"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            aria-label="Back to Curio"
            className="inline-flex items-center gap-1.5 text-foreground hover:opacity-80 transition-opacity shrink-0"
          >
            <CurioMark size={18} variant="compact" />
          </Link>
          <span className="truncate font-serif text-sm text-foreground">
            Library
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">
            · {stats?.total ?? books.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsLogModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border border-border bg-card text-foreground cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Log</span>
          </button>
          {exhibitionItems.length > 0 && (
            <button
              type="button"
              data-testid="mobile-open-exhibition-btn"
              onClick={() => setIsExhibitionOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono bg-[var(--brand)] text-[var(--brand-foreground)] cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Immerse</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Editorial Navigation Bar (Desktop) */}
      <header className="hidden md:block border-b border-border bg-background/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Curio</span>
            </Link>
            <Link
              href="/cinema"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <Film className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Cinema</span>
            </Link>
            <div className="min-w-0">
              <h1 className="font-serif-editorial text-2xl sm:text-3xl leading-none tracking-tight text-foreground">
                Personal Library
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border cursor-pointer transition-colors ${
                grStatus?.authStatus === "expired"
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
                  : grStatus?.configured
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {grStatus?.authStatus === "expired" && (
                <AlertTriangle className="w-3 h-3" />
              )}
              <span>
                {grStatus?.authStatus === "expired"
                  ? "Goodreads Cookie Expired"
                  : grStatus?.configured
                  ? "Goodreads Synced"
                  : "Connect Goodreads"}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {duplicateCount > 0 && (
              <button
                type="button"
                onClick={async () => {
                  setIsDeduping(true);
                  setBannerNotice(null);
                  try {
                    const res = await apiFetch("/api/v1/library/deduplicate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({}),
                    });
                    const d = await res.json();
                    if (res.ok) {
                      setBannerNotice(
                        `Merged ${d.mergedSavesRemoved ?? 0} duplicate books into canonical editions.`
                      );
                      await loadLibrary();
                    }
                  } finally {
                    setIsDeduping(false);
                  }
                }}
                disabled={isDeduping}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-xs font-mono text-amber-700 dark:text-amber-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeduping && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Fix Duplicates ({duplicateCount})</span>
              </button>
            )}
            {missingMetadataCount > 0 && (
              <button
                type="button"
                onClick={handleEnrichCovers}
                disabled={isEnriching}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border bg-card text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
              >
                {isEnriching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>
                  {isEnriching
                    ? "Enriching..."
                    : `Enrich Covers (${missingMetadataCount})`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleQuickGoodreadsSync}
              disabled={isQuickSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border bg-card text-xs font-mono text-foreground hover:border-foreground/40 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isQuickSyncing ? "animate-spin" : ""}`}
              />
              <span>{isQuickSyncing ? "Syncing..." : "Sync Goodreads"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="px-3 py-1.5 rounded-full border border-border bg-card text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Goodreads Cookie & CSV Settings"
            >
              Settings
            </button>

            {exhibitionItems.length > 0 && (
              <button
                type="button"
                data-testid="open-exhibition-btn"
                onClick={() => setIsExhibitionOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border bg-card text-xs font-mono text-foreground hover:border-foreground/40 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[var(--brand)]" />
                <span>Immerse</span>
              </button>
            )}

            <button
              type="button"
              data-testid="log-read-book-btn"
              onClick={() => setIsLogModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-foreground text-background text-xs font-mono font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Read Book</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-8">
        {bannerNotice && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border border-border bg-card text-xs font-mono">
            <span>{bannerNotice}</span>
            <button
              type="button"
              onClick={() => setBannerNotice(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Stripe Press 3D Bookshelf Hero + Live Book Inspector */}
        <section
          ref={stageRef}
          tabIndex={0}
          onKeyDown={handleShelfKeyDown}
          className="rounded-2xl border border-border/80 overflow-hidden shadow-lift grid grid-cols-1 xl:grid-cols-[1.55fr_420px] outline-none"
        >
          {/* Left: 3D Bookshelf Stage */}
          <div
            className="relative flex flex-col justify-between min-w-0"
            style={{
              backgroundColor: activePalette.surface,
              color: activePalette.ink,
              transition: "background-color 400ms ease, color 400ms ease",
            }}
          >
            {/* Stage Ledger Bar */}
            <div
              className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b"
              style={{ borderColor: activePalette.rule }}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    {
                      id: "owned",
                      label: `Owned (${stats?.ownedCount ?? 0})`,
                    },
                    {
                      id: "online",
                      label: `Read Online (${stats?.readOnlineCount ?? 0})`,
                    },
                    {
                      id: "all",
                      label: `All (${stats?.total ?? 0})`,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`shelf-scope-${opt.id}`}
                    onClick={() => setShelfScope(opt.id)}
                    className="px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border transition-colors cursor-pointer"
                    style={{
                      borderColor:
                        shelfScope === opt.id
                          ? activePalette.accent
                          : activePalette.rule,
                      backgroundColor:
                        shelfScope === opt.id
                          ? activePalette.accent
                          : activePalette.surfaceSecondary,
                      color:
                        shelfScope === opt.id
                          ? activePalette.surfaceSecondary
                          : activePalette.ink,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() =>
                    setShelfMode((m) => (m === "showcase" ? "spines" : "showcase"))
                  }
                  className="px-2.5 py-1 rounded-full border cursor-pointer"
                  style={{
                    borderColor: activePalette.rule,
                    backgroundColor: activePalette.surfaceSecondary,
                    color: activePalette.ink,
                  }}
                >
                  {shelfMode === "showcase" ? "Showcase" : "Spines"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setInspectMode((m) => (m === "spine" ? "front" : "spine"))
                  }
                  className="px-2.5 py-1 rounded-full border cursor-pointer"
                  style={{
                    borderColor: activePalette.rule,
                    backgroundColor: activePalette.surfaceSecondary,
                    color: activePalette.ink,
                  }}
                >
                  {inspectMode === "spine" ? "Cover" : "Spine"}
                </button>
                <button
                  type="button"
                  aria-label="Reset 3D shelf angle"
                  onClick={() => {
                    setInspectMode("front");
                    setResetSignal((n) => n + 1);
                  }}
                  className="p-1.5 rounded-full border cursor-pointer"
                  style={{
                    borderColor: activePalette.rule,
                    backgroundColor: activePalette.surfaceSecondary,
                    color: activePalette.ink,
                  }}
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 3D WebGL Shelf or CSS Fallback */}
            {shelfBooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-3">
                <BookOpen
                  className="w-8 h-8 opacity-50"
                  style={{ color: activePalette.muted }}
                />
                <p className="font-serif-editorial text-xl">
                  {shelfScope === "owned"
                    ? "No owned books on the 3D shelf yet."
                    : shelfScope === "online"
                    ? "No books logged as Read Online yet."
                    : "Your Personal Library is empty."}
                </p>
                <div className="flex items-center gap-2">
                  {shelfScope !== "all" && books.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShelfScope("all")}
                      className="px-4 py-1.5 rounded-full font-mono text-xs border cursor-pointer"
                      style={{
                        borderColor: activePalette.rule,
                        color: activePalette.ink,
                      }}
                    >
                      Show All Books ({books.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsLogModalOpen(true)}
                    className="px-4 py-1.5 rounded-full font-mono text-xs font-medium cursor-pointer"
                    style={{
                      backgroundColor: activePalette.accent,
                      color: activePalette.surfaceSecondary,
                    }}
                  >
                    + Log Read Book
                  </button>
                </div>
              </div>
            ) : !webglUnavailable ? (
              <VirtualBookshelf3D
                items={shelfItems3D}
                activeIndex={activeShelfIdx}
                inspectMode={inspectMode}
                shelfMode={shelfMode}
                onSelectIndex={(idx) => {
                  setInspectMode("front");
                  setActiveShelfByIndex(idx);
                }}
                onActivateActiveItem={() => {
                  if (activeBook) setOpenBookSaveId(activeBook.saveId);
                }}
                onToggleInspectMode={() =>
                  setInspectMode((m) => (m === "spine" ? "front" : "spine"))
                }
                onWebglUnavailable={() => setWebglUnavailable(true)}
                resetSignal={resetSignal}
              />
            ) : (
              <div className="px-6 py-10 flex items-end gap-3 overflow-x-auto min-h-[340px]">
                {shelfBooks.map((b, idx) => {
                  const isAct = idx === activeShelfIdx;
                  return (
                    <button
                      key={b.saveId}
                      type="button"
                      onClick={() => setActiveShelfByIndex(idx)}
                      className={`shrink-0 rounded-r-md overflow-hidden border transition-transform cursor-pointer ${
                        isAct
                          ? "w-40 h-56 -translate-y-2 shadow-2xl"
                          : "w-12 h-52 opacity-80 hover:opacity-100"
                      }`}
                      style={{
                        borderColor: activePalette.rule,
                        backgroundColor: activePalette.coverBg,
                      }}
                    >
                      {isAct && b.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.coverUrl}
                          alt={b.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center p-2">
                          <span className="press-writing-v font-serif-editorial text-xs truncate">
                            {b.title}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Synchronized Marquee + Shelf Scrubber */}
            {shelfBooks.length > 0 && activeBook && activeMeta && (
              <div
                className="relative z-10 border-t px-4 sm:px-6 py-3.5 space-y-2.5"
                style={{
                  borderColor: activePalette.rule,
                  backgroundColor: `${activePalette.surfaceSecondary}CC`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className="font-mono text-[10px] uppercase tracking-[0.12em] truncate"
                      style={{ color: activePalette.accent }}
                    >
                      {activeBook.author &&
                      activeBook.author.toLowerCase() !== "unknown author" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthorFilter(activeBook.author);
                            setStatusFilter("ALL");
                          }}
                          className="underline underline-offset-4 decoration-dotted hover:opacity-80 cursor-pointer"
                        >
                          {activeBook.author}
                        </button>
                      ) : (
                        activeBook.author
                      )}
                      {activeBook.year ? ` · ${activeBook.year}` : ""}
                      {activeBook.pageCount ? ` · ${activeBook.pageCount} pp` : ""}
                    </div>
                    <div className="font-serif-editorial text-xl sm:text-2xl truncate">
                      {activeBook.title}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveShelfByIndex(activeShelfIdx - 1)}
                      disabled={activeShelfIdx <= 0}
                      aria-label="Previous book"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-full border disabled:opacity-30 cursor-pointer"
                      style={{
                        borderColor: activePalette.rule,
                        backgroundColor: activePalette.surface,
                        color: activePalette.ink,
                      }}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <span style={{ color: activePalette.muted }}>
                      {String(activeShelfIdx + 1).padStart(2, "0")} /{" "}
                      {String(shelfBooks.length).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveShelfByIndex(activeShelfIdx + 1)}
                      disabled={activeShelfIdx >= shelfBooks.length - 1}
                      aria-label="Next book"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-full border disabled:opacity-30 cursor-pointer"
                      style={{
                        borderColor: activePalette.rule,
                        backgroundColor: activePalette.surface,
                        color: activePalette.ink,
                      }}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {shelfBooks.length > 3 && (
                  <HairlineTickRuler
                    total={shelfBooks.length}
                    activeIndex={activeShelfIdx}
                    onChange={setActiveShelfByIndex}
                    ariaLabel="Scrub bookshelf"
                    accentColor={activePalette.accent}
                    ruleColor={activePalette.rule}
                    tickColor={activePalette.rule}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right: Live Book Inspector & Comments */}
          <BookInspectorDrawer
            book={activeBook}
            onSelectAuthor={(author) => {
              setAuthorFilter(author);
              setStatusFilter("ALL");
            }}
            onUpdated={() => {
              void loadLibrary();
            }}
            onOpenFullModal={(book, presentation) => {
              setLightboxPresentation(presentation || "standard");
              setLightboxCard(book.card);
            }}
          />
        </section>

        {/* Reading Telemetry Strip (Flush Hairlines) */}
        {stats && (
          <section className="grid grid-cols-2 sm:grid-cols-5 border-y border-border divide-y sm:divide-y-0 sm:divide-x divide-border">
            {[
              { label: "Library Volumes", value: stats.total },
              { label: "Owned on Shelf", value: stats.ownedCount },
              { label: "Read This Year", value: stats.readThisYear },
              {
                label: "Pages Read",
                value: stats.totalPagesRead.toLocaleString(),
              },
              {
                label: "Average Rating",
                value: stats.avgRating !== null ? `${stats.avgRating} ★` : "—",
              },
            ].map((metric) => (
              <div key={metric.label} className="py-3.5 px-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {metric.label}
                </div>
                <div className="font-mono text-xl sm:text-2xl tabular-nums font-medium text-foreground mt-0.5">
                  {metric.value}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Library Explorer & Goodreads Tag Filter */}
        <section className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "ALL", label: "All", count: stats?.total ?? books.length },
                  {
                    id: "FINISHED",
                    label: "Read",
                    count: stats?.finishedCount ?? 0,
                  },
                  {
                    id: "NOT_READ",
                    label: "Not Read",
                    count: Math.max(0, (stats?.total ?? books.length) - (stats?.finishedCount ?? 0)),
                  },
                  {
                    id: "READING",
                    label: "Reading",
                    count: stats?.readingCount ?? 0,
                  },
                  {
                    id: "WANT_TO_READ",
                    label: "Want to Read",
                    count: stats?.wantToReadCount ?? 0,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-colors cursor-pointer ${
                    statusFilter === tab.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="opacity-70 tabular-nums">{tab.count}</span>
                </button>
              ))}

              <span className="h-4 w-px bg-border mx-1 hidden sm:inline-block" />

              {(["ALL", "MY_STUFF", "GOODREADS", "MANUAL"] as const).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setSourceFilter(src)}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-colors cursor-pointer ${
                    sourceFilter === src
                      ? "bg-secondary text-foreground border-foreground/30 font-medium"
                      : "bg-transparent border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {src === "ALL"
                    ? "Any Source"
                    : formatBookSourceLabel(src)}
                </button>
              ))}
              {authorFilter && (
                <button
                  type="button"
                  onClick={() => setAuthorFilter(null)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 cursor-pointer"
                >
                  <span>Author: {authorFilter} ×</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-initial sm:w-64">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, author, notes..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-full border border-border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as BookSortKey)}
                aria-label="Sort books"
                className="px-3 py-1.5 rounded-full border border-border bg-card text-xs font-mono focus:outline-none"
              >
                <option value="dateAdded">Date Added</option>
                <option value="author">Author (A–Z)</option>
                <option value="title">Title (A–Z)</option>
                <option value="read">Read Status</option>
                <option value="dateRead">Date Read</option>
                <option value="rating">Highest Rated</option>
                <option value="pages">Page Count</option>
              </select>
              <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setCatalogLayout("grid")}
                  aria-label="Grid view"
                  className={`p-1.5 rounded-full cursor-pointer ${
                    catalogLayout === "grid"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogLayout("list")}
                  aria-label="List view"
                  className={`p-1.5 rounded-full cursor-pointer ${
                    catalogLayout === "list"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground"
                  }`}
                >
                  <ListIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Goodreads / Custom Tag Filter Pills */}
          {stats && stats.tagCounts.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setTagFilter(null)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors cursor-pointer ${
                  tagFilter === null
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                All Tags
              </button>
              {stats.tagCounts.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() =>
                    setTagFilter((cur) => (cur === t.tag ? null : t.tag))
                  }
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors cursor-pointer ${
                    tagFilter?.toLowerCase() === t.tag.toLowerCase()
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>#{t.tag}</span>
                  <span className="opacity-65 tabular-nums">{t.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Filtered Catalog */}
          {filteredCatalog.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-3xl space-y-2">
              <p className="font-serif-editorial text-lg text-muted-foreground">
                No books match the current filters.
              </p>
              {(tagFilter || authorFilter || searchQuery || statusFilter !== "ALL" || sourceFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setTagFilter(null);
                    setAuthorFilter(null);
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setSourceFilter("ALL");
                  }}
                  className="font-mono text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : catalogLayout === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {filteredCatalog.map((book) => {
                const isSelected = activeBook?.saveId === book.saveId;
                return (
                  <article
                    key={book.saveId}
                    onClick={() => focusBookOnShelf(book)}
                    className={`group flex flex-col cursor-pointer rounded-2xl border bg-card overflow-hidden transition-all duration-150 hover:-translate-y-0.5 ${
                      isSelected
                        ? "border-foreground ring-1 ring-foreground"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="relative aspect-[1/1.45] w-full bg-muted overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 w-4 z-10 pointer-events-none"
                        style={{
                          background:
                            "linear-gradient(to right, rgba(0,0,0,0.28), rgba(255,255,255,0.14) 30%, transparent)",
                        }}
                      />
                      {book.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                        />
                      ) : (
                        <div className="w-full h-full p-4 flex flex-col justify-between bg-secondary">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                            {book.publisher || "Book"}
                          </span>
                          <div className="font-serif-editorial text-base font-medium leading-tight line-clamp-3">
                            {book.title}
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground truncate">
                            {book.author}
                          </span>
                        </div>
                      )}

                      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                        {book.sources.slice(0, 2).map((src) => (
                          <span
                            key={src}
                            className={`px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider backdrop-blur-xs border ${
                              src === "MY_STUFF"
                                ? "bg-neutral-950/80 text-emerald-300 border-emerald-400/30"
                                : src === "GOODREADS"
                                ? "bg-neutral-950/80 text-amber-200 border-amber-400/30"
                                : "bg-neutral-950/75 text-neutral-200 border-white/15"
                            }`}
                          >
                            {formatBookSourceLabel(src)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h3 className="font-serif-editorial text-sm font-medium leading-snug line-clamp-2 text-foreground">
                          {book.title}
                        </h3>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {book.author}
                        </p>
                      </div>

                      {book.personalNotes && (
                        <p className="text-[11px] italic text-muted-foreground line-clamp-2 border-l border-border pl-2">
                          {book.personalNotes}
                        </p>
                      )}

                      <div className="pt-1 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-0.5">
                          {book.rating ? (
                            <>
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              <span className="font-mono text-[10px] tabular-nums">
                                {book.rating}
                              </span>
                            </>
                          ) : (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {book.readingStatus === "FINISHED"
                                ? "Finished"
                                : book.readingStatus === "READING"
                                ? "Reading"
                                : "To Read"}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSaveId(book.saveId);
                            setOpenBookSaveId(book.saveId);
                          }}
                          className="font-mono text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Open →
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="border border-border rounded-2xl divide-y divide-border bg-card overflow-hidden">
              {filteredCatalog.map((book) => (
                <div
                  key={book.saveId}
                  onClick={() => focusBookOnShelf(book)}
                  className={`flex items-center gap-4 p-3.5 hover:bg-muted/40 transition-colors cursor-pointer ${
                    activeBook?.saveId === book.saveId ? "bg-muted/60" : ""
                  }`}
                >
                  <div className="w-10 h-14 rounded bg-muted border border-border overflow-hidden shrink-0">
                    {book.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif-editorial text-base font-medium truncate">
                        {book.title}
                      </h3>
                      {book.isOwned ? (
                        <ShoppingBag className="w-3 h-3 text-emerald-500 shrink-0" />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {book.author}
                      {book.year ? ` · ${book.year}` : ""}
                      {book.pageCount ? ` · ${book.pageCount} pp` : ""}
                    </p>
                    {book.personalNotes && (
                      <p className="text-xs italic text-muted-foreground truncate mt-0.5">
                        &ldquo;{book.personalNotes}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="hidden md:flex flex-wrap gap-1 max-w-xs justify-end">
                    {book.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-full bg-secondary font-mono text-[10px]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                  <div className="text-right font-mono text-[11px] tabular-nums shrink-0 space-y-0.5">
                    <div>
                      {book.rating ? `${book.rating} ★` : book.readingStatus}
                    </div>
                    {book.dateRead && (
                      <div className="text-[10px] text-muted-foreground">
                        {book.dateRead}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Log Read Book Modal */}
      <LogBookModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        existingTags={allTags}
        onSaved={(newBook) => {
          setSelectedSaveId(newBook.saveId);
          if (shelfScope === "owned" && !newBook.isOwned) {
            setShelfScope("all");
          }
          void loadLibrary();
        }}
      />

      {/* Goodreads Sync Modal */}
      <GoodreadsSyncModal
        isOpen={isSyncModalOpen}
        status={grStatus}
        onClose={() => setIsSyncModalOpen(false)}
        onSynced={() => {
          void loadLibrary();
        }}
      />

      {/* 3D Open Book Spread Modal */}
      <OpenBook3DModal
        book={books.find((b) => b.saveId === openBookSaveId) || null}
        isOpen={Boolean(openBookSaveId)}
        onSelectAuthor={(author) => {
          setAuthorFilter(author);
          setStatusFilter("ALL");
        }}
        onClose={() => setOpenBookSaveId(null)}
        onUpdated={() => {
          void loadLibrary();
        }}
        onOpenFullDossier={(book) => {
          setOpenBookSaveId(null);
          setLightboxPresentation("standard");
          setLightboxCard(book.card);
        }}
      />

      {/* Full Curio Card Lightbox */}
      <CardLightboxModal
        card={lightboxCard}
        isOpen={Boolean(lightboxCard)}
        initialPresentation={lightboxPresentation}
        creatorAffiliateTags={user?.affiliateTags}
        onClose={() => setLightboxCard(null)}
        onCardUpdated={() => {
          void loadLibrary();
        }}
        onCardDeleted={() => {
          setLightboxCard(null);
          void loadLibrary();
        }}
      />

      {/* Immersive Mobile & Desktop Exhibition Deck */}
      <BoardExhibitionModal
        isOpen={isExhibitionOpen}
        items={exhibitionItems}
        initialIndex={Math.max(0, activeShelfIdx)}
        boardTitle="Personal Library"
        onClose={() => setIsExhibitionOpen(false)}
        onInspectCard={(card) => {
          setIsExhibitionOpen(false);
          setLightboxPresentation("standard");
          setLightboxCard(card);
        }}
      />
    </main>
  );
}
