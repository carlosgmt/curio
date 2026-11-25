"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Omnibox } from "@/components/shapeshift/Omnibox";
import { PolymorphicCard, type CardData } from "@/components/cards/PolymorphicCard";
import { ImporterModal } from "@/components/importers/ImporterModal";
import { PairingModal } from "@/components/connections/PairingModal";
import { ListTabsBar } from "@/components/lists/ListTabsBar";
import { CreateListModal } from "@/components/lists/CreateListModal";
import { SectionGroupView } from "@/components/lists/SectionGroupView";
import { BreadcrumbNav } from "@/components/lists/BreadcrumbNav";
import { CardLightboxModal } from "@/components/lightbox/CardLightboxModal";
import { TypeBuilderModal } from "@/components/shapeshift/TypeBuilderModal";
import { TypesSettingsModal } from "@/components/types/TypesSettingsModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { UserNav } from "@/components/layout/UserNav";
import { CurioLandingVitrine } from "@/components/landing/CurioLandingVitrine";
import { PullToRefresh } from "@/components/pwa/PullToRefresh";
import { apiFetch, getApiUrl } from "@/lib/apiClient";
import type { SmartList } from "@/db";
import type { ListWithSections } from "@/lib/lists/service";
import {
  extractTypeInfo,
  buildNewTypeAutoRules,
  isTypeCoveredByBoards,
  type TypePromptInfo,
} from "@/lib/lists/promptRules";
import { MasonryLayout, GridLayout, TimelineLayout, ShelfLayout, PosterWallLayout } from "@/components/layout";
import { ViewModeSwitcher, type LayoutEngineType } from "@/components/layout/ViewModeSwitcher";
import type { SilhouetteDensity } from "@/components/cards/registry";
import {
  Sparkles,
  Layers,
  Upload,
  X,
  RefreshCw,
  Pencil,
  Loader2,
  Shirt,
  Package,
  BookOpen,
  Film,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ShoppingBag,
  Repeat,
} from "lucide-react";
import { LogBookModal } from "@/components/library/LogBookModal";
import {
  GoodreadsSyncModal,
  type GoodreadsSyncStatusInfo,
} from "@/components/library/GoodreadsSyncModal";
import { OpenBook3DModal } from "@/components/library/OpenBook3DModal";
import { LogFilmModal } from "@/components/cinema/LogFilmModal";
import {
  LetterboxdSyncModal,
  type LetterboxdSyncStatusInfo,
} from "@/components/cinema/LetterboxdSyncModal";
import {
  FilmAffinitySyncModal,
  type FilmAffinitySyncStatusInfo,
} from "@/components/cinema/FilmAffinitySyncModal";
import { FilmDetailModal } from "@/components/cinema/FilmDetailModal";
import {
  compareLibraryBooks,
  computeLibraryStats,
  formatBookSourceLabel,
  toLibraryBookView,
  type BookSortKey,
  type LibraryBookView,
} from "@/lib/books/library";
import {
  findDuplicateBookGroups,
  isTravelGuideOrStudyBook,
  sanitizeGoodreadsNote,
} from "@/lib/books/identity";
import { computeCinemaStats, toFilmView, type FilmView } from "@/lib/cinema/library";

const VALID_LAYOUT_MODES = new Set<LayoutEngineType>(["masonry", "grid", "timeline", "shelf", "posters"]);

function isShelfDefaultBoard(slug: string | null, wishOnly: boolean, isMyStuffDescendant = false): boolean {
  if (wishOnly) return true;
  if (!slug) return false;
  return (
    isMyStuffDescendant ||
    slug === "my-stuff" ||
    slug.startsWith("my-stuff-") ||
    slug === "books" ||
    slug === "music" ||
    slug === "wishlist"
  );
}

function getLayoutPreferenceKey(slug: string | null, wishOnly: boolean): string {
  if (wishOnly) return "wishlist";
  return slug || "all";
}

function resolveBoardLayout(
  slug: string | null,
  wishOnly: boolean,
  dbDefault?: string | null,
  isMyStuffDescendant = false
): LayoutEngineType {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(`curio_board_layout:${getLayoutPreferenceKey(slug, wishOnly)}`);
    if (saved && VALID_LAYOUT_MODES.has(saved as LayoutEngineType)) {
      return saved as LayoutEngineType;
    }
  }
  if (slug === "films" && (!dbDefault || dbDefault === "shelf")) {
    return "posters";
  }
  if (dbDefault && VALID_LAYOUT_MODES.has(dbDefault as LayoutEngineType)) {
    return dbDefault as LayoutEngineType;
  }
  if (slug === "films") return "posters";
  return isShelfDefaultBoard(slug, wishOnly, isMyStuffDescendant) ? "shelf" : "masonry";
}

function isLetterboxdFilmView(f: FilmView): boolean {
  if (f.letterboxdTags.length > 0) return true;
  if (f.canonicalUrl?.toLowerCase().includes("letterboxd.com")) return true;
  const tags = Array.isArray(f.card.save.autoTags) ? f.card.save.autoTags : [];
  return tags.some((t) => String(t).toLowerCase() === "letterboxd");
}

