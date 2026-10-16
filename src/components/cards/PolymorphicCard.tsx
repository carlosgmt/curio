"use client";

import React from "react";
import { VinylDiscCard } from "./silhouettes/VinylDiscCard";
import { MoviePosterCard } from "./silhouettes/MoviePosterCard";
import { BookJacketCard } from "./silhouettes/BookJacketCard";
import { WineLabelCard } from "./silhouettes/WineLabelCard";
import { ArtFrameCard } from "./silhouettes/ArtFrameCard";
import { RecipeIndexCard } from "./silhouettes/RecipeIndexCard";
import { MapPassCard } from "./silhouettes/MapPassCard";
import { PrivateMemoCard } from "./silhouettes/PrivateMemoCard";
import type { CandidateFallback } from "./DisambiguationBar";

export interface CardData {
  save: {
    id: string;
    isPrivateMemo: boolean;
    privateTitle?: string | null;
    personalNotes?: string | null;
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
}

export function PolymorphicCard({
  item,
  onSwapped,
}: {
  item: CardData;
  onSwapped?: (item: CardData) => void;
}) {
  const { save, entity, primarySource } = item;

  // 1. Private Memo Vault Silhouette (PRD v3.2 FR-1.2 Privacy Gating)
  if (save.isPrivateMemo || !entity) {
    return <PrivateMemoCard save={save} />;
  }

  // Helper to detect silhouette archetype based on typePath, coreType, and keywords
  const typePath = (entity.typePath || save.typePath || "").toLowerCase();
  const coreType = (entity.coreType || "").toUpperCase();
  const title = (entity.title || "").toLowerCase();
  const tags = (save.autoTags || []).map((t) => t.toLowerCase());

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
      onSwapped={onSwapped}
    />
  );
}
