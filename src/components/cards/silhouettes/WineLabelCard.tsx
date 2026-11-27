"use client";

import React from "react";
import { Wine, MapPin } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function WineLabelCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const producer = data.producer || entity.brandOrCreator || null;
  const cuvee = data.cuvee || entity.title;
  const vintage = data.vintage || null;
  const appellation = data.appellation || null;
  const region = data.region
    ? data.country
      ? `${data.region}, ${data.country}`
      : data.region
    : data.country || null;
  const varietal = data.varietal || null;
  const farming = data.farming || null;
  const abv = data.abv ? `${data.abv}% ABV` : null;

  const originText = [appellation, region].filter(Boolean).join(" · ");
  const specEntries = [
    varietal ? { label: "Varietal", value: varietal } : null,
    farming ? { label: "Farming", value: farming } : null,
    abv ? { label: "Alc / Vol", value: abv } : null,
  ].filter((x): x is { label: string; value: string } => Boolean(x));

  return (
    <div
      data-testid="wine-label-card"
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      {/* Editorial Wine Label Slip */}
      <div className="p-5 sm:p-6 relative flex flex-col items-center text-center flex-1">
        <div className="w-8 h-8 rounded-full border border-[var(--gallery-hairline)] bg-[var(--well-surface)] flex items-center justify-center text-[var(--brand)] mb-3">
          <Wine className="w-4 h-4" aria-hidden="true" />
        </div>

        {producer && (
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-1">
            {producer}
          </span>
        )}
        <h3 className="font-serif-editorial text-xl font-medium tracking-tight text-foreground mb-0.5">
          {cuvee}
        </h3>
        {vintage && (
          <span className="font-serif italic text-sm tabular-nums text-[var(--brand)] mb-2">
            {vintage}
          </span>
        )}

        {originText && (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>{originText}</span>
          </p>
        )}

        {specEntries.length > 0 && (
          <div
            className={`w-full grid gap-2 border-t border-[var(--gallery-hairline)] pt-3 mt-auto text-[10px] font-mono text-muted-foreground ${
              specEntries.length === 1
                ? "grid-cols-1"
                : specEntries.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
            }`}
          >
            {specEntries.map((spec) => (
              <div key={spec.label}>
                <span className="block text-[8px] uppercase text-muted-foreground/75">{spec.label}</span>
                <span className="text-foreground truncate block tabular-nums">{spec.value}</span>
              </div>
            ))}
          </div>
        )}

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={() => onSwapped?.(save)}
        />
      </div>

      {/* Hover/Focus-Revealed Footer */}
      <div className="curio-hover-footer">
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/product/beverage/wine",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Vivino Review"
          isWishlist={Boolean(save.wishlist)}
        />
      </div>
    </div>
  );
}
