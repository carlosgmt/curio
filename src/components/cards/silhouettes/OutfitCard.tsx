"use client";

import React, { useState } from "react";
import {
  Sun,
  CloudRain,
  Cloud,
  Thermometer,
  Calendar,
  Layers,
  Sparkles,
  Shirt,
  ExternalLink,
  ChevronRight,
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

export function OutfitCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
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
  const closetUrl = typeof data.closetUrl === "string" ? data.closetUrl : null;

  // Collect outfit cover/look photo + photos from constituent garments
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

  const activePhoto = garmentPhotos[selectedPhotoIdx] || garmentPhotos[0];
  const isTransparentAsset = (url?: string | null) =>
    Boolean(url && (url.includes("/cutouts/") || url.includes("/covers/") || url.toLowerCase().endsWith(".png")));

  const renderWeatherIcon = (w?: string) => {
    if (!w) return null;
    const lower = w.toLowerCase();
    if (lower.includes("sun") || lower.includes("clear")) {
      return <Sun className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (lower.includes("rain") || lower.includes("shower")) {
      return <CloudRain className="w-3.5 h-3.5 text-blue-500" />;
    }
    return <Cloud className="w-3.5 h-3.5 text-neutral-400" />;
  };

  return (
    <div
      data-testid="outfit-card"
      className="group relative rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-xl transition-all duration-300 border border-neutral-200/90 dark:border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Visual Header / Garment Photos Canvas */}
      <div className="p-5 flex flex-col">
        {/* Header Metadata: Wear Dates & Weather Badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="truncate">
              {datesWorn[0] ? datesWorn[0].slice(0, 10) : "Undated"}
            </span>
            {timesWorn > 1 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold">
                {timesWorn}x
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {closetUrl && (
              <a
                href={closetUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 transition"
                title="Open in Closet"
              >
                <span>Closet</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {weather && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                {renderWeatherIcon(weather)}
                <span>{weather}</span>
                {temp !== undefined && temp !== null && <span>• {temp}°C</span>}
              </div>
            )}
          </div>
        </div>

        {/* Outfit Photo Visual Hero / Multi-Garment Mosaic */}
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
            <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-mono flex items-center justify-between gap-2">
              <span className="truncate font-semibold">{activePhoto.brand}</span>
              <span className="truncate opacity-80">{activePhoto.title}</span>
            </div>
          </div>
        ) : (
          <div className="w-full aspect-16/9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 mb-3 border border-dashed border-neutral-200 dark:border-neutral-700">
            <Shirt className="w-8 h-8 stroke-1 text-neutral-400" />
          </div>
        )}

        {/* Multi-Garment Photo Thumbnails Strip */}
        {garmentPhotos.length > 1 && (
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
            {garmentPhotos.map((photo, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPhotoIdx(idx);
                }}
                className={`relative w-11 h-11 rounded-lg overflow-hidden shrink-0 border transition cursor-pointer bg-neutral-100 dark:bg-neutral-800 ${
                  selectedPhotoIdx === idx
                    ? "border-neutral-900 dark:border-white ring-2 ring-neutral-900/20 dark:ring-white/20"
                    : "border-neutral-200 dark:border-neutral-700 opacity-60 hover:opacity-100"
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
          </div>
        )}

        {/* Outfit Title */}
        <h3 className="font-serif text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1 leading-snug">
          {title}
        </h3>

        {location && (
          <p className="text-[11px] font-mono text-neutral-400 mb-3">
            📍 {location}
          </p>
        )}

        {notes && (
          <p className="text-xs text-neutral-600 dark:text-neutral-300 italic mb-3 line-clamp-2">
            "{notes}"
          </p>
        )}

        {/* Constituent Garments Checklist / Spec */}
        <div className="mt-1 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              Garments Used ({items.length})
            </span>
            <Layers className="w-3 h-3 text-neutral-400" />
          </div>

          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/80 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Swatch or thumbnail */}
                {item.photoUrl ? (
                  <img
                    src={item.photoUrl}
                    alt={item.title}
                    className={`w-6 h-6 rounded-md shrink-0 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 ${
                      isTransparentAsset(item.photoUrl) ? "object-contain p-0.5" : "object-cover"
                    }`}
                  />
                ) : (
                  <div
                    className="w-3 h-3 rounded-full shrink-0 border border-neutral-300 dark:border-neutral-600"
                    style={{ backgroundColor: item.colorHex || "#2b2b2b" }}
                  />
                )}
                <div className="min-w-0 flex flex-col">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-tight leading-none">
                    {item.brand}
                  </span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate leading-tight">
                    {item.title}
                  </span>
                </div>
              </div>

              {item.category && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-white dark:bg-neutral-800 text-neutral-500 border border-neutral-200/60 dark:border-neutral-700 shrink-0">
                  {item.category}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Waterfall */}
      <CardFooterWaterfall
        entity={entity}
        primarySource={primarySource}
        creatorAffiliateTags={creatorAffiliateTags}
      />
    </div>
  );
}
