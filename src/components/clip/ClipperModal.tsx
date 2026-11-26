"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Check, Copy, Sparkles, X } from "lucide-react";
import {
  buildCurioSaveToBookmarkletHref,
  getCurioClipEndpointUrl,
} from "@/lib/clip/protocol";

export interface ClipperBookmarkletBarProps {
  compact?: boolean;
}

export function ClipperBookmarkletBar({ compact = false }: ClipperBookmarkletBarProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const href = useMemo(
    () => buildCurioSaveToBookmarkletHref(getCurioClipEndpointUrl()),
    []
  );

  useEffect(() => {
    const el = linkRef.current;
    if (!el) return;
    el.setAttribute("href", href);
  }, [href]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setHint("Bookmarklet code copied to clipboard.");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setHint("Clipboard unavailable — drag 'Save to Curio' to your bookmarks bar.");
    }
  };

  return (
    <div className={compact ? "space-y-2.5" : "space-y-3.5"}>
      <div className="flex flex-wrap items-center gap-2">
        <a
          ref={linkRef}
          href="#save-to-curio"
          onClick={(e) => {
            e.preventDefault();
            setHint("Drag this button to your bookmarks bar (or tap Copy Code for mobile Chrome).");
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 transition cursor-grab active:cursor-grabbing shadow-xs"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Save to Curio</span>
        </a>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied" : "Copy Code"}</span>
        </button>
      </div>

      {hint && (
        <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
          {hint}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        <strong>Desktop:</strong> Drag <strong>Save to Curio</strong> to your bookmarks bar.{" "}
        <strong>Mobile Chrome:</strong> Tap <strong>Copy Code</strong>, bookmark any page, edit the bookmark name to{" "}
        <span className="font-mono">Curio</span> and replace its URL with the copied code, then type{" "}
        <span className="font-mono">Curio</span> in the address bar on any page.
      </p>
    </div>
  );
}

export interface ClipperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClipperModal({ isOpen, onClose }: ClipperModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="curio-clipper-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2
              id="curio-clipper-title"
              className="font-serif font-bold text-base text-neutral-900 dark:text-neutral-100"
            >
              Universal Save to Curio Clipper
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close clipper modal"
            className="p-1.5 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-neutral-700 dark:text-neutral-300">
          <p className="leading-relaxed text-neutral-600 dark:text-neutral-400">
            Captures metadata, composition materials, recipes, prices, highlights, and images directly from any open tab (bypassing HTTP 403 store blocks), saves to Curio, and routes straight to the right app.
          </p>

          <ClipperBookmarkletBar />

          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 p-3.5 space-y-1.5 text-[11px]">
            <div className="font-mono uppercase tracking-wider text-neutral-500 text-[10px]">
              Auto-Routing Rules
            </div>
            <div>Apparel &amp; Wardrobe → <strong>Closet</strong></div>
            <div>Recipes &amp; Cooking → <strong>Chef</strong></div>
            <div>Electronics, Tools &amp; Gear → <strong>My Stuff</strong></div>
            <div>Books, Cinema, Articles &amp; Quotes → <strong>Curio</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}
