"use client";

import React, { useState } from "react";
import { BookOpen, Bookmark, Quote, CheckCircle2, Clock, Check, Plus, Trash2, ShoppingBag, ExternalLink } from "lucide-react";
import type { CulturalModeProps } from "./CinemaCulturalMode";
import { buildAffiliateUrl } from "@/lib/commerce/affiliate";
import { apiFetch } from "@/lib/apiClient";

type ReadingStatus = "WANT_TO_READ" | "READING" | "FINISHED";

export function BookCulturalMode({ save, entity, primarySource, creatorAffiliateTags }: CulturalModeProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity?.coreStructuredData) || {};
  const customValues = (typeof save?.userCustomValues === "object" && save?.userCustomValues) || {};

  const [readingStatus, setReadingStatus] = useState<ReadingStatus>(
    (customValues.readingStatus as ReadingStatus) || "WANT_TO_READ"
  );
  const [quotes, setQuotes] = useState<string[]>(
    Array.isArray(customValues.marginQuotes) ? customValues.marginQuotes : []
  );
  const [newQuote, setNewQuote] = useState("");
  const [isAddingQuote, setIsAddingQuote] = useState(false);

  const author = data.author || entity?.brandOrCreator || "Unknown Author";
  const publisher = data.publisher || "Curio Editions";
  const isbn = data.isbn ? `ISBN ${data.isbn}` : entity?.canonicalExternalId || "FIRST EDITION";
  const pages = data.pages || data.numberOfPagesMedian ? `${data.pages || data.numberOfPagesMedian} PAGES` : "320 PAGES";
  const releaseYear = data.releaseYear || data.firstPublishYear || "2021";

  const handleStatusChange = async (status: ReadingStatus) => {
    setReadingStatus(status);
    try {
      await apiFetch(`/api/v1/saves/${save.id}/custom-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customValues: {
            readingStatus: status,
          },
        }),
      });
    } catch (err) {
      console.error("Failed to update reading status:", err);
    }
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuote.trim()) return;

    const nextQuotes = [...quotes, newQuote.trim()];
    setQuotes(nextQuotes);
    setNewQuote("");
    setIsAddingQuote(false);

    try {
      await apiFetch(`/api/v1/saves/${save.id}/custom-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customValues: {
            marginQuotes: nextQuotes,
          },
        }),
      });
    } catch (err) {
      console.error("Failed to add margin quote:", err);
    }
  };

  const handleRemoveQuote = async (index: number) => {
    const nextQuotes = quotes.filter((_, i) => i !== index);
    setQuotes(nextQuotes);

    try {
      await apiFetch(`/api/v1/saves/${save.id}/custom-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customValues: {
            marginQuotes: nextQuotes,
          },
        }),
      });
    } catch (err) {
      console.error("Failed to remove quote:", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#fcfbfa] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xl">
      {/* Book Jacket Aspect Frame */}
      <div className="relative aspect-[1/1.4] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
        {/* Physical Spine Shadow on Left Edge */}
        <div
          className="absolute inset-y-0 left-0 w-6 z-20 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(255,255,255,0.2) 25%, rgba(0,0,0,0.15) 50%, transparent 100%)",
          }}
        />

        {entity?.heroImageUrl ? (
          <img
            src={entity.heroImageUrl}
            alt={entity.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-between p-8 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-neutral-800 dark:to-neutral-900 text-center">
            <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500">
              {publisher}
            </span>
            <div className="my-auto">
              <h3 className="font-serif text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {entity?.title || "Literary Edition"}
              </h3>
              <p className="text-base font-serif italic text-neutral-600 dark:text-neutral-400 mt-2">
                by {author}
              </p>
            </div>
            <span className="text-[10px] font-mono text-neutral-400">{isbn}</span>
          </div>
        )}

        {/* Japanese Obi Belly-Band (帯) */}
        <div className="absolute inset-x-0 bottom-4 z-10 mx-4 rounded-xl bg-neutral-950/90 dark:bg-amber-100/95 text-white dark:text-neutral-950 p-3.5 shadow-lg backdrop-blur-xs border border-white/10 dark:border-amber-300/50">
          <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-amber-400 dark:text-amber-800 font-bold mb-1">
            <Bookmark className="w-3.5 h-3.5 fill-current" />
            <span>Curio Selected Edition • {releaseYear}</span>
          </div>
          <p className="font-serif italic text-xs leading-snug line-clamp-2">
            "{entity?.summary || "A resonant cultural work exploring memory and observation."}"
          </p>
        </div>
      </div>

      {/* Reading Progress Selector */}
      <div className="p-5 border-t border-neutral-200 dark:border-neutral-800 space-y-4">
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-2">
            Reading Progress
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              data-reading-status="WANT_TO_READ"
              onClick={() => handleStatusChange("WANT_TO_READ")}
              className={`p-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                readingStatus === "WANT_TO_READ"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-2xs font-semibold"
                  : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>To Read</span>
            </button>

            <button
              type="button"
              data-reading-status="READING"
              onClick={() => handleStatusChange("READING")}
              className={`p-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                readingStatus === "READING"
                  ? "bg-amber-500 text-neutral-950 border-amber-500 shadow-2xs font-bold"
                  : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Reading</span>
            </button>

            <button
              type="button"
              data-reading-status="FINISHED"
              onClick={() => handleStatusChange("FINISHED")}
              className={`p-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                readingStatus === "FINISHED"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                  : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Finished</span>
            </button>
          </div>
        </div>

        {/* Margin Quotes & Highlights */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
              Margin Quotes & Passages ({quotes.length})
            </span>
            <button
              type="button"
              onClick={() => setIsAddingQuote(!isAddingQuote)}
              className="text-[10px] font-mono font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Quote</span>
            </button>
          </div>

          {isAddingQuote && (
            <form onSubmit={handleAddQuote} className="mb-3 space-y-2">
              <textarea
                rows={2}
                value={newQuote}
                onChange={(e) => setNewQuote(e.target.value)}
                placeholder="Type or paste memorable passage..."
                className="w-full text-xs p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-serif focus:outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddingQuote(false)}
                  className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                >
                  Save Passage
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {quotes.length === 0 ? (
              <p className="text-xs text-neutral-400 italic font-serif">
                No passages highlighted yet. Click "+ Add Quote" to record resonant excerpts.
              </p>
            ) : (
              quotes.map((quote, idx) => (
                <div
                  key={idx}
                  className="group relative p-3 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 text-xs font-serif italic text-neutral-800 dark:text-neutral-200 leading-relaxed"
                >
                  <Quote className="w-3 h-3 text-neutral-400 inline mr-1 opacity-50" />
                  "{quote}"
                  <button
                    type="button"
                    onClick={() => handleRemoveQuote(idx)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-500 transition cursor-pointer p-0.5"
                    title="Delete quote"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Telemetry Bar & Creator-Attributed Affiliate CTA */}
        <div className="pt-3 border-t border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between text-[10px] font-mono text-neutral-400">
          <div className="flex items-center gap-2">
            <span>{publisher}</span>
            <span>•</span>
            <span>{pages}</span>
          </div>
          <a
            href={buildAffiliateUrl(
              primarySource?.sourceUrl || entity?.canonicalUrl || `https://bookshop.org/books?keywords=${encodeURIComponent(entity?.title || "")}`,
              primarySource?.sellerName || "Bookshop.org",
              primarySource?.affiliateTemplate,
              creatorAffiliateTags
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition shadow-2xs cursor-pointer"
          >
            <ShoppingBag className="w-3 h-3" />
            <span>Get on {primarySource?.sellerName || "Bookshop.org"}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>
        </div>
      </div>
    </div>
  );
}
