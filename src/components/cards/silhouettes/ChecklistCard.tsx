"use client";

import React, { useState } from "react";
import { CheckSquare, Square, Plus, ListTodo, Sparkles } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import type { SilhouetteCardProps } from "./VinylDiscCard";

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export function ChecklistCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
}: SilhouetteCardProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const initialItems: ChecklistItem[] = Array.isArray(data.items)
    ? data.items
    : [
        { id: "1", text: "First priority task", completed: false },
        { id: "2", text: "Research reference material", completed: false },
        { id: "3", text: "Draft initial overview", completed: true },
      ];

  const [items, setItems] = useState<ChecklistItem[]>(initialItems);
  const [newItemText, setNewItemText] = useState("");

  const title = entity?.title || save.personalNotes?.split("\n")[0] || "Curated Checklist";

  const completedCount = items.filter((i) => i.completed).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const toggleItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      completed: false,
    };
    setItems((prev) => [...prev, newItem]);
    setNewItemText("");
  };

  return (
    <div
      data-testid="checklist-card"
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex flex-col">
        <div className="flex items-baseline justify-between gap-2 pb-2.5 border-b border-[var(--gallery-hairline)]">
          <h3 className="font-serif-editorial text-lg font-medium text-foreground leading-snug">
            {title}
          </h3>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0">
            {completedCount}/{items.length}
          </span>
        </div>

        {/* Hairline Progress Rule */}
        <div className="h-[2px] w-full bg-[var(--well-surface)] -mt-px mb-3 overflow-hidden">
          <div
            className="h-full bg-[var(--brand)] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Checkable Items List */}
        <div className="divide-y divide-[var(--gallery-hairline)] mb-3">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={(e) => toggleItem(item.id, e)}
              className={`flex items-start gap-2.5 py-2 text-xs transition cursor-pointer select-none ${
                item.completed ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              <button
                type="button"
                className="mt-0.5 text-muted-foreground hover:text-[var(--brand)] transition shrink-0"
              >
                {item.completed ? (
                  <CheckSquare className="w-4 h-4 text-[var(--brand)]" />
                ) : (
                  <Square className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              <span className="leading-snug break-words flex-1">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Inline Add Item Form */}
        <form onSubmit={handleAddItem} className="flex items-center gap-1.5 pt-2 border-t border-[var(--gallery-hairline)]">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Add item…"
            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--well-surface)] border border-transparent focus:border-[var(--brand)] focus:outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!newItemText.trim()}
            className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 transition cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Hover/Focus-Revealed Footer */}
      {entity && (
        <div className="curio-hover-footer">
          <CardFooterWaterfall
            entity={entity}
            primarySource={primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
            isWishlist={Boolean(save.wishlist)}
          />
        </div>
      )}
    </div>
  );
}
