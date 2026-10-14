"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowRight, Lock, Globe, Sparkles, Loader2, Link2, BookOpen, Coffee, ShoppingBag, Film } from "lucide-react";

interface OmniboxProps {
  onCaptured?: (item: any) => void;
  isCapturing?: boolean;
}

export function Omnibox({ onCaptured, isCapturing: externalIsCapturing }: OmniboxProps) {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hintType, setHintType] = useState<"memo" | "entity" | "url" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setHintType(null);
    } else if (/^https?:\/\//i.test(trimmed)) {
      setHintType("url");
    } else if (/\b(?:met|meeting|talked|call|todo|remember|personal|memo|note to self)\b/i.test(trimmed)) {
      setHintType("memo");
    } else {
      setHintType("entity");
    }
  }, [input]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/capture", {
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

  const isBusy = isSubmitting || externalIsCapturing;

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <form
        onSubmit={handleSubmit}
        className="relative group rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all duration-200 p-2 sm:p-2.5 flex items-center gap-2"
      >
        <div className="pl-3 text-neutral-400 dark:text-neutral-500 flex items-center justify-center">
          {hintType === "memo" ? (
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
          placeholder="Capture anything — a thought, product, book, restaurant, or URL..."
          disabled={isBusy}
          className="flex-1 bg-transparent px-3 py-2 text-base text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none"
        />

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
      </form>

      {/* Quick suggestions pills */}
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-neutral-500 flex-wrap">
        <span className="text-neutral-400">Try:</span>
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
      </div>
    </div>
  );
}
