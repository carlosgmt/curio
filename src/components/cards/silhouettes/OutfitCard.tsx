"use client";

import React, { useState } from "react";
import {
  Sun,
  CloudRain,
  Cloud,
  Calendar,
  MapPin,
  Shirt,
} from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import type { SilhouetteCardProps } from "./VinylDiscCard";

interface OutfitGarmentItem {
  id: number;
  title: string;
  brand: string;
  category?: string;
  color?: string;
  colorHex?: string;
  photoUrl?: string | null;
  saveId?: string;
}

const MAX_OUTFIT_THUMBS = 5;
const MAX_OUTFIT_ITEMS = 3;

export function OutfitCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
}: SilhouetteCardProps) {
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number>(0);
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const custom = (typeof save.userCustomValues === "object" && save.userCustomValues) || {};

  const title = entity.title || "Outfit Ensemble";
  const items: OutfitGarmentItem[] = Array.isArray(data.items) ? data.items : [];
  const datesWorn: string[] = Array.isArray(data.datesWorn)
    ? data.datesWorn
    : Array.isArray(custom.datesWorn)
    ? custom.datesWorn
    : [];
  const timesWorn = data.timesWorn || datesWorn.length || 1;
  const weather = data.weatherCondition || custom.weatherCondition;
  const temp = data.temperature ?? custom.temperature;
  const location = data.location || custom.location;
  const notes = data.notes || save.personalNotes;

  const itemPhotos: Array<{ url: string; title: string; brand: string }> = items
    .filter((it) => it.photoUrl)
    .map((it) => ({
      url: it.photoUrl as string,
      title: it.title,
      brand: it.brand,
    }));

  const garmentPhotos: Array<{ url: string; title: string; brand: string }> =
    entity.heroImageUrl && !itemPhotos.some((p) => p.url === entity.heroImageUrl)
      ? [
          {
            url: entity.heroImageUrl,
            title,
            brand: data.kind === "idea" ? "Saved Look" : "Outfit Look",
          },
          ...itemPhotos,
        ]
      : itemPhotos;

  const visibleThumbPhotos = garmentPhotos.slice(0, MAX_OUTFIT_THUMBS);
  const overflowThumbCount = Math.max(0, garmentPhotos.length - visibleThumbPhotos.length);
  const activePhoto = garmentPhotos[selectedPhotoIdx] || garmentPhotos[0];
  const isTransparentAsset = (url?: string | null) =>
    Boolean(url && (url.includes("/cutouts/") || url.includes("/covers/") || url.toLowerCase().endsWith(".png")));

  const renderWeatherIcon = (w?: string) => {
    if (!w) return null;
    const lower = w.toLowerCase();
    if (lower.includes("sun") || lower.includes("clear")) {
      return <Sun className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />;
    }
    if (lower.includes("rain") || lower.includes("shower")) {
      return <CloudRain className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />;
    }
    return <Cloud className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />;
  };

  const visibleItems = items.slice(0, MAX_OUTFIT_ITEMS);
  const overflowItemCount = Math.max(0, items.length - visibleItems.length);

  return (
    <div
      data-testid="outfit-card"
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      {/* Visual Header / Garment Photos Canvas */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        {/* Outfit Photo Visual Hero */}
        {activePhoto ? (
          <div className="relative aspect-[4/3.6] w-full rounded-[8px] overflow-hidden mb-3 bg-[var(--well-surface)] flex items-center justify-center">
            <img
              src={activePhoto.url}
              alt={activePhoto.title}
              className={`w-full h-full group-hover:scale-[1.02] transition-transform duration-300 ${
                isTransparentAsset(activePhoto.url)
                  ? "object-contain p-3 drop-shadow-[0_10px_18px_rgba(24,22,18,0.14)]"
                  : "object-cover"
              }`}
            />
            {selectedPhotoIdx > 0 && (
              <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-white text-[10px] font-mono flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{activePhoto.brand}</span>
                <span className="truncate opacity-80">{activePhoto.title}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-[4/3] rounded-[8px] bg-[var(--well-surface)] flex items-center justify-center text-muted-foreground mb-3">
            <Shirt className="w-8 h-8 stroke-1" aria-hidden="true" />
          </div>
        )}

        {/* Multi-Garment Photo Thumbnails Strip (capped at 5 + N) */}
        {garmentPhotos.length > 1 && (
          <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-0.5 scrollbar-none">
            {visibleThumbPhotos.map((photo, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPhotoIdx(idx);
                }}
                className={`relative w-9 h-9 rounded-md overflow-hidden shrink-0 border transition-colors duration-150 cursor-pointer bg-[var(--well-surface)] ${
                  selectedPhotoIdx === idx
                    ? "border-[var(--brand)] ring-1 ring-[var(--brand)]/25"
                    : "border-[var(--gallery-hairline)] opacity-75 hover:opacity-100"
                }`}
              >
                <img
                  src={photo.url}
                  alt={photo.title}
                  className={`w-full h-full ${
                    isTransparentAsset(photo.url) ? "object-contain p-1" : "object-cover"
                  }`}
                />
              </button>
            ))}
            {overflowThumbCount > 0 && (
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-[var(--well-surface)] border border-[var(--gallery-hairline)] text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
                +{overflowThumbCount}
              </span>
            )}
          </div>
        )}

        {/* Outfit Title & Date / Worn Count */}
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm sm:text-[15px] font-medium text-foreground leading-snug line-clamp-1">
            {title}
          </h3>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0">
            {datesWorn[0] ? datesWorn[0].slice(0, 10) : ""}
            {timesWorn > 1 ? `${datesWorn[0] ? " · " : ""}${timesWorn}×` : ""}
          </span>
        </div>

        {(weather || location) && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {[
              weather ? `${weather}${temp !== undefined && temp !== null && !String(weather).includes("°") ? ` · ${temp}°C` : ""}` : null,
              location,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {notes && (
          <p className="text-xs text-muted-foreground italic mt-1.5 line-clamp-2">
            &ldquo;{notes}&rdquo;
          </p>
        )}

        {/* Constituent Garments: max 3 flush hairline rows + overflow count */}
        {items.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-[var(--gallery-hairline)]">
            <div className="divide-y divide-[var(--gallery-hairline)]">
              {visibleItems.map((item, idx) => (
                <div
                  key={item.id ?? idx}
                  className="flex items-center justify-between gap-2 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.photoUrl ? (
                      <img
                        src={item.photoUrl}
                        alt={item.title}
                        className={`w-5 h-5 rounded shrink-0 bg-[var(--well-surface)] ${
                          isTransparentAsset(item.photoUrl) ? "object-contain p-0.5" : "object-cover"
                        }`}
                      />
                    ) : (
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-[var(--gallery-hairline)]"
                        style={{ backgroundColor: item.colorHex || "#2b2b2b" }}
                      />
                    )}
                    <span className="text-foreground/90 truncate">{item.title}</span>
                  </div>
                  {item.category && (
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {item.category}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {overflowItemCount > 0 && (
              <p className="pt-1 text-[11px] font-mono tabular-nums text-muted-foreground">
                +{overflowItemCount} more {overflowItemCount === 1 ? "piece" : "pieces"}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hover/Focus-Revealed Footer */}
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
