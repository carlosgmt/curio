"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Layers,
  Sparkles,
  Plus,
  Code2,
  Eye,
  Fingerprint,
  Languages,
  Search,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Tag,
  Film,
  Disc3,
  BookOpen,
  Wine,
  Frame,
  UtensilsCrossed,
  MapPin,
  Lock,
  Gamepad2,
  ShoppingBag,
  Shirt,
  Cpu,
} from "lucide-react";
import { PolymorphicCard, type CardData } from "../cards/PolymorphicCard";
import { TypeBuilderModal } from "../shapeshift/TypeBuilderModal";
import { apiFetch } from "@/lib/apiClient";

export interface TypesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTypeBuilder?: () => void;
}

export interface CurioTypeRecord {
  id: string;
  name: string;
  typePath: string;
  rootArchetype: string;
  defaultSilhouette: string;
  identityRules?: {
    hardExternalIdKeys?: string[];
    fingerprintFields?: string[];
  } | null;
  jsonSchema?: any;
  ownJsonSchema?: any;
  effectiveJsonSchema?: any;
  uiFieldConfig?: Array<{
    key: string;
    label: string;
    primitive: string;
    isPublicObjective: boolean;
  }> | null;
  extractionPrompt?: string | null;
  localizedAliases?: Record<string, string> | null;
  userId?: string | null;
}

