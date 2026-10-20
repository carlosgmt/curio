"use client";

import React from "react";
import { VinylDiscCard } from "./silhouettes/VinylDiscCard";
import { MoviePosterCard } from "./silhouettes/MoviePosterCard";
import { VideoGameCard } from "./silhouettes/VideoGameCard";
import { BookJacketCard } from "./silhouettes/BookJacketCard";
import { WineLabelCard } from "./silhouettes/WineLabelCard";
import { ArtFrameCard } from "./silhouettes/ArtFrameCard";
import { RecipeIndexCard } from "./silhouettes/RecipeIndexCard";
import { MapPassCard } from "./silhouettes/MapPassCard";
import { PlaceSpotCard } from "./silhouettes/PlaceSpotCard";
import { PrivateMemoCard } from "./silhouettes/PrivateMemoCard";
import { ProductCard } from "./silhouettes/ProductCard";
import { GarmentCard } from "./silhouettes/GarmentCard";
import { CosmeticsCard } from "./silhouettes/CosmeticsCard";
import { ElectronicsCard } from "./silhouettes/ElectronicsCard";

export type SilhouetteDensity =
  | "micro"
  | "compact"
  | "standard"
  | "expanded"
  | "cinematic"
  | "canvasNode";

export type CanonicalArchetypeId =
  | "vinyl"
  | "cinema"
  | "videogame"
  | "book"
  | "wine"
  | "art"
  | "recipe"
  | "place"
  | "place_spot"
  | "private_memo"
  | "product"
  | "garment"
  | "cosmetics"
  | "electronics";

export type CulturalPresentationMode =
  | "gallery"
  | "collector"
  | "academic"
  | "minimalist"
  | "bazaar";

export type SilhouetteComponent = React.ComponentType<any>;

// ─── Default Fallback Shells for Missing Densities ─────────────────────────────

export function DefaultMicroShell(props: any) {
  const title = props.entity?.title || props.save?.privateTitle || "Item";
  return (
    <div
      data-testid="micro-shell"
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 shadow-2xs truncate max-w-[200px]"
    >
      <span className="w-2 h-2 rounded-full bg-neutral-400 shrink-0" />
      <span className="truncate">{title}</span>
    </div>
  );
}

export function DefaultCompactShell(props: any) {
  const title = props.entity?.title || props.save?.privateTitle || "Item";
  const brand = props.entity?.brandOrCreator || props.save?.typePath || "";
  return (
    <div
      data-testid="compact-shell"
      className="flex items-center justify-between h-[68px] px-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs hover:border-neutral-300 transition"
    >
      <div className="flex items-center gap-3 min-w-0">
        {props.entity?.heroImageUrl && (
          <img
            src={props.entity.heroImageUrl}
            alt={title}
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
        )}
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {title}
          </h4>
          {brand && <p className="text-xs text-neutral-500 font-mono truncate">{brand}</p>}
        </div>
      </div>
    </div>
  );
}

export function DefaultExpandedShell(props: any) {
  const title = props.entity?.title || props.save?.privateTitle || "Item";
  return (
    <div
      data-testid="expanded-shell"
      className="w-full max-w-[440px] p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg flex flex-col gap-4"
    >
      <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-neutral-50">
        {title}
      </h3>
      <div className="text-xs text-neutral-500 font-mono">
        Expanded In-Situ Spec Inspection
      </div>
    </div>
  );
}

export function DefaultCinematicShell(props: any) {
  const title = props.entity?.title || props.save?.privateTitle || "Item";
  return (
    <div
      data-testid="cinematic-shell"
      className="w-full h-full min-h-[400px] p-8 rounded-3xl bg-neutral-950 text-white flex flex-col items-center justify-center text-center shadow-2xl"
    >
      <h2 className="font-serif text-3xl font-bold mb-2">{title}</h2>
      <p className="text-xs font-mono text-neutral-400">Cinematic Fullscreen Stage</p>
    </div>
  );
}

export function DefaultCanvasNodeShell(props: any) {
  const title = props.entity?.title || props.save?.privateTitle || "Node";
  return (
    <div
      data-testid="canvas-node-shell"
      className="w-[160px] h-[120px] p-2.5 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-700 shadow-md flex flex-col justify-between select-none relative group"
    >
      {/* Input port */}
      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-neutral-400 border-2 border-white dark:border-neutral-900" />
      <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
        Taste Node
      </span>
      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 line-clamp-2">
        {title}
      </span>
      {/* Output port */}
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber-500 border-2 border-white dark:border-neutral-900" />
    </div>
  );
}

// ─── Silhouette Registry Class ────────────────────────────────────────────────

