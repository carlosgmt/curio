import type { CardBlock } from "@/components/blocks/types";

export interface ParsedRecipe {
  title: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredients: string[];
  instructions: string[];
  summary: string;
  blocks: CardBlock[];
}

export function parseRecipe(text: string): ParsedRecipe {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] || "Untitled Recipe";

  // Match servings: "serves 4", "4 servings", "servings: 2"
  const servingsMatch = text.match(/(?:serves|servings:?)\s*(\d+(?:-\d+)?)/i);
  const servings = servingsMatch ? servingsMatch[1] : undefined;

  // Match times: "30 min prep", "cook 45m"
  const prepMatch = text.match(/(\d+\s*(?:mins?|minutes?|m))\s*(?:prep|preparation)/i);
  const prepTime = prepMatch ? prepMatch[1] : undefined;

  const cookMatch = text.match(/(\d+\s*(?:mins?|minutes?|m|hours?|h))\s*(?:cook|bake|total)/i);
  const cookTime = cookMatch ? cookMatch[1] : undefined;

  // Extract ingredients (either lines with bullets/dashes/numbers or comma separated)
  const ingredients: string[] = [];
  const instructions: string[] = [];

  let inInstructions = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^(steps|instructions|method|directions):?/i.test(line)) {
      inInstructions = true;
      continue;
    }
    if (/^(ingredients):?/i.test(line)) {
      inInstructions = false;
      continue;
    }

    const clean = line.replace(/^[-*•\d.]+\s*/, "");
    if (inInstructions) {
      instructions.push(clean);
    } else {
      ingredients.push(clean);
    }
  }

  // If no newlines, parse comma-separated text
  if (ingredients.length === 0 && lines.length === 1) {
    const parts = text.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        ingredients.push(parts[i]);
      }
    }
  }

  const cleanTitle = firstLine.replace(/^(recipe:?|cook:?|bake:?)\s*/i, "");
  const summary = `${cleanTitle}${servings ? ` (${servings} servings)` : ""}`;

  const blocks: CardBlock[] = [
    {
      kind: "header",
      title: cleanTitle,
      subtitle: "Recipe",
      badge: cookTime || prepTime,
    },
    {
      kind: "properties",
      items: [
        ...(servings ? [{ label: "Servings", value: servings }] : []),
        ...(prepTime ? [{ label: "Prep Time", value: prepTime }] : []),
        ...(cookTime ? [{ label: "Cook Time", value: cookTime }] : []),
      ],
    },
    ...(ingredients.length > 0
      ? [
          {
            kind: "checklist" as const,
            title: "Ingredients",
            items: ingredients.map((item, idx) => ({ id: `ing-${idx}`, text: item })),
          },
        ]
      : []),
    ...(instructions.length > 0
      ? [
          {
            kind: "checklist" as const,
            title: "Instructions",
            items: instructions.map((step, idx) => ({ id: `step-${idx}`, text: `${idx + 1}. ${step}` })),
          },
        ]
      : []),
  ];

  return {
    title: cleanTitle,
    servings,
    prepTime,
    cookTime,
    ingredients,
    instructions,
    summary,
    blocks,
  };
}
