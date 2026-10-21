"use client";

import React, { useState } from "react";
import { Quote as QuoteIcon, Copy, Check, ExternalLink, Share2, BookOpen, Pencil } from "lucide-react";
import { QuoteEditor } from "./QuoteEditor";
import { DisambiguationBar, type CandidateFallback } from "../DisambiguationBar";
import type { UserAffiliateTags } from "../CardFooterWaterfall";

export interface QuoteCardProps {
  save: {
    id: string;
    isPrivateMemo?: boolean;
    personalNotes?: string | null;
    userCustomValues?: any;
    candidateFallbacks?: CandidateFallback[] | null;
    typePath?: string | null;
    createdAt: string | Date;
  };
  entity?: {
    id: string;
    title: string;
    summary?: string | null;
    heroImageUrl?: string | null;
    coreType?: string;
    typePath?: string | null;
    brandOrCreator?: string | null;
    canonicalUrl?: string;
    coreStructuredData?: any;
    extendedAttributes?: any;
  } | null;
  primarySource?: any;
  creatorAffiliateTags?: UserAffiliateTags | null;
  onSwapped?: (item: any) => void;
  /** Called after an inline edit is persisted. */
  onQuoteSaved?: (saveId: string, customValues: Record<string, unknown>, privateTitle: string) => void;
  /** Start in edit mode (used by lightbox). */
  startEditing?: boolean;
}

export function QuoteCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
  onQuoteSaved,
  startEditing = false,
}: QuoteCardProps) {
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);
  const [isEditing, setIsEditing] = useState(startEditing);
  const [localCustom, setLocalCustom] = useState<Record<string, any> | null>(null);

  const structured = (typeof entity?.coreStructuredData === "object" && entity?.coreStructuredData) || {};
  const custom: Record<string, any> =
    localCustom || (typeof save?.userCustomValues === "object" && save?.userCustomValues) || {};
  const extended = (typeof entity?.extendedAttributes === "object" && entity?.extendedAttributes) || {};

  // Resolve quotation text
  const quoteText =
    custom.text ||
    custom.quote_text ||
    custom.quoteText ||
    structured.text ||
    structured.quote_text ||
    structured.quoteText ||
    entity?.summary ||
    save?.personalNotes ||
    entity?.title ||
    "";

  // Resolve author attribution
  const author =
    custom.author ||
    custom.speaker ||
    structured.author ||
    structured.speaker ||
    entity?.brandOrCreator ||
    "Anonymous";

  // Resolve date or era
  const date =
    custom.date ||
    custom.year ||
    custom.era ||
    structured.date ||
    structured.year ||
    structured.era ||
    null;

  // Resolve source work or context
  const work =
    custom.work ||
    custom.source ||
    custom.publication ||
    structured.work ||
    structured.source ||
    structured.publication ||
    null;

  const handleCopyQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullText = `"${quoteText}"\n— ${author}${date ? ` (${date})` : ""}${work ? `, ${work}` : ""}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== "undefined") {
      const shareUrl = `${window.location.origin}/#save-${save.id}`;
      navigator.clipboard.writeText(shareUrl);
      setShareFeedback(true);
      setTimeout(() => setShareFeedback(false), 2000);
    }
  };

  // Custom attributes (excluding text, author, date, work)
  const otherCustomEntries = Object.entries(custom).filter(
    ([k]) => !["text", "quote_text", "quoteText", "author", "speaker", "date", "year", "era", "work", "source", "publication"].includes(k)
  );

  return (
    <div
      data-testid="quote-card"
      className="group relative rounded-3xl bg-[#fcfbfa] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-xl transition-all duration-300 border border-neutral-200/90 dark:border-neutral-800 p-6 sm:p-7 flex flex-col justify-between overflow-hidden"
    >
      {/* Decorative Pull-Quote Mark */}
      <div className="absolute top-4 right-6 pointer-events-none select-none text-neutral-200/60 dark:text-neutral-800 text-7xl font-serif leading-none">
        “
      </div>

      <div className="relative z-10">
        {/* Top Header Pill */}
        <div className="flex items-center gap-2 mb-4 pr-28">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60">
            <QuoteIcon className="w-3 h-3" />
            Quote
          </span>

          <div className="flex items-center gap-1.5">
            {date && (
              <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700/60">
                {date}
              </span>
            )}
            {!isEditing && (
              <button
                type="button"
                data-testid="quote-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                title="Edit quote"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <QuoteEditor
            saveId={save.id}
            existingCustom={custom}
            initial={{
              text: String(quoteText || ""),
              author: author === "Anonymous" ? "" : String(author),
              date: date ? String(date) : "",
              work: work ? String(work) : "",
            }}
            onCancel={() => setIsEditing(false)}
            onSaved={({ customValues, privateTitle }) => {
              setLocalCustom(customValues);
              setIsEditing(false);
              onQuoteSaved?.(save.id, customValues, privateTitle);
            }}
          />
        ) : (
          <>

        {/* Main Quotation Body */}
        <blockquote className="my-2">
          <p className="font-serif text-lg sm:text-xl font-medium tracking-tight text-neutral-900 dark:text-neutral-100 leading-relaxed italic">
            "{quoteText}"
          </p>
        </blockquote>

        {/* Author Attribution & Source Work */}
        <div className="mt-4 pt-3 border-t border-neutral-200/70 dark:border-neutral-800/80">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-serif text-base font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
              — {author}
            </span>
          </div>
          {work && (
            <p className="text-xs font-serif italic text-neutral-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-neutral-400 inline shrink-0" />
              <span>{work}</span>
            </p>
          )}
        </div>

          </>
        )}

        {/* Other Custom Overlay Attributes */}
        {otherCustomEntries.length > 0 && (
          <div className="mt-4 pt-3 border-t border-neutral-200/50 dark:border-neutral-800/50 flex flex-wrap gap-2">
            {otherCustomEntries.map(([k, v]) => (
              <span
                key={k}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700"
              >
                <span className="text-neutral-400 dark:text-neutral-500 mr-1">{k}:</span>
                {String(v)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Disambiguation Bar ("Wrong entity?") */}
      {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
        <div className="mt-3 relative z-20">
          <DisambiguationBar
            saveId={save.id}
            candidates={save.candidateFallbacks}
            onSwapped={onSwapped}
          />
        </div>
      )}

      {/* Action Footer Providers */}
      <div className="relative z-10 mt-6 pt-3 border-t border-neutral-200/70 dark:border-neutral-800/80 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          {/* 1-Click Copy Quote */}
          <button
            type="button"
            onClick={handleCopyQuote}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-mono text-[11px] font-medium transition cursor-pointer active:scale-95"
            title="Copy quotation and attribution"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy Quote"}</span>
          </button>

          {/* Search Author on Web/Wikipedia */}
          <a
            href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(author)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-mono text-[11px] font-medium transition cursor-pointer"
            title={`Search ${author} on Wikipedia`}
          >
            <ExternalLink className="w-3 h-3" />
            <span>Search Author</span>
          </a>
        </div>

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShare}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          title="Copy link to quote card"
        >
          {shareFeedback ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
