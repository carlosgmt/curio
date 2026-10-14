"use client";

import React, { useState, useEffect } from "react";
import { Omnibox } from "@/components/shapeshift/Omnibox";
import { PolymorphicCard, type CardData } from "@/components/cards/PolymorphicCard";
import { Sparkles, Layers, ShieldCheck, Zap } from "lucide-react";

export default function Home() {
  const [items, setItems] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/v1/capture");
      if (res.ok) {
        const data = await res.json();
        setItems(data.saves || []);
      }
    } catch (err) {
      console.error("Failed to load items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleCaptured = (result: any) => {
    if (result.save) {
      setItems((prev) => [
        {
          save: result.save,
          entity: result.entity,
        },
        ...prev,
      ]);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 text-xs font-semibold tracking-wide uppercase mb-4">
          <Sparkles className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100" />
          Autonomous Memory & Taste Graph
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 mb-3 font-serif">
          Curio
        </h1>
        <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
          Capture at Keep speed. Curate with Pinterest elegance. Engineered for Agents.
        </p>
      </div>

      {/* Omnibox Universal Capture */}
      <div className="mb-14">
        <Omnibox onCaptured={handleCaptured} />
      </div>

      {/* System Highlights */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/60 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-800">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Step 0 Privacy Gate isolates confidential memos</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/60 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-800">
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          <span>$0 Global Entity Cache for popular items</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/60 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-800">
          <Layers className="w-4 h-4 text-blue-500 shrink-0" />
          <span>FR-2.3 1-tap candidate disambiguation</span>
        </div>
      </div>

      {/* Memory & Taste Stream Feed */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-neutral-200/60 dark:border-neutral-800">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            Taste Stream ({items.length})
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-16 text-neutral-400 text-sm">
            Loading your taste graph...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
            <p className="text-neutral-500 text-sm mb-2">No items captured yet.</p>
            <p className="text-neutral-400 text-xs">
              Type or paste into the Omnibox above to try a private note or public item.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <PolymorphicCard
                key={item.save.id}
                item={item}
                onSwapped={() => fetchItems()}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
