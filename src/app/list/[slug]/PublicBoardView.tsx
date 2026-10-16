"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, Share2, Check, Layers, User, ArrowLeft } from "lucide-react";
import { SectionGroupView } from "@/components/lists/SectionGroupView";
import type { ListWithSections } from "@/lib/lists/service";

export function PublicBoardView({ data }: { data: ListWithSections }) {
  const [copied, setCopied] = useState(false);
  const { list, owner, itemCount, sections } = data;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] py-12 px-4 sm:px-6 lg:px-8">
      {/* Top Navigation */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-8 pb-4 border-b border-neutral-200/60 dark:border-neutral-800">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Curio Board Feed</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 transition cursor-pointer shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Board</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editorial Board Hero Header */}
      <div className="max-w-4xl mx-auto text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 text-xs font-semibold tracking-wide uppercase mb-4">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Curio Editorial Collection • {itemCount} {itemCount === 1 ? "Item" : "Items"}
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 mb-4 font-serif">
          {list.title}
        </h1>

        {list.description && (
          <p className="text-base sm:text-lg font-serif italic text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed mb-6">
            "{list.description}"
          </p>
        )}

        {/* Curator Profile Tag */}
        {owner && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs text-xs text-neutral-600 dark:text-neutral-400">
            {owner.avatarUrl ? (
              <img
                src={owner.avatarUrl}
                alt={owner.username}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold">
                {owner.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span>
              Curated by <strong className="text-neutral-900 dark:text-neutral-200">@{owner.username}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Sections and Cards Grid */}
      <div className="max-w-6xl mx-auto">
        <SectionGroupView sections={sections} />
      </div>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto text-center mt-20 pt-8 border-t border-neutral-200/60 dark:border-neutral-800 text-xs text-neutral-400">
        <p>
          Curated with <strong className="text-neutral-700 dark:text-neutral-300 font-serif">Curio</strong>.
          Every card links to canonical merchant sources with verified curation provenance.
        </p>
      </footer>
    </main>
  );
}
