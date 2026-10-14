"use client";

import type { TextBlockData } from "./types";
import { Quote as QuoteIcon } from "lucide-react";

export function TextBlock({ data }: { data: TextBlockData }) {
  if (!data.content) return null;

  if (data.variant === "quote") {
    return (
      <div className="relative my-1 rounded-xl bg-secondary/30 p-3 ps-8">
        <QuoteIcon className="absolute start-2.5 top-3 size-4 text-muted-foreground/50" />
        <blockquote className="text-sm font-serif italic text-foreground leading-relaxed">
          "{data.content}"
        </blockquote>
        {data.author && (
          <figcaption className="mt-2 text-xs font-sans font-medium text-muted-foreground text-end">
            — {data.author}
            {data.source && <span className="opacity-70">, {data.source}</span>}
          </figcaption>
        )}
      </div>
    );
  }

  if (data.variant === "callout") {
    return (
      <div className="my-1 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-foreground">
        {data.content}
      </div>
    );
  }

  return (
    <div className="my-1 text-xs leading-relaxed text-ink-2 break-words whitespace-pre-wrap">
      {data.content}
    </div>
  );
}
