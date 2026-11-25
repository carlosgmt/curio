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
      className="group relative rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-lg transition-shadow duration-200 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Index Card Ruled Header Margin */}
      <div className="h-1.5 w-full bg-red-400/80" />
      <div className="h-0.5 w-full bg-blue-300/40" />

      {/* Card Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-2.5 pr-16 sm:pr-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 truncate">
              <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{data.cuisine || "Recipe"}</span>
            </span>

            {baseYield && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0">
                <Users className="w-3 h-3" aria-hidden="true" />
                <span>{baseYield}</span>
              </span>
            )}
          </div>

          <h3 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-1 leading-snug">
            {entity.title}
          </h3>

          {timingParts.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums mb-3">
              <Clock className="w-3 h-3 text-amber-500 shrink-0" aria-hidden="true" />
              <span>{timingParts.join(" · ")}</span>
            </div>
          )}

          {visibleIngredients.length > 0 ? (
            <div className="border-t border-neutral-100 dark:border-neutral-800 pt-2.5 mt-2">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1.5 tabular-nums">
                Ingredients ({rawIngredients.length})
              </span>
              <ul className="space-y-1 text-xs text-neutral-700 dark:text-neutral-300">
                {visibleIngredients.map((ing, idx) => (
                  <li key={idx} className="truncate">
                    {ing.amount != null && (
                      <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100 mr-1.5">
                        {ing.amount}
                        {ing.unit ? ` ${ing.unit}` : ""}
                      </span>
                    )}
                    <span>{ing.item}</span>
                  </li>
                ))}
              </ul>
              {overflowIngredients > 0 && (
                <p className="mt-1 text-[11px] font-mono tabular-nums text-neutral-400">
                  +{overflowIngredients} more
                </p>
              )}
            </div>
          ) : entity.summary ? (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed mt-2">
              {entity.summary}
            </p>
          ) : null}
        </div>

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={() => onSwapped?.(save)}
        />

        {/* Action Footer */}
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/culinary/recipe",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Cook Mode"
          isWishlist={Boolean(save.wishlist)}
          flush
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
