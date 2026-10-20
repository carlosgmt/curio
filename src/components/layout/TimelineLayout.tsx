"use client";

import React from "react";
import type { LayoutEngineProps } from "./MasonryLayout";
import { Calendar } from "lucide-react";

export interface TimelineLayoutProps<T = any> extends LayoutEngineProps<T> {
  sortOrder?: "asc" | "desc";
}

interface GroupedTimeline<T> {
  periodKey: string;
  label: string;
  timestamp: number;
  items: T[];
}

export function TimelineLayout<T = any>({
  items,
  renderItem,
  sortOrder = "desc",
  className = "",
  emptyState,
}: TimelineLayoutProps<T>) {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  // Helper to extract timestamp from item
  const getItemDate = (item: any): Date => {
    const rawDate =
      item?.save?.createdAt ||
      item?.createdAt ||
      item?.date ||
      (item?.entity?.coreStructuredData?.year ? `${item.entity.coreStructuredData.year}-01-01` : null);

    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  };

  // Group items by Month & Year (or Year)
  const groupsMap = new Map<string, GroupedTimeline<T>>();

  for (const item of items) {
    const date = getItemDate(item);
    const month = date.toLocaleString("en-US", { month: "long" });
    const year = date.getFullYear();
    const periodKey = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = `${month} ${year}`;
    const timestamp = date.getTime();

    let group = groupsMap.get(periodKey);
    if (!group) {
      group = {
        periodKey,
        label,
        timestamp,
        items: [],
      };
      groupsMap.set(periodKey, group);
    }
    group.items.push(item);
  }

  // Sort groups chronologically
  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
    return sortOrder === "desc" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
  });

  return (
    <div data-testid="timeline-layout" className={`relative py-6 ${className}`}>
      {/* Central Spine line */}
      <div className="absolute left-6 md:left-1/2 -translate-x-1/2 top-4 bottom-4 w-0.5 bg-neutral-200 dark:bg-neutral-800" />

      <div className="space-y-12">
        {sortedGroups.map((group) => (
          <div key={group.periodKey} className="relative">
            {/* Sticky Date Marker Badge */}
            <div className="sticky top-20 z-20 flex justify-start md:justify-center mb-6 pl-2 md:pl-0">
              <div
                data-testid="timeline-date-marker"
                data-period={group.periodKey}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 shadow-sm text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>{group.label}</span>
              </div>
            </div>

            {/* Alternating Cards Grid */}
            <div className="space-y-6">
              {group.items.map((item, idx) => {
                const isLeft = idx % 2 === 0;
                return (
                  <div
                    key={(item as any)?.save?.id || (item as any)?.id || idx}
                    className="relative flex flex-col md:flex-row items-center"
                  >
                    {/* Spine Node Dot */}
                    <div className="absolute left-6 md:left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-neutral-400 dark:bg-neutral-600 border-2 border-white dark:border-neutral-950 z-10" />

                    {/* Card container with alternating margin */}
                    <div
                      data-testid="timeline-item-container"
                      className={`w-full md:w-[46%] pl-12 md:pl-0 ${
                        isLeft ? "md:mr-auto md:pr-6" : "md:ml-auto md:pl-6"
                      }`}
                    >
                      {renderItem(item, idx)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
