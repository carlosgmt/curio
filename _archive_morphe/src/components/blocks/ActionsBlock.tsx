"use client";

import type { ActionsBlockData } from "./types";
import { ExternalLink, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function ActionsBlock({ data }: { data: ActionsBlockData }) {
  const hasLinks = data.links && data.links.length > 0;
  const hasRating = data.rating !== undefined && data.rating > 0;

  if (!hasLinks && !hasRating) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
      {hasRating && (
        <div className="flex items-center gap-0.5 text-amber-500">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                "size-3.5",
                star <= (data.rating ?? 0) ? "fill-amber-500 text-amber-500" : "text-border"
              )}
            />
          ))}
        </div>
      )}

      {hasLinks && (
        <div className="flex items-center gap-1.5 ms-auto">
          {data.links!.map((link, idx) => (
            <a
              key={idx}
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary hover:text-primary transition-colors"
            >
              <span>{link.label}</span>
              <ExternalLink className="size-3 opacity-60" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
