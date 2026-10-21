"use client";

import React, { useState, useEffect } from "react";
import { Link2, FolderPlus, Heart } from "lucide-react";
import { wishLabel } from "@/lib/wishlist";
import { VinylDiscCard } from "./silhouettes/VinylDiscCard";
import { MoviePosterCard } from "./silhouettes/MoviePosterCard";
import { VideoGameCard } from "./silhouettes/VideoGameCard";
import { ProductCard } from "./silhouettes/ProductCard";
import { BookJacketCard } from "./silhouettes/BookJacketCard";
import { WineLabelCard } from "./silhouettes/WineLabelCard";
import { ArtFrameCard } from "./silhouettes/ArtFrameCard";
import { RecipeIndexCard } from "./silhouettes/RecipeIndexCard";
import { MapPassCard } from "./silhouettes/MapPassCard";
import { PlaceSpotCard } from "./silhouettes/PlaceSpotCard";
import { PrivateMemoCard } from "./silhouettes/PrivateMemoCard";
import { QuoteCard } from "./silhouettes/QuoteCard";
import { ChecklistCard } from "./silhouettes/ChecklistCard";
import { TravelPassCard } from "./silhouettes/TravelPassCard";
import { CreatorProfileCard } from "./silhouettes/CreatorProfileCard";
import { PhotoCard } from "./silhouettes/PhotoCard";
import { WebLinkCard } from "./silhouettes/WebLinkCard";
import { SynapsePill } from "../connections/SynapsePill";
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
    wishlist?: boolean | null;
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
    brandOrCreator?: string | null;
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
  onWishToggled?: (saveId: string, wishlist: boolean) => void;
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
  onWishToggled,
}: PolymorphicCardProps) {
  const { save, entity, primarySource } = item;
  const effectiveTags = item.creatorAffiliateTags || propCreatorTags;
  const [internalConnections, setInternalConnections] = useState<ConnectedItem[]>(item.connections || []);
  const [isAddToListOpen, setIsAddToListOpen] = useState(false);
  const [wished, setWished] = useState(Boolean(item.save.wishlist));
  useEffect(() => setWished(Boolean(item.save.wishlist)), [item.save.wishlist]);

  const toggleWish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !wished;
    setWished(next);
    try {
      const res = await apiFetch(`/api/v1/saves/${item.save.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishlist: next }),
      });
      if (!res.ok) throw new Error("wish failed");
      onWishToggled?.(item.save.id, next);
    } catch {
      setWished(!next);
    }
  };

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
    // 0. Dedicated Quote Silhouette (/quote, /culture/quote, tags: quote)
    if (
      typePath.includes("quote") ||
      tags.includes("quote") ||
      typePath === "/quote" ||
      typePath.startsWith("/quote/") ||
      typePath.startsWith("/culture/quote")
    ) {
      return (
        <QuoteCard
          save={save}
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
          onQuoteSaved={(id, cv) => onCustomFieldsUpdated?.(id, cv)}
        />
      );
    }

    // 0a. Checklist / Interactive List (/memo/list)
    if (
      typePath === "/memo/list" ||
      typePath.includes("list") ||
      tags.includes("checklist") ||
      tags.includes("list") ||
      (entity?.coreStructuredData && Array.isArray(entity.coreStructuredData.items))
    ) {
      return (
        <ChecklistCard
          save={save}
          entity={entity || ({ id: save.id, title: save.privateTitle || "Checklist", coreType: "NOTE", typePath: "/memo/list", canonicalUrl: "" } as any)}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 0b. Web Link / Article Bookmark (/link, /article/web, LINK)
    if (
      typePath === "/link" ||
      typePath.startsWith("/link") ||
      typePath === "/article/web" ||
      coreType === "LINK" ||
      tags.includes("link") ||
      tags.includes("bookmark")
    ) {
      return (
        <WebLinkCard
          save={save}
          entity={entity as any}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 0c. Travel & Transit Boarding Pass (/travel/*, /travel/transit, flight, train)
    if (
      typePath.startsWith("/travel") ||
      typePath === "/travel/transit" ||
      coreType === "TRAVEL" ||
      tags.includes("travel") ||
      tags.includes("flight") ||
      tags.includes("train")
    ) {
      return (
        <TravelPassCard
          save={save}
          entity={entity as any}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 0d. Creator / Cultural Figure (/person/*, CREATOR)
    if (
      typePath.startsWith("/person") ||
      coreType === "CREATOR" ||
      tags.includes("creator") ||
      tags.includes("author") ||
      tags.includes("director") ||
      tags.includes("musician") ||
      tags.includes("artist")
    ) {
      return (
        <CreatorProfileCard
          save={save}
          entity={entity as any}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 0e. Photo / Full-bleed Photograph (/media/image, /photo)
    if (
      typePath === "/media/image" ||
      typePath === "/photo" ||
      typePath.startsWith("/media/image") ||
      tags.includes("photo") ||
      tags.includes("photography")
    ) {
      return (
        <PhotoCard
          save={save}
          entity={entity as any}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 1. Private Memo Vault Silhouette (PRD v3.2 FR-1.2 Privacy Gating)
    if (save.isPrivateMemo || !entity) {
      return <PrivateMemoCard save={save} />;
    }

    // 2. Music Album / Song / Vinyl Silhouette (/media/music/*)
    if (
      typePath.includes("vinyl") ||
      typePath.includes("music") ||
      tags.includes("vinyl") ||
      tags.includes("album") ||
      tags.includes("song") ||
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

    // 3. Video Game Jewel Case Silhouette (/media/videogame)
    if (
      typePath.includes("videogame") ||
      typePath.includes("game") ||
      coreType === "VIDEOGAME" ||
      tags.includes("game") ||
      tags.includes("gaming") ||
      tags.includes("steam") ||
      title.includes("steam")
    ) {
      return (
        <VideoGameCard
          save={save}
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 4. Movie Poster Silhouette (/media/film)
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

    // 5. Wine Label Silhouette (/product/beverage/wine)
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

    // 6. Art Frame Silhouette (/product/art)
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

    // 7. Recipe Index Card Silhouette (/culinary/recipe)
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

    // 8. Place & Venue Silhouette (/place, /place/*, venue spot)
    if (
      typePath.includes("place") ||
      typePath.includes("trail") ||
      typePath.includes("restaurant") ||
      typePath.includes("cafe") ||
      typePath.includes("hotel") ||
      typePath.includes("shop") ||
      typePath.includes("bar") ||
      coreType === "PLACE" ||
      tags.includes("place") ||
      tags.includes("restaurant") ||
      tags.includes("cafe") ||
      tags.includes("hotel") ||
      tags.includes("trail") ||
      tags.includes("japan") ||
      title.includes("trail") ||
      title.includes("pass") ||
      title.includes("coffee") ||
      title.includes("cafe")
    ) {
      if (typePath.includes("trail") || tags.includes("trail") || title.includes("trail")) {
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
      return (
        <PlaceSpotCard
          save={save}
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 9. Physical Product Silhouette (/product, /product/watch, /product/garment, /product/cosmetics, /product/electronics, custom /product/*)
    if (
      typePath === "/product" ||
      (typePath.startsWith("/product/") && !typePath.startsWith("/product/book")) ||
      coreType === "PRODUCT" ||
      tags.includes("product") ||
      tags.includes("watch") ||
      tags.includes("garment") ||
      tags.includes("apparel") ||
      tags.includes("clothing") ||
      tags.includes("cosmetics") ||
      tags.includes("skincare") ||
      tags.includes("electronics") ||
      tags.includes("hardware") ||
      tags.includes("gadget")
    ) {
      return (
        <ProductCard
          save={save}
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={effectiveTags}
          onSwapped={onSwapped}
        />
      );
    }

    // 10. Book Jacket Silhouette (/product/book or default)
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
      {/* Quick Action Toolbar (Wish + Board) */}
      <div className={`absolute top-3 right-3 z-30 flex items-center gap-1.5 transition ${wished ? "opacity-100" : "sm:opacity-0 sm:group-hover/curio-card:opacity-100 opacity-90"}`}>
        <button
          type="button"
          data-testid="wish-toggle"
          aria-pressed={wished}
          onClick={toggleWish}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium backdrop-blur-md shadow-md border transition cursor-pointer ${
            wished
              ? "bg-rose-500 text-white border-rose-400"
              : "bg-neutral-900/80 text-white border-white/20 dark:bg-neutral-100/90 dark:text-neutral-950"
          }`}
          title={wished ? "On your wishlist (click to remove)" : wishLabel(entity?.typePath || save.typePath, entity?.coreType)}
        >
          <Heart className={`w-3 h-3 ${wished ? "fill-current" : ""}`} />
          <span>{wished ? "Wished" : "Wish"}</span>
        </button>
        {!save.isPrivateMemo && (
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
        )}
      </div>

      {/* Silhouette Card Body */}
      <div
        data-card-body="true"
        className={`flex-1 ${onCardClick ? "cursor-pointer" : ""}`}
        onClick={() => onCardClick?.(item)}
      >
        {renderSilhouette()}
      </div>

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
        onListUpdated={() => onAddToList?.(save.id)}
      />
    </div>
  );
}
