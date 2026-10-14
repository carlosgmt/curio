"use client";

import { useState } from "react";
import type { ChecklistBlockData } from "./types";
import { Check, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChecklistBlock({ data }: { data: ChecklistBlockData }) {
  const [items, setItems] = useState(data.items);

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 py-1">
      {data.title && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-0.5">
          {data.title}
        </span>
      )}
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            className="flex items-start gap-2.5 rounded-md px-1.5 py-1 text-start text-xs transition-colors hover:bg-secondary/60"
          >
            <span
              className={cn(
                "mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors",
                item.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-transparent"
              )}
            >
              <Check className="size-3" />
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 leading-normal transition-opacity",
                item.done ? "line-through text-muted-foreground opacity-60" : "text-foreground"
              )}
            >
              {item.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
