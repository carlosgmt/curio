"use client";

import React, { useState } from "react";
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
} from "lucide-react";

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
    "memos",
  ]);
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch("/api/v1/import", {
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
      const res = await fetch("/api/v1/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          username: username.trim() || undefined,
          archetypes: selectedArchetypes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Onboarding failed");
      }

      onComplete(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header & Steps Progress */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 flex items-center justify-center font-bold text-xs">
              {step}
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 font-serif">
                {step === 1 && "Claim Your Sovereign Handle"}
                {step === 2 && "Select Your Taste Archetypes"}
                {step === 3 && "Preview Your Smart Boards"}
                {step === 4 && "Day-0 Library Import"}
                {step === 5 && "Privacy & Local Vault"}
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

          {/* Step 1: Claim Handle */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  Claim your unique Curio handle
                </h4>
                <p className="text-xs text-neutral-500 mt-1">
                  Your handle establishes your identity across curated boards, synaptic pairings, and peer exchanges.
                </p>
              </div>

              <div className="space-y-4 max-w-md mx-auto">
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
                      placeholder="curator"
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm text-neutral-900 dark:text-neutral-100 font-mono focus:outline-none focus:ring-2 focus:ring-neutral-400"
                    />
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 font-mono">
                    curio.sh/@{username || "handle"}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Elena Rostova"
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
                    Select 3 or more archetypes to bootstrap your polymorphic card stream.
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    selectedArchetypes.length >= 3
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {selectedArchetypes.length} selected (min 3)
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
                  Curio will automatically generate these intelligent boards with auto-categorization rules.
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

          {/* Step 4: Import Library */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  1-Click Day-0 Library Import
                </h4>
                <p className="text-xs text-neutral-500">
                  Bring your existing Letterboxd watchlists or Goodreads reading history directly into Curio.
                </p>
              </div>

              <div className="p-6 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-3xl text-center hover:border-neutral-400 transition bg-neutral-50/50 dark:bg-neutral-950/50">
                <Upload className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  {csvFileName ? csvFileName : "Drop Letterboxd or Goodreads CSV file here"}
                </p>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Or select a CSV file from your disk
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
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1.5 active:scale-95 transition"
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

          {/* Step 5: Privacy & Local Vault */}
          {step === 5 && (
            <div className="space-y-6 text-center max-w-md mx-auto py-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 font-serif">
                  Step 0 Privacy & Sovereign Vault
                </h4>
                <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                  Curio strictly enforces Step 0 heuristic classification: private memos, journal entries, and personal reflections are never sent to external search APIs or shared across accounts.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Zero Leakage</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">Isolated SQLite storage & tenant scoping</div>
                </div>
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Autonomous Sync</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">Live enrichment with fallback candidates</div>
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 active:scale-95 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as any)}
                disabled={step === 2 && selectedArchetypes.length < 3}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-50 hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-95 transition"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishOnboarding}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition shadow-sm"
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
