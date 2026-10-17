"use client";

import React, { useState } from "react";
import { UtensilsCrossed, Clock, Users, Check } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

interface Ingredient {
  item: string;
  amount?: number;
  unit?: string;
}

export function RecipeIndexCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const [multiplier, setMultiplier] = useState<number>(1);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const prepTime = data.prepTimeMinutes ? `${data.prepTimeMinutes}m prep` : "15m prep";
  const cookTime = data.cookTimeMinutes ? `${data.cookTimeMinutes}m cook` : "25m cook";
  const baseYield = data.yieldServings || 4;

  const defaultIngredients: Ingredient[] = [
    { item: "Extra virgin olive oil", amount: 2, unit: "tbsp" },
    { item: "Garlic cloves, thinly sliced", amount: 4, unit: "cloves" },
    { item: "Fresh basil leaves", amount: 1, unit: "cup" },
    { item: "Coarse sea salt & black pepper", amount: 1, unit: "tsp" },
  ];

  const rawIngredients: Ingredient[] = Array.isArray(data.ingredients) && data.ingredients.length > 0
    ? data.ingredients
    : defaultIngredients;

  const directions: string[] = Array.isArray(data.directions) && data.directions.length > 0
    ? data.directions
    : [
        "Heat the olive oil in a wide heavy-bottomed skillet over medium heat.",
        "Add sliced garlic and sizzle gently until golden and aromatic.",
        "Toss with fresh pasta, tearing basil over the top. Season generously.",
      ];

  const toggleCheck = (idx: number) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="group relative rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:shadow-xl transition-all duration-300 border border-neutral-300 dark:border-neutral-800 flex flex-col justify-between overflow-hidden">
      {/* Index Card Ruled Header Margin */}
      <div className="h-1.5 w-full bg-red-400/80" />
      <div className="h-0.5 w-full bg-blue-300/40 mb-3" />

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-md">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              {data.cuisine || "Kitchen Protocol"}
            </span>

            {/* Servings Scaler (1x / 2x / 4x) */}
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg text-[10px] font-mono">
              <span className="px-1.5 text-neutral-400 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {baseYield * multiplier}
              </span>
              {[1, 2, 4].map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => setMultiplier(scale)}
                  className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                    multiplier === scale
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                  }`}
                >
                  {scale}x
                </button>
              ))}
            </div>
          </div>

          <h3 className="font-serif text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
            {entity.title}
          </h3>

          <div className="flex items-center gap-3 text-xs text-neutral-500 font-mono mb-4">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500" />
              {prepTime}
            </span>
            <span>•</span>
            <span>{cookTime}</span>
          </div>

          {/* Split Two-Column Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-neutral-200 dark:border-neutral-800 pt-3 text-xs">
            {/* Left Column: Ingredients with Scaled Units & Interactive Checks */}
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-wider font-bold text-neutral-400 mb-2">
                Ingredients ({baseYield * multiplier} Servings)
              </h4>
              <ul className="space-y-1.5">
                {rawIngredients.map((ing, idx) => {
                  const isChecked = Boolean(checkedItems[idx]);
                  const scaledAmount = ing.amount ? ing.amount * multiplier : null;

                  return (
                    <li
                      key={idx}
                      onClick={() => toggleCheck(idx)}
                      className={`flex items-start gap-2 cursor-pointer select-none transition ${
                        isChecked
                          ? "line-through text-neutral-400 dark:text-neutral-600"
                          : "text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded border mt-0.5 shrink-0 flex items-center justify-center transition ${
                          isChecked
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-neutral-300 dark:border-neutral-600"
                        }`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span className="leading-tight">
                        {scaledAmount && (
                          <strong className="font-mono font-semibold text-neutral-900 dark:text-neutral-100 mr-1">
                            {scaledAmount} {ing.unit || ""}
                          </strong>
                        )}
                        {ing.item}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Right Column: Numbered Directions */}
            <div className="border-t sm:border-t-0 sm:border-l sm:pl-4 border-neutral-100 dark:border-neutral-800 pt-3 sm:pt-0">
              <h4 className="font-mono text-[10px] uppercase tracking-wider font-bold text-neutral-400 mb-2">
                Directions
              </h4>
              <ol className="space-y-2">
                {directions.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-neutral-600 dark:text-neutral-400 leading-relaxed text-[11.5px]">
                    <span className="font-mono font-bold text-neutral-400 dark:text-neutral-600 shrink-0">
                      {idx + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Disambiguation Bar */}
        {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
          <div className="pt-3">
            <DisambiguationBar
              saveId={save.id}
              candidates={save.candidateFallbacks}
              onSwapped={() => onSwapped?.(save)}
            />
          </div>
        )}

        {/* Action Footer */}
        <CardFooterWaterfall
          entity={{
            ...entity,
            typePath: entity.typePath || "/culinary/recipe",
          }}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          customUtilityLabel="Cook Mode"
        />
      </div>
    </div>
  );
}