export class SilhouetteRegistry {
  private registry = new Map<CanonicalArchetypeId, Map<SilhouetteDensity, SilhouetteComponent>>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    // Register Standard Silhouettes for all 14 Canonical Archetypes
    this.register("vinyl", "standard", VinylDiscCard);
    this.register("cinema", "standard", MoviePosterCard);
    this.register("videogame", "standard", VideoGameCard);
    this.register("book", "standard", BookJacketCard);
    this.register("wine", "standard", WineLabelCard);
    this.register("art", "standard", ArtFrameCard);
    this.register("recipe", "standard", RecipeIndexCard);
    this.register("place", "standard", MapPassCard);
    this.register("place_spot", "standard", PlaceSpotCard);
    this.register("private_memo", "standard", PrivateMemoCard);
    this.register("product", "standard", ProductCard);
    this.register("garment", "standard", GarmentCard);
    this.register("cosmetics", "standard", CosmeticsCard);
    this.register("electronics", "standard", ElectronicsCard);
  }

  public register(
    archetype: CanonicalArchetypeId,
    density: SilhouetteDensity,
    component: SilhouetteComponent
  ): void {
    let densityMap = this.registry.get(archetype);
    if (!densityMap) {
      densityMap = new Map();
      this.registry.set(archetype, densityMap);
    }
    densityMap.set(density, component);
  }

  public resolve(
    archetype: CanonicalArchetypeId,
    density: SilhouetteDensity = "standard"
  ): SilhouetteComponent {
    const densityMap = this.registry.get(archetype);
    if (densityMap) {
      const component = densityMap.get(density);
      if (component) return component;

      // If standard requested or fallback to standard
      if (density === "standard") {
        const std = densityMap.get("standard");
        if (std) return std;
      }
    }

    // Density fallback shells architecture
    switch (density) {
      case "micro":
        return DefaultMicroShell;
      case "compact":
        return DefaultCompactShell;
      case "expanded":
        return DefaultExpandedShell;
      case "cinematic":
        return DefaultCinematicShell;
      case "canvasNode":
        return DefaultCanvasNodeShell;
      case "standard":
      default:
        // Fallback to standard component of this archetype, or generic ProductCard
        return densityMap?.get("standard") || ProductCard;
    }
  }

  public resolveArchetypeFromTypePath(
    typePath?: string | null,
    isPrivateMemo?: boolean
  ): CanonicalArchetypeId {
    if (isPrivateMemo) return "private_memo";

    const path = (typePath || "").toLowerCase().trim();

    if (path.startsWith("/memo") || path.includes("memo") || path.includes("personal_note")) {
      return "private_memo";
    }

    // 14 Canonical Archetype Taxonomy Rules
    if (path.includes("vinyl") || path.includes("/media/music") || path.includes("album")) {
      return "vinyl";
    }
    if (
      path.includes("cinema") ||
      path.includes("film") ||
      path.includes("movie") ||
      path.startsWith("/media/film")
    ) {
      return "cinema";
    }
    if (
      path.includes("videogame") ||
      path.includes("game") ||
      path.startsWith("/media/videogame")
    ) {
      return "videogame";
    }
    if (
      path.includes("book") ||
      path.includes("literature") ||
      path.startsWith("/book")
    ) {
      return "book";
    }
    if (
      path.includes("wine") ||
      path.includes("cellar") ||
      path.startsWith("/product/beverage/wine")
    ) {
      return "wine";
    }
    if (
      path.includes("recipe") ||
      path.includes("culinary") ||
      path.startsWith("/culinary")
    ) {
      return "recipe";
    }
    if (
      path.includes("art") ||
      path.includes("sculpture") ||
      path.startsWith("/art") ||
      path.startsWith("/product/art")
    ) {
      return "art";
    }
    if (
      path.includes("spot") ||
      path.startsWith("/place/spot") ||
      path.includes("restaurant") ||
      path.includes("bar") ||
      path.includes("cafe")
    ) {
      return "place_spot";
    }
    if (path.includes("place") || path.startsWith("/place")) {
      return "place";
    }
    if (
      path.includes("garment") ||
      path.includes("clothing") ||
      path.includes("apparel") ||
      path.startsWith("/product/garment")
    ) {
      return "garment";
    }
    if (
      path.includes("cosmetics") ||
      path.includes("beauty") ||
      path.includes("skincare") ||
      path.startsWith("/product/cosmetics")
    ) {
      return "cosmetics";
    }
    if (
      path.includes("electronics") ||
      path.includes("hardware") ||
      path.includes("gadget") ||
      path.startsWith("/product/electronics")
    ) {
      return "electronics";
    }

    return "product";
  }
}

export const silhouetteRegistry = new SilhouetteRegistry();
