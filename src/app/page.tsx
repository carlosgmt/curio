"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Omnibox } from "@/components/shapeshift/Omnibox";
import { PolymorphicCard, type CardData } from "@/components/cards/PolymorphicCard";
import { ImporterModal } from "@/components/importers/ImporterModal";
import { PairingModal } from "@/components/connections/PairingModal";
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
import { MasonryLayout, GridLayout, TimelineLayout } from "@/components/layout";
import { ViewModeSwitcher, type LayoutEngineType } from "@/components/layout/ViewModeSwitcher";
import type { SilhouetteDensity } from "@/components/cards/registry";
import {
  Sparkles,
  Layers,
  Upload,
  X,
} from "lucide-react";

export default function Home() {
  const [items, setItems] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
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
  const [dismissedOnboarding, setDismissedOnboarding] = useState(true);
  const [isTypesModalOpen, setIsTypesModalOpen] = useState(false);
  const [layoutEngine, setLayoutEngine] = useState<LayoutEngineType>("masonry");
  const [cardDensity, setCardDensity] = useState<SilhouetteDensity>("standard");
  const [newTypePrompt, setNewTypePrompt] = useState<{ key: string; name: string; coreType?: string } | null>(null);

  // Sync dismissal of "Bring in your collections" banner
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = localStorage.getItem("curio_dismissed_bring_collections") === "true";
      setDismissedOnboarding(isDismissed);
    }
  }, []);

  const handleDismissBringCollections = () => {
    setDismissedOnboarding(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("curio_dismissed_bring_collections", "true");
    }
  };

  const extractTypeInfo = (card: CardData): { key: string; name: string; coreType?: string } | null => {
    if (card.save.isPrivateMemo) return null;
    if (card.entity?.typePath && card.entity.typePath !== "/") {
      const segments = card.entity.typePath.split("/").filter(Boolean);
      const lastSeg = segments[segments.length - 1];
      const name = lastSeg.charAt(0).toUpperCase() + lastSeg.slice(1);
      return {
        key: card.entity.typePath.toLowerCase(),
        name,
        coreType: card.entity.coreType,
      };
    }
    if (card.entity?.coreType) {
      const raw = card.entity.coreType.toLowerCase();
      const name = raw === "media" ? "Cinema" : raw.charAt(0).toUpperCase() + raw.slice(1);
      return {
        key: card.entity.coreType.toLowerCase(),
        name,
        coreType: card.entity.coreType,
      };
    }
    if (card.save.typePath) {
      const segments = card.save.typePath.split("/").filter(Boolean);
      const lastSeg = segments[segments.length - 1] || "Custom";
      const name = lastSeg.charAt(0).toUpperCase() + lastSeg.slice(1);
      return {
        key: card.save.typePath.toLowerCase(),
        name,
      };
    }
    return null;
  };

  const handleCreateListForPrompt = async (typeInfo: { key: string; name: string; coreType?: string }) => {
    try {
      const listTitle = `${typeInfo.name}s`;
      const autoRules = typeInfo.coreType ? { coreType: typeInfo.coreType } : undefined;
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
        setUser(data.user);
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
      const newCard: CardData = {
        save: result.save,
        entity: result.entity,
        primarySource: result.primary_source,
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

      // Check if this is the first time adding on this type
      const typeInfo = extractTypeInfo(newCard);
      if (typeInfo && typeof window !== "undefined") {
        try {
          const promptedRaw = localStorage.getItem("curio_prompted_type_lists");
          const prompted: string[] = promptedRaw ? JSON.parse(promptedRaw) : [];
          if (!prompted.includes(typeInfo.key)) {
            const alreadyHadType = items.some((it) => {
              const t = extractTypeInfo(it);
              return t && t.key === typeInfo.key;
            });
            const listExists = lists.some(
              (l) =>
                l.title.toLowerCase() === `${typeInfo.name}s`.toLowerCase() ||
                l.title.toLowerCase() === typeInfo.name.toLowerCase()
            );

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
            fetchItems();
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
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-end mb-4">
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
              fetchItems();
              fetchLists();
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
      <div className="mb-8">
        <Omnibox
          onCaptured={handleCaptured}
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
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-3 border-b border-neutral-200/60 dark:border-neutral-800">
          <div>
            <h2 className="text-xl font-bold font-serif text-neutral-900 dark:text-neutral-100">
              My collections
            </h2>
            <p className="text-xs text-neutral-500">
              Showing {items.length} total saves
            </p>
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
            {/* View Mode Switcher */}
            <div className="flex items-center justify-end mb-6">
              <ViewModeSwitcher
                layout={layoutEngine}
                density={cardDensity}
                onLayoutChange={setLayoutEngine}
                onDensityChange={setCardDensity}
                className="shrink-0"
              />
            </div>

            {/* Feed Layout Engines */}
            {loading ? (
              <div className="text-center py-20 text-neutral-400 text-sm">
                Loading your collections...
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
                <p className="text-neutral-600 dark:text-neutral-300 font-medium text-sm mb-1">
                  No items in your collections yet.
                </p>
                <p className="text-neutral-400 text-xs max-w-sm mx-auto">
                  Capture a new thought above or import a CSV export from Letterboxd or Goodreads to seed your library.
                </p>
              </div>
            ) : (
              <div>
                {layoutEngine === "masonry" && (
                  <MasonryLayout
                    items={items}
                    renderItem={(item) => (
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
                    )}
                  />
                )}

                {layoutEngine === "grid" && (
                  <GridLayout
                    items={items}
                    renderItem={(item) => (
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
                    )}
                  />
                )}

                {layoutEngine === "timeline" && (
                  <TimelineLayout
                    items={items}
                    renderItem={(item) => (
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
                    )}
                  />
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
        onSuccess={(authenticatedUser, token) => {
          if (typeof window !== "undefined" && token) {
            localStorage.setItem("curio_token", token);
          }
          setUser(authenticatedUser);
          setIsAuthOpen(false);
          fetchItems();
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

      {/* Floating Dismissable Prompt: Create List for New Type */}
      {newTypePrompt && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-amber-300/80 dark:border-amber-800/80 shadow-2xl animate-in slide-in-from-bottom-5 duration-300 backdrop-blur-md">
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
              Create &ldquo;{newTypePrompt.name}s&rdquo; List
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
