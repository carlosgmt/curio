"use client";

import type { PropertiesBlockData } from "./types";

export function PropertiesBlock({ data }: { data: PropertiesBlockData }) {
  if (!data.items || data.items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1">
      {data.items.map((item, idx) => (
        <div
          key={idx}
          className="flex flex-col rounded-lg bg-secondary/50 px-2.5 py-1.5 transition-colors hover:bg-secondary/80"
        >
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {item.label}
          </span>
          <span className="text-xs font-semibold text-foreground truncate mt-0.5">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
