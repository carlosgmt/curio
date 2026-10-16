"use client";

import React, { useState } from "react";
import { X, Link2, Wine, Music, Sparkles, Shirt, Utensils, Search, Loader2 } from "lucide-react";
import type { ConnectionType } from "@/lib/connections/service";
import type { CardData } from "../cards/PolymorphicCard";

interface PairingModalProps {
  sourceCard: CardData | null;
  availableCards: CardData[];
  isOpen: boolean;
  onClose: () => void;
  onPaired: () => void;
}

const RELATION_TYPES: Array<{
  type: ConnectionType;
  label: string;
  icon: React.ReactNode;
  hint: string;
}> = [
  {
    type: "PAIRED_WITH",
    label: "Paired With",
    icon: <Wine className="w-4 h-4 text-rose-500" />,
    hint: "Culinary & sensory pairings (e.g., wine + dish, coffee + book)",
  },
  {
    type: "SOUNDTRACK_TO",
    label: "Soundtrack To",
    icon: <Music className="w-4 h-4 text-indigo-400" />,
    hint: "Music / vinyl playing during this experience",
  },
  {
    type: "INSPIRED_BY",
    label: "Inspired By",
    icon: <Sparkles className="w-4 h-4 text-amber-400" />,
    hint: "Artistic or philosophical influence",
  },
  {
    type: "WORN_ON",
    label: "Worn On",
    icon: <Shirt className="w-4 h-4 text-blue-400" />,
    hint: "Garment or gear worn during transit or event",
  },
  {
    type: "CONSUMED_AT",
    label: "Consumed At",
    icon: <Utensils className="w-4 h-4 text-emerald-400" />,
    hint: "Place or restaurant where this was enjoyed",
  },
];

export function PairingModal({
  sourceCard,
  availableCards,
  isOpen,
  onClose,
  onPaired,
}: PairingModalProps) {
  const [selectedType, setSelectedType] = useState<ConnectionType>("PAIRED_WITH");
  const [targetSaveId, setTargetSaveId] = useState<string | null>(null);
  const [contextNote, setContextNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !sourceCard) return null;

  const sourceTitle = sourceCard.save.privateTitle || sourceCard.entity?.title || "Current Card";

  // Filter out the source card itself, and match search query
  const candidates = availableCards.filter((card) => {
    if (card.save.id === sourceCard.save.id) return false;
    const title = (card.save.privateTitle || card.entity?.title || "").toLowerCase();
    return title.includes(searchQuery.toLowerCase());
  });

  const handleConnect = async () => {
    if (!targetSaveId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSaveId: sourceCard.save.id,
          targetSaveId,
          connectionType: selectedType,
          contextNote: contextNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create connection");
      }

      onPaired();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-bold font-serif text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              Establish Synaptic Pair
            </h2>
            <p className="text-xs text-neutral-500 truncate max-w-sm">
              Connecting with: <strong className="text-neutral-900 dark:text-neutral-200">{sourceTitle}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto py-4 space-y-4 flex-1">
          {/* Relationship Type Selector */}
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 font-bold mb-2">
              1. Choose Edge Relationship
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RELATION_TYPES.map((rel) => (
                <button
                  key={rel.type}
                  type="button"
                  onClick={() => setSelectedType(rel.type)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    selectedType === rel.type
                      ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800 shadow-2xs"
                      : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{rel.icon}</div>
                  <div>
                    <span className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      {rel.label}
                    </span>
                    <span className="block text-[10px] text-neutral-500 leading-tight">
                      {rel.hint}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Context Note */}
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 font-bold mb-1.5">
              2. Memory Context Note (Optional)
            </label>
            <input
              type="text"
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
              placeholder="e.g. Uncorked during evening reading session..."
              className="w-full text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            />
          </div>

          {/* Target Card Selection */}
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 font-bold mb-2">
              3. Select Companion Card
            </label>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your taste stream..."
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2 bg-neutral-50/50 dark:bg-neutral-950/30">
              {candidates.length === 0 ? (
                <p className="text-center py-4 text-xs text-neutral-400">
                  No companion cards found.
                </p>
              ) : (
                candidates.map((card) => {
                  const title = card.save.privateTitle || card.entity?.title || "Untitled Card";
                  const isSelected = targetSaveId === card.save.id;

                  return (
                    <div
                      key={card.save.id}
                      onClick={() => setTargetSaveId(card.save.id)}
                      className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition select-none ${
                        isSelected
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                      }`}
                    >
                      {card.entity?.heroImageUrl ? (
                        <img
                          src={card.entity.heroImageUrl}
                          alt={title}
                          className="w-8 h-8 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0 text-xs font-mono">
                          ✦
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-medium truncate">{title}</span>
                        <span className={`block text-[10px] ${isSelected ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-400"}`}>
                          {card.entity?.coreType || "NOTE"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-500 font-medium">{error}</p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConnect}
            disabled={!targetSaveId || isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-40 transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Linking...</span>
              </>
            ) : (
              <span>Create Synapse Edge</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
