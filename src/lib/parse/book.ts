import type { CardBlock } from "@/components/blocks/types";

export interface ParsedBook {
  title: string;
  author?: string;
  pages?: string;
  rating?: number;
  notes?: string;
  summary: string;
  blocks: CardBlock[];
}

export function parseBook(text: string): ParsedBook {
  const clean = text.replace(/^(book:?|reading:?|read:?)\s*/i, "");

  // "1984 by George Orwell, 328 pages, 5 stars"
  const authorMatch = clean.match(/(?:by|author:?)\s*([^,;.\n]+)/i);
  const author = authorMatch ? authorMatch[1].trim() : undefined;

  const pagesMatch = clean.match(/(\d+)\s*(?:pages|pp)/i);
  const pages = pagesMatch ? pagesMatch[1] : undefined;

  const starsMatch = clean.match(/(\d)\s*(?:stars|\/5|★)/i);
  const rating = starsMatch ? parseInt(starsMatch[1], 10) : undefined;

  let title = clean.split(/[,;\n]|(?:\s+by\s+)/i)[0].trim();
  title = title.replace(/^["']|["']$/g, "");

  const summary = `${title}${author ? ` by ${author}` : ""}`;

  const blocks: CardBlock[] = [
    {
      kind: "header",
      title,
      subtitle: author ? `by ${author}` : "Book",
      status: rating ? "Read" : "To Read",
    },
    {
      kind: "properties",
      items: [
        ...(author ? [{ label: "Author", value: author }] : []),
        ...(pages ? [{ label: "Pages", value: `${pages} pp` }] : []),
        ...(rating ? [{ label: "Rating", value: `${rating}/5 ★` }] : []),
      ],
    },
    ...(rating ? [{ kind: "actions" as const, rating }] : []),
  ];

  return {
    title,
    author,
    pages,
    rating,
    summary,
    blocks,
  };
}
