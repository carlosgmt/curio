"use client";

import type { MediaBlockData } from "./types";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MediaBlock({ data }: { data: MediaBlockData }) {
  if (!data.url) return null;

  return (
    <div className="relative my-1 overflow-hidden rounded-xl border border-border/50 bg-secondary/20">
      <div
        className={cn(
          "w-full bg-cover bg-center",
          data.aspect === "square" ? "aspect-square" :
          data.aspect === "wide" ? "aspect-video" :
          "h-48"
        )}
        style={{ backgroundImage: `url(${data.url})` }}
      />
      {data.caption && (
        <div className="p-2 text-center text-[11px] text-muted-foreground bg-card/80 backdrop-blur-xs border-t border-border/30">
          {data.caption}
        </div>
      )}
    </div>
  );
}
