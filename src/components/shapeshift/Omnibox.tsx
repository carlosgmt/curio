"use client";

import React, { useState, useRef, useEffect } from "react";
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

export function Omnibox({
  onCaptured,
  isCapturing: externalIsCapturing,
  onOpenTypeBuilder,
}: OmniboxProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hintType, setHintType] = useState<"memo" | "entity" | "url" | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if in search mode (starts with "/" or search mode toggled)
  const inSearch = isSearchMode || input.startsWith("/");
  const searchQuery = input.startsWith("/") ? input.slice(1).trim() : input.trim();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Classify input hint for capture mode
  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed || inSearch) {
      setHintType(null);
    } else if (/^https?:\/\//i.test(trimmed)) {
      setHintType("url");
    } else if (/\b(?:met|meeting|talked|call|todo|remember|personal|memo|note to self)\b/i.test(trimmed)) {
      setHintType("memo");
    } else {
      setHintType("entity");
    }
  }, [input, inSearch]);

  // Debounced semantic search when in search mode
  useEffect(() => {
    if (!inSearch || !searchQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowDropdown(true);

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (inSearch) {
      // In search mode, navigate to top result if available
      if (searchResults.length > 0) {
        router.push(`/card/${searchResults[0].saveId}`);
        setShowDropdown(false);
        setInput("");
      }
      return;
    }

    const trimmed = input.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await apiFetch("/api/v1/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });

      if (!res.ok) {
        throw new Error("Failed to capture item");
      }

      const data = await res.json();
      setInput("");
      if (onCaptured) {
        onCaptured(data);
      }
    } catch (err) {
      console.error("Omnibox capture error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
      setIsSearchMode(false);
      if (input.startsWith("/")) {
        setInput("");
      }
    }
  };

  const isBusy = isSubmitting || externalIsCapturing;

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
            : "border-neutral-200/80 dark:border-neutral-800"
        }`}
      >
        <div className="pl-3 text-neutral-400 dark:text-neutral-500 flex items-center justify-center">
          {inSearch ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-0.5 rounded-full border border-purple-200/50 dark:border-purple-800/50">
              <Search className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Semantic Search
            </span>
          ) : hintType === "memo" ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
              <Lock className="w-3.5 h-3.5" />
              Private Memo
            </span>
          ) : hintType === "url" ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
              <Link2 className="w-3.5 h-3.5" />
              Web Resource
            </span>
          ) : hintType === "entity" ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              <Globe className="w-3.5 h-3.5" />
              Public Entity
            </span>
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inSearch && searchResults.length > 0) {
              setShowDropdown(true);
            }
          }}
          placeholder={
            inSearch
              ? "Type to search your saves with local vector semantics..."
              : "Capture anything, or type / to search your saves..."
          }
          disabled={isBusy}
          className="flex-1 bg-transparent px-3 py-2 text-base text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none"
        />

        {inSearch ? (
          <div className="flex items-center gap-1.5">
            {isSearching && <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400 mr-1" />}
            <button
              type="button"
              onClick={() => {
                setIsSearchMode(false);
                setInput("");
                setShowDropdown(false);
              }}
              className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition"
              title="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
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
              className="cursor-pointer inline-flex items-center justify-center rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 py-2.5 text-sm font-medium transition-transform active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            >
              {isBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <span>Save</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </button>
          </div>
        )}
      </form>

      {/* Semantic Search Results Dropdown */}
      {inSearch && showDropdown && searchQuery.length > 0 && (
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
                    setShowDropdown(false);
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
          onClick={() => setInput("Dune 1965 book")}
          className="hover:text-neutral-900 dark:hover:text-neutral-200 transition underline underline-offset-2 flex items-center gap-1"
        >
          <BookOpen className="w-3 h-3" /> Dune 1965 book
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => setInput("Met Sarah about Q3 funding")}
          className="hover:text-neutral-900 dark:hover:text-neutral-200 transition underline underline-offset-2 flex items-center gap-1"
        >
          <Lock className="w-3 h-3" /> Met Sarah about Q3 funding
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => setInput("Blue Bottle Coffee Tokyo")}
          className="hover:text-neutral-900 dark:hover:text-neutral-200 transition underline underline-offset-2 flex items-center gap-1"
        >
          <Coffee className="w-3 h-3" /> Blue Bottle Coffee Tokyo
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
