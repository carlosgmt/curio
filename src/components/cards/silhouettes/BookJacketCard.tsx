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
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
        {/* Book Jacket Gallery Stage */}
        <div className="relative aspect-[4/4.3] w-full rounded-[8px] bg-[var(--well-surface)] flex items-center justify-center p-4 mb-3 overflow-hidden">
          <div className="relative h-full aspect-[1/1.45] max-w-full rounded-r-[4px] overflow-hidden shadow-[6px_12px_24px_rgba(24,22,18,0.22)]">
            {/* Physical Spine Shadow & Highlight on Left Edge */}
            <div
              className="absolute inset-y-0 left-0 w-4 z-20 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to right, rgba(0,0,0,0.26) 0%, rgba(255,255,255,0.18) 25%, rgba(0,0,0,0.12) 55%, transparent 100%)",
              }}
            />

            {entity.heroImageUrl ? (
              <img
                src={entity.heroImageUrl}
                alt={entity.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-between p-4 bg-[#294A3B] text-[#F2EFE9] text-center">
                {publisher ? (
                  <span className="text-[9px] uppercase font-mono tracking-widest text-[#C89572]">
                    {publisher}
                  </span>
                ) : (
                  <span />
                )}
                <div className="my-auto">
                  <h4 className="font-serif-editorial text-lg font-medium tracking-tight leading-snug">
                    {entity.title}
                  </h4>
                  {author && (
                    <p className="text-xs font-serif italic text-[#D5E0D9] mt-1.5">
                      by {author}
                    </p>
                  )}
                </div>
                {isbn ? <span className="text-[8px] font-mono tabular-nums text-[#C89572]">{isbn}</span> : <span />}
              </div>
            )}

            {/* Tactile Obi Belly-Band (rendered only when real curator note or obiText exists) */}
            {obiQuote && (
              <div className="absolute inset-x-0 bottom-2 z-10 mx-2 rounded-md bg-neutral-950/90 text-white p-2.5 shadow-md backdrop-blur-xs border border-white/10">
                <div className="flex items-center gap-1 text-[8px] font-mono uppercase tracking-widest text-[#C89572] mb-0.5">
                  <Bookmark className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                  <span>Curator Note</span>
                </div>
                <p className="text-[11px] font-serif italic line-clamp-2 leading-snug">
                  &ldquo;{obiQuote}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Clean Museum Label Below Jacket */}
        <div>
          <h3 className="font-serif-editorial text-base sm:text-[17px] font-medium text-foreground leading-snug line-clamp-2">
            {entity.title}
          </h3>
          {byline && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {byline}
            </p>
          )}
        </div>

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={() => onSwapped?.(save)}
        />
      </div>

      {/* Hover/Focus-Revealed Waterfall Footer */}
      <div className="curio-hover-footer">
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/product/book",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Read Sample"
          isWishlist={Boolean(save.wishlist)}
        />
      </div>
    </div>
  );
}
