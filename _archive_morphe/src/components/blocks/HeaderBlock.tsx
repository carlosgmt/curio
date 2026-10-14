"use client";

import type { HeaderBlockData } from "./types";
import { cn } from "@/lib/utils";

export function HeaderBlock({ data }: { data: HeaderBlockData }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2.5">
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold leading-snug tracking-tight text-foreground break-words">
          {data.title}
        </h3>
        {data.subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground break-words">
            {data.subtitle}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {data.badge && (
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
            {data.badge}
          </span>
        )}
        {data.status && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              data.status === "done" || data.status === "watched" || data.status === "read"
                ? "bg-positive/15 text-positive"
                : "bg-primary/10 text-primary"
            )}
          >
            {data.status}
          </span>
        )}
      </div>
    </div>
  );
}
