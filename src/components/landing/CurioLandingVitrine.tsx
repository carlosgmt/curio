"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Search,
  ArrowRight,
  Disc3,
  Film,
  BookOpen,
  Wine,
  UtensilsCrossed,
  MapPin,
  ExternalLink,
  ChevronRight,
  Network,
  Cpu,
  Layers,
  FileSpreadsheet,
  Check,
} from "lucide-react";
import { MoviePosterCard } from "@/components/cards/silhouettes/MoviePosterCard";
import { VinylDiscCard } from "@/components/cards/silhouettes/VinylDiscCard";
import { BookJacketCard } from "@/components/cards/silhouettes/BookJacketCard";
import { WineLabelCard } from "@/components/cards/silhouettes/WineLabelCard";
import { RecipeIndexCard } from "@/components/cards/silhouettes/RecipeIndexCard";
import { MapPassCard } from "@/components/cards/silhouettes/MapPassCard";
import { apiFetch } from "@/lib/apiClient";

export interface CurioLandingVitrineProps {
  onOpenAuth?: (tab?: "login" | "register") => void;
}

// 6 Flagship Cultural Archetype Specimens
const SPECIMENS = {
  cinema: {
    save: { id: "specimen-cinema", createdAt: "2026-10-17" },
    entity: {
      id: "ent-cinema",
      title: "In the Mood for Love",
      summary: "Two neighbors form a delicate bond after discovering the infidelity of their respective spouses in 1962 British Hong Kong.",
      heroImageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80",
      coreType: "MEDIA",
      typePath: "/media/film",
      canonicalUrl: "https://mubi.com/films/in-the-mood-for-love",
      coreStructuredData: {
        director: "Wong Kar-wai",
        releaseYear: "2000",
        runtimeMinutes: 98,
        cinematographer: "Christopher Doyle & Mark Lee Ping-bin",
        distributor: "CRITERION COLLECTION № 147",
        tmdbRating: "8.1",
      },
    },
  },
  vinyl: {
    save: { id: "specimen-vinyl", createdAt: "2026-10-17" },
    entity: {
      id: "ent-vinyl",
      title: "Kind of Blue",
      summary: "Miles Davis Quintet with John Coltrane and Bill Evans.",
      heroImageUrl: "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=800&auto=format&fit=crop&q=80",
      coreType: "VINYL",
      typePath: "/media/music/vinyl",
      canonicalUrl: "https://open.spotify.com/album/1weenldZZHIcu659YuYDY5",
      coreStructuredData: {
        artist: "Miles Davis",
        releaseYear: "1959",
        rpm: "33 ⅓ RPM",
        recordLabel: "Columbia Masterworks",
        catalogNumber: "CL-1355",
        tracklist: [
          { number: "A1", title: "So What", duration: "9:22" },
          { number: "A2", title: "Freddie Freeloader", duration: "9:46" },
          { number: "A3", title: "Blue in Green", duration: "5:37" },
          { number: "B1", title: "All Blues", duration: "11:33" },
          { number: "B2", title: "Flamenco Sketches", duration: "9:26" },
        ],
      },
    },
  },
  book: {
    save: { id: "specimen-book", createdAt: "2026-10-17" },
    entity: {
      id: "ent-book",
      title: "The Days of Abandonment",
      summary: "A ferocious, razor-sharp meditation on grief, obsession, and the unraveling of a marriage in Turin.",
      heroImageUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&auto=format&fit=crop&q=80",
      coreType: "BOOK",
      typePath: "/product/book",
      canonicalUrl: "https://openlibrary.org/works/OL1991428W",
      coreStructuredData: {
        author: "Elena Ferrante",
        publisher: "Europa Editions",
        isbn: "978-1933372006",
        obiText: "A masterclass in domestic catastrophe and transcendent reclamation.",
      },
    },
  },
  wine: {
    save: { id: "specimen-wine", createdAt: "2026-10-17" },
    entity: {
      id: "ent-wine",
      title: "Barolo Riserva Monfortino",
      summary: "Unfined and unfiltered monumental expression of Nebbiolo from the legendary Cascina Francia vineyard.",
      heroImageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&auto=format&fit=crop&q=80",
      coreType: "PRODUCT",
      typePath: "/product/beverage/wine",
      canonicalUrl: "https://www.vivino.com",
      coreStructuredData: {
        producer: "Giacomo Conterno",
        cuvee: "Barolo Riserva Monfortino",
        vintage: "2013",
        appellation: "DOCG",
        region: "Serralunga d'Alba, Piedmont",
        country: "Italy",
        varietal: "100% Nebbiolo",
        farming: "Traditional & Biodynamic",
        abv: "14.5",
      },
    },
  },
  culinary: {
    save: { id: "specimen-culinary", createdAt: "2026-10-17" },
    entity: {
      id: "ent-culinary",
      title: "Authentic Carbonara Romana",
      summary: "Classical Roman protocol strictly without cream, peas, or garlic.",
      coreType: "CULINARY",
      typePath: "/culinary/recipe",
      canonicalUrl: "https://cooking.nytimes.com",
      coreStructuredData: {
        cuisine: "Roman Classical",
        prepTimeMinutes: 10,
        cookTimeMinutes: 15,
        yieldServings: 2,
        ingredients: [
          { item: "Artisanal Spaghettoni", amount: 200, unit: "g" },
          { item: "Aged Guanciale jowl", amount: 120, unit: "g" },
          { item: "Pasture Egg yolks", amount: 4, unit: "" },
          { item: "Pecorino Romano DOP", amount: 50, unit: "g" },
          { item: "Tellicherry Black Peppercorns", amount: 1, unit: "tbsp" },
        ],
        directions: [
          "Render guanciale slowly in a cold carbon steel skillet until caramelized and deeply fragrant.",
          "Whisk egg yolks with grated Pecorino and freshly toasted cracked pepper into a lustrous paste.",
          "Boil spaghettoni until 2 minutes shy of al dente; gloss in rendered fat with reserved starchy water.",
          "Fold egg-cheese cream off the flame, tossing swiftly into a mirror-sheen emulsion.",
        ],
      },
    },
  },
  place: {
    save: { id: "specimen-place", createdAt: "2026-10-17" },
    entity: {
      id: "ent-place",
      title: "Mount Tamalpais Matt Davis Trail",
      summary: "Coastal redwoods climbing to high ridges overlooking Stinson Beach and the Pacific Ocean.",
      coreType: "PLACE",
      typePath: "/place/transit_trail",
      canonicalUrl: "https://maps.google.com",
      coreStructuredData: {
        location: "Marin County, California",
        coordinates: "37.9048° N, 122.6044° W",
        elevationGainMeters: 580,
        distanceKm: 10.8,
        passType: "SUMMIT & COASTAL RIDGE PASS",
      },
    },
  },
};

