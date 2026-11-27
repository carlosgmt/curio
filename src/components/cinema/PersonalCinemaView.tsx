"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
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
  Repeat,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { VirtualPosterItem } from "@/components/layout/VirtualPosterWall3D";
import type { CardData } from "@/components/cards/PolymorphicCard";
import {
  formatSpineMeta,
  getDeterministicClothPalette,
  resolveSameOriginImageUrl,
  type PressPalette,
} from "@/lib/press/archetypes";
import { extractPaletteFromImageUrl } from "@/lib/press/palette";
import type { CinemaStats, FilmView, WatchStatus } from "@/lib/cinema/library";
import { LogFilmModal } from "./LogFilmModal";
import {
  LetterboxdSyncModal,
  type LetterboxdSyncStatusInfo,
} from "./LetterboxdSyncModal";
import {
  FilmAffinitySyncModal,
  type FilmAffinitySyncStatusInfo,
} from "./FilmAffinitySyncModal";
import { FilmDetailModal } from "./FilmDetailModal";
import { FilmInspectorDrawer } from "./FilmInspectorDrawer";
import { CardLightboxModal } from "@/components/lightbox/CardLightboxModal";
import { BoardExhibitionModal } from "@/components/lists/BoardExhibitionModal";
import { AuthModal } from "@/components/auth/AuthModal";

const VirtualPosterWall3D = dynamic(
  () => import("@/components/layout/VirtualPosterWall3D"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[390px] items-center justify-center font-mono text-xs uppercase tracking-widest opacity-60">
        Loading 3D Cinema Posters...
      </div>
    ),
  }
);

type ShelfScope = "all" | "watched" | "watchlist" | "owned";
type CatalogSort = "recent" | "dateWatched" | "rating" | "title" | "year";

