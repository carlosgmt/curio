"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Omnibox } from "@/components/shapeshift/Omnibox";
import { PolymorphicCard, type CardData } from "@/components/cards/PolymorphicCard";
import { ImporterModal } from "@/components/importers/ImporterModal";
import { PairingModal } from "@/components/connections/PairingModal";
import { QuotaIndicator } from "@/components/shapeshift/QuotaIndicator";
import { ListTabsBar } from "@/components/lists/ListTabsBar";
import { CreateListModal } from "@/components/lists/CreateListModal";
import { SectionGroupView } from "@/components/lists/SectionGroupView";
import { CardLightboxModal } from "@/components/lightbox/CardLightboxModal";
import { TypeBuilderModal } from "@/components/shapeshift/TypeBuilderModal";
import { TypesSettingsModal } from "@/components/types/TypesSettingsModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { UserNav } from "@/components/layout/UserNav";
import { CurioLandingVitrine } from "@/components/landing/CurioLandingVitrine";
import { apiFetch } from "@/lib/apiClient";
import type { SmartList } from "@/db";
import type { ListWithSections } from "@/lib/lists/service";
import {
  Sparkles,
  Layers,
  ShieldCheck,
  Zap,
  Upload,
  Disc3,
  Film,
  BookOpen,
  Wine,
  Frame,
  UtensilsCrossed,
  MapPin,
  Lock,
  Gamepad2,
  ShoppingBag,
} from "lucide-react";

type FilterTab =
  | "all"
  | "cinema"
  | "games"
  | "vinyl"
  | "books"
  | "products"
  | "places"
  | "wine"
  | "art"
  | "recipes"
  | "memos";

