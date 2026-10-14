import type { CardBlock } from "@/components/blocks/types";

export interface ParsedOutfit {
  title: string;
  occasion?: string;
  season?: string;
  pieces: string[];
  summary: string;
  blocks: CardBlock[];
}

export function parseOutfit(text: string): ParsedOutfit {
  const clean = text.replace(/^(outfit:?|wear:?|fit:?)\s*/i, "");

  const occasionMatch = clean.match(/(?:for|occasion:?)\s*([^,;.\n]+)/i);
  const occasion = occasionMatch ? occasionMatch[1].trim() : undefined;

  const seasonMatch = clean.match(/\b(summer|winter|spring|autumn|fall)\b/i);
  const season = seasonMatch ? seasonMatch[1] : undefined;

  const pieces = clean
    .split(/[,;\n+]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const title = occasion ? `${occasion} Outfit` : pieces[0] || "Outfit";
  const summary = `${title} (${pieces.length} items)`;

  const blocks: CardBlock[] = [
    {
      kind: "header",
      title,
      subtitle: "Style & Wardrobe",
      badge: season,
    },
    {
      kind: "properties",
      items: [
        ...(occasion ? [{ label: "Occasion", value: occasion }] : []),
        ...(season ? [{ label: "Season", value: season }] : []),
        { label: "Items", value: `${pieces.length} pieces` },
      ],
    },
    {
      kind: "checklist",
      title: "Pieces",
      items: pieces.map((p, idx) => ({ id: `p-${idx}`, text: p })),
    },
  ];

  return {
    title,
    occasion,
    season,
    pieces,
    summary,
    blocks,
  };
}
