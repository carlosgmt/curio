"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Disc3,
  BookOpen,
  Film,
  Wine,
  UtensilsCrossed,
  Frame,
  MapPin,
  Lock,
  Upload,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (user: any) => void;
  initialUser?: {
    username?: string;
    displayName?: string;
    avatarUrl?: string;
  } | null;
}

interface ArchetypeOption {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  boardTitle: string;
}

const ARCHETYPES: ArchetypeOption[] = [
  {
    id: "cinema",
    name: "Cinema",
    category: "Moving Image",
    icon: Film,
    description: "Auteur cinema, 35mm prints & festival screenings",
    boardTitle: "Cinema Watchlist",
  },
  {
    id: "books",
    name: "Books",
    category: "Literature",
    icon: BookOpen,
    description: "First editions, annotations & literary essays",
    boardTitle: "The Library",
  },
  {
    id: "vinyl",
    name: "Vinyl & Hi-Fi",
    category: "Sound",
    icon: Disc3,
    description: "Analog pressings, album sleeves & acoustic gear",
    boardTitle: "Vinyl & Sound Rotation",
  },
  {
    id: "wine",
    name: "Wine & Cellar",
    category: "Terroir",
    icon: Wine,
    description: "Vintages, producers & cellar tasting notes",
    boardTitle: "Cellar & Vintages",
  },
  {
    id: "recipes",
    name: "Culinary Arts",
    category: "Gastronomy",
    icon: UtensilsCrossed,
    description: "Techniques, flavor pairings & kitchen experiments",
    boardTitle: "Culinary Laboratory",
  },
  {
    id: "art",
    name: "Fine Art",
    category: "Visuals",
    icon: Frame,
    description: "Galleries, sculpture, design objects & prints",
    boardTitle: "Gallery & Art Objets",
  },
  {
    id: "places",
    name: "Cartography",
    category: "Places",
    icon: MapPin,
    description: "Architectural spots, coffee bars & urban walks",
    boardTitle: "Cartography & Places",
  },
  {
    id: "memos",
    name: "Private Memos",
    category: "Inner Vault",
    icon: Lock,
    description: "Encrypted thoughts, sketches & local field notes",
    boardTitle: "Private Vault & Field Notes",
  },
];

