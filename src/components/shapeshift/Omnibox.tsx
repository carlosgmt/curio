"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Lock,
  Globe,
  Sparkles,
  Loader2,
  Link2,
  BookOpen,
  Coffee,
  ShoppingBag,
  Film,
  Search,
  Disc,
  MapPin,
  Utensils,
  X,
  Compass,
  Edit3,
  FolderInput,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Undo2,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

interface OmniboxProps {
  onCaptured?: (item: any) => void;
  isCapturing?: boolean;
  onOpenTypeBuilder?: () => void;
}

interface SearchResultItem {
  saveId: string;
  title: string;
  summary: string | null;
  heroImageUrl: string | null;
  typePath: string | null;
  coreType: string | null;
  isPrivateMemo: boolean;
  score: number;
  semanticScore: number;
  lexicalScore: number;
}

interface SaveCandidate {
  saveId: string;
  entityId: string | null;
  title: string;
  typePath: string | null;
  similarity: number;
  personalNotes?: string | null;
  rating?: number | null;
  heroImageUrl?: string | null;
  brandOrCreator?: string | null;
}

interface IntentPreview {
  intent: "SEARCH_QUERY" | "EDIT_SAVE" | "ADD_ENTITY" | "PRIVATE_MEMO";
  confidence: number;
  tier: number;
  action?: "RATING" | "NOTE" | "LIST_MOVE" | "STATUS" | "CHECKLIST_APPEND" | "VIEW";
  targetSave?: SaveCandidate;
  ambiguousCandidates?: SaveCandidate[];
  editDetails?: {
    action: string;
    targetTitle?: string;
    rating?: number;
    note?: string;
    targetList?: string;
    status?: string;
    itemToAdd?: string;
  };
  suggestedTitle?: string;
  reasoning?: string;
}

interface UndoState {
  saveId: string;
  title: string;
  previousNotes?: string | null;
  previousValues?: Record<string, unknown> | null;
  countdown: number;
}

