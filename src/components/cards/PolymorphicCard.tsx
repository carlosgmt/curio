"use client";

import React, { useState, useEffect } from "react";
import { Link2, FolderPlus } from "lucide-react";
import { VinylDiscCard } from "./silhouettes/VinylDiscCard";
import { MoviePosterCard } from "./silhouettes/MoviePosterCard";
import { BookJacketCard } from "./silhouettes/BookJacketCard";
import { WineLabelCard } from "./silhouettes/WineLabelCard";
import { ArtFrameCard } from "./silhouettes/ArtFrameCard";
import { RecipeIndexCard } from "./silhouettes/RecipeIndexCard";
import { MapPassCard } from "./silhouettes/MapPassCard";
import { PrivateMemoCard } from "./silhouettes/PrivateMemoCard";
import { SynapsePill } from "../connections/SynapsePill";
import { CustomFieldsSection } from "./CustomFieldsSection";
import { AddToListPopover } from "../lists/AddToListPopover";
import type { CandidateFallback } from "./DisambiguationBar";
import type { ConnectedItem } from "@/lib/connections/service";
import type { UserAffiliateTags } from "@/lib/commerce/affiliate";
import { apiFetch } from "@/lib/apiClient";

export interface CardData {
  save: {
    id: string;
    isPrivateMemo: boolean;
    privateTitle?: string | null;
    personalNotes?: string | null;
    userCustomValues?: any;
    candidateFallbacks?: CandidateFallback[] | null;
    typePath?: string | null;
    autoTags?: string[] | null;
    createdAt: string | Date;
  };
  entity?: {
    id: string;
    title: string;
    summary?: string | null;
    heroImageUrl?: string | null;
    coreType: string;
    typePath?: string | null;
    canonicalUrl: string;
    priceCents?: number | null;
    currency?: string | null;
    ucpSkuId?: string | null;
    coreStructuredData?: any;
    extendedAttributes?: any;
  } | null;
  primarySource?: any;
  connections?: ConnectedItem[];
  creatorAffiliateTags?: UserAffiliateTags | null;
}

export interface PolymorphicCardProps {
  item: CardData;
  connections?: ConnectedItem[];
  creatorAffiliateTags?: UserAffiliateTags | null;
  onConnect?: (item: CardData) => void;
  onUnlink?: (connectionId: string) => void;
  onSwapped?: (item: CardData) => void;
  onCustomFieldsUpdated?: (saveId: string, customValues: Record<string, unknown>) => void;
  onAddToList?: (saveId: string) => void;
  onCardClick?: (item: CardData) => void;
}