// Fallback preview archetypes with rich mock data for live silhouette review
const PREVIEW_CARDS: Record<string, CardData> = {
  "/media/videogame": {
    save: {
      id: "preview-game",
      isPrivateMemo: false,
      createdAt: new Date(),
      autoTags: ["videogame", "rpg", "goty"],
    },
    entity: {
      id: "ent-game",
      title: "Elden Ring: Shadow of the Erdtree",
      summary: "Guided by Empyrean Miquella, players are beckoned to the Land of Shadow, a place obscured by the Erdtree.",
      heroImageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80",
      coreType: "VIDEOGAME",
      typePath: "/media/videogame",
      canonicalUrl: "https://store.steampowered.com/app/2778580/ELDEN_RING_Shadow_of_the_Erdtree/",
      priceCents: 3999,
      currency: "USD",
      coreStructuredData: {
        developer: "FromSoftware Inc.",
        publisher: "Bandai Namco",
        releaseYear: 2024,
        platforms: ["PC", "PS5", "Xbox Series X"],
        genre: "Action RPG",
        playtimeHours: 42,
        esrbRating: "M",
        storeUrl: "https://store.steampowered.com/app/2778580/ELDEN_RING_Shadow_of_the_Erdtree/",
      },
    },
  },
  "/place": {
    save: {
      id: "preview-place",
      isPrivateMemo: false,
      createdAt: new Date(),
      autoTags: ["restaurant", "dining", "tokyo"],
    },
    entity: {
      id: "ent-place",
      title: "L'Effervescence",
      summary: "Three Michelin-starred French restaurant with deep Japanese artisanal terroir in Nishi-Azabu.",
      heroImageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
      coreType: "PLACE",
      typePath: "/place",
      canonicalUrl: "https://maps.google.com/?q=L'Effervescence+Tokyo",
      priceCents: 28000,
      currency: "JPY",
      coreStructuredData: {
        category: "restaurant",
        address: "2-26-4 Nishi-Azabu, Minato City",
        neighborhood: "Nishi-Azabu",
        city: "Tokyo",
        coordinates: "35.6586° N, 139.7206° E",
        priceTier: "$$$$",
        openingHours: "17:30 - 23:00",
      },
    },
  },
  "/product": {
    save: {
      id: "preview-product",
      isPrivateMemo: false,
      createdAt: new Date(),
      autoTags: ["product", "hardware", "audio"],
    },
    entity: {
      id: "ent-prod",
      title: "WH-1000XM5 Noise Canceling Headphones",
      summary: "Industry-leading noise canceling with two processors and eight microphones for unprecedented sound.",
      heroImageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
      coreType: "PRODUCT",
      typePath: "/product",
      canonicalUrl: "https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b",
      priceCents: 39999,
      currency: "USD",
      coreStructuredData: {
        brand: "Sony",
        model: "WH-1000XM5",
        ean: "4548736132580",
        asin: "B09XS7JWHH",
        availability: "in_stock",
        merchantName: "Sony Electronics",
        buyUrl: "https://www.amazon.com/dp/B09XS7JWHH",
      },
    },
  },
  "/product/garment": {
    save: {
      id: "preview-garment",
      isPrivateMemo: false,
      createdAt: new Date(),
      autoTags: ["apparel", "knitwear", "menswear"],
    },
    entity: {
      id: "ent-garment",
      title: "Chunky Ribbed Wool Crewneck",
      summary: "Heavyweight 7-gauge British lambswool crewneck sweater with saddle shoulder construction.",
      heroImageUrl: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80",
      coreType: "PRODUCT",
      typePath: "/product/garment",
      canonicalUrl: "https://www.inverallanknitwear.com",
      priceCents: 34000,
      currency: "USD",
      coreStructuredData: {
        brand: "Inverallan of Scotland",
        size: "42 (L)",
        material: "100% Lambswool",
        color: "Oatmeal Melange",
        season: "Autumn / Winter",
        genderCut: "unisex",
        careInstructions: "Hand wash cold, dry flat",
        buyUrl: "https://www.inverallanknitwear.com",
      },
    },
  },
  "/product/cosmetics": {
    save: {
      id: "preview-cosmetic",
      isPrivateMemo: false,
      createdAt: new Date(),
      autoTags: ["beauty", "skincare", "serum"],
    },
    entity: {
      id: "ent-cosmetic",
      title: "C-Firma Fresh Day Serum",
      summary: "Potent 15% vitamin C day serum packed with a powerful antioxidant complex, essential nutrients, and fruit enzymes.",
      heroImageUrl: "https://images.unsplash.com/photo-1608248597359-597545920678?auto=format&fit=crop&w=800&q=80",
      coreType: "PRODUCT",
      typePath: "/product/cosmetics",
      canonicalUrl: "https://www.drunkelephant.com",
      priceCents: 7800,
      currency: "USD",
      coreStructuredData: {
        brand: "Drunk Elephant",
        volumeOrWeight: "28 ml / 1 fl oz",
        skinOrHairType: "All skin types",
        formulation: "serum",
        activeIngredients: "15% L-Ascorbic Acid, 0.5% Ferulic Acid, 1% Vitamin E",
        crueltyFree: true,
        buyUrl: "https://www.drunkelephant.com",
      },
    },
  },
  "/product/electronics": {
    save: {
      id: "preview-elec",
      isPrivateMemo: false,
      createdAt: new Date(),
      autoTags: ["electronics", "tech", "audio"],
    },
    entity: {
      id: "ent-elec",
      title: "Teenage Engineering OP-1 Field",
      summary: "Portable synthesizer, sampler and 4-track sequencer with aluminium unibody and 100-step sequencer.",
      heroImageUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80",
      coreType: "PRODUCT",
      typePath: "/product/electronics",
      canonicalUrl: "https://teenage.engineering/store/op-1-field",
      priceCents: 199900,
      currency: "USD",
      coreStructuredData: {
        brand: "Teenage Engineering",
        modelNumber: "TE-OP1F",
        specsSummary: "Stereo 24-bit/96kHz audio, 32-bit internal architecture, Bluetooth MIDI, FM transmitter",
        connectivity: "USB-C, 3.5mm in/out, FM radio, Bluetooth LE",
        batteryLife: "24 hours",
        powerWatts: 15,
        buyUrl: "https://teenage.engineering/store/op-1-field",
      },
    },
  },
  "/media/film": {
    save: {
      id: "preview-film",
      isPrivateMemo: false,
      createdAt: new Date(),
      autoTags: ["film", "cinema", "criterion"],
    },
    entity: {
      id: "ent-film",
      title: "In the Mood for Love",
      summary: "Two neighbors form a strong bond after both suspect extramarital activities of their spouses in 1962 British Hong Kong.",
      heroImageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80",
      coreType: "MEDIA",
      typePath: "/media/film",
      canonicalUrl: "https://mubi.com/films/in-the-mood-for-love",
      coreStructuredData: {
        director: "Wong Kar-wai",
        releaseYear: 2000,
        runtimeMinutes: 98,
        cinematographer: "Christopher Doyle & Mark Lee Ping-bin",
        distributor: "Block 2 Pictures / Criterion",
      },
    },
  },
  "/media/music/vinyl": {
    save: {
      id: "preview-vinyl",
      isPrivateMemo: false,
      createdAt: new Date(),
      autoTags: ["vinyl", "music", "jazz"],
    },
    entity: {
      id: "ent-vinyl",
      title: "A Love Supreme",
      summary: "Recorded in a single session at Van Gelder Studio, John Coltrane's four-part suite masterpiece.",
      heroImageUrl: "https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=800&q=80",
      coreType: "MEDIA",
      typePath: "/media/music/vinyl",
      canonicalUrl: "https://open.spotify.com/album/7e8962rJPZLdp1jZqq99J9",
      coreStructuredData: {
        artist: "John Coltrane",
        album: "A Love Supreme",
        releaseYear: 1965,
        rpm: "33",
        catalogNumber: "AS-77",
        recordLabel: "Impulse! Records",
        gatefold: true,
      },
    },
  },
};

