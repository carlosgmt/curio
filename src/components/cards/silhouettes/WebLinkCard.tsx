"use client";

import React, { useState } from "react";
import { Globe, ExternalLink, Clock, Copy, Check, Bookmark } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function WebLinkCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const [copied, setCopied] = useState(false);
  const data = (typeof entity?.coreStructuredData === "object" && entity.coreStructuredData) || {};

  const title = entity?.title || "Web Link";
  const url = entity?.canonicalUrl || data.rawUrl || "#";
  let domain = "web";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = data.domain || data.siteName || "article";
  }

  const excerpt = entity?.summary || data.description || "Saved article link.";
  const readingTime = data.readingTimeMinutes || Math.max(1, Math.round(excerpt.length / 250));
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      data-testid="weblink-card"
      className="group relative rounded-2xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm hover:shadow-lg transition-all duration-300 border border-stone-200 dark:border-stone-800 flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex flex-col">
        {/* Top Domain & Favicon Ribbon */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={faviconUrl}
              alt=""
              className="w-4 h-4 rounded-xs shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <span className="text-xs font-mono font-semibold text-stone-600 dark:text-stone-400 truncate">
              {domain}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="flex items-center gap-1 text-[10px] font-mono text-stone-400">
              <Clock className="w-3 h-3" />
              <span>{readingTime} min read</span>
            </span>

            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy URL"
              className="p-1 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Thumbnail if present */}
        {entity?.heroImageUrl && (
          <div className="relative aspect-16/9 w-full rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 mb-3">
            <img
              src={entity.heroImageUrl}
              alt={title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
            />
          </div>
        )}

        {/* Article Headline */}
        <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-50 leading-snug mb-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
          <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {title}
          </a>
        </h3>

        {/* Excerpt */}
        <p className="text-xs font-serif text-stone-600 dark:text-stone-300 line-clamp-3 leading-relaxed mb-4">
          {excerpt}
        </p>

        {/* Action Button: Open Outbound */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="outbound-link"
          className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-stone-900 text-white dark:bg-white dark:text-stone-900 text-xs font-semibold hover:bg-stone-800 active:scale-98 transition shadow-xs mt-auto"
        >
          <span>Read on {domain}</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </a>
      </div>

      {/* Disambiguation Bar */}
      <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={onSwapped}
        />

      {/* Footer */}
      {entity && (
        <CardFooterWaterfall
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
        />
      )}
    </div>
  );
}
