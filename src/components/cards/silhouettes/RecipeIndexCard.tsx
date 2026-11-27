"use client";

import React, { useState } from "react";
import { UtensilsCrossed, Clock, Users, X, ChevronLeft, ChevronRight } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

interface Ingredient {
  item: string;
  name?: string;
  text?: string;
  amount?: number;
  unit?: string;
}

const MAX_CARD_INGREDIENTS = 4;

export function RecipeIndexCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const [isCookMode, setIsCookMode] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);

  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const prepTime = data.prepTimeMinutes ? `${data.prepTimeMinutes}m prep` : null;
  const cookTime = data.cookTimeMinutes ? `${data.cookTimeMinutes}m cook` : null;
  const baseYield = data.yieldServings || null;

  const rawIngredients: Ingredient[] = Array.isArray(data.ingredients)
    ? data.ingredients.map((ing: any) =>
        typeof ing === "string"
          ? { item: ing }
          : {
              item: ing.item || ing.name || ing.text || "",
              amount: ing.amount,
              unit: ing.unit,
            }
      ).filter((ing: Ingredient) => Boolean(ing.item))
    : [];

  const directions: string[] = Array.isArray(data.directions)
    ? data.directions
    : Array.isArray(data.instructions)
    ? data.instructions
    : Array.isArray(data.steps)
    ? data.steps
    : [];

  const visibleIngredients = rawIngredients.slice(0, MAX_CARD_INGREDIENTS);
  const overflowIngredients = Math.max(0, rawIngredients.length - visibleIngredients.length);
  const timingParts = [prepTime, cookTime].filter(Boolean);

  return (
    <div
      data-testid="recipe-index-card"
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      {/* Ruled Editorial Recipe Index Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-serif-editorial text-lg sm:text-[19px] font-medium tracking-tight text-foreground leading-snug">
              {entity.title}
            </h3>
            {(timingParts.length > 0 || baseYield) && (
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0">
                {[...timingParts, baseYield ? `${baseYield} srv` : null].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>

          {visibleIngredients.length > 0 ? (
            <div className="border-t border-[var(--gallery-hairline)] mt-3">
              <ul className="divide-y divide-[var(--gallery-hairline)] text-xs text-muted-foreground">
                {visibleIngredients.map((ing, idx) => (
                  <li key={idx} className="py-1.5 truncate">
                    {ing.amount != null && (
                      <span className="font-mono tabular-nums font-medium text-foreground mr-1.5">
                        {ing.amount}
                        {ing.unit ? ` ${ing.unit}` : ""}
                      </span>
                    )}
                    <span>{ing.item}</span>
                  </li>
                ))}
              </ul>
              {overflowIngredients > 0 && (
                <p className="pt-1.5 text-[11px] font-mono tabular-nums text-muted-foreground/80">
                  +{overflowIngredients} more ingredients
                </p>
              )}
            </div>
          ) : entity.summary ? (
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mt-2.5">
              {entity.summary}
            </p>
          ) : null}
        </div>

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
            typePath: entity.typePath || "/culinary/recipe",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Cook Mode"
          isWishlist={Boolean(save.wishlist)}
          onUtilityClick={() => setIsCookMode(true)}
        />
      </div>

      {/* Fullscreen "Cook Mode" Kitchen Overlay */}
      {isCookMode && (
        <div
          className="fixed inset-0 z-50 bg-neutral-950 text-white flex flex-col p-6 sm:p-12 animate-in fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-6 border-b border-neutral-800">
            <div>
              <span className="text-xs font-mono uppercase text-amber-400 font-bold">
                KITCHEN COOK MODE{baseYield ? ` · ${baseYield} SERVINGS` : ""}
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold mt-1 text-white">{entity.title}</h1>
            </div>

            <button
              type="button"
              onClick={() => setIsCookMode(false)}
              className="p-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer"
              aria-label="Close cook mode"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto text-center px-4 py-8">
            {directions.length > 0 ? (
              <>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-mono tabular-nums font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-6">
                  Step {currentStep + 1} of {directions.length}
                </span>

                <p className="font-serif text-2xl sm:text-4xl font-medium leading-relaxed sm:leading-loose text-neutral-100">
                  {directions[currentStep]}
                </p>
              </>
            ) : (
              <p className="font-serif text-lg text-neutral-300">
                {entity.summary || "No step-by-step directions saved for this recipe yet."}
              </p>
            )}
          </div>

          {directions.length > 0 && (
            <div className="flex items-center justify-between pt-6 border-t border-neutral-800 max-w-3xl mx-auto w-full">
              <button
                type="button"
                disabled={currentStep === 0}
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 transition cursor-pointer text-white"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                <span>Previous</span>
              </button>

              <span className="font-mono tabular-nums text-xs text-neutral-500">
                {currentStep + 1} / {directions.length}
              </span>

              <button
                type="button"
                disabled={currentStep === directions.length - 1}
                onClick={() => setCurrentStep((prev) => Math.min(directions.length - 1, prev + 1))}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold bg-white text-neutral-950 hover:bg-neutral-200 disabled:opacity-30 transition cursor-pointer shadow-lg"
              >
                <span>Next Step</span>
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