export function PolymorphicCard({
  item,
  connections: propConnections,
  creatorAffiliateTags: propCreatorTags,
  onConnect,
  onUnlink,
  onSwapped,
  onCustomFieldsUpdated,
  onAddToList,
  onCardClick,
}: PolymorphicCardProps) {
  const { save, entity, primarySource } = item;
  const effectiveTags = item.creatorAffiliateTags || propCreatorTags;
  const [internalConnections, setInternalConnections] = useState<ConnectedItem[]>(item.connections || []);
  const [isAddToListOpen, setIsAddToListOpen] = useState(false);

  useEffect(() => {
    if (propConnections !== undefined) {
      setInternalConnections(propConnections);
      return;
    }
    if (item.connections !== undefined) {
      setInternalConnections(item.connections);
      return;
    }
    // Lazy fetch connections if not provided and not private memo
    if (save.isPrivateMemo) return;

    let isMounted = true;
    apiFetch(`/api/v1/connections?saveId=${save.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.connections) {
          setInternalConnections(data.connections);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [save.id, save.isPrivateMemo, item.connections, propConnections]);

  const displayedConnections = propConnections !== undefined ? propConnections : internalConnections;

  const handleUnlink = async (connectionId: string) => {
    try {
      const res = await apiFetch(`/api/v1/connections?connectionId=${connectionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setInternalConnections((prev) => prev.filter((c) => c.connectionId !== connectionId));
        onUnlink?.(connectionId);
      }
    } catch (err) {
      console.error("Failed to delete connection:", err);
    }
  };

  // Helper to detect silhouette archetype based on typePath, coreType, and keywords
  const typePath = (entity?.typePath || save.typePath || "").toLowerCase();
  const coreType = (entity?.coreType || "").toUpperCase();
  const title = (entity?.title || "").toLowerCase();
  const tags = (save.autoTags || []).map((t) => t.toLowerCase());

  const renderSilhouette = () => {
    // 1. Private Memo Vault Silhouette (PRD v3.2 FR-1.2 Privacy Gating)
    if (save.isPrivateMemo || !entity) {
      return <PrivateMemoCard save={save} />;
    }

    // 2. Vinyl Disc Silhouette (/media/music/vinyl)
    if (
      typePath.includes("vinyl") ||
      typePath.includes("music") ||
      tags.includes("vinyl") ||
      tags.includes("album") ||
      title.includes("vinyl") ||
      title.includes("lp")
    ) {
      return (
        <VinylDiscCard
          save={save}
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 3. Movie Poster Silhouette (/media/film)
    if (
      typePath.includes("film") ||
      typePath.includes("movie") ||
      typePath.includes("cinema") ||
      coreType === "MEDIA" ||
      tags.includes("film") ||
      tags.includes("movie") ||
      title.includes("movie") ||
      title.includes("film")
    ) {
      return (
        <MoviePosterCard
          save={save}
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 4. Wine Label Silhouette (/product/beverage/wine)
    if (
      typePath.includes("wine") ||
      typePath.includes("beverage") ||
      tags.includes("wine") ||
      title.includes("wine") ||
      title.includes("domaine") ||
      title.includes("château") ||
      title.includes("chateau") ||
      title.includes("cuvée")
    ) {
      return (
        <WineLabelCard
          save={save}
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 5. Art Frame Silhouette (/product/art)
    if (
      typePath.includes("art") ||
      typePath.includes("print") ||
      tags.includes("art") ||
      tags.includes("painting") ||
      title.includes("lithograph") ||
      title.includes("print") ||
      title.includes("painting")
    ) {
      return (
        <ArtFrameCard
          save={save}
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 6. Recipe Index Card Silhouette (/culinary/recipe)
    if (
      typePath.includes("recipe") ||
      typePath.includes("culinary") ||
      coreType === "CULINARY" ||
      tags.includes("recipe") ||
      tags.includes("cooking") ||
      title.includes("recipe") ||
      title.includes("pasta") ||
      title.includes("salad")
    ) {
      return (
        <RecipeIndexCard
          save={save}
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 7. Map Pass Silhouette (/place/transit_trail)
    if (
      typePath.includes("place") ||
      typePath.includes("trail") ||
      typePath.includes("transit") ||
      coreType === "PLACE" ||
      tags.includes("place") ||
      tags.includes("trail") ||
      tags.includes("japan") ||
      title.includes("trail") ||
      title.includes("pass") ||
      title.includes("coffee") ||
      title.includes("cafe")
    ) {
      return (
        <MapPassCard
          save={save}
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 8. Book Jacket Silhouette (/product/book or default)
    return (
      <BookJacketCard
        save={save}
        entity={entity}
        primarySource={primarySource}
        creatorAffiliateTags={effectiveTags}
        onSwapped={onSwapped}
      />
    );
  };

  return (
    <div
      id={`save-${save.id}`}
      className="group/curio-card relative flex flex-col h-full transition-all duration-200"
    >
      {/* Quick Action Toolbar (Board + Pair) */}
      {!save.isPrivateMemo && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 opacity-0 sm:group-hover/curio-card:opacity-100 opacity-90 transition">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onAddToList) {
                onAddToList(save.id);
              } else {
                setIsAddToListOpen(true);
              }
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-900/80 hover:bg-neutral-950 text-white dark:bg-neutral-100/90 dark:hover:bg-white dark:text-neutral-950 backdrop-blur-md shadow-md border border-white/20 dark:border-neutral-800 transition cursor-pointer"
            title="Add to Curated Board"
          >
            <FolderPlus className="w-3 h-3 text-neutral-300 dark:text-neutral-700" />
            <span>Board</span>
          </button>

          {onConnect && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConnect(item);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-900/80 hover:bg-neutral-950 text-white dark:bg-neutral-100/90 dark:hover:bg-white dark:text-neutral-950 backdrop-blur-md shadow-md border border-white/20 dark:border-neutral-800 transition cursor-pointer"
              title="Establish Synaptic Pair"
            >
              <Link2 className="w-3 h-3 text-neutral-300 dark:text-neutral-700" />
              <span>Pair</span>
            </button>
          )}
        </div>
      )}

      {/* Silhouette Card Body */}
      <div
        data-card-body="true"
        className={`flex-1 ${onCardClick ? "cursor-pointer" : ""}`}
        onClick={() => onCardClick?.(item)}
      >
        {renderSilhouette()}
      </div>

      {/* Curio Learns: Custom Attributes & Consensus Badges */}
      {!save.isPrivateMemo && (
        <div className="px-1 mt-1.5">
          <CustomFieldsSection
            saveId={save.id}
            userCustomValues={save.userCustomValues}
            extendedAttributes={entity?.extendedAttributes}
            onUpdated={(updatedValues) => {
              onCustomFieldsUpdated?.(save.id, updatedValues);
            }}
          />
        </div>
      )}

      {/* Synaptic Memory Edge Connections */}
      {displayedConnections.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 items-center px-1">
          {displayedConnections.map((conn) => (
            <SynapsePill
              key={conn.connectionId}
              connection={conn}
              onUnlink={handleUnlink}
              onClick={(targetSaveId) => {
                const el = document.getElementById(`save-${targetSaveId}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("ring-2", "ring-neutral-400", "dark:ring-neutral-500", "rounded-2xl");
                  setTimeout(() => {
                    el.classList.remove("ring-2", "ring-neutral-400", "dark:ring-neutral-500", "rounded-2xl");
                  }, 2500);
                }
              }}
            />
          ))}
          {!save.isPrivateMemo && onConnect && (
            <button
              type="button"
              onClick={() => onConnect(item)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 transition cursor-pointer"
              title="Add another synaptic connection"
            >
              <Link2 className="w-2.5 h-2.5" />
              <span>+ Pair</span>
            </button>
          )}
        </div>
      )}

      {/* Add To List / Curated Board Popover */}
      <AddToListPopover
        saveId={save.id}
        isOpen={isAddToListOpen}
        onClose={() => setIsAddToListOpen(false)}
      />
    </div>
  );
}
