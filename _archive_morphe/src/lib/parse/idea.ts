import type { CardBlock } from "@/components/blocks/types";

export interface ParsedIdea {
  title: string;
  notes: string;
  tags: string[];
  summary: string;
  blocks: CardBlock[];
}

export function parseIdea(text: string): ParsedIdea {
  const clean = text.replace(/^(idea:?|thought:?)\s*/i, "");

  // Extract hashtags like #ai #startup
  const tags: string[] = [];
  const tagMatches = clean.matchAll(/#(\w+)/g);
  for (const m of tagMatches) {
    tags.push(m[1]);
  }

  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
  const title = (lines[0] || "New Idea").replace(/#\w+/g, "").trim();
  const notes = lines.slice(1).join("\n").replace(/#\w+/g, "").trim();

  const summary = title;

  const blocks: CardBlock[] = [
    {
      kind: "header",
      title,
      subtitle: "Brain dump idea",
      badge: tags.length > 0 ? `#${tags[0]}` : undefined,
    },
    ...(notes ? [{ kind: "text" as const, content: notes, variant: "callout" as const }] : []),
    ...(tags.length > 0
      ? [
          {
            kind: "properties" as const,
            items: tags.map((t) => ({ label: "Tag", value: `#${t}` })),
          },
        ]
      : []),
  ];

  return {
    title,
    notes,
    tags,
    summary,
    blocks,
  };
}