export default function Home() {
  const [items, setItems] = useState<CardData[]>([]);
  const [streamTotalCount, setStreamTotalCount] = useState<number | null>(null);
  const [vaultTotalCount, setVaultTotalCount] = useState<number | null>(null);
  const [wishlistCount, setWishlistCount] = useState<number | null>(null);
  const [wearLogCount, setWearLogCount] = useState<number | null>(null);
  const [closetCount, setClosetCount] = useState<number | null>(null);
  const [myStuffCount, setMyStuffCount] = useState<number | null>(null);
  const [showWearLogs, setShowWearLogs] = useState(false);
  const [showCloset, setShowCloset] = useState(false);
  const [showMyStuff, setShowMyStuff] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [pairingCard, setPairingCard] = useState<CardData | null>(null);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [lists, setLists] = useState<Array<SmartList & { itemCount: number }>>([]);
  const [activeListSlug, setActiveListSlug] = useState<string | null>(null);
  const [activeListDetails, setActiveListDetails] = useState<ListWithSections | null>(null);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<SmartList | null>(null);
  const [createListParentId, setCreateListParentId] = useState<string | null>(null);
  const [isTypeBuilderOpen, setIsTypeBuilderOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [dismissedOnboarding, setDismissedOnboarding] = useState(true);
  const [isTypesModalOpen, setIsTypesModalOpen] = useState(false);
  const [wishOnly, setWishOnly] = useState(false);
  const [layoutEngine, setLayoutEngine] = useState<LayoutEngineType>("masonry");
  const [lightboxPresentation, setLightboxPresentation] = useState<"standard" | "press">("standard");
  const [cardDensity, setCardDensity] = useState<SilhouetteDensity>("standard");
  const [newTypePrompt, setNewTypePrompt] = useState<TypePromptInfo | null>(null);
  const [garmentCategoryFilter, setGarmentCategoryFilter] = useState<string>("ALL");
  const [garmentSeasonFilter, setGarmentSeasonFilter] = useState<string>("ALL");
  const [isSyncingCloset, setIsSyncingCloset] = useState(false);
  const [isSyncingPurchaseHub, setIsSyncingPurchaseHub] = useState(false);
  const [isSyncingChef, setIsSyncingChef] = useState(false);
  const [isLogBookOpen, setIsLogBookOpen] = useState(false);
  const [isGoodreadsSyncOpen, setIsGoodreadsSyncOpen] = useState(false);
  const [goodreadsStatus, setGoodreadsStatus] =
    useState<GoodreadsSyncStatusInfo | null>(null);
  const [isLogFilmOpen, setIsLogFilmOpen] = useState(false);
  const [isLetterboxdSyncOpen, setIsLetterboxdSyncOpen] = useState(false);
  const [letterboxdStatus, setLetterboxdStatus] =
    useState<LetterboxdSyncStatusInfo | null>(null);
  const [isFilmAffinitySyncOpen, setIsFilmAffinitySyncOpen] = useState(false);
  const [filmaffinityStatus, setFilmaffinityStatus] =
    useState<FilmAffinitySyncStatusInfo | null>(null);
  const [bookSubFilter, setBookSubFilter] = useState<
    "ALL" | "MY_STUFF" | "GOODREADS" | "MANUAL" | "FINISHED" | "NOT_READ" | "READING" | "WANT_TO_READ"
  >("ALL");
  const [bookAuthorFilter, setBookAuthorFilter] = useState<string | null>(null);
  const [bookTagFilter, setBookTagFilter] = useState<string | null>(null);
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [bookSortBy, setBookSortBy] = useState<BookSortKey>("dateAdded");
  const [isDedupingBooks, setIsDedupingBooks] = useState(false);
  const [isEnrichingBooks, setIsEnrichingBooks] = useState(false);
  const [booksBannerMsg, setBooksBannerMsg] = useState<string | null>(null);
  const [openBookSaveId, setOpenBookSaveId] = useState<string | null>(null);
  const [filmSubFilter, setFilmSubFilter] = useState<
    "ALL" | "LETTERBOXD" | "FILMAFFINITY" | "WATCHED" | "WATCHLIST" | "REWATCH" | "OWNED"
  >("ALL");
  const [filmDirectorFilter, setFilmDirectorFilter] = useState<string | null>(null);
  const [filmGenreFilter, setFilmGenreFilter] = useState<string | null>(null);
  const [filmTagFilter, setFilmTagFilter] = useState<string | null>(null);
  const [filmSearchQuery, setFilmSearchQuery] = useState("");
  const [filmSortBy, setFilmSortBy] = useState<"recent" | "dateWatched" | "rating" | "title" | "year">("recent");
  const [isEnrichingFilms, setIsEnrichingFilms] = useState(false);
  const [filmsBannerMsg, setFilmsBannerMsg] = useState<string | null>(null);
  const [openFilmSaveId, setOpenFilmSaveId] = useState<string | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchSeqRef = useRef(0);

  const GARMENT_CATEGORIES = [
    { id: "ALL", label: "All Items" },
    { id: "FOOTWEAR", label: "Footwear" },
    { id: "TOPS", label: "Tops" },
    { id: "BOTTOMS", label: "Bottoms" },
    { id: "OUTERWEAR", label: "Outerwear" },
  ];

  const GARMENT_SEASONS = [
    { id: "ALL", label: "All Seasons" },
    { id: "SPRING_SUMMER", label: "Spring / Summer" },
    { id: "AUTUMN_WINTER", label: "Autumn / Winter" },
  ];

  // Sync dismissal of "Bring in your collections" banner & stream inventory filter preferences
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = localStorage.getItem("curio_dismissed_bring_collections") === "true";
      setDismissedOnboarding(isDismissed);
      setShowWearLogs(localStorage.getItem("curio_show_wear_logs") === "true");
      setShowCloset(localStorage.getItem("curio_show_closet") === "true");
      setShowMyStuff(localStorage.getItem("curio_show_my_stuff") === "true");
    }
    setPrefsHydrated(true);
  }, []);

  const handleToggleWearLogs = () => {
    setShowWearLogs((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("curio_show_wear_logs", next ? "true" : "false");
      }
      return next;
    });
  };

  const handleToggleCloset = () => {
    setShowCloset((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("curio_show_closet", next ? "true" : "false");
      }
      return next;
    });
  };

  const handleToggleMyStuff = () => {
    setShowMyStuff((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("curio_show_my_stuff", next ? "true" : "false");
      }
      return next;
    });
  };

  const handleDismissBringCollections = () => {
    setDismissedOnboarding(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("curio_dismissed_bring_collections", "true");
    }
  };

  const handleCreateListForPrompt = async (typeInfo: TypePromptInfo) => {
    try {
      const listTitle = typeInfo.listTitle;
      const autoRules = buildNewTypeAutoRules(typeInfo);
      const res = await apiFetch("/api/v1/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: listTitle,
          description: `Curated collection for ${typeInfo.name}`,
          visibility: "PUBLIC",
          autoRules,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchLists();
        if (data.list?.slug) {
          setActiveListSlug(data.list.slug);
        }
      }
    } catch (err) {
      console.error("Failed to create list for type:", err);
    } finally {
      setNewTypePrompt(null);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await apiFetch("/api/v1/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (typeof window !== "undefined" && typeof data.token === "string" && data.token) {
          localStorage.setItem("curio_token", data.token);
        }
        setUser(data.user);
      } else {
        if (res.status === 401 && typeof window !== "undefined") {
          localStorage.removeItem("curio_token");
        }
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to check auth status:", err);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchItems = useCallback(
    async (opts?: {
      reset?: boolean;
      wishlist?: boolean;
      includeWearLogs?: boolean;
      showCloset?: boolean;
      showMyStuff?: boolean;
      cursor?: string | null;
    }) => {
      const reset = opts?.reset ?? true;
      const seq = reset ? ++fetchSeqRef.current : fetchSeqRef.current;
      const wishlistFlag = opts?.wishlist ?? wishOnly;
      const includeWearFlag = opts?.includeWearLogs ?? showWearLogs;
      const includeClosetFlag = opts?.showCloset ?? showCloset;
      const includeMyStuffFlag = opts?.showMyStuff ?? showMyStuff;
      const cursorParam = !reset && opts?.cursor ? `&cursor=${encodeURIComponent(opts.cursor)}` : "";
      const wishParam = wishlistFlag ? "&wishlist=true" : "";
      const wearLogsParam = !wishlistFlag && includeWearFlag ? "&includeWearLogs=true" : "";
      const closetParam = !wishlistFlag && !includeClosetFlag ? "&excludeCloset=true" : "";
      const myStuffParam = !wishlistFlag && !includeMyStuffFlag ? "&excludeMyStuff=true" : "";
      if (!reset) setLoadingMore(true);

      try {
        const res = await apiFetch(
          `/api/v1/capture?limit=50${wishParam}${wearLogsParam}${closetParam}${myStuffParam}${cursorParam}`
        );
        if (res.ok) {
          const data = await res.json();
          if (seq !== fetchSeqRef.current) {
            return;
          }
          const fetched: CardData[] = data.saves || [];
          if (typeof data.totalCount === "number") {
            setStreamTotalCount(data.totalCount);
          }
          if (typeof data.vaultTotalCount === "number") {
            setVaultTotalCount(data.vaultTotalCount);
          }
          if (typeof data.wishlistCount === "number") {
            setWishlistCount(data.wishlistCount);
          }
          if (typeof data.wearLogCount === "number") {
            setWearLogCount(data.wearLogCount);
          }
          if (typeof data.closetCount === "number") {
            setClosetCount(data.closetCount);
          }
          if (typeof data.myStuffCount === "number") {
            setMyStuffCount(data.myStuffCount);
          }
          setNextCursor(data.nextCursor ?? null);

          if (reset) {
            setItems((prev) => {
              const optimistic = prev.filter((it) => it.save.id.startsWith("optimistic-"));
              const fetchedIds = new Set(fetched.map((f) => f.save.id));
              return [...optimistic.filter((o) => !fetchedIds.has(o.save.id)), ...fetched];
            });
          } else {
            setItems((prev) => {
              const existingIds = new Set(prev.map((p) => p.save.id));
              return [...prev, ...fetched.filter((f) => !existingIds.has(f.save.id))];
            });
          }
        }
      } catch (err) {
        console.error("Failed to load items:", err);
      } finally {
        if (seq === fetchSeqRef.current) {
          setLoading(false);
        }
        if (!reset) {
          setLoadingMore(false);
        }
      }
    },
    [wishOnly, showWearLogs, showCloset, showMyStuff]
  );

  const fetchLists = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/lists");
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists || []);
      }
    } catch (err) {
      console.error("Failed to load lists:", err);
    }
  }, []);

  const refreshActiveBoard = useCallback(async (slugOverride?: string | null) => {
    const targetSlug = slugOverride !== undefined ? slugOverride : activeListSlug;
    if (!targetSlug) return;
    try {
      const res = await apiFetch(`/api/v1/lists/${targetSlug}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.list) {
          setActiveListDetails(data);
        }
      }
    } catch (err) {
      console.error("Failed to refresh board details:", err);
    }
  }, [activeListSlug]);

  const triggerAllSourcesSync = useCallback(async () => {
    setIsSyncingAll(true);
    try {
      await apiFetch("/api/v1/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      await Promise.all([
        fetchItems({ reset: true, wishlist: wishOnly }),
        fetchLists(),
        refreshActiveBoard(),
      ]);
    } catch {
      // Non-fatal if background source is offline
    } finally {
      setIsSyncingAll(false);
    }
  }, [fetchItems, fetchLists, refreshActiveBoard, wishOnly]);

  const triggerClosetSync = useCallback(
    async (force: boolean = false) => {
      if (force) setIsSyncingCloset(true);
      try {
        const res = await apiFetch("/api/v1/sync/closet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force, ifStaleMs: 300_000 }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const didChange = Boolean(data?.synced);
        if (didChange) {
          await Promise.all([
            fetchItems({ reset: true, wishlist: wishOnly }),
            fetchLists(),
            refreshActiveBoard(),
          ]);
        }
      } catch {
        // Non-fatal if closet-ui is offline
      } finally {
        if (force) setIsSyncingCloset(false);
      }
    },
    [fetchItems, fetchLists, refreshActiveBoard, wishOnly]
  );

  const triggerPurchaseHubSync = useCallback(
    async (force: boolean = false) => {
      if (force) setIsSyncingPurchaseHub(true);
      try {
        const res = await apiFetch("/api/v1/sync/purchase-hub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force, ifStaleMs: 300_000 }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const didChange = Boolean(data?.synced);
        if (didChange) {
          await Promise.all([
            fetchItems({ reset: true, wishlist: wishOnly }),
            fetchLists(),
            refreshActiveBoard(),
          ]);
        }
      } catch {
        // Non-fatal if purchase-hub is offline
      } finally {
        if (force) setIsSyncingPurchaseHub(false);
      }
    },
    [fetchItems, fetchLists, refreshActiveBoard, wishOnly]
  );

  const triggerChefSync = useCallback(
    async (force: boolean = false) => {
      if (force) setIsSyncingChef(true);
      try {
        const res = await apiFetch("/api/v1/sync/chef", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force, ifStaleMs: 300_000 }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const didChange = Boolean(data?.synced);
        if (didChange) {
          await Promise.all([
            fetchItems({ reset: true, wishlist: wishOnly }),
            fetchLists(),
            refreshActiveBoard(),
          ]);
        }
      } catch {
        // Non-fatal if chef-ui is offline
      } finally {
        if (force) setIsSyncingChef(false);
      }
    },
    [fetchItems, fetchLists, refreshActiveBoard, wishOnly]
  );

  const triggerBackgroundFeedSyncIfStale = async (force: boolean = false) => {
    try {
      const statusRes = await apiFetch("/api/v1/sync/feeds");
      if (!statusRes.ok) return;
      const status = await statusRes.json();
      const hasFeeds = Boolean(status.letterboxdUsername || status.goodreadsUserId);
      if (hasFeeds && (force || status.isStale)) {
        const syncRes = await apiFetch("/api/v1/sync/feeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (syncRes.ok) {
          await fetchItems({ reset: true });
        }
      }
    } catch {
      // Non-fatal background sync check
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchLists();
    triggerBackgroundFeedSyncIfStale(false);
  }, [fetchLists]);

  useEffect(() => {
    if (!prefsHydrated) return;
    fetchItems({ reset: true, wishlist: wishOnly });
  }, [prefsHydrated, wishOnly, fetchItems]);

  // Automatic Closet, Purchase Hub & Chef <-> Curio background sync on session start + tab focus
  useEffect(() => {
    if (!user) return;
    triggerClosetSync(false);
    triggerPurchaseHubSync(false);
    triggerChefSync(false);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        triggerClosetSync(false);
        triggerPurchaseHubSync(false);
        triggerChefSync(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [user, triggerClosetSync, triggerPurchaseHubSync, triggerChefSync]);

  // Infinite scroll observer for main feed
  useEffect(() => {
    if (activeListSlug !== null || !nextCursor || loadingMore) return;
    const node = loadMoreSentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !loadingMore) {
          fetchItems({ reset: false, wishlist: wishOnly, cursor: nextCursor });
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeListSlug, nextCursor, loadingMore, wishOnly, fetchItems]);

  useEffect(() => {
    if (!activeListSlug) {
      setActiveListDetails(null);
      return;
    }
    let isMounted = true;
    apiFetch(`/api/v1/lists/${activeListSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.list) {
          setActiveListDetails(data);
        }
      })
      .catch((err) => console.error("Failed to load list details:", err));

    return () => {
      isMounted = false;
    };
  }, [activeListSlug]);

  const activeBoardContext = useMemo(() => {
    if (!activeListSlug) return null;
    const board = activeListDetails?.list || lists.find((l) => l.slug === activeListSlug);
    if (!board) return null;
    return {
      id: board.id,
      slug: board.slug,
      title: board.title,
      coreType: board.autoRules?.coreType,
      typePathPrefix: board.autoRules?.typePathPrefix,
    };
  }, [activeListSlug, activeListDetails, lists]);

  const isMyStuffDescendant = Boolean(
    activeListSlug &&
      (activeListSlug === "my-stuff" ||
        activeListSlug.startsWith("my-stuff-") ||
        (activeListDetails?.list.slug === activeListSlug &&
          activeListDetails.ancestors?.some((a) => a.slug === "my-stuff")))
  );

  const isRecipesDescendant = Boolean(
    activeListSlug &&
      (activeListSlug === "recipes" ||
        activeListSlug.startsWith("recipes-") ||
        (activeListDetails?.list.slug === activeListSlug &&
          activeListDetails.ancestors?.some((a) => a.slug === "recipes")))
  );

  const activeDbDefaultLayout =
    activeListSlug === null
      ? null
      : activeListDetails?.list.slug === activeListSlug
      ? activeListDetails.list.defaultLayout
      : lists.find((l) => l.slug === activeListSlug)?.defaultLayout ?? null;

  useEffect(() => {
    if (!prefsHydrated) return;
    setLayoutEngine(
      resolveBoardLayout(activeListSlug, wishOnly, activeDbDefaultLayout, isMyStuffDescendant)
    );
  }, [prefsHydrated, activeListSlug, wishOnly, activeDbDefaultLayout, isMyStuffDescendant]);

  const handleLayoutChange = useCallback(
    (nextLayout: LayoutEngineType) => {
      setLayoutEngine(nextLayout);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `curio_board_layout:${getLayoutPreferenceKey(activeListSlug, wishOnly)}`,
          nextLayout
        );
      }
      if (!activeListSlug) return;
      setLists((prev) =>
        prev.map((l) => (l.slug === activeListSlug ? { ...l, defaultLayout: nextLayout } : l))
      );
      setActiveListDetails((prev) =>
        prev && prev.list.slug === activeListSlug
          ? { ...prev, list: { ...prev.list, defaultLayout: nextLayout } }
          : prev
      );
      apiFetch(`/api/v1/lists/${activeListSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultLayout: nextLayout }),
      }).catch(() => {});
    },
    [activeListSlug, wishOnly]
  );

  const handleOptimisticStart = useCallback((tempCard: CardData) => {
    setItems((prev) => [tempCard, ...prev]);
    setVaultTotalCount((prev) => (prev !== null ? prev + 1 : null));
    setStreamTotalCount((prev) => (prev !== null ? prev + 1 : null));
  }, []);

  const handleOptimisticSettle = useCallback(
    (tempId: string, result: any | null) => {
      if (!result || !result.save) {
        setItems((prev) => prev.filter((it) => it.save.id !== tempId));
        setVaultTotalCount((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
        setStreamTotalCount((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
        return;
      }

      if (result.status !== "created") {
        setVaultTotalCount((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
        setStreamTotalCount((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
      }

      const settledCard: CardData = {
        save: result.save,
        entity: result.entity,
        primarySource: result.primary_source,
        connections: result.connections ?? [],
      };

      setItems((prev) => {
        const withoutTemp = prev.filter((it) => it.save.id !== tempId);
        const existingIdx = withoutTemp.findIndex((it) => it.save.id === settledCard.save.id);
        if (existingIdx >= 0) {
          const next = [...withoutTemp];
          next[existingIdx] = settledCard;
          return next;
        }
        return [settledCard, ...withoutTemp];
      });
    },
    []
  );

  const handleSelectExistingSave = useCallback(
    async (saveId: string) => {
      const inFeed = items.find((it) => it.save.id === saveId);
      if (inFeed) {
        setSelectedCard(inFeed);
        return;
      }
      const inBoard = activeListDetails?.sections
        ?.flatMap((s) => s.items)
        .find((it) => it.save.id === saveId);
      if (inBoard) {
        setSelectedCard({
          save: inBoard.save,
          entity: inBoard.entity,
          connections: inBoard.connections ?? [],
        });
        return;
      }
      try {
        const res = await apiFetch(`/api/v1/saves/${encodeURIComponent(saveId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.save) {
            setSelectedCard({
              save: data.save,
              entity: data.entity,
              connections: data.connections,
            });
          }
        }
      } catch (err) {
        console.error("Failed to open save in lightbox:", err);
      }
    },
    [items, activeListDetails]
  );

  const removeConnectionInPlace = useCallback((connectionId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.connections
          ? {
              ...it,
              connections: it.connections.filter((c) => c.connectionId !== connectionId),
            }
          : it
      )
    );
    setSelectedCard((prev) =>
      prev
        ? {
            ...prev,
            connections: (prev.connections || []).filter((c) => c.connectionId !== connectionId),
          }
        : null
    );
    setActiveListDetails((prev) => {
      if (!prev) return prev;
      const stripFromSections = (secs: typeof prev.sections) =>
        secs.map((sec) => ({
          ...sec,
          items: sec.items.map((item) =>
            item.connections
              ? {
                  ...item,
                  connections: item.connections.filter((c) => c.connectionId !== connectionId),
                }
              : item
          ),
        }));
      return {
        ...prev,
        sections: stripFromSections(prev.sections),
        children: prev.children?.map((child) => ({
          ...child,
          sections: child.sections ? stripFromSections(child.sections) : child.sections,
        })),
      };
    });
  }, []);

  const pairableCards = useMemo(() => {
    const byId = new Map<string, CardData>();
    if (activeListDetails) {
      for (const sec of activeListDetails.sections || []) {
        for (const row of sec.items || []) {
          if (!row.save.isPrivateMemo && !row.save.id.startsWith("optimistic-")) {
            byId.set(row.save.id, {
              save: row.save,
              entity: row.entity,
              connections: row.connections,
            });
          }
        }
      }
      for (const child of activeListDetails.children || []) {
        for (const sec of child.sections || []) {
          for (const row of sec.items || []) {
            if (!row.save.isPrivateMemo && !row.save.id.startsWith("optimistic-")) {
              byId.set(row.save.id, {
                save: row.save,
                entity: row.entity,
                connections: row.connections,
              });
            }
          }
        }
      }
    }
    for (const card of items) {
      if (
        !card.save.isPrivateMemo &&
        card.save.enrichmentStatus !== "OPTIMISTIC" &&
        !card.save.id.startsWith("optimistic-") &&
        !byId.has(card.save.id)
      ) {
        byId.set(card.save.id, card);
      }
    }
    return Array.from(byId.values());
  }, [activeListDetails, items]);

  const handleCaptured = (result: any) => {
    if (result.save) {
      const newCard: CardData = {
        save: result.save,
        entity: result.entity,
        primarySource: result.primary_source,
        connections: result.connections ?? [],
      };
      setItems((prev) => {
        const existingIdx = prev.findIndex((it) => it.save.id === newCard.save.id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = newCard;
          return next;
        }
        return [newCard, ...prev];
      });

      // Update board size counters & active board view in real time
      fetchLists();
      if (activeListSlug) {
        refreshActiveBoard(activeListSlug);
      }

      // Check if this is the first time adding a genuinely new card on this type
      const isNewCreation = !result.status || result.status === "created";
      const typeInfo = isNewCreation ? extractTypeInfo(newCard) : null;
      if (typeInfo && typeof window !== "undefined") {
        try {
          const promptedRaw = localStorage.getItem("curio_prompted_type_lists");
          const prompted: string[] = promptedRaw ? JSON.parse(promptedRaw) : [];
          if (!prompted.includes(typeInfo.key)) {
            const alreadyHadType = items.some((it) => {
              if (it.save.id === newCard.save.id || it.save.id.startsWith("optimistic-")) {
                return false;
              }
              const t = extractTypeInfo(it);
              return t && t.key === typeInfo.key;
            });
            const listExists = isTypeCoveredByBoards(typeInfo, lists);

            if (!alreadyHadType && !listExists) {
              localStorage.setItem("curio_prompted_type_lists", JSON.stringify([...prompted, typeInfo.key]));
              setNewTypePrompt(typeInfo);
            }
          }
        } catch (e) {
          console.error("Failed to check type prompt state:", e);
        }
      }
    }
  };

  const visibleItems = wishOnly ? items.filter((it) => it.save.wishlist) : items;

  const openCardOrBook = useCallback(
    (card: CardData, presentation?: "standard" | "press") => {
      const isBookCard =
        card.entity?.coreType === "BOOK" || card.save.typePath === "/product/book";
      if (isBookCard && presentation !== "press") {
        setOpenBookSaveId(card.save.id);
        return;
      }
      const isFilmCard =
        card.save.typePath === "/media/film" || card.entity?.typePath === "/media/film";
      if (isFilmCard && presentation !== "press") {
        setOpenFilmSaveId(card.save.id);
        return;
      }
      setLightboxPresentation(presentation || "standard");
      setSelectedCard(card);
    },
    []
  );

  const booksBoardData = useMemo(() => {
    if (activeListSlug !== "books" || !activeListDetails?.sections) {
      return null;
    }
    const rawPairs: Array<{ save: any; entity: any; card: CardData; view: LibraryBookView }> = [];
    for (const sec of activeListDetails.sections) {
      for (const it of sec.items) {
        const cardData: CardData = {
          save: it.save,
          entity: it.entity,
          connections: it.connections,
        };
        const view = toLibraryBookView(it.save, it.entity);
        view.card = cardData;
        rawPairs.push({ save: it.save, entity: it.entity, card: cardData, view });
      }
    }
    const views = rawPairs.map((p) => p.view);
    const stats = computeLibraryStats(views);
    const goodreadsCount = views.filter((b) => b.sources.includes("GOODREADS")).length;
    const myStuffBookCount = views.filter((b) => b.sources.includes("MY_STUFF")).length;
    const manualCount = views.filter((b) => b.sources.includes("MANUAL")).length;
    const dupGroups = findDuplicateBookGroups(rawPairs);
    const duplicateCount = dupGroups.reduce((acc, g) => acc + g.length - 1, 0);
    const hygieneIssueCount = rawPairs.filter(({ save, entity }) => {
      const title = (save.privateTitle || entity?.title || "").trim();
      const probe = `${title} ${entity?.brandOrCreator || ""} ${(save.autoTags || []).join(" ")}`;
      if (isTravelGuideOrStudyBook(probe)) return true;
      const sanitized = sanitizeGoodreadsNote(save.personalNotes);
      if ((save.personalNotes || null) !== sanitized) return true;
      const tags = Array.isArray(save.autoTags) ? save.autoTags : [];
      return tags.some((t: string) => String(t).toLowerCase() === "[edit]");
    }).length;
    const missingMetadataCount = views.filter(
      (b) => !b.coverUrl || !b.pageCount || b.author === "Unknown Author"
    ).length;

    const bySaveId = new Map<string, LibraryBookView>();
    for (const v of views) bySaveId.set(v.saveId, v);

    return {
      views,
      bySaveId,
      stats,
      goodreadsCount,
      myStuffBookCount,
      manualCount,
      duplicateCount,
      hygieneIssueCount,
      missingMetadataCount,
    };
  }, [activeListSlug, activeListDetails]);

  const filmsBoardData = useMemo(() => {
    if (activeListSlug !== "films" || !activeListDetails?.sections) {
      return null;
    }
    const views: FilmView[] = [];
    const bySaveId = new Map<string, FilmView>();
    for (const sec of activeListDetails.sections) {
      for (const it of sec.items) {
        const cardData: CardData = {
          save: it.save,
          entity: it.entity,
          connections: it.connections,
        };
        const view = toFilmView(it.save, it.entity);
        view.card = cardData;
        views.push(view);
        bySaveId.set(view.saveId, view);
      }
    }
    const stats = computeCinemaStats(views);
    const letterboxdCount = views.filter(isLetterboxdFilmView).length;
    const filmaffinityCount = views.filter((f) => f.sources.includes("FILMAFFINITY")).length;
    const rewatchCount = views.filter((f) => f.rewatch).length;
    const missingFilmMetadataCount = views.filter(
      (f) =>
        !f.posterUrl ||
        !f.director ||
        f.director === "Unknown Director" ||
        /\band\s+(?:written|produced|edited|starring)\b/i.test(f.director) ||
        f.genres.length === 0
    ).length;

    return {
      views,
      bySaveId,
      stats,
      letterboxdCount,
      filmaffinityCount,
      rewatchCount,
      missingFilmMetadataCount,
    };
  }, [activeListSlug, activeListDetails]);

  const displayedBoardSections = useMemo(() => {
    if (!activeListDetails?.sections) return [];
    if (activeListSlug === "books" && booksBoardData) {
      const q = bookSearchQuery.trim().toLowerCase();
      const authorNorm = bookAuthorFilter?.trim().toLowerCase() || null;
      return activeListDetails.sections
        .map((section) => {
          const filtered = section.items.filter((item) => {
            const view = booksBoardData.bySaveId.get(item.save.id);
            if (!view) return false;
            if (bookSubFilter === "MY_STUFF" && !view.sources.includes("MY_STUFF")) return false;
            if (bookSubFilter === "GOODREADS" && !view.sources.includes("GOODREADS")) return false;
            if (bookSubFilter === "MANUAL" && !view.sources.includes("MANUAL")) return false;
            if (bookSubFilter === "FINISHED" && view.readingStatus !== "FINISHED") return false;
            if (bookSubFilter === "NOT_READ" && view.readingStatus === "FINISHED") return false;
            if (bookSubFilter === "READING" && view.readingStatus !== "READING") return false;
            if (bookSubFilter === "WANT_TO_READ" && view.readingStatus !== "WANT_TO_READ") return false;
            if (
              authorNorm &&
              view.author.toLowerCase() !== authorNorm &&
              !view.author.toLowerCase().includes(authorNorm)
            ) {
              return false;
            }
            if (
              bookTagFilter &&
              !view.tags.some((t) => t.toLowerCase() === bookTagFilter.toLowerCase())
            ) {
              return false;
            }
            if (q) {
              const hay = `${view.title} ${view.author} ${view.personalNotes || ""} ${view.sources
                .map(formatBookSourceLabel)
                .join(" ")} ${view.tags.join(" ")}`.toLowerCase();
              if (!hay.includes(q)) return false;
            }
            return true;
          });

          const sorted = [...filtered];
          sorted.sort((ia, ib) => {
            const a = booksBoardData.bySaveId.get(ia.save.id)!;
            const b = booksBoardData.bySaveId.get(ib.save.id)!;
            return compareLibraryBooks(a, b, bookSortBy);
          });
          return { ...section, items: sorted };
        })
        .filter((section) => section.items.length > 0);
    }

    if (activeListSlug === "films" && filmsBoardData) {
      const q = filmSearchQuery.trim().toLowerCase();
      const dirNorm = filmDirectorFilter?.trim().toLowerCase() || null;
      const genreNorm = filmGenreFilter?.trim().toLowerCase() || null;
      return activeListDetails.sections
        .map((section) => {
          const filtered = section.items.filter((item) => {
            const view = filmsBoardData.bySaveId.get(item.save.id);
            if (!view) return false;
            if (filmSubFilter === "LETTERBOXD" && !isLetterboxdFilmView(view)) return false;
            if (filmSubFilter === "FILMAFFINITY" && !view.sources.includes("FILMAFFINITY")) return false;
            if (filmSubFilter === "WATCHED" && view.watchStatus !== "WATCHED") return false;
            if (filmSubFilter === "WATCHLIST" && view.watchStatus !== "WATCHLIST") return false;
            if (filmSubFilter === "REWATCH" && !view.rewatch) return false;
            if (filmSubFilter === "OWNED" && !view.isOwned) return false;
            if (
              dirNorm &&
              view.director.toLowerCase() !== dirNorm &&
              !view.director.toLowerCase().includes(dirNorm)
            ) {
              return false;
            }
            if (
              genreNorm &&
              !view.genres.some((g) => g.toLowerCase() === genreNorm)
            ) {
              return false;
            }
            if (
              filmTagFilter &&
              !view.tags.some((t) => t.toLowerCase() === filmTagFilter.toLowerCase())
            ) {
              return false;
            }
            if (q) {
              const hay = `${view.title} ${view.director} ${view.genres.join(" ")} ${view.personalNotes || ""} ${view.tags.join(
                " "
              )}`.toLowerCase();
              if (!hay.includes(q)) return false;
            }
            return true;
          });

          const sorted = [...filtered];
          if (filmSortBy !== "recent") {
            sorted.sort((ia, ib) => {
              const a = filmsBoardData.bySaveId.get(ia.save.id)!;
              const b = filmsBoardData.bySaveId.get(ib.save.id)!;
              if (filmSortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
              if (filmSortBy === "title") return a.title.localeCompare(b.title);
              if (filmSortBy === "year") return (b.releaseYear ?? 0) - (a.releaseYear ?? 0);
              if (filmSortBy === "dateWatched") {
                return (b.dateWatched || "").localeCompare(a.dateWatched || "");
              }
              return 0;
            });
          }
          return { ...section, items: sorted };
        })
        .filter((section) => section.items.length > 0);
    }

    if (activeListSlug !== "wardrobe") return activeListDetails.sections;

    if (garmentCategoryFilter === "ALL" && garmentSeasonFilter === "ALL") {
      return activeListDetails.sections;
    }

    return activeListDetails.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const structured: any = item.entity?.coreStructuredData || {};
          const custom: any = item.save?.userCustomValues || {};
          const tags: string[] = (item.save?.autoTags || []).map((t: string) => t.toLowerCase());

          if (garmentCategoryFilter !== "ALL") {
            const itemCat = (structured.category || custom.category || "").toLowerCase();
            const targetCat = garmentCategoryFilter.toLowerCase();
            const matchesCategory = itemCat === targetCat || tags.includes(targetCat);
            if (!matchesCategory) return false;
          }

          if (garmentSeasonFilter !== "ALL") {
            const itemSeason = (structured.season || custom.season || "").toLowerCase();
            if (garmentSeasonFilter === "SPRING_SUMMER") {
              const matches =
                itemSeason.includes("spring") ||
                itemSeason.includes("summer") ||
                tags.includes("spring") ||
                tags.includes("summer");
              if (!matches) return false;
            } else if (garmentSeasonFilter === "AUTUMN_WINTER") {
              const matches =
                itemSeason.includes("autumn") ||
                itemSeason.includes("winter") ||
                itemSeason.includes("fall") ||
                tags.includes("autumn") ||
                tags.includes("winter") ||
                tags.includes("fall");
              if (!matches) return false;
            }
          }

          return true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [
    activeListDetails,
    activeListSlug,
    garmentCategoryFilter,
    garmentSeasonFilter,
    booksBoardData,
    bookSubFilter,
    bookAuthorFilter,
    bookTagFilter,
    bookSearchQuery,
    bookSortBy,
    filmsBoardData,
    filmSubFilter,
    filmDirectorFilter,
    filmGenreFilter,
    filmTagFilter,
    filmSearchQuery,
    filmSortBy,
  ]);

  const orderedBookViews = useMemo(() => {
    if (activeListSlug === "books" && booksBoardData) {
      return displayedBoardSections.flatMap((sec) =>
        sec.items
          .map((it) => booksBoardData.bySaveId.get(it.save.id))
          .filter((v): v is LibraryBookView => Boolean(v))
      );
    }
    return items
      .filter((it) => it.entity?.coreType === "BOOK" || it.save.typePath === "/product/book")
      .map((it) => toLibraryBookView(it.save as any, it.entity as any));
  }, [activeListSlug, booksBoardData, displayedBoardSections, items]);

  const openBookIdx = useMemo(
    () =>
      openBookSaveId
        ? orderedBookViews.findIndex((b) => b.saveId === openBookSaveId)
        : -1,
    [orderedBookViews, openBookSaveId]
  );

  const openBookView = useMemo(() => {
    if (!openBookSaveId) return null;
    if (openBookIdx >= 0) return orderedBookViews[openBookIdx];
    const fromBooks = booksBoardData?.bySaveId.get(openBookSaveId);
    if (fromBooks) return fromBooks;
    const fromFeed = items.find((it) => it.save.id === openBookSaveId);
    if (fromFeed) {
      const v = toLibraryBookView(fromFeed.save as any, fromFeed.entity as any);
      v.card = fromFeed;
      return v;
    }
    return null;
  }, [openBookSaveId, openBookIdx, orderedBookViews, booksBoardData, items]);

  const orderedFilmViews = useMemo(() => {
    if (activeListSlug === "films" && filmsBoardData) {
      return displayedBoardSections.flatMap((sec) =>
        sec.items
          .map((it) => filmsBoardData.bySaveId.get(it.save.id))
          .filter((v): v is FilmView => Boolean(v))
      );
    }
    return items
      .filter((it) => it.save.typePath === "/media/film" || it.entity?.typePath === "/media/film")
      .map((it) => toFilmView(it.save as any, it.entity as any));
  }, [activeListSlug, filmsBoardData, displayedBoardSections, items]);

  const openFilmIdx = useMemo(
    () =>
      openFilmSaveId
        ? orderedFilmViews.findIndex((f) => f.saveId === openFilmSaveId)
        : -1,
    [orderedFilmViews, openFilmSaveId]
  );

  const openFilmView = useMemo(() => {
    if (!openFilmSaveId) return null;
    if (openFilmIdx >= 0) return orderedFilmViews[openFilmIdx];
    const fromFilms = filmsBoardData?.bySaveId.get(openFilmSaveId);
    if (fromFilms) return fromFilms;
    const fromFeed = items.find((it) => it.save.id === openFilmSaveId);
    if (fromFeed) {
      const v = toFilmView(fromFeed.save as any, fromFeed.entity as any);
      v.card = fromFeed;
      return v;
    }
    return null;
  }, [openFilmSaveId, openFilmIdx, orderedFilmViews, filmsBoardData, items]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center font-serif font-black text-xl shadow-md animate-pulse">
          C
        </div>
        <p className="mt-3 text-xs font-mono uppercase tracking-widest text-neutral-400">
          Loading Curio Taste Graph...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <CurioLandingVitrine
          onOpenAuth={(tab) => {
            setAuthTab(tab || "login");
            setIsAuthOpen(true);
          }}
        />

        {/* Authentication Modal */}
        <AuthModal
          isOpen={isAuthOpen}
          defaultTab={authTab}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={(authenticatedUser, token) => {
            if (typeof window !== "undefined" && token) {
              localStorage.setItem("curio_token", token);
            }
            setUser(authenticatedUser);
            setIsAuthOpen(false);
            fetchItems({ reset: true });
            fetchLists();
          }}
        />

        {/* Onboarding Modal */}
        <OnboardingModal
          isOpen={isOnboardingOpen}
          initialUser={user}
          onClose={() => setIsOnboardingOpen(false)}
          onComplete={(completedUser) => {
            setUser(completedUser);
            fetchItems({ reset: true });
            fetchLists();
          }}
        />
      </>
    );
  }

  const renderFeedCard = (item: CardData) => (
    <PolymorphicCard
      key={item.save.id}
      item={item}
      density={cardDensity}
      onCardClick={(card) => {
        openCardOrBook(card);
      }}
      onConnect={(card) => {
        setPairingCard(card);
        setIsPairingOpen(true);
      }}
      onSwapped={() => fetchItems({ reset: true })}
      onUnlink={(connectionId) => {
        removeConnectionInPlace(connectionId);
        fetchItems({ reset: true });
      }}
      onAddToList={() => {
        fetchLists();
        if (activeListSlug) refreshActiveBoard(activeListSlug);
      }}
      onWishToggled={(id, w) => {
        setItems((prev) =>
          prev.map((it) => (it.save.id === id ? { ...it, save: { ...it.save, wishlist: w } } : it))
        );
        setWishlistCount((prev) =>
          prev !== null ? Math.max(0, prev + (w ? 1 : -1)) : null
        );
      }}
      onCustomFieldsUpdated={(saveId, updatedValues) => {
        setItems((prev) =>
          prev.map((it) =>
            it.save.id === saveId
              ? {
                  ...it,
                  save: {
                    ...it.save,
                    userCustomValues: updatedValues,
                  },
                }
              : it
          )
        );
      }}
    />
  );

  const displayedTotalSaves = vaultTotalCount ?? items.length;
  const displayedStreamTotal = streamTotalCount ?? displayedTotalSaves;
  const displayedWishlistCount = wishlistCount ?? items.filter((it) => it.save.wishlist).length;
  const hiddenWearLogCount = !wishOnly && !showWearLogs ? wearLogCount ?? 0 : 0;
  const hiddenClosetCount = !wishOnly && !showCloset ? closetCount ?? 0 : 0;
  const hiddenMyStuffCount = !wishOnly && !showMyStuff ? myStuffCount ?? 0 : 0;

  return (
    <PullToRefresh
      disabled={Boolean(selectedCard) || Boolean(openBookView) || Boolean(openFilmView) || isImporterOpen || isPairingOpen || isCreateListOpen || isTypeBuilderOpen || isTypesModalOpen || isAuthOpen || isOnboardingOpen || isLogBookOpen || isGoodreadsSyncOpen || isLogFilmOpen || isLetterboxdSyncOpen || isFilmAffinitySyncOpen}
      onRefresh={() =>
        Promise.all([
          fetchItems({ reset: true, wishlist: wishOnly }),
          fetchLists(),
          refreshActiveBoard(),
          triggerClosetSync(false),
          triggerPurchaseHubSync(false),
          triggerChefSync(false),
          triggerBackgroundFeedSyncIfStale(false),
        ])
      }
    >
    <main className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-end gap-2.5 mb-4">
          <UserNav
            user={user}
            onOpenAuth={(tab = "login") => {
              setAuthTab(tab);
              setIsAuthOpen(true);
            }}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
            onOpenImporter={() => setIsImporterOpen(true)}
            onOpenTypesSettings={() => setIsTypesModalOpen(true)}
            onLogout={async () => {
              await apiFetch("/api/v1/auth/logout", { method: "POST" });
              if (typeof window !== "undefined") {
                localStorage.removeItem("curio_token");
              }
              setUser(null);
              setItems([]);
              setLists([]);
            }}
          />
        </div>

        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 font-serif">
            Curio
          </h1>
        </div>
      </div>

      {/* Omnibox Universal Capture */}
      <div className="mb-8 max-w-4xl mx-auto">
        <Omnibox
          onCaptured={handleCaptured}
          onOptimisticStart={handleOptimisticStart}
          onOptimisticSettle={handleOptimisticSettle}
          onSelectExistingSave={handleSelectExistingSave}
          activeBoardContext={activeBoardContext}
          onOpenTypeBuilder={() => setIsTypeBuilderOpen(true)}
        />
      </div>

      {/* Optional Onboarding / Bring in your collections Banner */}
      {user && !user.onboardingCompleted && !dismissedOnboarding && (
        <div className="max-w-4xl mx-auto mb-10 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                Bring in your collections
              </h3>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                Seed your taste graph with starter boards or import from Letterboxd, Goodreads, and bookmarks.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition cursor-pointer shadow-xs"
            >
              Get Started →
            </button>
            <button
              type="button"
              onClick={handleDismissBringCollections}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* My collections */}
      <div className="max-w-screen-2xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-3 border-b border-neutral-200/60 dark:border-neutral-800">
          <div>
            <h2 className="text-xl font-bold font-serif text-neutral-900 dark:text-neutral-100">
              My collections
            </h2>
            <p className="text-xs text-neutral-500">
              {wishOnly
                ? `Showing ${visibleItems.length} of ${displayedWishlistCount} wishlisted saves`
                : hiddenClosetCount === 0 &&
                  hiddenMyStuffCount === 0 &&
                  hiddenWearLogCount > 0
                ? `Showing ${items.length} of ${displayedStreamTotal} saves · ${hiddenWearLogCount} ${
                    hiddenWearLogCount === 1 ? "wear log" : "wear logs"
                  } tucked in Outfits`
                : (() => {
                    const tucked: string[] = [];
                    if (hiddenClosetCount > 0) tucked.push(`${hiddenClosetCount} Closet`);
                    if (hiddenMyStuffCount > 0) tucked.push(`${hiddenMyStuffCount} My Stuff`);
                    if (hiddenWearLogCount > 0) tucked.push(`${hiddenWearLogCount} wear logs`);
                    return tucked.length > 0
                      ? `Showing ${items.length} of ${displayedStreamTotal} saves · Tucked: ${tucked.join(" · ")}`
                      : `Showing ${items.length} of ${displayedStreamTotal} total saves`;
                  })()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-auto">
            {activeListSlug === null && !wishOnly && ((closetCount ?? 0) > 0 || showCloset) && (
              <button
                type="button"
                data-testid="toggle-closet-stream"
                aria-pressed={showCloset}
                onClick={handleToggleCloset}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                  showCloset
                    ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white shadow-xs"
                    : "bg-white dark:bg-neutral-900 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
                title={showCloset ? "Hide Closet garments from All stream" : "Include Closet garments in All stream"}
              >
                <Shirt className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Closet{typeof closetCount === "number" ? ` (${closetCount})` : ""}</span>
              </button>
            )}
            {activeListSlug === null && !wishOnly && ((myStuffCount ?? 0) > 0 || showMyStuff) && (
              <button
                type="button"
                data-testid="toggle-mystuff-stream"
                aria-pressed={showMyStuff}
                onClick={handleToggleMyStuff}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                  showMyStuff
                    ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white shadow-xs"
                    : "bg-white dark:bg-neutral-900 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
                title={showMyStuff ? "Hide My Stuff items from All stream" : "Include My Stuff items in All stream"}
              >
                <Package className="w-3.5 h-3.5" aria-hidden="true" />
                <span>My Stuff{typeof myStuffCount === "number" ? ` (${myStuffCount})` : ""}</span>
              </button>
            )}
            {activeListSlug === null && !wishOnly && ((wearLogCount ?? 0) > 0 || showWearLogs) && (
              <button
                type="button"
                data-testid="toggle-wear-logs"
                aria-pressed={showWearLogs}
                onClick={handleToggleWearLogs}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                  showWearLogs
                    ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white shadow-xs"
                    : "bg-white dark:bg-neutral-900 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
                title={
                  showWearLogs
                    ? "Tuck daily wear logs out of All stream"
                    : "Include daily wear logs in All stream"
                }
              >
                <Shirt className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Wear logs{typeof wearLogCount === "number" ? ` (${wearLogCount})` : ""}</span>
              </button>
            )}
            {user && (
              <button
                type="button"
                data-testid="sync-all-sources-btn"
                onClick={triggerAllSourcesSync}
                disabled={isSyncingAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer disabled:opacity-50"
                title="Sync Closet, Purchase Hub, and external feeds"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? "animate-spin" : ""}`} aria-hidden="true" />
                <span className="hidden sm:inline">{isSyncingAll ? "Syncing..." : "Sync"}</span>
              </button>
            )}
            <ViewModeSwitcher
              layout={layoutEngine}
              density={cardDensity}
              onLayoutChange={handleLayoutChange}
              onDensityChange={setCardDensity}
            />
          </div>
        </div>

        {/* Curated Boards & Smart Lists Tabs Bar */}
        <ListTabsBar
          lists={lists}
          activeListSlug={activeListSlug}
          totalAllSavesCount={displayedStreamTotal}
          onSelectList={(slug) => {
            setWishOnly(false);
            setActiveListSlug(slug);
          }}
          wishlistActive={wishOnly}
          wishlistCount={displayedWishlistCount}
          onToggleWishlist={() => {
            setActiveListSlug(null);
            setWishOnly((v) => !v);
          }}
          onCreateListClick={() => {
            setEditingBoard(null);
            setCreateListParentId(activeListDetails?.list.id || null);
            setIsCreateListOpen(true);
          }}
        />

        {/* Content View: Board View vs Taste Stream Feed */}
        {activeListSlug !== null ? (
          <div>
            {/* Breadcrumb Navigation when viewing board */}
            {activeListDetails && (
              <BreadcrumbNav
                ancestors={activeListDetails.ancestors || []}
                currentTitle={activeListDetails.list.title}
                onSelectBoard={(slug) => {
                  setWishOnly(false);
                  setActiveListSlug(slug);
                }}
                className="mb-4"
              />
            )}

            {/* Board Header details */}
            {activeListDetails && (
              <div className="mb-8 p-6 rounded-3xl bg-neutral-100/60 dark:bg-neutral-900/40 border border-neutral-200/80 dark:border-neutral-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold font-serif text-neutral-900 dark:text-neutral-100">
                      {activeListDetails.list.title}
                    </h2>
                    {activeListDetails.list.description && (
                      <p className="text-xs text-neutral-500 mt-1 max-w-xl">
                        {activeListDetails.list.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {(activeListSlug === "closet" ||
                      activeListSlug === "wardrobe" ||
                      activeListSlug === "outfits" ||
                      Boolean(activeListDetails.ancestors?.some((a) => a.slug === "closet"))) && (
                      <>
                        <button
                          type="button"
                          onClick={() => triggerClosetSync(true)}
                          disabled={isSyncingCloset}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloset ? "animate-spin" : ""}`} />
                          <span>{isSyncingCloset ? "Syncing Closet..." : "Sync Closet"}</span>
                        </button>
                        <a
                          href={`/closet/#${activeListSlug === "outfits" ? "outfits" : "closet"}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition"
                        >
                          <span>Open Closet ↗</span>
                        </a>
                      </>
                    )}
                    {activeListSlug === "books" && (
                      <>
                        {booksBoardData && (booksBoardData.duplicateCount > 0 || booksBoardData.hygieneIssueCount > 0) && (
                          <button
                            type="button"
                            data-testid="fix-book-duplicates-btn"
                            disabled={isDedupingBooks}
                            onClick={async () => {
                              setIsDedupingBooks(true);
                              setBooksBannerMsg(null);
                              try {
                                const res = await apiFetch("/api/v1/library/deduplicate", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({}),
                                });
                                const d = await res.json().catch(() => ({}));
                                if (res.ok) {
                                  const parts: string[] = [];
                                  if (d.mergedSavesRemoved > 0) {
                                    parts.push(`merged ${d.mergedSavesRemoved} duplicates`);
                                  }
                                  if (d.cleanedNotesCount > 0) {
                                    parts.push(`cleaned ${d.cleanedNotesCount} Goodreads notes/tags`);
                                  }
                                  if (d.reclassifiedReferenceCount > 0) {
                                    parts.push(`moved ${d.reclassifiedReferenceCount} travel/study books to My Stuff`);
                                  }
                                  setBooksBannerMsg(
                                    parts.length > 0
                                      ? `Library cleaned: ${parts.join(", ")}.`
                                      : "Library is already clean."
                                  );
                                  await Promise.all([
                                    fetchItems({ reset: true }),
                                    fetchLists(),
                                    refreshActiveBoard("books"),
                                  ]);
                                }
                              } finally {
                                setIsDedupingBooks(false);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 hover:border-amber-500 transition cursor-pointer disabled:opacity-50"
                          >
                            {isDedupingBooks && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>
                              Clean &amp; Deduplicate (
                              {booksBoardData.duplicateCount + booksBoardData.hygieneIssueCount})
                            </span>
                          </button>
                        )}
                        {booksBoardData && booksBoardData.missingMetadataCount > 0 && (
                          <button
                            type="button"
                            disabled={isEnrichingBooks}
                            onClick={async () => {
                              setIsEnrichingBooks(true);
                              setBooksBannerMsg(null);
                              try {
                                const res = await apiFetch("/api/v1/library/enrich", { method: "POST" });
                                const d = await res.json().catch(() => ({}));
                                if (res.ok) {
                                  setBooksBannerMsg(
                                    `Enriched ${d.enrichedCount ?? 0} of ${d.totalChecked ?? 0} books with covers, authors, and summaries.`
                                  );
                                  await Promise.all([
                                    fetchItems({ reset: true }),
                                    refreshActiveBoard("books"),
                                  ]);
                                }
                              } finally {
                                setIsEnrichingBooks(false);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition cursor-pointer disabled:opacity-50"
                          >
                            {isEnrichingBooks ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            )}
                            <span>Enrich Covers ({booksBoardData.missingMetadataCount})</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsLogBookOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Log Read Book</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            apiFetch("/api/v1/library/goodreads-sync")
                              .then((r) => (r.ok ? r.json() : null))
                              .then((d) => {
                                if (d) setGoodreadsStatus(d);
                              })
                              .catch(() => {});
                            setIsGoodreadsSyncOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Sync Goodreads</span>
                        </button>
                      </>
                    )}
                    {activeListSlug === "films" && (
                      <>
                        {filmsBoardData && filmsBoardData.missingFilmMetadataCount > 0 && (
                          <button
                            type="button"
                            disabled={isEnrichingFilms}
                            onClick={async () => {
                              setIsEnrichingFilms(true);
                              setFilmsBannerMsg(null);
                              try {
                                const res = await apiFetch("/api/v1/cinema/enrich", { method: "POST" });
                                const d = await res.json().catch(() => ({}));
                                if (res.ok) {
                                  setFilmsBannerMsg(
                                    `Enriched ${d.enrichedCount ?? 0} of ${d.totalChecked ?? 0} films with directors, genres, and posters.`
                                  );
                                  await Promise.all([
                                    fetchItems({ reset: true }),
                                    fetchLists(),
                                    refreshActiveBoard("films"),
                                  ]);
                                }
                              } finally {
                                setIsEnrichingFilms(false);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition cursor-pointer disabled:opacity-50"
                          >
                            {isEnrichingFilms ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            )}
                            <span>Enrich Films ({filmsBoardData.missingFilmMetadataCount})</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsLogFilmOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Log Film</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            apiFetch("/api/v1/cinema/letterboxd-sync")
                              .then((r) => (r.ok ? r.json() : null))
                              .then((d) => {
                                if (d) setLetterboxdStatus(d);
                              })
                              .catch(() => {});
                            setIsLetterboxdSyncOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Sync Letterboxd</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            apiFetch("/api/v1/cinema/filmaffinity-sync")
                              .then((r) => (r.ok ? r.json() : null))
                              .then((d) => {
                                if (d) setFilmaffinityStatus(d);
                              })
                              .catch(() => {});
                            setIsFilmAffinitySyncOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition cursor-pointer"
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>Sync FilmAffinity</span>
                        </button>
                      </>
                    )}
                    {isMyStuffDescendant && (
                      <>
                        <button
                          type="button"
                          data-testid="sync-purchase-hub-btn"
                          onClick={() => triggerPurchaseHubSync(true)}
                          disabled={isSyncingPurchaseHub}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPurchaseHub ? "animate-spin" : ""}`} />
                          <span>{isSyncingPurchaseHub ? "Syncing My Stuff..." : "Sync My Stuff"}</span>
                        </button>
                        <a
                          href="/my-stuff/"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition"
                        >
                          <span>Open Purchase Hub ↗</span>
                        </a>
                      </>
                    )}
                    {isRecipesDescendant && (
                      <>
                        <button
                          type="button"
                          data-testid="sync-chef-btn"
                          onClick={() => triggerChefSync(true)}
                          disabled={isSyncingChef}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingChef ? "animate-spin" : ""}`} />
                          <span>{isSyncingChef ? "Syncing Chef..." : "Sync Chef"}</span>
                        </button>
                        <a
                          href="/chef/"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition"
                        >
                          <span>Open Chef ↗</span>
                        </a>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBoard(activeListDetails.list);
                        setIsCreateListOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit Board</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBoard(null);
                        setCreateListParentId(activeListDetails.list.id);
                        setIsCreateListOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition cursor-pointer"
                    >
                      <span>+ Sub-Board</span>
                    </button>
                    {activeListDetails.list.visibility === "PUBLIC" && (
                      <a
                        href={getApiUrl(`/list/${activeListDetails.list.slug}`)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition"
                      >
                        <span>View Public Board ↗</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Books Sub-Board Filter Bar & Telemetry (when on Books board) */}
            {activeListSlug === "books" && booksBoardData && (
              <div className="mb-6 space-y-3" data-testid="books-subboard-filters">
                {booksBannerMsg && (
                  <div className="flex items-center justify-between gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-neutral-800 dark:text-neutral-200">
                    <span>{booksBannerMsg}</span>
                    <button
                      type="button"
                      onClick={() => setBooksBannerMsg(null)}
                      className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: "ALL", label: "All", count: booksBoardData.stats.total },
                        { id: "FINISHED", label: "Read", count: booksBoardData.stats.finishedCount, icon: CheckCircle2 },
                        {
                          id: "NOT_READ",
                          label: "Not Read",
                          count: Math.max(0, booksBoardData.stats.total - booksBoardData.stats.finishedCount),
                        },
                        { id: "READING", label: "Reading", count: booksBoardData.stats.readingCount, icon: BookOpen },
                        { id: "WANT_TO_READ", label: "Want to Read", count: booksBoardData.stats.wantToReadCount, icon: Clock },
                        { id: "GOODREADS", label: "Goodreads", count: booksBoardData.goodreadsCount },
                        { id: "MY_STUFF", label: "My Stuff", count: booksBoardData.myStuffBookCount, icon: ShoppingBag },
                        ...(booksBoardData.manualCount > 0
                          ? [{ id: "MANUAL" as const, label: "Manual", count: booksBoardData.manualCount }]
                          : []),
                      ] as Array<{
                        id: typeof bookSubFilter;
                        label: string;
                        count: number;
                        icon?: React.ComponentType<{ className?: string }>;
                      }>
                    ).map((f) => {
                      const active = bookSubFilter === f.id;
                      const Icon = f.icon ?? null;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          data-testid={`books-filter-${f.id.toLowerCase()}`}
                          onClick={() => setBookSubFilter(f.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition cursor-pointer ${
                            active
                              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-xs"
                              : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                          }`}
                        >
                          {Icon && <Icon className="w-3 h-3" />}
                          <span>{f.label}</span>
                          <span className="opacity-70 tabular-nums">{f.count}</span>
                        </button>
                      );
                    })}
                    {bookAuthorFilter && (
                      <button
                        type="button"
                        onClick={() => setBookAuthorFilter(null)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 cursor-pointer"
                      >
                        <span>Author: {bookAuthorFilter}</span>
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 sm:flex-initial sm:w-56">
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={bookSearchQuery}
                        onChange={(e) => setBookSearchQuery(e.target.value)}
                        placeholder="Search books, authors, notes..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400"
                      />
                    </div>
                    <select
                      value={bookSortBy}
                      onChange={(e) => setBookSortBy(e.target.value as BookSortKey)}
                      aria-label="Sort books"
                      className="px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-mono focus:outline-none"
                    >
                      <option value="dateAdded">Sort: Date Added</option>
                      <option value="author">Sort: Author (A–Z)</option>
                      <option value="title">Sort: Title (A–Z)</option>
                      <option value="read">Sort: Read Status</option>
                      <option value="dateRead">Sort: Date Read</option>
                      <option value="rating">Sort: Highest Rated</option>
                      <option value="pages">Sort: Page Count</option>
                    </select>
                  </div>
                </div>

                {/* Goodreads & Personal Labels Bar */}
                {booksBoardData.stats.tagCounts.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setBookTagFilter(null)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-mono border transition cursor-pointer ${
                        bookTagFilter === null
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                          : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                      }`}
                    >
                      All Labels
                    </button>
                    {booksBoardData.stats.tagCounts.map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() =>
                          setBookTagFilter((cur) => (cur === t.tag ? null : t.tag))
                        }
                        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border transition cursor-pointer ${
                          bookTagFilter?.toLowerCase() === t.tag.toLowerCase()
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                            : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                        }`}
                      >
                        <span>#{t.tag}</span>
                        <span className="opacity-65 tabular-nums">{t.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Compact Flush Reading Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 border-y border-neutral-200 dark:border-neutral-800 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 dark:divide-neutral-800 text-left">
                  {[
                    { label: "Volumes", value: booksBoardData.stats.total },
                    { label: "Owned", value: booksBoardData.stats.ownedCount },
                    { label: "Read", value: booksBoardData.stats.finishedCount },
                    { label: "Pages Read", value: booksBoardData.stats.totalPagesRead.toLocaleString() },
                    {
                      label: "Avg Rating",
                      value: booksBoardData.stats.avgRating !== null ? `${booksBoardData.stats.avgRating} ★` : "—",
                    },
                  ].map((m) => (
                    <div key={m.label} className="py-2.5 px-3.5">
                      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                        {m.label}
                      </div>
                      <div className="font-mono text-base sm:text-lg tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Films Sub-Board Filter Bar & Telemetry (when on Films board) */}
            {activeListSlug === "films" && filmsBoardData && (
              <div className="mb-6 space-y-3" data-testid="films-subboard-filters">
                {filmsBannerMsg && (
                  <div className="flex items-center justify-between gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-neutral-800 dark:text-neutral-200">
                    <span>{filmsBannerMsg}</span>
                    <button
                      type="button"
                      onClick={() => setFilmsBannerMsg(null)}
                      className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: "ALL", label: "All", count: filmsBoardData.stats.total },
                        { id: "WATCHED", label: "Watched", count: filmsBoardData.stats.watchedCount, icon: CheckCircle2 },
                        { id: "WATCHLIST", label: "Want to Watch", count: filmsBoardData.stats.watchlistCount, icon: Clock },
                        { id: "REWATCH", label: "Rewatches", count: filmsBoardData.rewatchCount, icon: Repeat },
                        { id: "LETTERBOXD", label: "Letterboxd", count: filmsBoardData.letterboxdCount },
                        { id: "FILMAFFINITY", label: "FilmAffinity", count: filmsBoardData.filmaffinityCount },
                        { id: "OWNED", label: "Owned", count: filmsBoardData.stats.ownedCount, icon: ShoppingBag },
                      ] as const
                    ).map((f) => {
                      const active = filmSubFilter === f.id;
                      const Icon = "icon" in f ? f.icon : null;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          data-testid={`films-filter-${f.id.toLowerCase()}`}
                          onClick={() => setFilmSubFilter(f.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition cursor-pointer ${
                            active
                              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-xs"
                              : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                          }`}
                        >
                          {Icon && <Icon className="w-3 h-3" />}
                          <span>{f.label}</span>
                          <span className="opacity-70 tabular-nums">{f.count}</span>
                        </button>
                      );
                    })}
                    {filmDirectorFilter && (
                      <button
                        type="button"
                        onClick={() => setFilmDirectorFilter(null)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 cursor-pointer"
                      >
                        <span>Director: {filmDirectorFilter}</span>
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    {filmGenreFilter && (
                      <button
                        type="button"
                        onClick={() => setFilmGenreFilter(null)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 cursor-pointer"
                      >
                        <span>Genre: {filmGenreFilter}</span>
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 sm:flex-initial sm:w-56">
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={filmSearchQuery}
                        onChange={(e) => setFilmSearchQuery(e.target.value)}
                        placeholder="Search films, directors, notes..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400"
                      />
                    </div>
                    <select
                      value={filmSortBy}
                      onChange={(e) => setFilmSortBy(e.target.value as any)}
                      className="px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-mono focus:outline-none"
                    >
                      <option value="recent">Sort: Board Order</option>
                      <option value="dateWatched">Sort: Date Watched</option>
                      <option value="rating">Sort: Highest Rated</option>
                      <option value="title">Sort: Title A–Z</option>
                      <option value="year">Sort: Release Year</option>
                    </select>
                  </div>
                </div>

                {filmsBoardData.stats.genreCounts.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setFilmGenreFilter(null)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-mono border transition cursor-pointer ${
                        filmGenreFilter === null
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                          : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                      }`}
                    >
                      All Genres
                    </button>
                    {filmsBoardData.stats.genreCounts.map((g) => (
                      <button
                        key={g.genre}
                        type="button"
                        onClick={() =>
                          setFilmGenreFilter((cur) => (cur === g.genre ? null : g.genre))
                        }
                        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border transition cursor-pointer ${
                          filmGenreFilter?.toLowerCase() === g.genre.toLowerCase()
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                            : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                        }`}
                      >
                        <span>{g.genre}</span>
                        <span className="opacity-65 tabular-nums">{g.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {filmsBoardData.stats.tagCounts.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setFilmTagFilter(null)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-mono border transition cursor-pointer ${
                        filmTagFilter === null
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                          : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                      }`}
                    >
                      All Labels
                    </button>
                    {filmsBoardData.stats.tagCounts.map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() =>
                          setFilmTagFilter((cur) => (cur === t.tag ? null : t.tag))
                        }
                        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border transition cursor-pointer ${
                          filmTagFilter?.toLowerCase() === t.tag.toLowerCase()
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                            : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                        }`}
                      >
                        <span>#{t.tag}</span>
                        <span className="opacity-65 tabular-nums">{t.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Compact Flush Cinema Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 border-y border-neutral-200 dark:border-neutral-800 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 dark:divide-neutral-800 text-left">
                  {[
                    { label: "Films", value: filmsBoardData.stats.total },
                    { label: "Watched", value: filmsBoardData.stats.watchedCount },
                    { label: "Want to Watch", value: filmsBoardData.stats.watchlistCount },
                    { label: "Hours", value: filmsBoardData.stats.totalHoursWatched },
                    {
                      label: "Avg Rating",
                      value: filmsBoardData.stats.avgRating !== null ? `${filmsBoardData.stats.avgRating} ★` : "—",
                    },
                  ].map((m) => (
                    <div key={m.label} className="py-2.5 px-3.5">
                      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                        {m.label}
                      </div>
                      <div className="font-mono text-base sm:text-lg tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Garment Characteristic Filter Bar (when on Wardrobe board) */}
            {activeListSlug === "wardrobe" && (
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  {GARMENT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setGarmentCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider transition ${
                        garmentCategoryFilter === cat.id
                          ? "bg-white dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 shadow-xs font-bold"
                          : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  {GARMENT_SEASONS.map((season) => (
                    <button
                      key={season.id}
                      onClick={() => setGarmentSeasonFilter(season.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider transition ${
                        garmentSeasonFilter === season.id
                          ? "bg-white dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 shadow-xs font-bold"
                          : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                      }`}
                    >
                      {season.label}
                    </button>
                  ))}
                </div>

                {(garmentCategoryFilter !== "ALL" || garmentSeasonFilter !== "ALL") && (
                  <button
                    onClick={() => {
                      setGarmentCategoryFilter("ALL");
                      setGarmentSeasonFilter("ALL");
                    }}
                    className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 underline underline-offset-4 px-2"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            )}

            {/* Section Group View */}
            {activeListDetails ? (
              (displayedBoardSections.length > 0 || (activeListDetails.children && activeListDetails.children.length > 0)) ? (
                <SectionGroupView
                  sections={displayedBoardSections}
                  childrenBoards={activeListDetails.children}
                  layout={layoutEngine}
                  density={cardDensity}
                  hideShelfBuckets={
                    (activeListSlug === "books" || activeListSlug === "films") &&
                    !(activeListDetails.children && activeListDetails.children.length > 0)
                  }
                  shelfLabelOverride={
                    activeListSlug === "books" && bookAuthorFilter
                      ? `AUTHOR · ${bookAuthorFilter.toUpperCase()}`
                      : activeListSlug === "books"
                      ? "PERSONAL LIBRARY"
                      : undefined
                  }
                  galleryLabelOverride={
                    activeListSlug === "films" && filmDirectorFilter
                      ? `DIRECTOR · ${filmDirectorFilter.toUpperCase()}`
                      : activeListSlug === "films" && filmGenreFilter
                      ? `GENRE · ${filmGenreFilter.toUpperCase()}`
                      : activeListSlug === "films"
                      ? "PERSONAL CINEMA POSTERS"
                      : undefined
                  }
                  onSelectCreator={
                    activeListSlug === "books"
                      ? (creator) => {
                          setBookAuthorFilter(creator);
                          setBookSubFilter("ALL");
                        }
                      : undefined
                  }
                  onSelectDirector={
                    activeListSlug === "films"
                      ? (director) => {
                          setFilmDirectorFilter(director);
                          setFilmSubFilter("ALL");
                        }
                      : undefined
                  }
                  onSelectGenre={
                    activeListSlug === "films"
                      ? (genre) => {
                          setFilmGenreFilter(genre);
                          setFilmSubFilter("ALL");
                        }
                      : undefined
                  }
                  onSelectBoard={(slug) => {
                    setWishOnly(false);
                    setActiveListSlug(slug);
                  }}
                  onAddSubBoard={() => {
                    setEditingBoard(null);
                    setCreateListParentId(activeListDetails.list.id);
                    setIsCreateListOpen(true);
                  }}
                  onConnect={(card) => {
                    setPairingCard(card);
                    setIsPairingOpen(true);
                  }}
                  onSwapped={() => {
                    fetchItems({ reset: true });
                    fetchLists();
                    refreshActiveBoard(activeListSlug);
                  }}
                  onUnlink={(connectionId) => {
                    removeConnectionInPlace(connectionId);
                    fetchItems({ reset: true });
                    fetchLists();
                    refreshActiveBoard(activeListSlug);
                  }}
                  onAddToList={() => {
                    fetchLists();
                    refreshActiveBoard(activeListSlug);
                  }}
                  onCardClick={(card, presentation) => {
                    openCardOrBook(card, presentation);
                  }}
                />
              ) : (
                <div className="text-center py-20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
                  <p className="text-neutral-600 dark:text-neutral-300 font-medium text-sm mb-1">
                    {activeListSlug === "wardrobe" && (garmentCategoryFilter !== "ALL" || garmentSeasonFilter !== "ALL")
                      ? "No garments match the selected filters."
                      : activeListSlug === "books" && (bookSubFilter !== "ALL" || bookAuthorFilter || bookTagFilter || bookSearchQuery.trim())
                      ? "No books match the selected filters."
                      : activeListSlug === "films" && (filmSubFilter !== "ALL" || filmDirectorFilter || filmGenreFilter || filmTagFilter || filmSearchQuery.trim())
                      ? "No films match the selected filters."
                      : "This board is currently empty."}
                  </p>
                  <p className="text-neutral-400 text-xs max-w-sm mx-auto mb-4">
                    {activeListSlug === "wardrobe" && (garmentCategoryFilter !== "ALL" || garmentSeasonFilter !== "ALL")
                      ? "Try selecting a different category or season combination."
                      : (activeListSlug === "books" && (bookSubFilter !== "ALL" || bookAuthorFilter || bookTagFilter || bookSearchQuery.trim())) ||
                        (activeListSlug === "films" && (filmSubFilter !== "ALL" || filmDirectorFilter || filmGenreFilter || filmTagFilter || filmSearchQuery.trim()))
                      ? "Clear the active sub-board filters to view the full board."
                      : "Capture an item above while viewing this board, or click Board on any card."}
                  </p>
                  {activeListSlug === "wardrobe" && (garmentCategoryFilter !== "ALL" || garmentSeasonFilter !== "ALL") && (
                    <button
                      onClick={() => {
                        setGarmentCategoryFilter("ALL");
                        setGarmentSeasonFilter("ALL");
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 transition"
                    >
                      Clear Filters
                    </button>
                  )}
                  {activeListSlug === "books" && (bookSubFilter !== "ALL" || bookAuthorFilter || bookTagFilter || bookSearchQuery.trim()) && (
                    <button
                      onClick={() => {
                        setBookSubFilter("ALL");
                        setBookAuthorFilter(null);
                        setBookTagFilter(null);
                        setBookSearchQuery("");
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 transition cursor-pointer"
                    >
                      Clear Book Filters
                    </button>
                  )}
                  {activeListSlug === "films" && (filmSubFilter !== "ALL" || filmDirectorFilter || filmGenreFilter || filmTagFilter || filmSearchQuery.trim()) && (
                    <button
                      onClick={() => {
                        setFilmSubFilter("ALL");
                        setFilmDirectorFilter(null);
                        setFilmGenreFilter(null);
                        setFilmTagFilter(null);
                        setFilmSearchQuery("");
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 transition cursor-pointer"
                    >
                      Clear Film Filters
                    </button>
                  )}
                </div>
              )
            ) : (
              <div className="text-center py-20 text-neutral-400 text-sm">
                Loading board...
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Feed Layout Engines */}
            {loading ? (
              <div className="text-center py-20 text-neutral-400 text-sm">
                Loading your collections...
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
                <p className="text-neutral-600 dark:text-neutral-300 font-medium text-sm mb-1">
                  {wishOnly
                    ? "Your wishlist is empty. Tap the heart on any card."
                    : hiddenWearLogCount > 0
                    ? `Your ${hiddenWearLogCount} daily ${
                        hiddenWearLogCount === 1 ? "wear log is" : "wear logs are"
                      } tucked in Outfits.`
                    : "No items in your collections yet."}
                </p>
                <p className="text-neutral-400 text-xs max-w-sm mx-auto">
                  {hiddenWearLogCount > 0
                    ? "Capture a new save above, browse your Outfits board, or include wear logs in this stream."
                    : "Capture a new thought above or import a CSV export from Letterboxd or Goodreads to seed your library."}
                </p>
                {hiddenWearLogCount > 0 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleWearLogs}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 transition cursor-pointer"
                    >
                      Include wear logs
                    </button>
                    {lists.some((l) => l.slug === "outfits") && (
                      <button
                        type="button"
                        onClick={() => setActiveListSlug("outfits")}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
                      >
                        Open Outfits
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {layoutEngine === "masonry" && (
                  <MasonryLayout items={visibleItems} renderItem={renderFeedCard} />
                )}

                {layoutEngine === "grid" && (
                  <GridLayout items={visibleItems} renderItem={renderFeedCard} />
                )}

                {layoutEngine === "timeline" && (
                  <TimelineLayout items={visibleItems} renderItem={renderFeedCard} />
                )}

                {layoutEngine === "shelf" && (
                  <ShelfLayout
                    items={visibleItems}
                    onOpenObject={(card, presentation) => {
                      openCardOrBook(card, presentation);
                    }}
                  />
                )}

                {layoutEngine === "posters" && (
                  <PosterWallLayout
                    items={visibleItems}
                    onOpenObject={(card, presentation) => {
                      openCardOrBook(card, presentation);
                    }}
                  />
                )}

                {/* Infinite Scroll Sentinel & Load More Fallback */}
                {nextCursor && (
                  <div ref={loadMoreSentinelRef} className="mt-10 flex justify-center py-4">
                    <button
                      type="button"
                      onClick={() =>
                        fetchItems({ reset: false, wishlist: wishOnly, cursor: nextCursor })
                      }
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 text-neutral-700 dark:text-neutral-200 shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{loadingMore ? "Loading more..." : "Load more saves"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Day-0 Cold-Start Importer Modal */}
      <ImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImported={() => {
          setIsImporterOpen(false);
          fetchItems({ reset: true });
          fetchLists();
        }}
      />

      <OpenBook3DModal
        book={openBookView}
        isOpen={Boolean(openBookView)}
        hasPrev={openBookIdx > 0}
        hasNext={openBookIdx >= 0 && openBookIdx < orderedBookViews.length - 1}
        onSelectAuthor={(author) => {
          setBookAuthorFilter(author);
          setBookSubFilter("ALL");
          setActiveListSlug("books");
        }}
        onPrev={() => {
          if (openBookIdx > 0) setOpenBookSaveId(orderedBookViews[openBookIdx - 1].saveId);
        }}
        onNext={() => {
          if (openBookIdx >= 0 && openBookIdx < orderedBookViews.length - 1) {
            setOpenBookSaveId(orderedBookViews[openBookIdx + 1].saveId);
          }
        }}
        onClose={() => setOpenBookSaveId(null)}
        onUpdated={() => {
          fetchItems({ reset: true });
          fetchLists();
          if (activeListSlug) refreshActiveBoard(activeListSlug);
        }}
        onOpenFullDossier={(book) => {
          setOpenBookSaveId(null);
          setLightboxPresentation("standard");
          setSelectedCard(book.card);
        }}
      />

      <FilmDetailModal
        film={openFilmView}
        isOpen={Boolean(openFilmView)}
        hasPrev={openFilmIdx > 0}
        hasNext={openFilmIdx >= 0 && openFilmIdx < orderedFilmViews.length - 1}
        onSelectDirector={(dir) => {
          setFilmDirectorFilter(dir);
          setFilmSubFilter("ALL");
          setActiveListSlug("films");
        }}
        onSelectGenre={(genre) => {
          setFilmGenreFilter(genre);
          setFilmSubFilter("ALL");
          setActiveListSlug("films");
        }}
        onPrev={() => {
          if (openFilmIdx > 0) setOpenFilmSaveId(orderedFilmViews[openFilmIdx - 1].saveId);
        }}
        onNext={() => {
          if (openFilmIdx >= 0 && openFilmIdx < orderedFilmViews.length - 1) {
            setOpenFilmSaveId(orderedFilmViews[openFilmIdx + 1].saveId);
          }
        }}
        onClose={() => setOpenFilmSaveId(null)}
        onUpdated={() => {
          fetchItems({ reset: true });
          fetchLists();
          if (activeListSlug) refreshActiveBoard(activeListSlug);
        }}
        onOpenFullDossier={(film) => {
          setOpenFilmSaveId(null);
          setLightboxPresentation("standard");
          setSelectedCard(film.card);
        }}
      />

      <LogBookModal
        isOpen={isLogBookOpen}
        onClose={() => setIsLogBookOpen(false)}
        onSaved={() => {
          fetchItems({ reset: true });
          fetchLists();
          if (activeListSlug) refreshActiveBoard(activeListSlug);
        }}
      />

      <GoodreadsSyncModal
        isOpen={isGoodreadsSyncOpen}
        status={goodreadsStatus}
        onClose={() => setIsGoodreadsSyncOpen(false)}
        onSynced={() => {
          fetchItems({ reset: true });
          fetchLists();
          if (activeListSlug) refreshActiveBoard(activeListSlug);
        }}
      />

      <LogFilmModal
        isOpen={isLogFilmOpen}
        onClose={() => setIsLogFilmOpen(false)}
        onSaved={() => {
          fetchItems({ reset: true });
          fetchLists();
          if (activeListSlug) refreshActiveBoard(activeListSlug);
        }}
      />

      <LetterboxdSyncModal
        isOpen={isLetterboxdSyncOpen}
        status={letterboxdStatus}
        onClose={() => setIsLetterboxdSyncOpen(false)}
        onSynced={() => {
          fetchItems({ reset: true });
          fetchLists();
          if (activeListSlug) refreshActiveBoard(activeListSlug);
        }}
      />

      <FilmAffinitySyncModal
        isOpen={isFilmAffinitySyncOpen}
        status={filmaffinityStatus}
        onClose={() => setIsFilmAffinitySyncOpen(false)}
        onSynced={() => {
          fetchItems({ reset: true });
          fetchLists();
          if (activeListSlug) refreshActiveBoard(activeListSlug);
        }}
      />

      {/* Synaptic Memory Edge Pairing Modal */}
      <PairingModal
        sourceCard={pairingCard}
        availableCards={pairableCards}
        isOpen={isPairingOpen}
        onClose={() => {
          setIsPairingOpen(false);
          setPairingCard(null);
        }}
        onPaired={() => {
          fetchItems({ reset: true });
          if (activeListSlug) refreshActiveBoard(activeListSlug);
          if (selectedCard) {
            const targetId = selectedCard.save.id;
            apiFetch(`/api/v1/connections?saveId=${encodeURIComponent(targetId)}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (Array.isArray(data?.connections)) {
                  setSelectedCard((prev) =>
                    prev && prev.save.id === targetId
                      ? { ...prev, connections: data.connections }
                      : prev
                  );
                }
              })
              .catch(() => {});
          }
        }}
      />

      {/* Curated Board Creation / Edit Modal */}
      <CreateListModal
        isOpen={isCreateListOpen}
        editingBoard={editingBoard}
        defaultParentId={createListParentId}
        availableBoards={lists.map((l) => ({ id: l.id, title: l.title }))}
        onClose={() => {
          setIsCreateListOpen(false);
          setEditingBoard(null);
          setCreateListParentId(null);
        }}
        onCreated={(newList) => {
          fetchLists();
          setActiveListSlug(newList.slug);
        }}
        onUpdated={(updatedList) => {
          fetchLists();
          refreshActiveBoard(updatedList.slug);
        }}
        onDeleted={(deletedSlug) => {
          fetchLists();
          if (activeListSlug === deletedSlug) {
            setActiveListSlug(null);
            setActiveListDetails(null);
          }
        }}
      />

      {/* Curio Learns Type Builder Modal */}
      <TypeBuilderModal
        isOpen={isTypeBuilderOpen}
        onClose={() => setIsTypeBuilderOpen(false)}
        onTypeCreated={() => {
          fetchItems({ reset: true });
          fetchLists();
        }}
      />

      {/* Deep Inspection & Cultural Mode Lightbox */}
      <CardLightboxModal
        card={selectedCard}
        isOpen={Boolean(selectedCard)}
        initialPresentation={lightboxPresentation}
        suppressEscape={isPairingOpen}
        creatorAffiliateTags={user?.affiliateTags}
        onClose={() => {
          setSelectedCard(null);
          setLightboxPresentation("standard");
        }}
        onConnect={
          selectedCard && !selectedCard.save.isPrivateMemo
            ? (card) => {
                setPairingCard(card);
                setIsPairingOpen(true);
              }
            : undefined
        }
        onUnlink={(connectionId) => {
          removeConnectionInPlace(connectionId);
          fetchItems({ reset: true });
          if (activeListSlug) refreshActiveBoard(activeListSlug);
        }}
        onCardUpdated={(updatedSave, updatedEntity) => {
          fetchItems({ reset: true });
          fetchLists();
          if (activeListSlug) refreshActiveBoard(activeListSlug);
          setSelectedCard((prev) =>
            prev && prev.save.id === updatedSave?.id
              ? {
                  ...prev,
                  save: {
                    ...prev.save,
                    ...updatedSave,
                  },
                  ...(updatedEntity !== undefined
                    ? {
                        entity: updatedEntity
                          ? { ...(prev.entity || {}), ...updatedEntity }
                          : prev.entity,
                      }
                    : {}),
                }
              : prev
          );
        }}
        onNavigateToBoard={(slug) => {
          setSelectedCard(null);
          setWishOnly(false);
          setActiveListSlug(slug);
        }}
        onCardDeleted={() => {
          setSelectedCard(null);
          fetchItems({ reset: true });
          fetchLists();
          if (activeListSlug) refreshActiveBoard(activeListSlug);
        }}
        onListUpdated={() => {
          fetchLists();
          if (activeListSlug) refreshActiveBoard(activeListSlug);
        }}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        defaultTab={authTab}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(authenticatedUser, token) => {
          if (typeof window !== "undefined" && token) {
            localStorage.setItem("curio_token", token);
          }
          setUser(authenticatedUser);
          setIsAuthOpen(false);
          fetchItems({ reset: true });
          fetchLists();
        }}
      />

      {/* 5-Step Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        initialUser={user}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={(completedUser) => {
          setUser(completedUser);
          fetchItems({ reset: true });
          fetchLists();
        }}
      />

      {/* Types & Schemas Settings Modal */}
      <TypesSettingsModal
        isOpen={isTypesModalOpen}
        onClose={() => setIsTypesModalOpen(false)}
        onOpenTypeBuilder={() => {
          setIsTypesModalOpen(false);
          setIsTypeBuilderOpen(true);
        }}
      />

      {/* Floating Dismissable Prompt: Create List for New Type */}
      {newTypePrompt && (
        <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-6 z-50 sm:max-w-sm p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-amber-300/80 dark:border-amber-800/80 shadow-2xl animate-in slide-in-from-bottom-5 duration-300 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  New type added: {newTypePrompt.name}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Would you like to create a dedicated list for your {newTypePrompt.name} saves?
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNewTypePrompt(null)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 cursor-pointer transition"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewTypePrompt(null)}
              className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer transition"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => handleCreateListForPrompt(newTypePrompt)}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition active:scale-95 cursor-pointer shadow-xs"
            >
              Create &ldquo;{newTypePrompt.listTitle}&rdquo; List
            </button>
          </div>
        </div>
      )}
    </main>
    </PullToRefresh>
  );
}
