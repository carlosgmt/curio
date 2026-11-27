"use client";

import React, { useState } from "react";
import { Pin, Quote, ChevronDown, Folder, Plus, ExternalLink } from "lucide-react";
import { PolymorphicCard, type CardData } from "@/components/cards/PolymorphicCard";
import type { SectionGroup, BoardChildSummary } from "@/lib/lists/service";
import type { UserAffiliateTags } from "@/lib/commerce/affiliate";
import { MasonryLayout, GridLayout, TimelineLayout, ShelfLayout, PosterWallLayout } from "@/components/layout";
import type { LayoutEngineType } from "@/components/layout/ViewModeSwitcher";
import type { SilhouetteDensity } from "@/components/cards/registry";

export interface SectionGroupViewProps {
  sections: SectionGroup[];
  childrenBoards?: BoardChildSummary[];
  creatorAffiliateTags?: UserAffiliateTags | null;
  layout?: LayoutEngineType;
  density?: SilhouetteDensity;
  readOnly?: boolean;
  hideShelfBuckets?: boolean;
  hideSubBoardsFooter?: boolean;
  shelfLabelOverride?: string;
  galleryLabelOverride?: string;
  onSelectCreator?: (creator: string) => void;
  onSelectDirector?: (director: string) => void;
  onSelectGenre?: (genre: string) => void;
  onConnect?: (card: CardData) => void;
  onSwapped?: (card: CardData) => void;
  onUnlink?: (connectionId: string) => void;
  onAddToList?: (saveId: string) => void;
  onCardUpdated?: () => void;
  onCardClick?: (card: CardData, presentation?: "standard" | "press") => void;
  onSelectBoard?: (slug: string) => void;
  onAddSubBoard?: () => void;
  onAddCard?: (sectionName?: string | null) => void;
}

