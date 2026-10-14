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
  let clean = text.replace(/^(?:book:?|reading:?|read:?|libro:?|leyendo:?|leer:?)\s*/i, "").trim();
  clean = clean.replace(/\s+(?:book|libro)\s*$/i, "").trim();

  // Extract pages: "328 pages", "400 pp", "300 páginas"
  const pagesMatch = clean.match(/(\d+)\s*(?:pages|pp|páginas|paginas)/i);
  const pages = pagesMatch ? pagesMatch[1] : undefined;
  if (pagesMatch) {
    clean = clean.replace(pagesMatch[0], "").trim();
  }

  // Extract rating: "5 stars", "4/5", "5★", "4 estrellas"
  const starsMatch = clean.match(/(\d)\s*(?:stars|estrellas|\/5|★)/i);
  const rating = starsMatch ? parseInt(starsMatch[1], 10) : undefined;
  if (starsMatch) {
    clean = clean.replace(starsMatch[0], "").trim();
  }

  // Explicit title tag if present: "title: X", "título: X"
  let title: string | undefined;
  const titleTagMatch = clean.match(/(?:title:|título:|titulo:)\s*([^,;\n]+)/i);
  if (titleTagMatch) {
    title = titleTagMatch[1].trim();
    clean = clean.replace(titleTagMatch[0], "").trim();
  }

  // Extract author via explicit keywords: by / author: / de / por / autor:
  let author: string | undefined;
  const authorMatch = clean.match(/(?:by\s+|author:?\s*|autor:?\s*|por\s+)([^,;.\n]+)/i);
  if (authorMatch) {
    author = authorMatch[1].trim();
    clean = clean.replace(authorMatch[0], "").trim();
  } else {
    // Check for "Title de Author" e.g. "Patria de Fernando Aramburu"
    const deMatch = clean.match(/\s+de\s+([A-ZÁÉÍÓÚ][a-záéíóú]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóú]+)*)$/);
    if (deMatch) {
      author = deMatch[1].trim();
      clean = clean.slice(0, deMatch.index).trim();
    }
  }

  if (!title) {
    title = clean;

    // Literal prompt "title author" fallback
    if (/^title\s+author$/i.test(clean)) {
      title = "Title";
      author = "Author";
    } else if (!author && /[-—:]/.test(clean)) {
      // Check dash or colon: "1984 - George Orwell" or "Dune: Frank Herbert"
      const parts = clean.split(/\s*[-—:]\s*/).filter(Boolean);
      if (parts.length >= 2) {
        title = parts[0].trim();
        author = parts[1].trim();
      }
    } else if (!author && /,/.test(clean)) {
      const parts = clean.split(/\s*,\s*/).filter(Boolean);
      if (parts.length >= 2) {
        title = parts[0].trim();
        author = parts[1].trim();
      }
    }
  }

  title = title.replace(/^["']|["']$/g, "").replace(/^[,\s;]+|[,\s;]+$/g, "").trim();
  if (author) {
    author = author.replace(/^["']|["']$/g, "").replace(/^[,\s;]+|[,\s;]+$/g, "").trim();
  }

  const summary = `${title || "Book"}${author ? ` by ${author}` : ""}`;

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