export function TypesSettingsModal({
  isOpen,
  onClose,
  onOpenTypeBuilder,
}: TypesSettingsModalProps) {
  const [types, setTypes] = useState<CurioTypeRecord[]>([]);
  const [selectedTypePath, setSelectedTypePath] = useState<string>("/place");
  const [activeTab, setActiveTab] = useState<"preview" | "schema" | "identity" | "aliases">("preview");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTypeBuilderOpen, setIsTypeBuilderOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    apiFetch("/api/v1/types")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.types && data.types.length > 0) {
          setTypes(data.types);
        }
      })
      .catch((err) => console.error("Failed to fetch types:", err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const filteredTypes = useMemo(() => {
    if (!searchQuery.trim()) return types;
    const q = searchQuery.toLowerCase();
    return types.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.typePath.toLowerCase().includes(q) ||
        t.rootArchetype.toLowerCase().includes(q)
    );
  }, [types, searchQuery]);

  const selectedType = useMemo(() => {
    return (
      types.find((t) => t.typePath === selectedTypePath) ||
      types[0] ||
      null
    );
  }, [types, selectedTypePath]);

  if (!isOpen) return null;

  const getArchetypeIcon = (root: string, path: string) => {
    if (path.includes("videogame")) return <Gamepad2 className="w-4 h-4 text-indigo-500" />;
    if (path.includes("garment")) return <Shirt className="w-4 h-4 text-emerald-500" />;
    if (path.includes("cosmetics")) return <Sparkles className="w-4 h-4 text-rose-500" />;
    if (path.includes("electronics")) return <Cpu className="w-4 h-4 text-blue-500" />;
    if (path.includes("place")) return <MapPin className="w-4 h-4 text-amber-500" />;
    if (path.includes("wine")) return <Wine className="w-4 h-4 text-rose-600" />;
    if (path.includes("recipe")) return <UtensilsCrossed className="w-4 h-4 text-orange-500" />;
    if (path.includes("vinyl")) return <Disc3 className="w-4 h-4 text-purple-500" />;
    if (path.includes("film")) return <Film className="w-4 h-4 text-amber-500" />;
    if (path.includes("art")) return <Frame className="w-4 h-4 text-indigo-400" />;
    if (root === "PRODUCT") return <ShoppingBag className="w-4 h-4 text-blue-500" />;
    if (root === "PLACE") return <MapPin className="w-4 h-4 text-emerald-500" />;
    if (root === "MEMO") return <Lock className="w-4 h-4 text-neutral-400" />;
    return <BookOpen className="w-4 h-4 text-neutral-500" />;
  };

  // Build a preview CardData for the selected type
  const previewItem: CardData = PREVIEW_CARDS[selectedType?.typePath || ""] || {
    save: {
      id: `preview-${selectedType?.id || "custom"}`,
      isPrivateMemo: selectedType?.rootArchetype === "MEMO",
      createdAt: new Date(),
      autoTags: [selectedType?.name?.toLowerCase() || "custom"],
    },
    entity: {
      id: `ent-${selectedType?.id || "custom"}`,
      title: `Sample ${selectedType?.name || "Entry"}`,
      summary: selectedType?.extractionPrompt || "Demonstration of the tactile card silhouette.",
      heroImageUrl: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80",
      coreType: selectedType?.rootArchetype || "PRODUCT",
      typePath: selectedType?.typePath || "/product",
      canonicalUrl: "https://curio.local",
      coreStructuredData: {},
    },
  };

  const uiFields = selectedType?.uiFieldConfig || [];
  const schemaProps = selectedType?.effectiveJsonSchema?.properties || selectedType?.jsonSchema?.properties || {};
  const schemaRequired = selectedType?.effectiveJsonSchema?.required || selectedType?.jsonSchema?.required || [];
  const hardExternalIds = selectedType?.identityRules?.hardExternalIdKeys || [];
  const fingerprintFields = selectedType?.identityRules?.fingerprintFields || [];
  const aliases = selectedType?.localizedAliases || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold font-sans tracking-tight flex items-center gap-2">
                Curio Types & Schemas
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  {types.length} Active Archetypes
                </span>
              </h2>
              <p className="text-xs text-neutral-500 font-sans">
                Review, inspect, and customize physical silhouettes, JSON schemas, and deduplication rules.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (onOpenTypeBuilder) {
                  onOpenTypeBuilder();
                } else {
                  setIsTypeBuilderOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 text-xs font-semibold transition active:scale-95 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Custom Subtype</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2-Column Main Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Archetypes List */}
          <div className="w-72 sm:w-80 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50/40 dark:bg-neutral-950/20 shrink-0">
            {/* Search Box */}
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Filter types or aliases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs focus:outline-hidden focus:ring-1 focus:ring-neutral-400 font-sans"
                />
              </div>
            </div>

            {/* List of Types */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredTypes.map((t) => {
                const isSelected = t.typePath === selectedType?.typePath;
                return (
                  <button
                    key={t.id || t.typePath}
                    type="button"
                    onClick={() => setSelectedTypePath(t.typePath)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-left transition cursor-pointer ${
                      isSelected
                        ? "bg-white dark:bg-neutral-800 shadow-xs border border-neutral-200 dark:border-neutral-700 font-bold"
                        : "hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-neutral-100 dark:bg-neutral-850 flex items-center justify-center shrink-0">
                        {getArchetypeIcon(t.rootArchetype, t.typePath)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-neutral-900 dark:text-neutral-100 truncate">
                          {t.name}
                        </div>
                        <div className="font-mono text-[10px] text-neutral-400 truncate">
                          {t.typePath}
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                        isSelected ? "text-neutral-900 dark:text-white" : "text-neutral-300 dark:text-neutral-600"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Type Inspector */}
          {selectedType ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
              {/* Type Hero Banner */}
              <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-900 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    {getArchetypeIcon(selectedType.rootArchetype, selectedType.typePath)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-sans tracking-tight flex items-center gap-2">
                      {selectedType.name}
                      {selectedType.userId && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Custom Subtype
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs text-neutral-500">
                        {selectedType.typePath}
                      </span>
                      <span className="text-neutral-300 dark:text-neutral-700">•</span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                        Root: {selectedType.rootArchetype}
                      </span>
                      <span className="text-neutral-300 dark:text-neutral-700">•</span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                        Silhouette: {selectedType.defaultSilhouette || "default"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tab Pill Buttons */}
                <div className="flex items-center p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      activeTab === "preview"
                        ? "bg-white dark:bg-neutral-900 shadow-2xs text-neutral-900 dark:text-white"
                        : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Card Silhouette</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("schema")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      activeTab === "schema"
                        ? "bg-white dark:bg-neutral-900 shadow-2xs text-neutral-900 dark:text-white"
                        : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>JSON Schema</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("identity")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      activeTab === "identity"
                        ? "bg-white dark:bg-neutral-900 shadow-2xs text-neutral-900 dark:text-white"
                        : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    <span>Identity Rules</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("aliases")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      activeTab === "aliases"
                        ? "bg-white dark:bg-neutral-900 shadow-2xs text-neutral-900 dark:text-white"
                        : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    <Languages className="w-3.5 h-3.5" />
                    <span>Aliases</span>
                  </button>
                </div>
              </div>

              {/* Tab Content Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* TAB 1: Live Card Silhouette Preview */}
                {activeTab === "preview" && (
                  <div className="flex flex-col items-center justify-center min-h-full py-4">
                    <div className="text-center mb-6 max-w-md">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500 font-bold block mb-1">
                        Tactile Silhouette Preview
                      </span>
                      <h4 className="font-serif text-lg font-bold">
                        {selectedType.name} Physical Silhouette
                      </h4>
                      <p className="text-xs text-neutral-500 mt-1">
                        Rendered using authentic tactile card geometry, metadata slots, and utility deep-link integrations.
                      </p>
                    </div>

                    <div className="w-full max-w-sm drop-shadow-xl">
                      <PolymorphicCard item={previewItem} />
                    </div>
                  </div>
                )}

                {/* TAB 2: JSON Schema & Field Config */}
                {activeTab === "schema" && (
                  <div className="space-y-6 max-w-3xl">
                    <div>
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                        Field Definitions & UI Layout
                      </h4>
                      <p className="text-xs text-neutral-500 mb-4">
                        Attributes stored in <code className="font-mono text-[11px] bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">core_structured_data</code> and mapped to polymorphic UI slots.
                      </p>

                      <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs font-sans">
                          <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                            <tr>
                              <th className="px-4 py-2.5">Field Key</th>
                              <th className="px-4 py-2.5">Label</th>
                              <th className="px-4 py-2.5">Type</th>
                              <th className="px-4 py-2.5">Scope</th>
                              <th className="px-4 py-2.5">Required</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {Object.entries(schemaProps).map(([key, prop]: [string, any]) => {
                              const isReq = schemaRequired.includes(key);
                              const uiConfig = uiFields.find((f) => f.key === key);
                              return (
                                <tr key={key} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                                  <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                                    {key}
                                  </td>
                                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-300">
                                    {uiConfig?.label || prop.title || key}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-[10px] text-neutral-500">
                                    {prop.type || "string"}
                                    {prop.enum && ` (${prop.enum.join(" | ")})`}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span
                                      className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${
                                        uiConfig?.isPublicObjective !== false
                                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                      }`}
                                    >
                                      {uiConfig?.isPublicObjective !== false ? "Public Objective" : "Private Custom"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    {isReq ? (
                                      <span className="text-[10px] font-mono font-bold text-rose-500">
                                        YES
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-mono text-neutral-400">
                                        Optional
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Raw JSON Schema Preview */}
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500 mb-2">
                        Raw Effective JSON Schema
                      </h4>
                      <pre className="p-4 rounded-2xl bg-neutral-900 text-neutral-100 font-mono text-[11px] overflow-x-auto max-h-60 leading-relaxed border border-neutral-800">
                        {JSON.stringify(selectedType.effectiveJsonSchema || selectedType.jsonSchema, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* TAB 3: Identity & Deduplication Rules */}
                {activeTab === "identity" && (
                  <div className="space-y-6 max-w-2xl">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500 font-bold block mb-1">
                        Deterministic Deduplication
                      </span>
                      <h4 className="text-base font-bold">
                        Global Entity Identity Rules
                      </h4>
                      <p className="text-xs text-neutral-500 mt-1">
                        Curio unifies multi-user saves into progressive canonical entities using hard primary identifiers and fuzzy secondary fingerprints.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 space-y-3">
                      <div className="flex items-center gap-2">
                        <Fingerprint className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold">Hard External Identifiers (Tier 1)</span>
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        Unique keys that trigger an exact deterministic cache hit across all saves:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {hardExternalIds.length > 0 ? (
                          hardExternalIds.map((idKey) => (
                            <span
                              key={idKey}
                              className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200"
                            >
                              {idKey}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-mono text-neutral-400">
                            No hard external IDs defined.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold">Fuzzy Fingerprint Fields (Tier 2)</span>
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        Normalized attribute tuple used to synthesize identity fingerprint hashes when external IDs are missing:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {fingerprintFields.length > 0 ? (
                          fingerprintFields.map((fKey) => (
                            <span
                              key={fKey}
                              className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200"
                            >
                              {fKey}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-mono text-neutral-400">
                            No fingerprint fields defined.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: Extraction & Localized Aliases */}
                {activeTab === "aliases" && (
                  <div className="space-y-6 max-w-2xl">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-500 font-bold block mb-1">
                        Semantic Ingestion & Routing
                      </span>
                      <h4 className="text-base font-bold">
                        Extraction Prompt & Multilingual Aliases
                      </h4>
                      <p className="text-xs text-neutral-500 mt-1">
                        Used by the Magic Omnibox and the vector classifier for instant archetype classification and zero-shot entity extraction.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                        Extraction Prompt Directive
                      </span>
                      <p className="text-xs text-neutral-700 dark:text-neutral-300 font-sans leading-relaxed">
                        {selectedType.extractionPrompt || "No custom prompt registered."}
                      </p>
                    </div>

                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                        Localized Synonyms & Aliases
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(aliases).map(([lang, alias]) => (
                          <div
                            key={lang}
                            className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80"
                          >
                            <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 block">
                              {lang}
                            </span>
                            <span className="text-xs font-bold font-sans text-neutral-800 dark:text-neutral-200 mt-0.5 block truncate">
                              {alias}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-400 text-xs">
              No archetype selected.
            </div>
          )}
        </div>
      </div>

      {/* Embedded Type Builder Modal for creating custom subtypes */}
      <TypeBuilderModal
        isOpen={isTypeBuilderOpen}
        onClose={() => setIsTypeBuilderOpen(false)}
        onTypeCreated={(newType) => {
          setTypes((prev) => [...prev, newType as any]);
          setSelectedTypePath(newType.typePath);
        }}
      />
    </div>
  );
}
