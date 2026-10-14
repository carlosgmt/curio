import type { CardBlock } from "@/components/blocks/types";

export interface ParsedMovie {
  title: string;
  year?: string;
  director?: string;
  rating?: number;
  summary: string;
  blocks: CardBlock[];
}

export function parseMovie(text: string): ParsedMovie {
  const clean = text.replace(/^(movie:?|film:?|watch:?)\s*/i, "");

  // "Inception (2010) directed by Christopher Nolan, 5 stars"
  const yearMatch = clean.match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : undefined;

  const dirMatch = clean.match(/(?:directed by|dir:?)\s*([^,;.\n]+)/i);
  const director = dirMatch ? dirMatch[1].trim() : undefined;

  const starsMatch = clean.match(/(\d)\s*(?:stars|\/5|★)/i);
  const rating = starsMatch ? parseInt(starsMatch[1], 10) : undefined;

  let title = clean.split(/[,;\n(]|(?:\s+directed by\s+)/i)[0].trim();
  title = title.replace(/^["']|["']$/g, "");

  const summary = `${title}${year ? ` (${year})` : ""}`;

  const blocks: CardBlock[] = [
    {
      kind: "header",
      title,
      subtitle: director ? `Directed by ${director}` : "Movie",
      badge: year,
      status: rating ? "Watched" : "Watchlist",
    },
    {
      kind: "properties",
      items: [
        ...(year ? [{ label: "Year", value: year }] : []),
        ...(director ? [{ label: "Director", value: director }] : []),
        ...(rating ? [{ label: "Rating", value: `${rating}/5 ★` }] : []),
      ],
    },
    ...(rating ? [{ kind: "actions" as const, rating }] : []),
  ];

  return {
    title,
    year,
    director,
    rating,
    summary,
    blocks,
  };
}
