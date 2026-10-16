"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Omnibox } from "@/components/shapeshift/Omnibox";
import { PolymorphicCard, type CardData } from "@/components/cards/PolymorphicCard";
import { ImporterModal } from "@/components/importers/ImporterModal";
import { PairingModal } from "@/components/connections/PairingModal";
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
} from "lucide-react";

type FilterTab =
  | "all"
  | "vinyl"
  | "cinema"
  | "books"
  | "wine"
  | "art"
  | "recipes"
  | "places"
  | "memos";

export default function Home() {
  const [items, setItems] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [pairingCard, setPairingCard] = useState<CardData | null>(null);
  const [isPairingOpen, setIsPairingOpen] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/v1/capture");
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

  useEffect(() => {
    fetchItems();
  }, []);

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
        case "vinyl":
          return (
            typePath.includes("vinyl") ||
            tags.includes("vinyl") ||
            tags.includes("album") ||
            title.includes("vinyl") ||
            title.includes("lp")
          );
        case "cinema":
          return (
            typePath.includes("film") ||
            typePath.includes("movie") ||
            coreType === "MEDIA" ||
            tags.includes("film") ||
            tags.includes("movie")
          );
        case "books":
          return typePath.includes("book") || coreType === "BOOK" || tags.includes("book");
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
        case "places":
          return (
            typePath.includes("place") ||
            typePath.includes("trail") ||
            coreType === "PLACE" ||
            tags.includes("place") ||
            tags.includes("trail")
          );
        default:
          return true;
      }
    });
  }, [items, activeTab]);

  const tabs: Array<{ id: FilterTab; label: string; icon: React.ReactNode }> = [
    { id: "all", label: "All Curations", icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "vinyl", label: "Vinyl LPs", icon: <Disc3 className="w-3.5 h-3.5" /> },
    { id: "cinema", label: "Cinema", icon: <Film className="w-3.5 h-3.5" /> },
    { id: "books", label: "Books", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: "wine", label: "Estate Wine", icon: <Wine className="w-3.5 h-3.5" /> },
    { id: "art", label: "Fine Art", icon: <Frame className="w-3.5 h-3.5" /> },
    { id: "recipes", label: "Recipes", icon: <UtensilsCrossed className="w-3.5 h-3.5" /> },
    { id: "places", label: "Passes & Trails", icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: "memos", label: "Private Vault", icon: <Lock className="w-3.5 h-3.5" /> },
  ];

  return (
    <main className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 text-xs font-semibold tracking-wide uppercase mb-4">
          <Sparkles className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100" />
          Autonomous Memory & Taste Graph • PRD v3.2
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 mb-3 font-serif">
          Curio
        </h1>
        <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
          Capture at Keep speed. Curate with Pinterest elegance. Engineered for Agents.
        </p>
      </div>

      {/* Omnibox Universal Capture */}
      <div className="mb-12">
        <Omnibox onCaptured={handleCaptured} />
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

          {/* Action Button: Day-0 Importer */}
          <button
            type="button"
            onClick={() => setIsImporterOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-sm transition active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV (Letterboxd / Goodreads)</span>
          </button>
        </div>

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
                onConnect={(card) => {
                  setPairingCard(card);
                  setIsPairingOpen(true);
                }}
                onSwapped={() => fetchItems()}
                onUnlink={() => fetchItems()}
              />
            ))}
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
    </main>
  );
}
