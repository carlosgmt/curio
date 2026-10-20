"use client";

import React from "react";
import type { LayoutEngineProps } from "./MasonryLayout";

export function GridLayout<T = any>({
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
      data-testid="grid-layout"
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}
    >
      {items.map((item, index) => (
        <div
          key={(item as any)?.save?.id || (item as any)?.id || index}
          data-testid="grid-item-container"
          className="flex flex-col h-full"
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}
