"use client";

import React from "react";
import { Lock, ExternalLink, Tag, ShoppingBag, BookOpen, Coffee, Film, Sparkles } from "lucide-react";
import { DisambiguationBar, type CandidateFallback } from "./DisambiguationBar";

export interface CardData {
  save: {
    id: string;
    isPrivateMemo: boolean;
    privateTitle?: string | null;
    personalNotes?: string | null;
    candidateFallbacks?: CandidateFallback[] | null;
    createdAt: string | Date;
  };
  entity?: {
    id: string;
    title: string;
    summary?: string | null;
    heroImageUrl?: string | null;
    coreType: string;
    canonicalUrl: string;
    priceCents?: number | null;
    currency?: string | null;
    ucpSkuId?: string | null;
  } | null;
}

export function PolymorphicCard({
  item,
  onSwapped,
}: {
  item: CardData;
  onSwapped?: (item: CardData) => void;
}) {
  const { save, entity } = item;

  // 1. Private Memo Card (FR-1.2 Privacy Gate)
  if (save.isPrivateMemo || !entity) {
    return (
      <div className="group relative rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 p-5 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/50 px-2.5 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5" />
            Private Memo
          </span>
          <span className="text-[11px] text-neutral-400">
            {new Date(save.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
          {save.privateTitle || "Personal Note"}
        </h3>

        <p className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
          {save.personalNotes}
        </p>

        <div className="mt-4 pt-3 border-t border-amber-200/40 dark:border-amber-900/40 flex items-center justify-between text-[11px] text-amber-800/70 dark:text-amber-400/70 font-mono">
          <span>Isolated to local memory</span>
          <span>Never touches public web</span>
        </div>
      </div>
    );
  }

  // 2. Public Entity Card (Polymorphic)
  const formatPrice = (cents?: number | null, curr = "USD") => {
    if (cents == null) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr || "USD",
    }).format(cents / 100);
  };

  const getCoreIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case "BOOK":
        return <BookOpen className="w-3.5 h-3.5 text-indigo-500" />;
      case "PLACE":
        return <Coffee className="w-3.5 h-3.5 text-emerald-500" />;
      case "MEDIA":
        return <Film className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  return (
    <div className="group relative rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
      {entity.heroImageUrl && (
        <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          <img
            src={entity.heroImageUrl}
            alt={entity.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
          />
          {entity.priceCents != null && (
            <span className="absolute bottom-2.5 right-2.5 bg-neutral-900/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm shadow">
              {formatPrice(entity.priceCents, entity.currency || "USD")}
            </span>
          )}
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-full">
              {getCoreIcon(entity.coreType)}
              {entity.coreType}
            </span>

            {entity.canonicalUrl && (
              <a
                href={entity.canonicalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition p-1"
                title="Open canonical source"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1 leading-snug">
            {entity.title}
          </h3>

          {entity.summary && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-3 leading-relaxed mb-3">
              {entity.summary}
            </p>
          )}

          {entity.ucpSkuId && (
            <div className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded mb-3">
              <Sparkles className="w-3 h-3" />
              Google UCP Verified
            </div>
          )}
        </div>

        {/* 1-Tap Candidate Disambiguation Bar */}
        {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
          <DisambiguationBar
            saveId={save.id}
            candidates={save.candidateFallbacks}
            onSwapped={() => {
              if (onSwapped) onSwapped(item);
            }}
          />
        )}
      </div>
    </div>
  );
}
