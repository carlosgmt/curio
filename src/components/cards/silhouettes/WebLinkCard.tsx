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
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex flex-col">
        {/* Clean Editorial Source Domain & Reading Time */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={faviconUrl}
              alt=""
              className="w-3.5 h-3.5 rounded-xs shrink-0 opacity-80"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <span className="text-xs font-mono text-muted-foreground truncate">
              {domain}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground/80">
              {readingTime} min
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy URL"
              className="curio-hover-chrome p-1 rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition"
            >
              {copied ? <Check className="w-3 h-3 text-[var(--positive)]" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Thumbnail if present */}
        {entity?.heroImageUrl && (
          <div className="relative aspect-[16/10] w-full rounded-[8px] overflow-hidden bg-[var(--well-surface)] mb-3">
            <img
              src={entity.heroImageUrl}
              alt={title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          </div>
        )}

        {/* Article Headline */}
        <h3 className="font-serif-editorial text-lg font-medium text-foreground leading-snug mb-1.5 group-hover:text-[var(--brand)] transition-colors">
          <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">
            {title}
          </a>
        </h3>

        {/* Excerpt */}
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {excerpt}
        </p>

        {/* Quiet Editorial Read Link */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="outbound-link"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 mt-3 text-xs font-mono text-[var(--brand)] hover:underline underline-offset-4 transition w-fit"
        >
          <span>Read on {domain}</span>
          <ExternalLink className="w-3 h-3 opacity-75" aria-hidden="true" />
        </a>
      </div>

      <DisambiguationBar
        saveId={save.id}
        candidates={save.candidateFallbacks || []}
        onSwapped={onSwapped}
      />

      {/* Hover/Focus-Revealed Footer */}
      {entity && (
        <div className="curio-hover-footer">
          <CardFooterWaterfall
            entity={entity}
            primarySource={primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
            isWishlist={Boolean(save.wishlist)}
          />
        </div>
      )}
    </div>
  );
}