export default function Home() {
  const [items, setItems] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [pairingCard, setPairingCard] = useState<CardData | null>(null);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [lists, setLists] = useState<Array<SmartList & { itemCount: number }>>([]);
  const [activeListSlug, setActiveListSlug] = useState<string | null>(null);
  const [activeListDetails, setActiveListDetails] = useState<ListWithSections | null>(null);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isTypeBuilderOpen, setIsTypeBuilderOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isTypesModalOpen, setIsTypesModalOpen] = useState(false);

  const fetchCurrentUser = async () => {
    try {
      const res = await apiFetch("/api/v1/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.user && !data.user.onboardingCompleted) {
          setIsOnboardingOpen(true);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to check auth status:", err);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const res = await apiFetch("/api/v1/capture");
      if (res.ok) {
        const data = await res.json();
        setItems(data.saves || []);
      }
    } catch (err) {
      console.error("Failed to load items:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLists = async () => {
    try {
      const res = await apiFetch("/api/v1/lists");
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists || []);
      }
    } catch (err) {
      console.error("Failed to load lists:", err);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchItems();
    fetchLists();

    // Check for ?onboarding=true redirection from registration
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("onboarding") === "true") {
        setIsOnboardingOpen(true);
      }
    }
  }, []);

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

  const handleCaptured = (result: any) => {
    if (result.save) {
      setItems((prev) => [
        {
          save: result.save,
          entity: result.entity,
          primarySource: result.primary_source,
        },
        ...prev,
      ]);
    }
  };

  // Filter items dynamically based on selected tab
  const filteredItems = useMemo(() => {
    if (activeTab === "all") return items;

    return items.filter((item) => {
      const isMemo = item.save.isPrivateMemo || !item.entity;
      if (activeTab === "memos") return isMemo;
      if (isMemo) return false;

      const typePath = (item.entity?.typePath || item.save.typePath || "").toLowerCase();
      const coreType = (item.entity?.coreType || "").toUpperCase();
      const title = (item.entity?.title || "").toLowerCase();
      const tags = (item.save.autoTags || []).map((t) => t.toLowerCase());

      switch (activeTab) {
        case "cinema":
          return (
            typePath.includes("film") ||
            typePath.includes("movie") ||
            coreType === "MEDIA" ||
            tags.includes("film") ||
            tags.includes("movie")
          );
        case "games":
          return (
            typePath.includes("videogame") ||
            typePath.includes("game") ||
            coreType === "VIDEOGAME" ||
            tags.includes("game") ||
            tags.includes("gaming") ||
            tags.includes("steam")
          );
        case "vinyl":
          return (
            typePath.includes("vinyl") ||
            tags.includes("vinyl") ||
            tags.includes("album") ||
            title.includes("vinyl") ||
            title.includes("lp")
          );
        case "books":
          return typePath.includes("book") || coreType === "BOOK" || tags.includes("book");
        case "products":
          return (
            typePath === "/product" ||
            typePath.startsWith("/product/garment") ||
            typePath.startsWith("/product/cosmetic") ||
            typePath.startsWith("/product/electronic") ||
            coreType === "PRODUCT" ||
            tags.includes("product") ||
            tags.includes("garment") ||
            tags.includes("clothing") ||
            tags.includes("electronics") ||
            tags.includes("cosmetics") ||
            tags.includes("gadget")
          );
        case "places":
          return (
            typePath.includes("place") ||
            typePath.includes("trail") ||
            typePath.includes("restaurant") ||
            typePath.includes("cafe") ||
            typePath.includes("hotel") ||
            typePath.includes("shop") ||
            typePath.includes("bar") ||
            coreType === "PLACE" ||
            tags.includes("place") ||
            tags.includes("restaurant") ||
            tags.includes("cafe") ||
            tags.includes("hotel") ||
            tags.includes("trail")
          );
        case "wine":
          return (
            typePath.includes("wine") ||
            tags.includes("wine") ||
            title.includes("wine") ||
            title.includes("domaine") ||
            title.includes("château")
          );
        case "art":
          return typePath.includes("art") || tags.includes("art") || tags.includes("painting");
        case "recipes":
          return (
            typePath.includes("recipe") ||
            typePath.includes("culinary") ||
            coreType === "CULINARY" ||
            tags.includes("recipe")
          );
        default:
          return true;
      }
    });
  }, [items, activeTab]);

  const tabs: Array<{ id: FilterTab; label: string; icon: React.ReactNode }> = [
    { id: "all", label: "All Curations", icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "cinema", label: "Cinema", icon: <Film className="w-3.5 h-3.5" /> },
    { id: "games", label: "Video Games", icon: <Gamepad2 className="w-3.5 h-3.5" /> },
    { id: "vinyl", label: "Vinyl LPs", icon: <Disc3 className="w-3.5 h-3.5" /> },
    { id: "books", label: "Books", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: "products", label: "Products & Gear", icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: "places", label: "Places & Venues", icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: "wine", label: "Estate Wine", icon: <Wine className="w-3.5 h-3.5" /> },
    { id: "art", label: "Fine Art", icon: <Frame className="w-3.5 h-3.5" /> },
    { id: "recipes", label: "Recipes", icon: <UtensilsCrossed className="w-3.5 h-3.5" /> },
    { id: "memos", label: "Private Vault", icon: <Lock className="w-3.5 h-3.5" /> },
  ];

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
          onSuccess={(authenticatedUser, _token, isRegister) => {
            setUser(authenticatedUser);
            fetchItems();
            fetchLists();
            if (isRegister || !authenticatedUser.onboardingCompleted) {
              setIsOnboardingOpen(true);
            }
          }}
        />

        {/* Onboarding Modal */}
        <OnboardingModal
          isOpen={isOnboardingOpen}
          initialUser={user}
          onClose={() => setIsOnboardingOpen(false)}
          onComplete={(completedUser) => {
            setUser(completedUser);
            fetchItems();
            fetchLists();
          }}
        />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100" />
              Autonomous Memory & Taste Graph • PRD v3.2
            </div>
            <button
              type="button"
              onClick={() => setIsTypesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition cursor-pointer"
            >
              <Layers className="w-3 h-3" />
              <span>Types & Schemas</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <QuotaIndicator />
            <UserNav
              user={user}
              onOpenAuth={(tab = "login") => {
                setAuthTab(tab);
                setIsAuthOpen(true);
              }}
              onOpenOnboarding={() => setIsOnboardingOpen(true)}
              onOpenTypesSettings={() => setIsTypesModalOpen(true)}
              onLogout={async () => {
                await apiFetch("/api/v1/auth/logout", { method: "POST" });
                setUser(null);
                fetchItems();
                fetchLists();
              }}
            />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 mb-3 font-serif">
            Curio
          </h1>
          <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
            Capture at Keep speed. Curate with Pinterest elegance. Engineered for Agents.
          </p>
        </div>
      </div>

      {/* Omnibox Universal Capture */}
      <div className="mb-12">
        <Omnibox
          onCaptured={handleCaptured}
          onOpenTypeBuilder={() => setIsTypeBuilderOpen(true)}
        />
      </div>

      {/* System Highlights */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/60 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-800">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Step 0 Privacy Gate isolates confidential memos</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/60 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-800">
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          <span>7 Polymorphic Physical "Artifact-as-Card" Silhouettes</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/60 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-800">
          <Layers className="w-4 h-4 text-blue-500 shrink-0" />
          <span>Multi-Merchant waterfall routing & affiliate links</span>
        </div>
      </div>

      {/* Memory & Taste Stream Feed */}
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-3 border-b border-neutral-200/60 dark:border-neutral-800">
          <div>
            <h2 className="text-xl font-bold font-serif text-neutral-900 dark:text-neutral-100">
              Taste Stream
            </h2>
            <p className="text-xs text-neutral-500">
              Showing {filteredItems.length} of {items.length} total saves
            </p>
          </div>

          {/* Action Buttons: Teach Type & Day-0 Importer */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setIsTypeBuilderOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-neutral-400 dark:hover:border-neutral-600 shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>+ Teach Type</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImporterOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>
          </div>
        </div>

        {/* Curated Boards & Smart Lists Tabs Bar */}
        <ListTabsBar
          lists={lists}
          activeListSlug={activeListSlug}
          totalAllSavesCount={items.length}
          onSelectList={setActiveListSlug}
          onCreateListClick={() => setIsCreateListOpen(true)}
        />

        {/* Content View: Board View vs Taste Stream Feed */}
        {activeListSlug !== null ? (
          <div>
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
                  <a
                    href={`/list/${activeListDetails.list.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 text-neutral-800 dark:text-neutral-200 self-start sm:self-auto transition"
                  >
                    <span>View Public Board ↗</span>
                  </a>
                </div>
              </div>
            )}

            {/* Section Group View */}
            {activeListDetails ? (
              <SectionGroupView
                sections={activeListDetails.sections}
                onConnect={(card) => {
                  setPairingCard(card);
                  setIsPairingOpen(true);
                }}
                onSwapped={() => {
                  fetchItems();
                  fetchLists();
                }}
                onUnlink={() => {
                  fetchItems();
                  fetchLists();
                }}
                onCardClick={(card) => setSelectedCard(card)}
              />
            ) : (
              <div className="text-center py-20 text-neutral-400 text-sm">
                Loading board...
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Archetype Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-8 scrollbar-none">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                      : "bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Feed Grid */}
            {loading ? (
              <div className="text-center py-20 text-neutral-400 text-sm">
                Loading your taste graph...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
                <p className="text-neutral-600 dark:text-neutral-300 font-medium text-sm mb-1">
                  No items in this category yet.
                </p>
                <p className="text-neutral-400 text-xs max-w-sm mx-auto">
                  Capture a new thought above or import a CSV export from Letterboxd or Goodreads to seed your library.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((item) => (
                  <PolymorphicCard
                    key={item.save.id}
                    item={item}
                    onCardClick={(card) => setSelectedCard(card)}
                    onConnect={(card) => {
                      setPairingCard(card);
                      setIsPairingOpen(true);
                    }}
                    onSwapped={() => fetchItems()}
                    onUnlink={() => fetchItems()}
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
                ))}
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
          fetchItems();
        }}
      />

      {/* Synaptic Memory Edge Pairing Modal */}
      <PairingModal
        sourceCard={pairingCard}
        availableCards={items}
        isOpen={isPairingOpen}
        onClose={() => {
          setIsPairingOpen(false);
          setPairingCard(null);
        }}
        onPaired={() => {
          fetchItems();
        }}
      />

      {/* Curated Board Creation Modal */}
      <CreateListModal
        isOpen={isCreateListOpen}
        onClose={() => setIsCreateListOpen(false)}
        onCreated={(newList) => {
          fetchLists();
          setActiveListSlug(newList.slug);
        }}
      />

      {/* Curio Learns Type Builder Modal */}
      <TypeBuilderModal
        isOpen={isTypeBuilderOpen}
        onClose={() => setIsTypeBuilderOpen(false)}
        onTypeCreated={() => {
          fetchItems();
          fetchLists();
        }}
      />

      {/* Deep Inspection & Cultural Mode Lightbox */}
      <CardLightboxModal
        card={selectedCard}
        isOpen={Boolean(selectedCard)}
        creatorAffiliateTags={user?.affiliateTags}
        onClose={() => setSelectedCard(null)}
        onCardUpdated={(updatedSave) => {
          fetchItems();
          if (activeListSlug) fetchLists();
          setSelectedCard((prev) =>
            prev && prev.save.id === updatedSave?.id
              ? {
                  ...prev,
                  save: {
                    ...prev.save,
                    ...updatedSave,
                  },
                }
              : prev
          );
        }}
        onCardDeleted={() => {
          setSelectedCard(null);
          fetchItems();
          if (activeListSlug) fetchLists();
        }}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        defaultTab={authTab}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(authenticatedUser, _token, isRegister) => {
          setUser(authenticatedUser);
          fetchItems();
          fetchLists();
          if (isRegister || !authenticatedUser.onboardingCompleted) {
            setIsOnboardingOpen(true);
          }
        }}
      />

      {/* 5-Step Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        initialUser={user}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={(completedUser) => {
          setUser(completedUser);
          fetchItems();
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
    </main>
  );
}