const SIMULATOR_PRESETS = [
  {
    query: "In the Mood for Love 2000",
    archetype: "Cinema / Criterion 2:3",
    icon: Film,
    specimenKey: "cinema" as const,
  },
  {
    query: "Kind of Blue Miles Davis",
    archetype: "Vinyl / 33⅓ RPM LP",
    icon: Disc3,
    specimenKey: "vinyl" as const,
  },
  {
    query: "Elena Ferrante Days of Abandonment",
    archetype: "Book / Hardcover Obi",
    icon: BookOpen,
    specimenKey: "book" as const,
  },
  {
    query: "Barolo Riserva Giacomo Conterno 2013",
    archetype: "Wine / Terroir Estate",
    icon: Wine,
    specimenKey: "wine" as const,
  },
  {
    query: "Spaghetti alla Carbonara Guanciale",
    archetype: "Recipe / Indexed Protocol",
    icon: UtensilsCrossed,
    specimenKey: "culinary" as const,
  },
  {
    query: "Mount Tamalpais Matt Davis Trail",
    archetype: "Transit & Trail Pass",
    icon: MapPin,
    specimenKey: "place" as const,
  },
];

export function CurioLandingVitrine({ onOpenAuth }: CurioLandingVitrineProps) {
  const [activeTab, setActiveTab] = useState<keyof typeof SPECIMENS>("cinema");
  const [simQuery, setSimQuery] = useState("In the Mood for Love 2000");
  const [simActiveKey, setSimActiveKey] = useState<keyof typeof SPECIMENS>("cinema");
  const [publicLists, setPublicLists] = useState<any[]>([]);

  useEffect(() => {
    // Fetch live public boards from database
    const loadPublicBoards = async () => {
      try {
        const res = await apiFetch("/api/v1/lists/public");
        if (res.ok) {
          const data = await res.json();
          if (data.lists && data.lists.length > 0) {
            setPublicLists(data.lists);
          }
        }
      } catch (err) {
        console.error("Failed to load public vitrine lists:", err);
      }
    };
    loadPublicBoards();
  }, []);

  const handleSimPreset = (preset: typeof SIMULATOR_PRESETS[0]) => {
    setSimQuery(preset.query);
    setSimActiveKey(preset.specimenKey);
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] text-neutral-900 dark:text-neutral-100 selection:bg-amber-100 dark:selection:bg-neutral-800">
      {/* 1. Header / Navigation */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#fafaf9]/85 dark:bg-[#0c0a09]/85 border-b border-neutral-200/60 dark:border-neutral-800/60">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          {/* Left Brand Colophon */}
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center font-serif font-black text-lg shadow-sm group-hover:scale-105 transition">
              C
            </div>
            <div>
              <span className="font-serif font-bold text-xl tracking-tight block leading-none">
                Curio
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 block mt-0.5">
                Taste Graph & Sovereign Memory
              </span>
            </div>
          </Link>

          {/* Center Smooth Navigation Anchors */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-mono text-neutral-600 dark:text-neutral-400">
            <a href="#philosophy" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition">
              Philosophy
            </a>
            <a href="#archetypes" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition">
              Archetypes
            </a>
            <a href="#vitrines" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition">
              Public Vitrines
            </a>
            <a href="#migration" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition">
              Migration
            </a>
          </nav>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              onClick={(e) => {
                if (onOpenAuth) {
                  e.preventDefault();
                  onOpenAuth("login");
                }
              }}
              className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-neutral-100 transition cursor-pointer"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              onClick={(e) => {
                if (onOpenAuth) {
                  e.preventDefault();
                  onOpenAuth("register");
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition active:scale-95 shadow-xs cursor-pointer"
            >
              <span>Claim Sovereign Handle</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section with Value Proposition */}
      <section className="relative pt-20 pb-16 px-6 max-w-5xl mx-auto text-center">
        {/* Micro-Telemetry Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10.5px] font-mono uppercase tracking-widest bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 mb-6 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Autonomous Memory & Taste Graph • PRD v3.2</span>
        </div>

        {/* Hero Title */}
        <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 leading-[1.08] mb-6">
          Capture at Keep speed. <br />
          Curate with Pinterest elegance. <br />
          <span className="italic font-normal text-neutral-600 dark:text-neutral-400">
            Engineered for Agents.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 font-sans max-w-2xl mx-auto leading-relaxed mb-8">
          The sovereign personal library where Criterion posters, vinyl LPs, first editions, terroir wine labels, and transit passes coexist—guaranteed by client-side Step 0 privacy.
        </p>

        {/* Dual Hero CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-14">
          <Link
            href="/register"
            onClick={(e) => {
              if (onOpenAuth) {
                e.preventDefault();
                onOpenAuth("register");
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-md active:scale-95 transition cursor-pointer"
          >
            <span>Claim Sovereign Handle</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#vitrines"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-semibold bg-stone-100 hover:bg-stone-200/80 dark:bg-stone-900 dark:hover:bg-stone-800 text-neutral-800 dark:text-neutral-200 border border-stone-200 dark:border-stone-800 transition active:scale-95 cursor-pointer"
          >
            <span>Explore Public Curations</span>
            <span className="text-xs font-mono">↗</span>
          </a>
        </div>

        {/* Live Omnibox Simulator Stage */}
        <div className="relative max-w-2xl mx-auto bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-300 dark:border-neutral-800 p-4 shadow-xl text-left">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-100 dark:border-neutral-800 text-xs font-mono text-neutral-500">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              Live Omnibox Simulator
            </span>
            <span>Step 0 Router</span>
          </div>

          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={simQuery}
              onChange={(e) => setSimQuery(e.target.value)}
              placeholder="Paste any URL or title (e.g. In the Mood for Love, Kind of Blue)..."
              className="w-full pl-12 pr-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400"
            />
          </div>

          {/* Quick Preset Selector Buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <span className="text-[10px] font-mono uppercase text-neutral-400 mr-1">Sample seeds:</span>
            {SIMULATOR_PRESETS.map((preset) => (
              <button
                key={preset.query}
                type="button"
                onClick={() => handleSimPreset(preset)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono transition cursor-pointer ${
                  simQuery === preset.query
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                }`}
              >
                <preset.icon className="w-3 h-3" />
                <span>{preset.archetype}</span>
              </button>
            ))}
          </div>

          {/* Instant Classification Telemetry */}
          <div className="mt-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-neutral-600 dark:text-neutral-400">
                Resolved Entity: <strong className="text-neutral-900 dark:text-neutral-100">{SPECIMENS[simActiveKey].entity.title}</strong>
              </span>
            </div>
            <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300/40">
              {SPECIMENS[simActiveKey].entity.typePath}
            </span>
          </div>
        </div>
      </section>

      {/* 3. Interactive Vitrine: "Artifact-as-Card" Carousel */}
      <section id="archetypes" className="py-20 px-6 max-w-6xl mx-auto border-t border-neutral-200 dark:border-neutral-800/80">
        <div className="text-center mb-12">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold">
            Polymorphic Architecture
          </span>
          <h2 className="text-3xl sm:text-5xl font-serif font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mt-2">
            Artifact-as-Card
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto mt-2 font-sans">
            No generic gray rectangles. Every cultural object assumes its native physical silhouette with tactile typography and bespoke details.
          </p>

          {/* Archetype Tab Bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              { id: "cinema" as const, label: "Cinema (Criterion 2:3)", icon: Film },
              { id: "vinyl" as const, label: "Vinyl (12\" Grooved LP)", icon: Disc3 },
              { id: "book" as const, label: "Books (Hardcover Obi)", icon: BookOpen },
              { id: "wine" as const, label: "Wine (Terroir Seal)", icon: Wine },
              { id: "culinary" as const, label: "Culinary (Index Card)", icon: UtensilsCrossed },
              { id: "place" as const, label: "Cartography (Transit Pass)", icon: MapPin },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm"
                    : "bg-stone-100 hover:bg-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Silhouette Stage */}
        <div className="max-w-md mx-auto">
          {activeTab === "cinema" && (
            <MoviePosterCard
              save={SPECIMENS.cinema.save}
              entity={SPECIMENS.cinema.entity}
            />
          )}
          {activeTab === "vinyl" && (
            <VinylDiscCard
              save={SPECIMENS.vinyl.save}
              entity={SPECIMENS.vinyl.entity}
            />
          )}
          {activeTab === "book" && (
            <BookJacketCard
              save={SPECIMENS.book.save}
              entity={SPECIMENS.book.entity}
            />
          )}
          {activeTab === "wine" && (
            <WineLabelCard
              save={SPECIMENS.wine.save}
              entity={SPECIMENS.wine.entity}
            />
          )}
          {activeTab === "culinary" && (
            <RecipeIndexCard
              save={SPECIMENS.culinary.save}
              entity={SPECIMENS.culinary.entity}
            />
          )}
          {activeTab === "place" && (
            <MapPassCard
              save={SPECIMENS.place.save}
              entity={SPECIMENS.place.entity}
            />
          )}
        </div>
      </section>

      {/* 4. The 4 Sovereign Pillars */}
      <section id="philosophy" className="py-20 px-6 max-w-6xl mx-auto border-t border-neutral-200 dark:border-neutral-800/80">
        <div className="text-center mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold">
            Guiding Principles
          </span>
          <h2 className="text-3xl sm:text-5xl font-serif font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mt-2">
            The Sovereign Library Architecture
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Pillar 1 */}
          <div className="p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
                Step 0 Privacy Isolation
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans">
                Confidential memos, draft thoughts, and private reflections are classified client-side before touching external enrichment APIs or LLM pipelines. No ads, no data broker extraction.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              ✓ Zero Network Leak Guarantee
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
                Polymorphic Geometry
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans">
                Cultural objects demand tactile identity. Spinning 33⅓ RPM grooved vinyl with needle drop arms, Criterion billing blocks, textured cloth book spines, and stamped transit tickets.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-[11px] font-mono text-amber-700 dark:text-amber-400">
              ✓ 8 Native Cultural Silhouettes
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center mb-4">
                <Network className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
                Synaptic Memory Pairs
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans">
                Associative taste graphs connecting cross-domain gems. Pair a 1974 Italian soundtrack with a natural wine cuvée and a late-night Tokyo kissaten bar with bidirectional edges.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-[11px] font-mono text-blue-600 dark:text-blue-400">
              ✓ Bidirectional Associative Graph
            </div>
          </div>

          {/* Pillar 4 */}
          <div className="p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center mb-4">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
                Agent-Ready Ingestion
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans">
                Designed for human curators and autonomous agents alike. Features Model Context Protocol (MCP) server endpoints, Schema.org JSON-LD, and federated RSS/ActivityPub feeds.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-[11px] font-mono text-purple-600 dark:text-purple-400">
              ✓ Model Context Protocol (MCP) & RSS
            </div>
          </div>
        </div>
      </section>

      {/* 5. Public Curated Vitrines Showcase */}
      <section id="vitrines" className="py-20 px-6 max-w-6xl mx-auto border-t border-neutral-200 dark:border-neutral-800/80">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold">
              Living Taste Graphs
            </span>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mt-2">
              Public Vitrines
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 font-sans">
              Discover curated lists shared publicly across cinema, music, design, and travel.
            </p>
          </div>

          <Link
            href="/register"
            onClick={(e) => {
              if (onOpenAuth) {
                e.preventDefault();
                onOpenAuth("register");
              }
            }}
            className="mt-4 sm:mt-0 text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-100 hover:underline inline-flex items-center gap-1"
          >
            <span>Publish your own board</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Vitrine Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {(publicLists.length > 0 ? publicLists : [
            {
              slug: "tokyo-weekend-guide-12",
              title: "Tokyo Weekend Guide",
              description: "A 48-hour itinerary spanning Daikanyama vinyl shops, Ginza coffee roasters, and Nakameguro bookstores.",
              itemCount: 14,
              ownerUsername: "tokyowalk",
            },
            {
              slug: "criterion-picks-12",
              title: "Criterion Picks",
              description: "Essential arthouse masterpieces, Japanese New Wave, and French Poetic Realism.",
              itemCount: 22,
              ownerUsername: "cinephile",
            },
            {
              slug: "dinner-party-1792219893647",
              title: "Dinner Party 2026",
              description: "An evening of low-intervention natural wine, slow listening, and Roman pasta.",
              itemCount: 9,
              ownerUsername: "curator",
            },
          ]).map((list: any) => (
            <Link
              key={list.slug || list.id}
              href={`/list/${list.slug}`}
              className="group p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-neutral-500 mb-3">
                  <span className="uppercase tracking-wider">
                    @{list.ownerUsername || "curio"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 font-bold">
                    {list.itemCount} items
                  </span>
                </div>
                <h3 className="font-serif text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 group-hover:text-amber-600 transition mb-2">
                  {list.title}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-3 leading-relaxed">
                  {list.description || "Curated collection of sovereign cultural items and pairings."}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs font-mono font-medium text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-100">
                <span>Browse Board</span>
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 6. Day-0 Migration Banner */}
      <section id="migration" className="py-16 px-6 max-w-5xl mx-auto border-t border-neutral-200 dark:border-neutral-800/80 text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-stone-100 to-stone-50 dark:from-stone-900/60 dark:to-neutral-900 border border-stone-200 dark:border-stone-800">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 mb-4 shadow-2xs">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Frictionless Day-0 Migration</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-3">
            Bring your taste graph with you.
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto mb-8 leading-relaxed font-sans">
            Instantly import thousands of ratings, watchlists, and books with 1-click CSV drag-and-drop parsing.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 font-mono text-xs text-neutral-700 dark:text-neutral-300">
            {["Letterboxd CSV", "Goodreads Export", "Notion Databases", "Raindrop Bookmarks"].map((source) => (
              <div key={source} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 shadow-2xs">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{source}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Warm Editorial Footer */}
      <footer className="py-12 px-6 border-t border-neutral-200 dark:border-neutral-800/80 bg-white/50 dark:bg-neutral-950/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center font-serif font-bold text-xs">
              C
            </div>
            <span className="font-serif text-sm font-bold">Curio</span>
            <span className="text-xs font-mono text-neutral-400">• Autonomous Memory & Taste Graph</span>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono text-neutral-500">
            <span>Tailscale Serve Network</span>
            <span>SQLite WAL</span>
            <Link href="/login" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition">
              Claim Handle
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
