"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
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
import { MasonryLayout, GridLayout, TimelineLayout, ShelfLayout } from "@/components/layout";
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
  Plus,
} from "lucide-react";
import { LogBookModal } from "@/components/library/LogBookModal";
import {
  GoodreadsSyncModal,
  type GoodreadsSyncStatusInfo,
} from "@/components/library/GoodreadsSyncModal";

const VALID_LAYOUT_MODES = new Set<LayoutEngineType>(["masonry", "grid", "timeline", "shelf"]);

function isShelfDefaultBoard(slug: string | null, wishOnly: boolean, isMyStuffDescendant = false): boolean {
  if (wishOnly) return true;
  if (!slug) return false;
  return (
    isMyStuffDescendant ||
    slug === "my-stuff" ||
    slug.startsWith("my-stuff-") ||
    slug === "books" ||
    slug === "films" ||
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
  if (dbDefault && VALID_LAYOUT_MODES.has(dbDefault as LayoutEngineType)) {
    return dbDefault as LayoutEngineType;
  }
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(`curio_board_layout:${getLayoutPreferenceKey(slug, wishOnly)}`);
    if (saved && VALID_LAYOUT_MODES.has(saved as LayoutEngineType)) {
      return saved as LayoutEngineType;
    }
  }
  return isShelfDefaultBoard(slug, wishOnly, isMyStuffDescendant) ? "shelf" : "masonry";
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
  const [isLogBookOpen, setIsLogBookOpen] = useState(false);
  const [isGoodreadsSyncOpen, setIsGoodreadsSyncOpen] = useState(false);
  const [goodreadsStatus, setGoodreadsStatus] =
    useState<GoodreadsSyncStatusInfo | null>(null);
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

  // Automatic Closet & Purchase Hub <-> Curio background sync on session start + tab focus
  useEffect(() => {
    if (!user) return;
    triggerClosetSync(false);
    triggerPurchaseHubSync(false);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        triggerClosetSync(false);
        triggerPurchaseHubSync(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [user, triggerClosetSync, triggerPurchaseHubSync]);

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

  const displayedBoardSections = useMemo(() => {
    if (!activeListDetails?.sections) return [];
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
  }, [activeListDetails, activeListSlug, garmentCategoryFilter, garmentSeasonFilter]);

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
        setLightboxPresentation("standard");
        setSelectedCard(card);
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
      disabled={Boolean(selectedCard) || isImporterOpen || isPairingOpen || isCreateListOpen || isTypeBuilderOpen || isTypesModalOpen || isAuthOpen || isOnboardingOpen || isLogBookOpen || isGoodreadsSyncOpen}
      onRefresh={() =>
        Promise.all([
          fetchItems({ reset: true, wishlist: wishOnly }),
          fetchLists(),
          refreshActiveBoard(),
          triggerClosetSync(false),
          triggerPurchaseHubSync(false),
          triggerBackgroundFeedSyncIfStale(false),
        ])
      }
    >
    <main className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-end gap-2.5 mb-4">
          <Link
            href="/library"
            data-testid="nav-personal-library"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 border border-neutral-200/60 dark:border-neutral-700/60 text-xs font-medium text-neutral-800 dark:text-neutral-200 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Library</span>
          </Link>
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
                        <Link
                          href="/library"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Open Personal Library →</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setIsLogBookOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition cursor-pointer"
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
                    <a
                      href={getApiUrl(`/list/${activeListDetails.list.slug}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 transition"
                    >
                      <span>View Public Board ↗</span>
                    </a>
                  </div>
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
                    setLightboxPresentation(presentation || "standard");
                    setSelectedCard(card);
                  }}
                />
              ) : (
                <div className="text-center py-20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
                  <p className="text-neutral-600 dark:text-neutral-300 font-medium text-sm mb-1">
                    {activeListSlug === "wardrobe" && (garmentCategoryFilter !== "ALL" || garmentSeasonFilter !== "ALL")
                      ? "No garments match the selected filters."
                      : "This board is currently empty."}
                  </p>
                  <p className="text-neutral-400 text-xs max-w-sm mx-auto mb-4">
                    {activeListSlug === "wardrobe" && (garmentCategoryFilter !== "ALL" || garmentSeasonFilter !== "ALL")
                      ? "Try selecting a different category or season combination."
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
                      setLightboxPresentation(presentation || "standard");
                      setSelectedCard(card);
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
