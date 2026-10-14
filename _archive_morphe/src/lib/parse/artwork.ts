import type { CardBlock } from "@/components/blocks/types";

export interface ParsedArtwork {
  title: string;
  artist?: string;
  year?: string;
  medium?: string;
  summary: string;
  blocks: CardBlock[];
}

export function parseArtwork(text: string): ParsedArtwork {
  const clean = text.replace(/^(artwork:?|art:?|painting:?)\s*/i, "");

  const artistMatch = clean.match(/(?:by|artist:?)\s*([^,;.\n]+)/i);
  const artist = artistMatch ? artistMatch[1].trim() : undefined;

  const yearMatch = clean.match(/\b(1\d\d\d|20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : undefined;

  let title = clean.split(/[,;\n]|(?:\s+by\s+)/i)[0].trim();
  title = title.replace(/^["']|["']$/g, "");

  const summary = `${title}${artist ? ` by ${artist}` : ""}`;

  const blocks: CardBlock[] = [
    {
      kind: "header",
      title,
      subtitle: artist ? `by ${artist}` : "Artwork",
      badge: year,
    },
    {
      kind: "properties",
      items: [
        ...(artist ? [{ label: "Artist", value: artist }] : []),
        ...(year ? [{ label: "Year", value: year }] : []),
      ],
    },
  ];

  return {
    title,
    artist,
    year,
    summary,
    blocks,
  };
}
