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
      className="group relative rounded-2xl bg-[#fdfbf7] dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm hover:shadow-md transition-all duration-300 border-2 border-stone-200/90 dark:border-stone-800 flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
              <ListTodo className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-stone-500 font-bold">
              Checklist
            </span>
          </div>

          <span className="px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-[10px] font-mono font-medium text-stone-600 dark:text-stone-300">
            {completedCount}/{items.length} done
          </span>
        </div>

        {/* Title */}
        <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100 mb-3 leading-snug">
          {title}
        </h3>

        {/* Progress Bar */}
        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-[10px] font-mono text-stone-400">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Checkable Items List */}
        <div className="space-y-2 mb-4">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={(e) => toggleItem(item.id, e)}
              className={`flex items-start gap-2.5 p-2 rounded-xl text-xs transition cursor-pointer select-none ${
                item.completed
                  ? "bg-stone-100/60 dark:bg-stone-800/40 text-stone-400 line-through"
                  : "hover:bg-amber-50/50 dark:hover:bg-stone-800/80 text-stone-800 dark:text-stone-200"
              }`}
            >
              <button
                type="button"
                className="mt-0.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition shrink-0"
              >
                {item.completed ? (
                  <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Square className="w-4 h-4 text-stone-400" />
                )}
              </button>
              <span className="leading-snug break-words flex-1">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Inline Add Item Form */}
        <form onSubmit={handleAddItem} className="flex items-center gap-1.5 pt-2 border-t border-dashed border-stone-200 dark:border-stone-800">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Add new list item..."
            className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800/70 border border-transparent focus:border-stone-300 dark:focus:border-stone-700 focus:outline-none text-stone-800 dark:text-stone-200 placeholder:text-stone-400"
          />
          <button
            type="submit"
            disabled={!newItemText.trim()}
            className="p-1.5 rounded-lg bg-stone-900 text-white dark:bg-white dark:text-stone-900 disabled:opacity-30 hover:opacity-90 active:scale-95 transition cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Footer */}
      {entity && (
        <CardFooterWaterfall
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
        />
      )}
    </div>
  );
}
