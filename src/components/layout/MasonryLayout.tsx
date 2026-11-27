"use client";

import React from "react";

export interface LayoutEngineProps<T = any> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  emptyState?: React.ReactNode;
}

export function MasonryLayout<T = any>({
  items,
  renderItem,
  className = "",
  emptyState,
}: LayoutEngineProps<T>) {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      data-testid="masonry-layout"
      className={`columns-1 sm:columns-2 lg:columns-3 gap-6 sm:gap-8 lg:gap-9 space-y-6 sm:space-y-8 lg:space-y-9 ${className}`}
    >
      {items.map((item, index) => (
        <div
          key={(item as any)?.save?.id || (item as any)?.id || index}
          data-testid="masonry-item-container"
          className="break-inside-avoid"
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}
