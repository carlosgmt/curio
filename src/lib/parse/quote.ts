import type { CardBlock } from "@/components/blocks/types";

export interface ParsedQuote {
  quote: string;
  author?: string;
  source?: string;
  summary: string;
  blocks: CardBlock[];
}

export function parseQuote(text: string): ParsedQuote {
  const clean = text.replace(/^(quote:?)\s*/i, "");

  const authorMatch = clean.match(/(?:—|--|-|by)\s*([^,;.\n]+)/);
  const author = authorMatch ? authorMatch[1].trim() : undefined;

  let quote = authorMatch ? clean.slice(0, authorMatch.index).trim() : clean;
  quote = quote.replace(/^["'“]|["'”]$/g, "");

  const summary = `"${quote.slice(0, 50)}${quote.length > 50 ? "..." : ""}"${author ? ` — ${author}` : ""}`;

  const blocks: CardBlock[] = [
    {
      kind: "text",
      content: quote,
      variant: "quote",
      author,
    },
  ];

  return {
    quote,
    author,
    summary,
    blocks,
  };
}