export function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
  initialUser,
}: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [username, setUsername] = useState(initialUser?.username || "");
  const [displayName, setDisplayName] = useState(initialUser?.displayName || "");
  const [selectedArchetypes, setSelectedArchetypes] = useState<string[]>([
    "cinema",
    "books",
    "vinyl",
  ]);
  const [seedClassics, setSeedClassics] = useState(true);
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calibratorCards, setCalibratorCards] = useState<any[]>([]);
  const [selectedCalibratorIds, setSelectedCalibratorIds] = useState<string[]>([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState<string | null>("natural-wine");

  useEffect(() => {
    if (initialUser?.username) setUsername(initialUser.username);
    if (initialUser?.displayName) setDisplayName(initialUser.displayName);

    apiFetch("/api/v1/onboarding/calibrate")
      .then((res) => res.json())
      .then((data) => {
        if (data.cards) {
          setCalibratorCards(data.cards);
          setSelectedCalibratorIds([data.cards[0]?.id, data.cards[3]?.id, data.cards[6]?.id].filter(Boolean));
        }
      })
      .catch(() => {});
  }, [initialUser]);

  if (!isOpen) return null;

  const toggleArchetype = (id: string) => {
    setSelectedArchetypes((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  const handleRunImport = async () => {
    if (!csvText.trim()) return;
    setIsImporting(true);
    setImportStatus(null);
    try {
      const res = await apiFetch("/api/v1/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportStatus(`Successfully ingested ${data.insertedCount} items!`);
      } else {
        setImportStatus(`Import error: ${data.error || "Failed to process"}`);
      }
    } catch (err: any) {
      setImportStatus(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch("/api/v1/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          username: username.trim() || undefined,
          archetypes: selectedArchetypes,
          seedClassics,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Onboarding failed");
      }

      if (selectedCalibratorIds.length > 0) {
        await apiFetch("/api/v1/onboarding/calibrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acceptedIds: selectedCalibratorIds }),
        }).catch(() => {});
      }

      // Celebratory launch sequence
      setIsCelebrating(true);
      setTimeout(() => {
        onComplete(data.user);
        onClose();
      }, 1400);
    } catch (err: any) {
      setError(err.message || "Failed to complete onboarding");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Celebratory Launch Sequence Splash */}
        {isCelebrating && (
          <div className="absolute inset-0 z-50 bg-white/95 dark:bg-neutral-950/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-lg animate-bounce">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="font-serif text-3xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
              Taste Graph Initialized
            </h3>
            <p className="text-xs font-mono text-neutral-500 max-w-sm">
              Provisioned sovereign lists & cultural seeds. Launching your personal library stream...
            </p>
          </div>
        )}

        {/* Header & Steps Progress */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 flex items-center justify-center font-bold text-xs">
              {step}
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 font-serif">
                {step === 1 && "Sovereign Identity Calibrated"}
                {step === 2 && "Select Your Taste Archetypes"}
                {step === 3 && "Preview Your Smart Boards"}
                {step === 4 && "Day-0 Library Seed & Import"}
                {step === 5 && "Privacy & Sovereign Launch"}
              </h3>
              <p className="text-xs text-neutral-500">Step {step} of 5</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? "w-6 bg-neutral-900 dark:bg-neutral-100"
                    : s < step
                    ? "w-2 bg-emerald-500"
                    : "w-2 bg-neutral-300 dark:bg-neutral-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Step 1: Sovereign Identity Calibration */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  Identity Calibrated
                </h4>
                <p className="text-xs text-neutral-500 mt-1">
                  Your creator handle powers your sovereign public page, RSS syndication, and synaptic pairing attribution.
                </p>
              </div>

              <div className="space-y-4 max-w-md mx-auto">
                {/* Live Sovereign URL Card */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                      Live Sovereign URL
                    </span>
                    <span className="font-mono text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      curio.page/@{username || "curator"}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono font-bold border border-emerald-300/40">
                    Active
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Creator Handle
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-neutral-400 font-mono text-sm">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      placeholder="handle"
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm text-neutral-900 dark:text-neutral-100 font-mono focus:outline-none focus:ring-2 focus:ring-neutral-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Roland Barthes"
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Taste Archetypes */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    What shapes your taste universe?
                  </h4>
                  <p className="text-xs text-neutral-500">
                    Select 2 or more archetypes to bootstrap your polymorphic card stream.
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    selectedArchetypes.length >= 2
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {selectedArchetypes.length} selected (min 2)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {ARCHETYPES.map((arch) => {
                  const Icon = arch.icon;
                  const isSelected = selectedArchetypes.includes(arch.id);
                  return (
                    <div
                      key={arch.id}
                      onClick={() => toggleArchetype(arch.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 text-left ${
                        isSelected
                          ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900/5 dark:bg-neutral-100/10 shadow-xs"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                            {arch.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                        </div>
                        <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                          {arch.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Starter Boards Preview */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Starter Smart Lists for Your Archetypes
                </h4>
                <p className="text-xs text-neutral-500">
                  Curio will automatically provision these intelligent boards in SQLite with polymorphic auto-rules.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {selectedArchetypes.map((id) => {
                  const arch = ARCHETYPES.find((a) => a.id === id);
                  if (!arch) return null;
                  const Icon = arch.icon;
                  return (
                    <div
                      key={id}
                      className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-300">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                            {arch.boardTitle}
                          </div>
                          <div className="text-[11px] text-neutral-400 font-mono">
                            Auto-captures: {arch.category.toLowerCase()}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                        Ready to provision
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Day-0 Seed & CSV Import */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Day-0 Library Cold-Start & Taste Calibrator
                </h4>
                <p className="text-xs text-neutral-500">
                  Calibrate your sovereign 768-d taste vector by selecting items you love, or launch an instant starter blueprint.
                </p>
              </div>

              {/* 15-Card Visual Taste Calibrator Deck */}
              {calibratorCards.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider font-mono">
                      Visual Taste Calibrator ({selectedCalibratorIds.length} accepted)
                    </span>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      768-d unit vector
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50">
                    {calibratorCards.map((card) => {
                      const isSelected = selectedCalibratorIds.includes(card.id);
                      return (
                        <div
                          key={card.id}
                          onClick={() => {
                            setSelectedCalibratorIds((prev) =>
                              prev.includes(card.id)
                                ? prev.filter((id) => id !== card.id)
                                : [...prev, card.id]
                            );
                          }}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900/5 dark:bg-neutral-100/10 shadow-xs ring-1 ring-neutral-900/10"
                              : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase">
                                {card.coreType}
                              </span>
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                                  isSelected
                                    ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-transparent font-bold"
                                    : "border-neutral-300 dark:border-neutral-700"
                                }`}
                              >
                                {isSelected ? "✓" : ""}
                              </div>
                            </div>
                            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                              {card.title}
                            </div>
                            <div className="text-[10px] text-neutral-500 line-clamp-1">
                              {card.brandOrCreator}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4 Starter Blueprints */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider font-mono">
                  Instant Starter Blueprints
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "natural-wine", title: "Natural Wine & Terroir", tag: "Terroir" },
                    { id: "specialty-coffee", title: "Specialty Coffee Roasters", tag: "Craft" },
                    { id: "auteur-cinema", title: "Auteur Cinema 35mm", tag: "Cinema" },
                    { id: "design-objects", title: "Design Objects & Architecture", tag: "Design" },
                  ].map((bp) => {
                    const isSelected = selectedBlueprint === bp.id;
                    return (
                      <div
                        key={bp.id}
                        onClick={() => setSelectedBlueprint(isSelected ? null : bp.id)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900/5 dark:bg-neutral-100/10"
                            : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 bg-white dark:bg-neutral-900"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-neutral-900 dark:text-neutral-100">
                          <span className="truncate">{bp.title}</span>
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                            {bp.tag}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Path A: 1-Click Starter Taste Seed */}
              <div
                onClick={() => setSeedClassics(!seedClassics)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  seedClassics
                    ? "border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-800/40 shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      Seed with 4 Curio Classics (Recommended)
                    </h5>
                    <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                      Pre-populates your library with 4 cultural masterpieces: <em>In the Mood for Love</em>, <em>Kind of Blue</em>, Elena Ferrante's <em>Days of Abandonment</em>, and <em>Barolo Riserva</em>.
                    </p>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border mt-0.5 shrink-0 flex items-center justify-center ${
                    seedClassics ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "border-neutral-300 dark:border-neutral-700"
                  }`}
                >
                  {seedClassics && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* Path B: CSV File Dropzone */}
              <div className="p-6 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-3xl text-center hover:border-neutral-400 transition bg-neutral-50/50 dark:bg-neutral-950/50">
                <Upload className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  {csvFileName ? csvFileName : "Or drop Letterboxd or Goodreads CSV file here"}
                </p>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Supports Letterboxd watched.csv, Goodreads export, or Notion CSV exports
                </p>
                <label className="mt-3 inline-block px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold cursor-pointer active:scale-95 transition">
                  Browse File
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {csvText && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                  <span className="text-xs text-neutral-700 dark:text-neutral-300 font-mono truncate max-w-xs">
                    {csvFileName} ({Math.round(csvText.length / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={handleRunImport}
                    disabled={isImporting}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
                  >
                    {isImporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isImporting ? "Importing..." : "Process Import"}</span>
                  </button>
                </div>
              )}

              {importStatus && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                  {importStatus}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Privacy & Sovereign Launch */}
          {step === 5 && (
            <div className="space-y-6 text-center max-w-md mx-auto py-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 font-serif">
                  Step 0 Privacy Guarantee
                </h4>
                <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                  Curio strictly enforces client-side Step 0 privacy: confidential memos, private sketches, and unreleased notes never touch external enrichment APIs or AI training sets.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Zero Leakage</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">Isolated SQLite storage & tenant scoping</div>
                </div>
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Autonomous Sync</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">Model Context Protocol & RSS enabled</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 active:scale-95 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {step === 4 && (
              <button
                type="button"
                onClick={() => setStep(5)}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition cursor-pointer"
              >
                Skip CSV import
              </button>
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as any)}
                disabled={step === 2 && selectedArchetypes.length < 2}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-50 hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-95 transition cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishOnboarding}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition shadow-sm cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Launch Curio</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