export function PersonalCinemaView() {
  const [films, setFilms] = useState<FilmView[]>([]);
  const [stats, setStats] = useState<CinemaStats | null>(null);
  const [lbStatus, setLbStatus] = useState<LetterboxdSyncStatusInfo | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // 3D Poster Gallery State
  const [shelfScope, setShelfScope] = useState<ShelfScope>("all");
  const [shelfMode, setShelfMode] = useState<"gallery" | "marquee">("gallery");
  const [inspectMode, setInspectMode] = useState<boolean>(false);
  const [selectedSaveId, setSelectedSaveId] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [palettesBySaveId, setPalettesBySaveId] = useState<
    Record<string, PressPalette>
  >({});

  // Catalog Filters
  const [statusFilter, setStatusFilter] = useState<"ALL" | WatchStatus>("ALL");
  const [ownedOnlyFilter, setOwnedOnlyFilter] = useState(false);
  const [directorFilter, setDirectorFilter] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<CatalogSort>("recent");
  const [catalogLayout, setCatalogLayout] = useState<"grid" | "list">("grid");

  // Modals & Actions
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isFaModalOpen, setIsFaModalOpen] = useState(false);
  const [faStatus, setFaStatus] = useState<FilmAffinitySyncStatusInfo | null>(null);
  const [openFilmSaveId, setOpenFilmSaveId] = useState<string | null>(null);
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

  const loadCinema = useCallback(async () => {
    try {
      const meRes = await apiFetch("/api/v1/auth/me");
      if (!meRes.ok) {
        setUser(null);
        setLoading(false);
        return;
      }
      const meData = await meRes.json();
      setUser(meData.user);

      const res = await apiFetch("/api/v1/cinema");
      if (!res.ok) return;
      const data = await res.json();
      const loadedFilms: FilmView[] = Array.isArray(data?.films)
        ? data.films
        : [];
      setFilms(loadedFilms);
      setStats(data.stats || null);
      setLbStatus(data.letterboxdStatus || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCinema();
  }, [loadCinema]);

  const shelfFilms = useMemo(() => {
    if (shelfScope === "watched") return films.filter((f) => f.watchStatus === "WATCHED");
    if (shelfScope === "watchlist") return films.filter((f) => f.watchStatus === "WATCHLIST");
    if (shelfScope === "owned") return films.filter((f) => f.isOwned);
    return films;
  }, [films, shelfScope]);

  const activeShelfIdx = useMemo(() => {
    if (shelfFilms.length === 0) return -1;
    if (!selectedSaveId) return 0;
    const idx = shelfFilms.findIndex((f) => f.saveId === selectedSaveId);
    return idx >= 0 ? idx : 0;
  }, [shelfFilms, selectedSaveId]);

  const activeFilm = useMemo(() => {
    if (activeShelfIdx >= 0) return shelfFilms[activeShelfIdx];
    if (selectedSaveId) {
      return films.find((f) => f.saveId === selectedSaveId) || films[0] || null;
    }
    return films[0] || null;
  }, [shelfFilms, activeShelfIdx, selectedSaveId, films]);

  const setActiveShelfByIndex = useCallback(
    (nextIdx: number) => {
      if (shelfFilms.length === 0) return;
      const clamped = Math.max(0, Math.min(shelfFilms.length - 1, nextIdx));
      setSelectedSaveId(shelfFilms[clamped].saveId);
    },
    [shelfFilms]
  );

  // Extract WCAG-safe palettes for visible shelf neighborhood
  useEffect(() => {
    if (shelfFilms.length === 0 || activeShelfIdx < 0) return;
    let cancelled = false;
    const start = Math.max(0, activeShelfIdx - 12);
    const end = Math.min(shelfFilms.length - 1, activeShelfIdx + 12);

    const run = async () => {
      const slice: Array<{ film: FilmView; dist: number }> = [];
      for (let i = start; i <= end; i++) {
        slice.push({ film: shelfFilms[i], dist: Math.abs(i - activeShelfIdx) });
      }
      slice.sort((a, b) => a.dist - b.dist);

      for (const { film } of slice) {
        if (cancelled) break;
        if (palettesBySaveId[film.saveId]) continue;
        const fallback = getDeterministicClothPalette(film.card, "media_case");
        const sameOriginUrl = resolveSameOriginImageUrl(film.posterUrl);
        if (!sameOriginUrl) {
          setPalettesBySaveId((prev) =>
            prev[film.saveId] ? prev : { ...prev, [film.saveId]: fallback }
          );
          continue;
        }
        const extracted = await extractPaletteFromImageUrl(sameOriginUrl, fallback);
        if (!cancelled) {
          setPalettesBySaveId((prev) =>
            prev[film.saveId] ? prev : { ...prev, [film.saveId]: extracted }
          );
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [shelfFilms, activeShelfIdx, palettesBySaveId]);

  const activePalette = useMemo<PressPalette>(() => {
    if (!activeFilm) {
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
      palettesBySaveId[activeFilm.saveId] ||
      getDeterministicClothPalette(activeFilm.card, "media_case")
    );
  }, [activeFilm, palettesBySaveId]);

  const posterItems3D = useMemo<VirtualPosterItem[]>(
    () =>
      shelfFilms.map((film) => ({
        saveId: film.saveId,
        title: film.title,
        director: film.director,
        year: film.releaseYear,
        runtimeMinutes: film.runtimeMinutes,
        rating: film.rating,
        watchStatus: film.watchStatus,
        rewatch: film.rewatch,
        isOwned: film.isOwned,
        posterUrl: resolveSameOriginImageUrl(film.posterUrl),
        palette:
          palettesBySaveId[film.saveId] ||
          getDeterministicClothPalette(film.card, "media_case"),
      })),
    [shelfFilms, palettesBySaveId]
  );

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const dirNorm = directorFilter?.trim().toLowerCase() || null;
    const genreNorm = genreFilter?.trim().toLowerCase() || null;
    const list = films.filter((f) => {
      if (statusFilter !== "ALL" && f.watchStatus !== statusFilter) return false;
      if (ownedOnlyFilter && !f.isOwned) return false;
      if (
        dirNorm &&
        f.director.toLowerCase() !== dirNorm &&
        !f.director.toLowerCase().includes(dirNorm)
      ) {
        return false;
      }
      if (genreNorm && !f.genres.some((g) => g.toLowerCase() === genreNorm)) {
        return false;
      }
      if (
        tagFilter &&
        !f.tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase())
      ) {
        return false;
      }
      if (q) {
        const hay = `${f.title} ${f.director} ${f.genres.join(" ")} ${f.personalNotes || ""} ${f.tags.join(
          " "
        )}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "year") return (b.releaseYear ?? 0) - (a.releaseYear ?? 0);
      if (sortBy === "dateWatched") {
        return (b.dateWatched || "").localeCompare(a.dateWatched || "");
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
    return sorted;
  }, [films, statusFilter, ownedOnlyFilter, directorFilter, genreFilter, tagFilter, searchQuery, sortBy]);

  const handleQuickLetterboxdSync = async () => {
    if (!lbStatus?.configured) {
      setIsSyncModalOpen(true);
      return;
    }
    setIsQuickSyncing(true);
    setBannerNotice(null);
    try {
      const res = await apiFetch("/api/v1/cinema/letterboxd-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerNotice(data.error || "Letterboxd sync failed.");
        setIsSyncModalOpen(true);
        return;
      }
      setBannerNotice(
        `Synced ${data.recordsProcessed ?? data.fetchedCount ?? 0} Letterboxd films (${data.createdSaves ?? 0} added, ${data.updatedSaves ?? 0} updated).`
      );
      await loadCinema();
    } finally {
      setIsQuickSyncing(false);
    }
  };

  const handleShelfKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveShelfByIndex(activeShelfIdx + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveShelfByIndex(activeShelfIdx - 1);
    }
  };

  const focusFilmOnShelf = (film: FilmView) => {
    setSelectedSaveId(film.saveId);
    if (shelfScope === "owned" && !film.isOwned) {
      setShelfScope("all");
    } else if (shelfScope === "watched" && film.watchStatus !== "WATCHED") {
      setShelfScope("all");
    } else if (shelfScope === "watchlist" && film.watchStatus !== "WATCHLIST") {
      setShelfScope("all");
    }
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Opening Personal Cinema...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center space-y-4">
        <Film className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        <h1 className="font-serif-editorial text-3xl">Personal Cinema</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Sign in to explore your 3D edition shelf, Letterboxd diary, and film notes.
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
            void loadCinema();
          }}
        />
      </div>
    );
  }

  const allTags = stats?.tagCounts.map((t) => t.tag) || [];
  const activeMeta = activeFilm ? formatSpineMeta(activeFilm.card) : null;
  const exhibitionItems = (filteredCatalog.length > 0 ? filteredCatalog : shelfFilms).map(
    (f) => f.card
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
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="truncate font-serif text-sm text-foreground">
            Personal Cinema
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">
            · {stats?.total ?? films.length}
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
              href="/library"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Library</span>
            </Link>
            <div className="min-w-0">
              <h1 className="font-serif-editorial text-2xl sm:text-3xl leading-none tracking-tight text-foreground">
                Personal Cinema
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border cursor-pointer transition-colors ${
                lbStatus?.configured
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>
                {lbStatus?.configured
                  ? `Letterboxd · @${lbStatus.letterboxdUsername}`
                  : "Connect Letterboxd"}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleQuickLetterboxdSync}
              disabled={isQuickSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border bg-card text-xs font-mono text-foreground hover:border-foreground/40 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isQuickSyncing ? "animate-spin" : ""}`}
              />
              <span>{isQuickSyncing ? "Syncing..." : "Sync Letterboxd"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                apiFetch("/api/v1/cinema/filmaffinity-sync")
                  .then((r) => (r.ok ? r.json() : null))
                  .then((d) => {
                    if (d) setFaStatus(d);
                  })
                  .catch(() => {});
                setIsFaModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-full border border-border bg-card text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="FilmAffinity Connector"
            >
              FilmAffinity
            </button>

            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="px-3 py-1.5 rounded-full border border-border bg-card text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Letterboxd RSS & CSV Settings"
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
              data-testid="log-film-btn"
              onClick={() => setIsLogModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-foreground text-background text-xs font-mono font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Film</span>
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

        {/* 3D Edition Shelf Hero + Live Film Inspector */}
        <section
          ref={stageRef}
          tabIndex={0}
          onKeyDown={handleShelfKeyDown}
          className="rounded-2xl border border-border/80 overflow-hidden shadow-lift grid grid-cols-1 xl:grid-cols-[1.55fr_420px] outline-none"
        >
          {/* Left: 3D Edition Stage */}
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
                    { id: "all", label: `All (${stats?.total ?? 0})` },
                    { id: "watched", label: `Watched (${stats?.watchedCount ?? 0})` },
                    { id: "watchlist", label: `Watchlist (${stats?.watchlistCount ?? 0})` },
                    { id: "owned", label: `Owned (${stats?.ownedCount ?? 0})` },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`cinema-scope-${opt.id}`}
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
                    setShelfMode((m) => (m === "gallery" ? "marquee" : "gallery"))
                  }
                  className="px-2.5 py-1 rounded-full border cursor-pointer"
                  style={{
                    borderColor: activePalette.rule,
                    backgroundColor: activePalette.surfaceSecondary,
                    color: activePalette.ink,
                  }}
                >
                  {shelfMode === "gallery" ? "Gallery" : "Marquee"}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectMode((m) => !m)}
                  className="px-2.5 py-1 rounded-full border cursor-pointer"
                  style={{
                    borderColor: activePalette.rule,
                    backgroundColor: activePalette.surfaceSecondary,
                    color: activePalette.ink,
                  }}
                >
                  {inspectMode ? "Poster" : "Credits"}
                </button>
                <button
                  type="button"
                  aria-label="Reset 3D poster gallery angle"
                  onClick={() => {
                    setInspectMode(false);
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

            {/* 3D WebGL Poster Wall or CSS Fallback */}
            {shelfFilms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-3">
                <Film
                  className="w-8 h-8 opacity-50"
                  style={{ color: activePalette.muted }}
                />
                <p className="font-serif-editorial text-xl">
                  {shelfScope === "owned"
                    ? "No physical Blu-ray or 4K editions saved yet."
                    : shelfScope === "watchlist"
                    ? "Your film watchlist is empty."
                    : "Your Personal Cinema archive is empty."}
                </p>
                <div className="flex items-center gap-2">
                  {shelfScope !== "all" && films.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShelfScope("all")}
                      className="px-4 py-1.5 rounded-full font-mono text-xs border cursor-pointer"
                      style={{
                        borderColor: activePalette.rule,
                        color: activePalette.ink,
                      }}
                    >
                      Show All Films ({films.length})
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
                    + Log Film
                  </button>
                </div>
              </div>
            ) : !webglUnavailable ? (
              <VirtualPosterWall3D
                items={posterItems3D}
                activeIndex={activeShelfIdx}
                wallMode={shelfMode}
                inspectBack={inspectMode}
                onSelectIndex={(idx) => {
                  setInspectMode(false);
                  setActiveShelfByIndex(idx);
                }}
                onActivateActiveItem={() => {
                  if (activeFilm) {
                    setOpenFilmSaveId(activeFilm.saveId);
                  }
                }}
                onWebglUnavailable={() => setWebglUnavailable(true)}
                resetSignal={resetSignal}
              />
            ) : (
              <div className="px-6 py-10 flex items-end gap-3 overflow-x-auto min-h-[340px]">
                {shelfFilms.map((f, idx) => {
                  const isAct = idx === activeShelfIdx;
                  return (
                    <button
                      key={f.saveId}
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
                      {isAct && f.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.posterUrl}
                          alt={f.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center p-2">
                          <span className="press-writing-v font-serif-editorial text-xs truncate">
                            {f.title}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Synchronized Marquee + Shelf Scrubber */}
            {shelfFilms.length > 0 && activeFilm && activeMeta && (
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
                      {activeFilm.director &&
                      activeFilm.director.toLowerCase() !== "unknown director" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDirectorFilter(activeFilm.director);
                            setStatusFilter("ALL");
                          }}
                          className="underline underline-offset-4 decoration-dotted hover:opacity-80 cursor-pointer"
                        >
                          {activeFilm.director}
                        </button>
                      ) : (
                        activeFilm.director
                      )}
                      {activeFilm.releaseYear ? ` · ${activeFilm.releaseYear}` : ""}
                      {activeFilm.runtimeMinutes
                        ? ` · ${activeFilm.runtimeMinutes} min`
                        : ""}
                    </div>
                    <div className="font-serif-editorial text-xl sm:text-2xl truncate">
                      {activeFilm.title}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveShelfByIndex(activeShelfIdx - 1)}
                      disabled={activeShelfIdx <= 0}
                      aria-label="Previous film"
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
                      {String(shelfFilms.length).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveShelfByIndex(activeShelfIdx + 1)}
                      disabled={activeShelfIdx >= shelfFilms.length - 1}
                      aria-label="Next film"
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

                {shelfFilms.length > 3 && (
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label="Scrub cinema shelf"
                    aria-valuemin={1}
                    aria-valuemax={shelfFilms.length}
                    aria-valuenow={activeShelfIdx + 1}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(
                        0,
                        Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))
                      );
                      setActiveShelfByIndex(Math.round(ratio * (shelfFilms.length - 1)));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") setActiveShelfByIndex(activeShelfIdx + 1);
                      if (e.key === "ArrowLeft") setActiveShelfByIndex(activeShelfIdx - 1);
                    }}
                    className="flex items-end justify-between h-5 pt-1 border-t cursor-pointer select-none"
                    style={{ borderColor: activePalette.rule }}
                  >
                    {(() => {
                      const tickCount = Math.min(shelfFilms.length, 48);
                      const activeTick =
                        shelfFilms.length <= 1
                          ? 0
                          : Math.round((activeShelfIdx / (shelfFilms.length - 1)) * (tickCount - 1));
                      return Array.from({ length: tickCount }, (_, i) => {
                        const isAct = i === activeTick;
                        return (
                          <span
                            key={i}
                            className="block transition-all duration-150"
                            style={{
                              width: "1px",
                              height: isAct ? "15px" : i % 6 === 0 ? "9px" : "5px",
                              backgroundColor: isAct ? activePalette.accent : activePalette.rule,
                            }}
                          />
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Live Film Inspector & Comments */}
          <FilmInspectorDrawer
            film={activeFilm}
            onSelectDirector={(dir) => {
              setDirectorFilter(dir);
              setStatusFilter("ALL");
            }}
            onSelectGenre={(g) => {
              setGenreFilter(g);
              setStatusFilter("ALL");
            }}
            onUpdated={() => {
              void loadCinema();
            }}
            onOpenFullModal={(film, presentation) => {
              if (presentation === "press") {
                setLightboxPresentation("press");
                setLightboxCard(film.card);
              } else {
                setOpenFilmSaveId(film.saveId);
              }
            }}
          />
        </section>

        {/* Cinema Telemetry Strip */}
        {stats && (
          <section className="grid grid-cols-2 sm:grid-cols-5 border-y border-border divide-y sm:divide-y-0 sm:divide-x divide-border">
            {[
              { label: "Total Films", value: stats.total },
              { label: "Watched", value: stats.watchedCount },
              { label: "Watchlist", value: stats.watchlistCount },
              { label: "Hours Watched", value: stats.totalHoursWatched },
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

        {/* Film Explorer & Letterboxd Tag Filters */}
        <section className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "ALL", label: "All", count: stats?.total ?? films.length },
                  {
                    id: "WATCHED",
                    label: "Watched",
                    count: stats?.watchedCount ?? 0,
                  },
                  {
                    id: "WATCHLIST",
                    label: "Watchlist",
                    count: stats?.watchlistCount ?? 0,
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

              <button
                type="button"
                onClick={() => setOwnedOnlyFilter((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-mono border transition-colors cursor-pointer ${
                  ownedOnlyFilter
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingBag className="w-3 h-3" />
                <span>Owned Only</span>
              </button>
              {directorFilter && (
                <button
                  type="button"
                  onClick={() => setDirectorFilter(null)}
                  className="px-3 py-1.5 rounded-full text-xs font-mono bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 cursor-pointer"
                >
                  Director: {directorFilter} ×
                </button>
              )}
              {genreFilter && (
                <button
                  type="button"
                  onClick={() => setGenreFilter(null)}
                  className="px-3 py-1.5 rounded-full text-xs font-mono bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 cursor-pointer"
                >
                  Genre: {genreFilter} ×
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
                  placeholder="Search title, director, notes..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-full border border-border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as CatalogSort)}
                className="px-3 py-1.5 rounded-full border border-border bg-card text-xs font-mono focus:outline-none"
              >
                <option value="recent">Sort: Recently Added</option>
                <option value="dateWatched">Sort: Date Watched</option>
                <option value="rating">Sort: Highest Rated</option>
                <option value="title">Sort: Title A–Z</option>
                <option value="year">Sort: Release Year</option>
              </select>

              <div className="inline-flex rounded-full border border-border bg-card p-0.5">
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

          {/* Genres Strip */}
          {stats && stats.genreCounts.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setGenreFilter(null)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors cursor-pointer ${
                  genreFilter === null
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                All Genres
              </button>
              {stats.genreCounts.map((g) => (
                <button
                  key={g.genre}
                  type="button"
                  onClick={() =>
                    setGenreFilter((cur) => (cur === g.genre ? null : g.genre))
                  }
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors cursor-pointer ${
                    genreFilter?.toLowerCase() === g.genre.toLowerCase()
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{g.genre}</span>
                  <span className="opacity-65 tabular-nums">{g.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Letterboxd & Custom Tag Filter Pills */}
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
                No films match the current filters.
              </p>
              {(tagFilter ||
                directorFilter ||
                genreFilter ||
                searchQuery ||
                statusFilter !== "ALL" ||
                ownedOnlyFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setTagFilter(null);
                    setDirectorFilter(null);
                    setGenreFilter(null);
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setOwnedOnlyFilter(false);
                  }}
                  className="font-mono text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : catalogLayout === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {filteredCatalog.map((film) => {
                const isSelected = activeFilm?.saveId === film.saveId;
                return (
                  <article
                    key={film.saveId}
                    onClick={() => focusFilmOnShelf(film)}
                    className={`group flex flex-col cursor-pointer rounded-2xl border bg-card overflow-hidden transition-all duration-150 hover:-translate-y-0.5 ${
                      isSelected
                        ? "border-foreground ring-1 ring-foreground"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="relative aspect-[2/3] w-full bg-muted overflow-hidden">
                      {film.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={film.posterUrl}
                          alt={film.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                          <Film className="w-5 h-5 text-muted-foreground/50 mb-2" />
                          <span className="font-serif-editorial text-sm leading-tight">
                            {film.title}
                          </span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        {film.rewatch && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/90 text-black font-mono text-[9px] uppercase tracking-wider inline-flex items-center gap-0.5">
                            <Repeat className="w-2.5 h-2.5" />
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider backdrop-blur-xs ${
                            film.isOwned
                              ? "bg-emerald-950/80 text-emerald-200 border border-emerald-500/40"
                              : film.watchStatus === "WATCHLIST"
                              ? "bg-black/75 text-amber-200 border border-amber-400/30"
                              : "bg-black/70 text-white/90"
                          }`}
                        >
                          {film.isOwned
                            ? "Owned"
                            : film.watchStatus === "WATCHLIST"
                            ? "Watchlist"
                            : "Watched"}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-serif-editorial text-sm font-medium leading-snug line-clamp-2 text-foreground">
                          {film.title}
                        </h3>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {film.director}
                          {film.releaseYear ? ` · ${film.releaseYear}` : ""}
                        </p>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          {film.rating ? (
                            <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 tabular-nums">
                              <Star className="w-3 h-3 fill-current" />
                              {film.rating}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">
                              {film.watchStatus === "WATCHLIST"
                                ? "Watchlist"
                                : "Unrated"}
                            </span>
                          )}
                          {film.dateWatched && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {film.dateWatched}
                            </span>
                          )}
                        </div>

                        {film.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {film.tags.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded-full bg-secondary font-mono text-[9px] text-muted-foreground"
                              >
                                #{t}
                              </span>
                            ))}
                            {film.tags.length > 2 && (
                              <span className="font-mono text-[9px] text-muted-foreground">
                                +{film.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="border border-border rounded-2xl divide-y divide-border bg-card overflow-hidden">
              {filteredCatalog.map((film) => (
                <div
                  key={film.saveId}
                  onClick={() => focusFilmOnShelf(film)}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-14 rounded-md bg-muted border border-border overflow-hidden shrink-0">
                    {film.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={film.posterUrl}
                        alt={film.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif-editorial text-base font-medium truncate">
                        {film.title}
                      </h3>
                      {film.isOwned && (
                        <ShoppingBag className="w-3 h-3 text-emerald-500 shrink-0" />
                      )}
                      {film.rewatch && (
                        <Repeat className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {film.director}
                      {film.releaseYear ? ` · ${film.releaseYear}` : ""}
                      {film.runtimeMinutes ? ` · ${film.runtimeMinutes} min` : ""}
                    </p>
                    {film.personalNotes && (
                      <p className="text-xs italic text-muted-foreground truncate mt-0.5">
                        &ldquo;{film.personalNotes}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="hidden md:flex flex-wrap gap-1 max-w-xs justify-end">
                    {film.tags.slice(0, 3).map((t) => (
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
                      {film.rating ? `${film.rating} ★` : film.watchStatus}
                    </div>
                    {film.dateWatched && (
                      <div className="text-[10px] text-muted-foreground">
                        {film.dateWatched}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Log Film Modal */}
      <LogFilmModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        existingTags={allTags}
        onSaved={(newFilm) => {
          setSelectedSaveId(newFilm.saveId);
          void loadCinema();
        }}
      />

      {/* Letterboxd Sync Modal */}
      <LetterboxdSyncModal
        isOpen={isSyncModalOpen}
        status={lbStatus}
        onClose={() => setIsSyncModalOpen(false)}
        onSynced={() => {
          void loadCinema();
        }}
      />

      {/* FilmAffinity Sync Modal */}
      <FilmAffinitySyncModal
        isOpen={isFaModalOpen}
        status={faStatus}
        onClose={() => setIsFaModalOpen(false)}
        onSynced={() => {
          void loadCinema();
        }}
      />

      {/* Film Detail Modal */}
      <FilmDetailModal
        film={films.find((f) => f.saveId === openFilmSaveId) || null}
        isOpen={Boolean(openFilmSaveId)}
        onSelectDirector={(dir) => {
          setDirectorFilter(dir);
          setStatusFilter("ALL");
        }}
        onSelectGenre={(g) => {
          setGenreFilter(g);
          setStatusFilter("ALL");
        }}
        onClose={() => setOpenFilmSaveId(null)}
        onUpdated={() => {
          void loadCinema();
        }}
        onOpenFullDossier={(film) => {
          setOpenFilmSaveId(null);
          setLightboxPresentation("standard");
          setLightboxCard(film.card);
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
          void loadCinema();
        }}
        onCardDeleted={() => {
          setLightboxCard(null);
          void loadCinema();
        }}
      />

      {/* Immersive Mobile & Desktop Exhibition Deck */}
      <BoardExhibitionModal
        isOpen={isExhibitionOpen}
        items={exhibitionItems}
        initialIndex={Math.max(0, activeShelfIdx)}
        boardTitle="Personal Cinema"
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
