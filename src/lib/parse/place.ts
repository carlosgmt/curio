import type { CardBlock } from "@/components/blocks/types";

export interface ParsedPlace {
  name: string;
  category?: string;
  address?: string;
  notes?: string;
  summary: string;
  blocks: CardBlock[];
}

export function parsePlace(text: string): ParsedPlace {
  const clean = text.replace(/^(place:?|spot:?|location:?|visit:?)\s*/i, "");

  const categoryMatch = clean.match(/\b(cafe|restaurant|bar|museum|park|hotel|shop|beach)\b/i);
  const category = categoryMatch ? categoryMatch[1] : undefined;

  const parts = clean.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean);
  const name = parts[0] || "Saved Place";
  const address = parts.length > 1 ? parts.slice(1).join(", ") : undefined;

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
  const summary = `${name}${category ? ` (${category})` : ""}`;

  const blocks: CardBlock[] = [
    {
      kind: "header",
      title: name,
      subtitle: address || "Saved Place",
      badge: category,
    },
    {
      kind: "properties",
      items: [
        ...(category ? [{ label: "Category", value: category }] : []),
        ...(address ? [{ label: "Location", value: address }] : []),
      ],
    },
    {
      kind: "actions",
      links: [{ label: "Open in Maps", url: mapUrl, iconName: "map-pin" }],
    },
  ];

  return {
    name,
    category,
    address,
    summary,
    blocks,
  };
}
