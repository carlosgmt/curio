"use client";

import React, { useState } from "react";
import { Check } from "lucide-react";

export interface ChecklistItem {
  id: string;
  label: string;
  checked?: boolean;
}

export interface ActionChecklistProps {
  items: ChecklistItem[];
  onToggle?: (id: string, checked: boolean) => void;
  className?: string;
}

export function ActionChecklist({ items, onToggle, className = "" }: ActionChecklistProps) {
  const [internalState, setInternalState] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const item of items) {
      init[item.id] = !!item.checked;
    }
    return init;
  });

  const handleToggle = (id: string) => {
    const nextState = !internalState[id];
    setInternalState((prev) => ({ ...prev, [id]: nextState }));
    onToggle?.(id, nextState);
  };

  return (
    <div data-testid="action-checklist" className={`flex flex-col gap-1.5 ${className}`}>
      {items.map((item) => {
        const isChecked = internalState[item.id] ?? !!item.checked;
        return (
          <div
            key={item.id}
            data-testid={`checklist-item-${item.id}`}
            onClick={() => handleToggle(item.id)}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/60 cursor-pointer transition select-none group"
          >
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                isChecked
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-neutral-300 dark:border-neutral-700 group-hover:border-neutral-400"
              }`}
            >
              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
            <span
              className={`text-xs transition-colors ${
                isChecked
                  ? "line-through text-neutral-400 dark:text-neutral-500"
                  : "text-neutral-800 dark:text-neutral-200"
              }`}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
