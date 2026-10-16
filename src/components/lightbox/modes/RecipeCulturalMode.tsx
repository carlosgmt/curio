"use client";

import React, { useState } from "react";
import { Utensils, ChefHat, Check, ShoppingCart, ChevronLeft, ChevronRight, X, Clock, Users } from "lucide-react";
import type { CulturalModeProps } from "./CinemaCulturalMode";

interface Ingredient {
  name: string;
  amount?: number;
  unit?: string;
  originalText?: string;
}

export function RecipeCulturalMode({ save, entity, primarySource }: CulturalModeProps) {
  const [scale, setScale] = useState<number>(1);
  const [isCookMode, setIsCookMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const data = (typeof entity?.coreStructuredData === "object" && entity?.coreStructuredData) || {};

  const prepTime = data.prepTime || "20 MIN";
  const cookTime = data.cookTime || "15 MIN";
  const totalTime = data.totalTime || "35 MIN";
  const cuisine = data.cuisine || "Italian Classical";

  // Parse or provide default ingredients
  const defaultIngredients: Array<{ text: string; amount?: number; unit?: string; item: string }> = [
    { text: "200g Rigatoni or Spaghettoni", amount: 200, unit: "g", item: "Rigatoni or Spaghettoni" },
    { text: "150g Guanciale (cured pork jowl)", amount: 150, unit: "g", item: "Guanciale" },
    { text: "4 Egg yolks (fresh pasture-raised)", amount: 4, unit: "", item: "Egg yolks" },
    { text: "60g Pecorino Romano (finely grated)", amount: 60, unit: "g", item: "Pecorino Romano" },
    { text: "1 tsp Freshly cracked Tellicherry black pepper", amount: 1, unit: "tsp", item: "Tellicherry black pepper" },
  ];

  const ingredients = Array.isArray(data.ingredients) && data.ingredients.length > 0
    ? data.ingredients.map((item: any) =>
        typeof item === "string"
          ? { text: item, item }
          : { text: item.name || item.text, ...item }
      )
    : defaultIngredients;

  const defaultSteps: string[] = [
    "Slice the guanciale into thick matchsticks (~1cm). Place in a cold skillet over medium-low heat and render gently until golden and crispy outside with a tender bite (8–10 minutes). Remove pan from heat.",
    "Whisk the egg yolks together with the grated Pecorino Romano and an abundant amount of freshly cracked black pepper until a thick, luxurious paste forms.",
    "Boil pasta in moderately salted water until 2 minutes shy of al dente. Reserve 1 cup of starchy pasta cooking water.",
    "Transfer hot pasta directly into the guanciale pan with a splash of pasta water. Toss vigorously to emulsify. Allow the pan to cool slightly, then fold in the egg-cheese cream, tossing rapidly off the heat to create a silky, glossy velvet emulsion without curdling.",
  ];

  const steps: string[] = Array.isArray(data.instructions) && data.instructions.length > 0
    ? data.instructions
    : Array.isArray(data.steps) && data.steps.length > 0
    ? data.steps
    : defaultSteps;

  const toggleIngredient = (idx: number) => {
    const next = new Set(checkedIngredients);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setCheckedIngredients(next);
  };

  const formatScaledText = (ing: { text: string; amount?: number; unit?: string; item?: string }) => {
    if (ing.amount !== undefined) {
      const scaledAmount = ing.amount * scale;
      return `${scaledAmount}${ing.unit ? ` ${ing.unit}` : ""} ${ing.item || ""}`.trim();
    }
    return ing.text;
  };

  return (
    <div className="flex flex-col h-full bg-[#fbf9f5] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xl">
      {/* Header with Cook Mode Trigger */}
      <div className="p-5 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between bg-white/70 dark:bg-neutral-950/40">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold">
            {cuisine}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-neutral-900 dark:text-neutral-50 tracking-tight">
            {entity?.title || "Artisanal Recipe"}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setIsCookMode(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 shadow-md transition cursor-pointer shrink-0"
        >
          <ChefHat className="w-4 h-4" />
          <span>Cook Mode</span>
        </button>
      </div>

      {/* Hero Image / Timing Bar */}
      {entity?.heroImageUrl && (
        <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          <img
            src={entity.heroImageUrl}
            alt={entity.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono bg-black/75 backdrop-blur-md text-white font-medium">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>{totalTime}</span>
            </span>
          </div>
        </div>
      )}

      {/* Servings Scaler & Ingredients Checklist */}
      <div className="p-5 space-y-5 flex-1 overflow-y-auto">
        {/* Servings Scaler */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
            <Users className="w-4 h-4 text-neutral-500" />
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">Servings:</span>
          </div>

          <div className="flex items-center gap-1">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScale(s)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                  scale === s
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
                    : "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Ingredients Checklist */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
              Ingredients ({ingredients.length})
            </span>
            <a
              href="https://www.instacart.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
            >
              <ShoppingCart className="w-3 h-3" />
              <span>Order on Instacart</span>
            </a>
          </div>

          <div className="space-y-1.5">
            {ingredients.map((ing: any, idx: number) => {
              const isChecked = checkedIngredients.has(idx);
              return (
                <div
                  key={idx}
                  onClick={() => toggleIngredient(idx)}
                  className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer select-none text-xs transition border ${
                    isChecked
                      ? "bg-neutral-100/50 dark:bg-neutral-800/30 text-neutral-400 border-neutral-200/40 line-through"
                      : "bg-white dark:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200 border-neutral-200/60 dark:border-neutral-700/60 hover:border-neutral-300"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isChecked
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "border-neutral-300 dark:border-neutral-600"
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="leading-snug">{formatScaledText(ing)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step-by-Step Overview */}
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-2">
            Directions Overview
          </span>
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 text-xs leading-relaxed">
                <span className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-neutral-700 dark:text-neutral-300">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fullscreen "Cook Mode" Kitchen Overlay */}
      {isCookMode && (
        <div className="fixed inset-0 z-50 bg-neutral-950 text-white flex flex-col p-6 sm:p-12 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-6 border-b border-neutral-800">
            <div>
              <span className="text-xs font-mono uppercase text-amber-400 font-bold">
                KITCHEN COOK MODE • {scale}x SERVINGS
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold mt-1">{entity?.title}</h1>
            </div>

            <button
              type="button"
              onClick={() => setIsCookMode(false)}
              className="p-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto text-center px-4 py-8">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-6">
              Step {currentStep + 1} of {steps.length}
            </span>

            <p className="font-serif text-2xl sm:text-4xl font-medium leading-relaxed sm:leading-loose text-neutral-100">
              {steps[currentStep]}
            </p>
          </div>

          {/* Stepper Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-neutral-800 max-w-3xl mx-auto w-full">
            <button
              type="button"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 transition cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Previous</span>
            </button>

            <span className="font-mono text-xs text-neutral-500">
              {currentStep + 1} / {steps.length}
            </span>

            <button
              type="button"
              disabled={currentStep === steps.length - 1}
              onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold bg-white text-neutral-950 hover:bg-neutral-200 disabled:opacity-30 transition cursor-pointer shadow-lg"
            >
              <span>Next Step</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
