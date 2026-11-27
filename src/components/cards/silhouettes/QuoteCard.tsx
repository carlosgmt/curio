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
      className="curio-gallery-card group relative p-5 sm:p-6 flex flex-col justify-between overflow-hidden"
    >
      <div className="relative z-10">
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
            {/* Optical Serif Excerpt */}
            <blockquote className="my-1">
              <p className="font-serif-editorial text-xl sm:text-[22px] font-normal tracking-[-0.015em] text-foreground leading-relaxed">
                &ldquo;{quoteText}&rdquo;
              </p>
            </blockquote>

            {/* Author Attribution & Source Work */}
            <div className="mt-5 pt-3 border-t border-[var(--gallery-hairline)] flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-medium text-muted-foreground">
                  — {author}
                  {date ? ` · ${date}` : ""}
                </span>
                {work && (
                  <p className="text-xs font-serif italic text-muted-foreground/85 mt-0.5 truncate">
                    {work}
                  </p>
                )}
              </div>

              {!isEditing && (
                <button
                  type="button"
                  data-testid="quote-edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  className="curio-hover-chrome p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition cursor-pointer shrink-0"
                  title="Edit quote"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        )}

        {otherCustomEntries.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {otherCustomEntries.slice(0, 3).map(([k, v]) => (
              <span
                key={k}
                className="text-[10px] font-mono text-muted-foreground"
              >
                {k}: {String(v)}
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

      {/* Hover/Focus-Revealed Quote Action Overlay */}
      <div className="curio-hover-footer px-4 py-2.5 border-t border-[var(--gallery-hairline)] flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyQuote}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-secondary/80 text-foreground font-mono text-[11px] transition cursor-pointer"
            title="Copy quotation and attribution"
          >
            {copied ? <Check className="w-3 h-3 text-[var(--positive)]" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy Quote"}</span>
          </button>

          <a
            href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(author)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground font-mono text-[11px] transition cursor-pointer"
            title={`Search ${author} on Wikipedia`}
          >
            <ExternalLink className="w-3 h-3" />
            <span>Author</span>
          </a>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition cursor-pointer"
          title="Copy link to quote card"
        >
          {shareFeedback ? <Check className="w-3.5 h-3.5 text-[var(--positive)]" /> : <Share2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