export function Omnibox({
  onCaptured,
  isCapturing: externalIsCapturing,
  onOpenTypeBuilder,
}: OmniboxProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Intent preview state
  const [intentPreview, setIntentPreview] = useState<IntentPreview | null>(null);
  const [showDisambiguation, setShowDisambiguation] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<SaveCandidate | null>(null);

  // Real-time Undo Toast state
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [undoSuccess, setUndoSuccess] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if in search mode (starts with "/" or search mode toggled)
  const inSearch = isSearchMode || input.startsWith("/");
  const searchQuery = input.startsWith("/") ? input.slice(1).trim() : input.trim();

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
        setShowDisambiguation(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Countdown timer for Undo Toast
  useEffect(() => {
    if (!undoState) return;

    if (undoState.countdown <= 0) {
      setUndoState(null);
      return;
    }

    const interval = setInterval(() => {
      setUndoState((prev) => (prev ? { ...prev, countdown: prev.countdown - 1 } : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [undoState]);

  // Real-time Keystroke Intent Preview (<15 ms deterministic)
  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed || inSearch) {
      setIntentPreview(null);
      setShowDisambiguation(false);
      setSelectedCandidate(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/v1/capture/intent?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data: IntentPreview = await res.json();
          setIntentPreview(data);

          if (data.ambiguousCandidates && data.ambiguousCandidates.length > 1) {
            setShowDisambiguation(true);
            setSelectedCandidate(data.ambiguousCandidates[0]);
          } else {
            setShowDisambiguation(false);
            setSelectedCandidate(data.targetSave || null);
          }
        }
      } catch (err) {
        console.error("Intent preview error:", err);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [input, inSearch]);

  // Debounced semantic search when in search mode
  useEffect(() => {
    if (!inSearch || !searchQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowSearchDropdown(true);

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}&semantic=true&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error("Semantic search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, inSearch]);

  const executeCapture = async (forceNew: boolean = false, targetSaveId?: string) => {
    const trimmed = input.trim();
    if (!trimmed || isSubmitting) return;

    if (inSearch) {
      if (searchResults.length > 0) {
        router.push(`/card/${searchResults[0].saveId}`);
        setShowSearchDropdown(false);
        setInput("");
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch("/api/v1/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: trimmed,
          forceNew,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to capture item");
      }

      const data = await res.json();
      setInput("");
      setIntentPreview(null);
      setShowDisambiguation(false);

      // If inline card edit, activate 5-second Undo Toast
      if (data.status === "edited") {
        setUndoState({
          saveId: data.save.id,
          title: data.save.privateTitle || data.entity?.title || "Card",
          previousNotes: data.save.personalNotes,
          previousValues: data.save.userCustomValues,
          countdown: 5,
        });
      }

      if (onCaptured) {
        onCaptured(data);
      }
    } catch (err) {
      console.error("Omnibox capture error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeCapture(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowSearchDropdown(false);
      setShowDisambiguation(false);
      setIsSearchMode(false);
      if (input.startsWith("/")) {
        setInput("");
      }
      return;
    }

    // Shift + Enter forces "Add as New Card"
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      executeCapture(true);
      return;
    }
  };

  const handleUndo = async () => {
    if (!undoState) return;
    try {
      // Revert previous notes / rating
      await apiFetch(`/api/v1/saves/${undoState.saveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalNotes: undoState.previousNotes || null,
          userCustomValues: undoState.previousValues || {},
        }),
      });
      setUndoSuccess(true);
      setTimeout(() => {
        setUndoSuccess(false);
        setUndoState(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to undo edit:", err);
    }
  };

  const isBusy = isSubmitting || externalIsCapturing;

  const renderIntentBadge = () => {
    if (inSearch) {
      return (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-0.5 rounded-full border border-purple-200/50 dark:border-purple-800/50">
          <Search className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          Semantic Search
        </span>
      );
    }

    if (!intentPreview) {
      return <Sparkles className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />;
    }

    if (intentPreview.intent === "EDIT_SAVE") {
      const targetTitle = intentPreview.targetSave?.title || "Card";
      if (intentPreview.action === "RATING") {
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
            <Edit3 className="w-3.5 h-3.5" />
            ✏️ Update &lsquo;{targetTitle}&rsquo; ({intentPreview.editDetails?.rating}★)
          </span>
        );
      }
      if (intentPreview.action === "NOTE") {
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/40">
            <FileText className="w-3.5 h-3.5" />
            📝 Add note to &lsquo;{targetTitle}&rsquo;
          </span>
        );
      }
      if (intentPreview.action === "LIST_MOVE") {
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
            <FolderInput className="w-3.5 h-3.5" />
            📁 Move &lsquo;{targetTitle}&rsquo; to {intentPreview.editDetails?.targetList}
          </span>
        );
      }
      if (intentPreview.action === "STATUS") {
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/40">
            <RotateCcw className="w-3.5 h-3.5" />
            🔄 Mark &lsquo;{targetTitle}&rsquo; as {intentPreview.editDetails?.status}
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
          <Edit3 className="w-3.5 h-3.5" />
          ✏️ Edit &lsquo;{targetTitle}&rsquo;
        </span>
      );
    }

    if (intentPreview.intent === "PRIVATE_MEMO") {
      return (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-full border border-neutral-200/60 dark:border-neutral-700/50">
          <Lock className="w-3.5 h-3.5" />
          🔒 Vault: Private Memo
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
        <Sparkles className="w-3.5 h-3.5" />
        ✨ Capture: New Card
      </span>
    );
  };

  const renderArchetypeIcon = (item: SearchResultItem) => {
    if (item.isPrivateMemo) {
      return <Lock className="w-3.5 h-3.5 text-amber-500" />;
    }
    const path = (item.typePath || "").toLowerCase();
    const core = (item.coreType || "").toUpperCase();

    if (path.includes("/book") || core === "BOOK") {
      return <BookOpen className="w-3.5 h-3.5 text-blue-500" />;
    }
    if (path.includes("/film") || path.includes("/movie") || (core === "MEDIA" && path.includes("film"))) {
      return <Film className="w-3.5 h-3.5 text-rose-500" />;
    }
    if (path.includes("/vinyl") || path.includes("/music") || core === "MEDIA") {
      return <Disc className="w-3.5 h-3.5 text-purple-500" />;
    }
    if (path.includes("/recipe") || core === "CULINARY") {
      return <Utensils className="w-3.5 h-3.5 text-orange-500" />;
    }
    if (path.includes("/place") || core === "PLACE") {
      return <MapPin className="w-3.5 h-3.5 text-emerald-500" />;
    }
    return <ShoppingBag className="w-3.5 h-3.5 text-neutral-500" />;
  };

  return (
    <div ref={containerRef} className="w-full max-w-3xl mx-auto px-4 relative">
      <form
        onSubmit={handleSubmit}
        className={`relative group rounded-3xl bg-white dark:bg-neutral-900 border transition-all duration-200 p-2 sm:p-2.5 flex items-center gap-2 shadow-sm hover:shadow-md ${
          inSearch
            ? "border-purple-400 dark:border-purple-600 ring-2 ring-purple-100 dark:ring-purple-950/40"
            : intentPreview?.intent === "EDIT_SAVE"
            ? "border-amber-400 dark:border-amber-600 ring-2 ring-amber-100 dark:ring-amber-950/40"
            : "border-neutral-200/80 dark:border-neutral-800"
        }`}
      >
        <div className="pl-3 text-neutral-400 dark:text-neutral-500 flex items-center justify-center shrink-0">
          {renderIntentBadge()}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inSearch && searchResults.length > 0) {
              setShowSearchDropdown(true);
            }
          }}
          placeholder={
            inSearch
              ? "Type to search your saves with local vector semantics..."
              : intentPreview?.intent === "EDIT_SAVE"
              ? "Press Enter to update card, Shift+Enter to create new card"
              : "Capture anything, update cards ('rate Past Lives 5★'), or type / to search..."
          }
          disabled={isBusy}
          className="flex-1 bg-transparent px-3 py-2 text-base text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none min-w-0"
        />

        {inSearch ? (
          <div className="flex items-center gap-1.5">
            {isSearching && <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400 mr-1" />}
            <button
              type="button"
              onClick={() => {
                setIsSearchMode(false);
                setInput("");
                setShowSearchDropdown(false);
              }}
              className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition"
              title="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsSearchMode(true);
                inputRef.current?.focus();
              }}
              className="p-2 rounded-2xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition text-xs flex items-center gap-1"
              title="Switch to semantic search (/)"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isBusy}
              className={`cursor-pointer inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition-transform active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
                intentPreview?.intent === "EDIT_SAVE"
                  ? "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-neutral-950"
                  : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              }`}
            >
              {isBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <span>{intentPreview?.intent === "EDIT_SAVE" ? "Update" : "Save"}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </button>
          </div>
        )}
      </form>

      {/* 1-Tap Candidate Disambiguation Dropdown */}
      {showDisambiguation && intentPreview?.ambiguousCandidates && (
        <div className="absolute left-4 right-4 top-full mt-2 z-50 rounded-2xl bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-800 shadow-xl overflow-hidden backdrop-blur-md">
          <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-amber-50/70 dark:bg-amber-950/40 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Multiple matching cards found in your vault. Which card would you like to update?
            </span>
            <span className="text-[11px] text-neutral-400">
              Shift+Enter to add new
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {intentPreview.ambiguousCandidates.map((c) => (
              <button
                key={c.saveId}
                type="button"
                onClick={() => {
                  setSelectedCandidate(c);
                  executeCapture(false, c.saveId);
                }}
                className="w-full text-left p-3 hover:bg-amber-50/50 dark:hover:bg-neutral-800/70 transition flex items-center justify-between gap-3 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                      {c.title}
                    </h4>
                    {c.brandOrCreator && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        by {c.brandOrCreator}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/40 shrink-0">
                  Select & Update
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => executeCapture(true)}
              className="w-full text-left p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
              <span>Don&rsquo;t update existing cards — <strong>Create as New Card</strong> (Shift+Enter)</span>
            </button>
          </div>
        </div>
      )}

      {/* Semantic Search Results Dropdown */}
      {inSearch && showSearchDropdown && searchQuery.length > 0 && (
        <div className="absolute left-4 right-4 top-full mt-2 z-50 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden backdrop-blur-md">
          <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/70 flex items-center justify-between text-xs text-neutral-500">
            <span className="flex items-center gap-1.5 font-medium">
              <Compass className="w-3.5 h-3.5 text-purple-500" />
              Semantic Taste Graph Retrieval
            </span>
            <span className="text-[11px] text-neutral-400">
              Hybrid Cosine + Lexical
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {isSearching && searchResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                <span>Searching your memory vault...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400">
                No matching saves found for &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              searchResults.map((item) => (
                <button
                  key={item.saveId}
                  type="button"
                  onClick={() => {
                    router.push(`/card/${item.saveId}`);
                    setShowSearchDropdown(false);
                    setInput("");
                  }}
                  className="w-full text-left p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition flex items-start gap-3 cursor-pointer group"
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-950/50 transition">
                    {renderArchetypeIcon(item)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                        {item.title}
                      </h4>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40 shrink-0">
                        {Math.round(item.score * 100)}% match
                      </span>
                    </div>
                    {item.summary && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                        {item.summary}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Real-time Undo Toast */}
      {undoState && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-2xl border border-neutral-700 dark:border-neutral-300 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="text-xs font-medium">
            Updated &lsquo;<strong>{undoState.title}</strong>&rsquo; inline
          </span>
          {undoSuccess ? (
            <span className="text-xs text-emerald-400 font-semibold">Reverted!</span>
          ) : (
            <button
              type="button"
              onClick={handleUndo}
              className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 dark:bg-neutral-200 dark:hover:bg-neutral-300 dark:text-amber-800 transition cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo ({undoState.countdown}s)
            </button>
          )}
        </div>
      )}

      {/* Quick suggestions pills */}
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-neutral-500 flex-wrap">
        <span className="text-neutral-400">Try:</span>
        <button
          type="button"
          onClick={() => {
            setInput("/coffee");
            setIsSearchMode(true);
            inputRef.current?.focus();
          }}
          className="hover:text-purple-600 dark:hover:text-purple-400 transition font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1 bg-purple-50/70 dark:bg-purple-950/30 px-2 py-0.5 rounded-full border border-purple-200/50 dark:border-purple-800/40 cursor-pointer"
        >
          <Search className="w-3 h-3 text-purple-500" /> /coffee (Search)
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => setInput("Change rating to 5 stars for Past Lives")}
          className="hover:text-neutral-900 dark:hover:text-neutral-200 transition underline underline-offset-2 flex items-center gap-1"
        >
          <Edit3 className="w-3 h-3 text-amber-500" /> Change rating to 5 stars for Past Lives
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => setInput("Loved the ending of Dune")}
          className="hover:text-neutral-900 dark:hover:text-neutral-200 transition underline underline-offset-2 flex items-center gap-1"
        >
          <BookOpen className="w-3 h-3 text-blue-500" /> Loved the ending of Dune
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => setInput("Met Sarah about Q3 funding")}
          className="hover:text-neutral-900 dark:hover:text-neutral-200 transition underline underline-offset-2 flex items-center gap-1"
        >
          <Lock className="w-3 h-3 text-amber-500" /> Met Sarah about Q3 funding
        </button>
        {onOpenTypeBuilder && (
          <>
            <span>•</span>
            <button
              type="button"
              onClick={onOpenTypeBuilder}
              className="hover:text-amber-600 dark:hover:text-amber-400 transition font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1 bg-amber-50/80 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40 cursor-pointer"
              title="Teach Curio a new custom type"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>+ Add Type</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
