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
      className="group relative rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-lg transition-shadow duration-200 border border-neutral-200/90 dark:border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Visual Header / Garment Photos Canvas */}
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Header Metadata: Wear Date & Weather */}
        <div className="flex items-center justify-between gap-2 mb-2.5 pr-16 sm:pr-0">
          <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums uppercase tracking-wider text-neutral-500 dark:text-neutral-400 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {datesWorn[0] ? datesWorn[0].slice(0, 10) : "Undated"}
            </span>
            {timesWorn > 1 && (
              <span className="text-neutral-600 dark:text-neutral-300 font-semibold">
                · {timesWorn}×
              </span>
            )}
          </div>

          {weather && (
            <div className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-neutral-600 dark:text-neutral-300 shrink-0">
              {renderWeatherIcon(weather)}
              <span className="truncate max-w-[120px]">{weather}</span>
              {temp !== undefined && temp !== null && !String(weather).includes("°") && (
                <span>· {temp}°C</span>
              )}
            </div>
          )}
        </div>

        {/* Outfit Photo Visual Hero */}
        {activePhoto ? (
          <div
            className={`relative aspect-4/3 w-full rounded-xl overflow-hidden mb-3 border border-neutral-100 dark:border-neutral-800 ${
              isTransparentAsset(activePhoto.url)
                ? "bg-gradient-to-b from-neutral-50 via-neutral-100/80 to-neutral-200/50 dark:from-neutral-800/70 dark:to-neutral-900 flex items-center justify-center"
                : "bg-neutral-100 dark:bg-neutral-800"
            }`}
          >
            <img
              src={activePhoto.url}
              alt={activePhoto.title}
              className={`w-full h-full group-hover:scale-102 transition-transform duration-500 ${
                isTransparentAsset(activePhoto.url)
                  ? "object-contain p-3 drop-shadow-md"
                  : "object-cover"
              }`}
            />
            {selectedPhotoIdx > 0 && (
              <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-md text-white text-[10px] font-mono flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{activePhoto.brand}</span>
                <span className="truncate opacity-80">{activePhoto.title}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-16/9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 mb-3 border border-dashed border-neutral-200 dark:border-neutral-700">
            <Shirt className="w-8 h-8 stroke-1 text-neutral-400" aria-hidden="true" />
          </div>
        )}

        {/* Multi-Garment Photo Thumbnails Strip (capped at 5 + N) */}
        {garmentPhotos.length > 1 && (
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-0.5 scrollbar-none">
            {visibleThumbPhotos.map((photo, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPhotoIdx(idx);
                }}
                className={`relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border transition-colors duration-150 cursor-pointer bg-neutral-100 dark:bg-neutral-800 ${
                  selectedPhotoIdx === idx
                    ? "border-neutral-900 dark:border-white ring-1 ring-neutral-900/20 dark:ring-white/20"
                    : "border-neutral-200 dark:border-neutral-700 opacity-70 hover:opacity-100"
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
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[10px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0">
                +{overflowThumbCount}
              </span>
            )}
          </div>
        )}

        {/* Outfit Title */}
        <h3 className="font-serif text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1 leading-snug">
          {title}
        </h3>

        {location && (
          <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-neutral-400 shrink-0" aria-hidden="true" />
            <span className="truncate">{location}</span>
          </p>
        )}

        {notes && (
          <p className="text-xs text-neutral-600 dark:text-neutral-300 italic mb-2.5 line-clamp-2">
            &ldquo;{notes}&rdquo;
          </p>
        )}

        {/* Constituent Garments: max 3 flush hairline rows + overflow count */}
        {items.length > 0 && (
          <div className="mt-1 pt-2.5 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 tabular-nums">
                Pieces ({items.length})
              </span>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
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
                        className={`w-6 h-6 rounded-md shrink-0 bg-neutral-50 dark:bg-neutral-800 ${
                          isTransparentAsset(item.photoUrl) ? "object-contain p-0.5" : "object-cover"
                        }`}
                      />
                    ) : (
                      <div
                        className="w-3 h-3 rounded-full shrink-0 border border-neutral-300 dark:border-neutral-600"
                        style={{ backgroundColor: item.colorHex || "#2b2b2b" }}
                      />
                    )}
                    <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {item.title}
                    </span>
                  </div>

                  {item.category && (
                    <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                      {item.category}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {overflowItemCount > 0 && (
              <p className="pt-1 text-[11px] font-mono tabular-nums text-neutral-400">
                +{overflowItemCount} more {overflowItemCount === 1 ? "piece" : "pieces"}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer Waterfall */}
      <CardFooterWaterfall
        entity={entity}
        primarySource={primarySource}
        creatorAffiliateTags={creatorAffiliateTags}
        isWishlist={Boolean(save.wishlist)}
      />
    </div>
  );
}
