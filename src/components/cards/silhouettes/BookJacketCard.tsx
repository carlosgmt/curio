"use client";

import React from "react";
import { Bookmark } from "lucide-react";
import { sanitizeGoodreadsNote } from "@/lib/books/identity";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

function cleanBookObiText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = sanitizeGoodreadsNote(raw);
  if (!cleaned || /^a definitive work by\b/i.test(cleaned)) return null;
  return cleaned;
}

export function BookJacketCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const ext = (typeof entity.extendedAttributes === "object" && entity.extendedAttributes) || {};
  const author = data.author || ext.author || entity.brandOrCreator || null;
  const publisher = data.publisher || ext.publisher || null;
  const isbn = data.isbn ? `ISBN ${data.isbn}` : null;
  const obiQuote =
    cleanBookObiText(data.obiText) || cleanBookObiText(save.personalNotes) || null;

  const byline = [author ? `by ${author}` : null, publisher].filter(Boolean).join(" · ");

  return (
    <div
      data-testid="book-jacket-card"
      className="group relative rounded-2xl bg-[#fcfbfa] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-xl transition-shadow duration-200 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Book Jacket Cover */}
      <div className="relative aspect-[1/1.45] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        {/* Physical Spine Shadow & Highlight on Left Edge */}
        <div
          className="absolute inset-y-0 left-0 w-5 z-20 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.25) 0%, rgba(255,255,255,0.2) 25%, rgba(0,0,0,0.15) 50%, transparent 100%)",
          }}
        />

        {entity.heroImageUrl ? (
          <img
            src={entity.heroImageUrl}
            alt={entity.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-103"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-between p-6 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-neutral-800 dark:to-neutral-900 text-center">
            {publisher ? (
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500">
                {publisher}
              </span>
            ) : (
              <span />
            )}
            <div className="my-auto">
              <h4 className="font-serif text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {entity.title}
              </h4>
              {author && (
                <p className="text-sm font-serif italic text-neutral-600 dark:text-neutral-400 mt-2">
                  by {author}
                </p>
              )}
            </div>
            {isbn ? <span className="text-[9px] font-mono tabular-nums text-neutral-400">{isbn}</span> : <span />}
          </div>
        )}

        {/* Tactile Obi Belly-Band (rendered only when real curator note or obiText exists) */}
        {obiQuote && (
          <div className="absolute inset-x-0 bottom-4 z-10 mx-2 rounded-lg bg-neutral-950/90 dark:bg-amber-100/95 text-white dark:text-neutral-950 p-3 shadow-lg backdrop-blur-xs border border-white/10 dark:border-amber-300/50">
            <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-amber-400 dark:text-amber-800 font-bold mb-1">
              <Bookmark className="w-3 h-3 fill-current" aria-hidden="true" />
              <span>Curator Note</span>
            </div>
            <p className="text-xs font-serif italic line-clamp-2 leading-snug">
              &ldquo;{obiQuote}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Book Metadata Below Cover */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 mb-1">
            <span className="uppercase font-semibold tracking-wider text-amber-700 dark:text-amber-400">
              Book
            </span>
            {isbn && <span className="tabular-nums">{isbn}</span>}
          </div>
          <h3 className="font-serif text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-50 leading-snug line-clamp-2">
            {entity.title}
          </h3>
          {byline && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 font-sans mt-0.5 line-clamp-1">
              {byline}
            </p>
          )}
        </div>

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={() => onSwapped?.(save)}
        />

        {/* Waterfall Footer */}
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/product/book",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Read Sample"
          isWishlist={Boolean(save.wishlist)}
          flush
        />
      </div>
    </div>
  );
}