export function SectionGroupView({
  sections,
  childrenBoards,
  creatorAffiliateTags,
  layout = "masonry",
  density = "standard",
  readOnly = false,
  hideShelfBuckets = false,
  hideSubBoardsFooter = false,
  shelfLabelOverride,
  galleryLabelOverride,
  onSelectCreator,
  onSelectDirector,
  onSelectGenre,
  onConnect,
  onSwapped,
  onUnlink,
  onAddToList,
  onCardUpdated,
  onCardClick,
  onSelectBoard,
  onAddSubBoard,
  onAddCard,
}: SectionGroupViewProps) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [activeShelfBucket, setActiveShelfBucket] = useState<string>("ALL");

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const shelfBuckets = React.useMemo(() => {
    const mapCard = (it: any): CardData => ({
      save: it.save,
      entity: it.entity,
      connections: it.connections,
    });
    const buckets: Array<{
      key: string;
      label: string;
      slug?: string;
      items: CardData[];
    }> = [];
    sections.forEach((sec, idx) => {
      if (sec.items.length > 0) {
        buckets.push({
          key: `sec:${sec.name || idx}`,
          label: sec.name || (sections.length === 1 && !childrenBoards?.length ? "Collection" : "Board Picks"),
          items: sec.items.map(mapCard),
        });
      }
    });
    (childrenBoards || []).forEach((child) => {
      const childItems = (child.sections?.flatMap((s) => s.items) || []).map(mapCard);
      if (childItems.length > 0 || (child.itemCount || 0) > 0) {
        buckets.push({
          key: `child:${child.id}`,
          label: child.title,
          slug: child.slug,
          items: childItems,
        });
      }
    });
    return buckets;
  }, [sections, childrenBoards]);

  const effectiveShelfBucketKey = React.useMemo(() => {
    if (activeShelfBucket === "ALL") return "ALL";
    return shelfBuckets.some((b) => b.key === activeShelfBucket) ? activeShelfBucket : "ALL";
  }, [activeShelfBucket, shelfBuckets]);

  const allUniqueShelfItems = React.useMemo(() => {
    const seen = new Set<string>();
    const combined: CardData[] = [];
    for (const bucket of shelfBuckets) {
      for (const card of bucket.items) {
        if (!seen.has(card.save.id)) {
          seen.add(card.save.id);
          combined.push(card);
        }
      }
    }
    return combined;
  }, [shelfBuckets]);

  const unifiedShelfItems = React.useMemo(() => {
    if (effectiveShelfBucketKey !== "ALL") {
      return shelfBuckets.find((b) => b.key === effectiveShelfBucketKey)?.items || [];
    }
    return allUniqueShelfItems;
  }, [shelfBuckets, effectiveShelfBucketKey, allUniqueShelfItems]);

  const activeShelfChildBucket =
    effectiveShelfBucketKey.startsWith("child:")
      ? shelfBuckets.find((b) => b.key === effectiveShelfBucketKey)
      : undefined;

  const hasItems = sections.some((s) => s.items.length > 0);
  const hasChildren = Boolean(childrenBoards && childrenBoards.length > 0);

  if (!hasItems && !hasChildren) {
    return (
      <div className="text-center py-20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 space-y-4">
        <p className="text-neutral-600 dark:text-neutral-300 font-medium text-sm">
          This board is currently empty.
        </p>
        <p className="text-neutral-400 text-xs max-w-sm mx-auto">
          Add cards from your taste stream using the "+ Board" button on any card, or create a nested sub-board.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          {onAddCard && (
            <button
              type="button"
              onClick={() => onAddCard(null)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Card</span>
            </button>
          )}
          {onAddSubBoard && (
            <button
              type="button"
              onClick={onAddSubBoard}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sub-Board</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const renderSectionCard = (item: any) => {
    const cardData: CardData = {
      save: item.save,
      entity: item.entity,
      connections: item.connections,
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
            density={density}
            readOnly={readOnly}
            creatorAffiliateTags={creatorAffiliateTags}
            onConnect={readOnly ? undefined : onConnect}
            onSwapped={readOnly ? undefined : onSwapped}
            onUnlink={readOnly ? undefined : onUnlink}
            onAddToList={readOnly ? undefined : onAddToList}
            onCardClick={onCardClick}
          />
        </div>
      </div>
    );
  };

  if (layout === "shelf" || layout === "posters") {
    const showBucketBar = !hideShelfBuckets && (shelfBuckets.length > 1 || Boolean(onAddSubBoard));
    return (
      <div className="space-y-6">
        {showBucketBar && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {shelfBuckets.length > 1 && (
                <button
                  type="button"
                  data-testid="shelf-bucket-all"
                  onClick={() => setActiveShelfBucket("ALL")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                    effectiveShelfBucketKey === "ALL"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                      : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400"
                  }`}
                >
                  <span>All</span>
                  <span className="font-mono text-[10px] opacity-80">
                    {allUniqueShelfItems.length}
                  </span>
                </button>
              )}
              {shelfBuckets.map((bucket) => {
                const isActive = effectiveShelfBucketKey === bucket.key;
                return (
                  <button
                    key={bucket.key}
                    type="button"
                    data-testid={`shelf-bucket-${bucket.slug || bucket.key}`}
                    onClick={() => setActiveShelfBucket(bucket.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                      isActive
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                        : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400"
                    }`}
                  >
                    <span>{bucket.label}</span>
                    <span className="font-mono text-[10px] opacity-80">
                      {bucket.items.length}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeShelfChildBucket?.slug && onSelectBoard && (
                <button
                  type="button"
                  onClick={() => onSelectBoard(activeShelfChildBucket.slug!)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
                >
                  <span>Open {activeShelfChildBucket.label}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
              {onAddSubBoard && (
                <button
                  type="button"
                  onClick={onAddSubBoard}
                  className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl px-2.5 py-1 transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Sub-Board</span>
                </button>
              )}
            </div>
          </div>
        )}

        {layout === "posters" ? (
          <PosterWallLayout
            items={unifiedShelfItems}
            galleryLabel={
              galleryLabelOverride ||
              (effectiveShelfBucketKey === "ALL"
                ? "CURIO CINEMA POSTERS"
                : shelfBuckets.find((b) => b.key === effectiveShelfBucketKey)?.label ||
                  "Poster Gallery")
            }
            onSelectDirector={onSelectDirector}
            onSelectGenre={onSelectGenre}
            onOpenObject={(card, presentation) => onCardClick?.(card, presentation)}
          />
        ) : (
          <ShelfLayout
            items={unifiedShelfItems}
            shelfLabel={
              shelfLabelOverride ||
              (effectiveShelfBucketKey === "ALL"
                ? "CURIO PRESS ARCHIVE"
                : shelfBuckets.find((b) => b.key === effectiveShelfBucketKey)?.label ||
                  "Board Shelf")
            }
            onSelectCreator={onSelectCreator}
            onOpenObject={(card, presentation) => onCardClick?.(card, presentation)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Editorial Card Sections */}
      {sections.map((section, idx) => {
        const secKey = section.name || `unsectioned-${idx}`;
        const isCollapsed = Boolean(collapsedSections[secKey]);

        return (
          <section key={secKey} className="space-y-6">
            {/* Section Header */}
            {section.name && (
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800 gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSection(secKey)}
                    className="flex items-center gap-2 group cursor-pointer text-left"
                    aria-label={`Toggle section ${section.name}`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-transform duration-200 ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                    <h3 className="text-xl sm:text-2xl font-bold font-serif text-neutral-900 dark:text-neutral-100 tracking-tight">
                      {section.name}
                    </h3>
                  </button>
                  <span className="text-xs font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-800/80 px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700/60">
                    {section.items.length} {section.items.length === 1 ? "card" : "cards"}
                  </span>
                </div>

                {onAddCard && (
                  <button
                    type="button"
                    onClick={() => onAddCard(section.name)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Card</span>
                  </button>
                )}
              </div>
            )}

            {/* Layout Engines (Collapsible) */}
            {!isCollapsed && (
              <>
                {layout === "masonry" && (
                  <MasonryLayout items={section.items} renderItem={renderSectionCard} />
                )}
                {layout === "grid" && (
                  <GridLayout items={section.items} renderItem={renderSectionCard} />
                )}
                {layout === "timeline" && (
                  <TimelineLayout items={section.items} renderItem={renderSectionCard} />
                )}
              </>
            )}
          </section>
        );
      })}

      {/* Nested Sub-Boards Section */}
      {!hideSubBoardsFooter && childrenBoards && childrenBoards.length > 0 && (
        <div className="space-y-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-neutral-500" />
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Sub-Boards & Collections
              </h3>
              <span className="text-xs font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                {childrenBoards.length}
              </span>
            </div>
            {onAddSubBoard && (
              <button
                type="button"
                onClick={onAddSubBoard}
                className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl px-2.5 py-1 transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Sub-Board</span>
              </button>
            )}
          </div>

          <div className="space-y-6">
            {childrenBoards.map((child) => {
              const childKey = `child-${child.id}`;
              const isChildCollapsed = Boolean(collapsedSections[childKey]);
              const childItems = child.sections?.flatMap((s) => s.items) || [];

              return (
                <div
                  key={child.id}
                  className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/40 p-4 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSection(childKey)}
                      className="flex items-center gap-2 cursor-pointer group text-left"
                      aria-label={`Toggle sub-board ${child.title}`}
                    >
                      <ChevronDown
                        className={`w-4 h-4 text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-transform duration-200 ${
                          isChildCollapsed ? "-rotate-90" : ""
                        }`}
                      />
                      <Folder className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                        {child.title}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400 bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                        {child.itemCount} {child.itemCount === 1 ? "card" : "cards"}
                      </span>
                    </button>

                    {onSelectBoard && (
                      <button
                        type="button"
                        onClick={() => onSelectBoard(child.slug)}
                        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {!isChildCollapsed && (
                    <div className="mt-4 pt-4 border-t border-neutral-200/60 dark:border-neutral-800/60">
                      {childItems.length > 0 ? (
                        layout === "masonry" ? (
                          <MasonryLayout items={childItems} renderItem={renderSectionCard} />
                        ) : layout === "grid" ? (
                          <GridLayout items={childItems} renderItem={renderSectionCard} />
                        ) : (
                          <TimelineLayout items={childItems} renderItem={renderSectionCard} />
                        )
                      ) : (
                        <div className="text-center py-6 text-xs text-neutral-400">
                          No items in this sub-board yet.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
