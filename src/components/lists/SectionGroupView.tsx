"use client";

import React from "react";
import { Pin, Quote } from "lucide-react";
import { PolymorphicCard, type CardData } from "@/components/cards/PolymorphicCard";
import type { SectionGroup } from "@/lib/lists/service";
import type { UserAffiliateTags } from "@/lib/commerce/affiliate";

export interface SectionGroupViewProps {
  sections: SectionGroup[];
  creatorAffiliateTags?: UserAffiliateTags | null;
  onConnect?: (card: CardData) => void;
  onSwapped?: (card: CardData) => void;
  onUnlink?: (connectionId: string) => void;
  onAddToList?: (saveId: string) => void;
  onCardUpdated?: () => void;
  onCardClick?: (card: CardData) => void;
}

export function SectionGroupView({
  sections,
  creatorAffiliateTags,
  onConnect,
  onSwapped,
  onUnlink,
  onAddToList,
  onCardUpdated,
  onCardClick,
}: SectionGroupViewProps) {
  if (sections.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
        <p className="text-neutral-600 dark:text-neutral-300 font-medium text-sm mb-1">
          This board is currently empty.
        </p>
        <p className="text-neutral-400 text-xs max-w-sm mx-auto">
          Add cards from your taste stream using the "+ Board" button on any card.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {sections.map((section, idx) => {
        return (
          <section key={section.name || `unsectioned-${idx}`} className="space-y-6">
            {/* Editorial Section Header */}
            {section.name && (
              <div className="flex items-center gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="text-xl sm:text-2xl font-bold font-serif text-neutral-900 dark:text-neutral-100 tracking-tight">
                  {section.name}
                </h3>
                <span className="text-xs font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-800/80 px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700/60">
                  {section.items.length} {section.items.length === 1 ? "card" : "cards"}
                </span>
                <div className="flex-1 border-t border-neutral-200/60 dark:border-neutral-800" />
              </div>
            )}

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {section.items.map((item) => {
                const cardData: CardData = {
                  save: item.save,
                  entity: item.entity,
                };

                return (
                  <div key={item.save.id} className="flex flex-col h-full group/card-wrapper">
                    {/* Curator Note & Pin Callout */}
                    {(item.listItem?.curatorNote || item.listItem?.isPinned) && (
                      <div className="mb-2 p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2 shadow-2xs">
                        {item.listItem?.isPinned && (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 shrink-0 mt-0.5"
                            title="Pinned curator pick"
                          >
                            <Pin className="w-3 h-3 fill-current rotate-45" />
                          </span>
                        )}
                        {item.listItem?.curatorNote && (
                          <div className="flex items-start gap-1.5 min-w-0">
                            <Quote className="w-3 h-3 text-amber-500 shrink-0 mt-0.5 opacity-60" />
                            <p className="font-serif italic text-[11px] leading-snug line-clamp-2">
                              {item.listItem.curatorNote}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Polymorphic Card Silhouette */}
                    <div className="flex-1">
                      <PolymorphicCard
                        item={cardData}
                        creatorAffiliateTags={creatorAffiliateTags}
                        onConnect={onConnect}
                        onSwapped={onSwapped}
                        onUnlink={onUnlink}
                        onAddToList={onAddToList}
                        onCardClick={onCardClick}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
