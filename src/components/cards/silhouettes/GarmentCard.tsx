"use client";

import React from "react";
import { Shirt, Droplets } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function GarmentCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  wearLinkCount = 0,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const brand = entity.brandOrCreator || data.brand || "Wardrobe";
  const garmentName = entity.title;
  const material = data.material || data.fabric || null;
  const weight = data.weight || null;
  const swatchHex = data.colorHex || null;
  const colorLabel = data.color || null;

  const custom = (typeof save.userCustomValues === "object" && save.userCustomValues) || {};
  const autoTags = ((save as any).autoTags || []) as string[];
  const category =
    data.category ||
    custom.category ||
    autoTags.find((t: string) =>
      ["footwear", "tops", "bottoms", "outerwear", "accessories"].includes(t.toLowerCase())
    );
  const subtype = data.subtype || custom.subtype;
  const size = data.size || custom.size;
  const season = data.season || custom.season;
  const rawTimesWorn = Number(custom.timesWorn ?? data.timesWorn ?? 0);
  const totalWears = Math.max(Number.isFinite(rawTimesWorn) ? rawTimesWorn : 0, wearLinkCount || 0);
  const isWaterproof = Boolean(custom.isWaterproof ?? data.isWaterproof);
  const inLaundry = Boolean(custom.inLaundry ?? data.inLaundry);
  const heroUrl = entity.heroImageUrl || "";
  const isCutoutImage =
    Boolean(data.hasCutout) ||
    heroUrl.includes("/cutouts/") ||
    heroUrl.toLowerCase().endsWith(".png");

  const metaParts = [
    category,
    subtype && String(subtype).toLowerCase() !== String(category || "").toLowerCase()
      ? subtype
      : null,
    size ? `Size ${size}` : null,
  ].filter(Boolean);

  const statusPills: Array<{ key: string; label: string; tone: string }> = [];
  if (inLaundry) {
    statusPills.push({
      key: "laundry",
      label: "In Laundry",
      tone: "text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border-sky-200/60 dark:border-sky-800/60",
    });
  }
  if (isWaterproof) {
    statusPills.push({
      key: "waterproof",
      label: "Waterproof",
      tone: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-800/60",
    });
  }

  return (
    <div
      data-testid="garment-card"
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      {/* Visual Header / Garment Studio Well */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        {/* Hero Image */}
        {heroUrl ? (
          <div className="relative aspect-[4/3.6] w-full rounded-[8px] overflow-hidden mb-3 bg-[var(--well-surface)] flex items-center justify-center">
            <img
              src={heroUrl}
              alt={garmentName}
              referrerPolicy="no-referrer"
              className={`w-full h-full group-hover:scale-[1.02] transition-transform duration-300 ${
                isCutoutImage
                  ? "object-contain p-4 drop-shadow-[0_10px_18px_rgba(24,22,18,0.14)]"
                  : "object-cover"
              }`}
            />
          </div>
        ) : (
          <div className="w-full aspect-[4/3] rounded-[8px] bg-[var(--well-surface)] flex items-center justify-center text-muted-foreground mb-3">
            <Shirt className="w-8 h-8 stroke-1" aria-hidden="true" />
          </div>
        )}

        {/* Museum Label Caption */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-[15px] font-medium text-foreground leading-snug line-clamp-2">
              {garmentName}
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {[brand, ...metaParts].filter(Boolean).join(" · ")}
            </p>
          </div>
          {totalWears > 0 && (
            <span
              data-testid="garment-wear-count"
              className="text-[11px] font-mono tabular-nums font-medium text-[var(--brand)] shrink-0"
            >
              Worn {totalWears}×
            </span>
          )}
        </div>

        {/* Optional Color Swatch & Minimal Status Metadata */}
        {(swatchHex || colorLabel || season || statusPills.length > 0 || material || weight) && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-[11px] font-mono tabular-nums text-muted-foreground">
            {(swatchHex || colorLabel) && (
              <span className="inline-flex items-center gap-1.5">
                {swatchHex && (
                  <span
                    data-testid="garment-swatch"
                    className="inline-block w-2.5 h-2.5 rounded-sm border border-[var(--gallery-hairline)]"
                    style={{ backgroundColor: swatchHex }}
                    title={`Swatch: ${swatchHex}`}
                  />
                )}
                {colorLabel && <span>{colorLabel}</span>}
              </span>
            )}
            {season && <span className="truncate max-w-[140px]">{season}</span>}
            {(material || weight) && (
              <span className="truncate max-w-[160px]">{[material, weight].filter(Boolean).join(" · ")}</span>
            )}
            {statusPills.slice(0, 2).map((pill) => (
              <span key={pill.key} className="inline-flex items-center gap-1 text-[10px] text-[var(--brand)]">
                {pill.key === "waterproof" && <Droplets className="w-2.5 h-2.5" aria-hidden="true" />}
                <span>{pill.label}</span>
              </span>
            ))}
          </div>
        )}

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={onSwapped}
        />
      </div>

      {/* Hover/Focus-Revealed Footer Overlay */}
      <div className="curio-hover-footer">
        <CardFooterWaterfall
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          isWishlist={Boolean(save.wishlist)}
        />
      </div>
    </div>
  );
}
