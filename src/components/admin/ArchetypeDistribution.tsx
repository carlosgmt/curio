"use client";

import React from "react";
import {
  ShoppingBag,
  MapPin,
  Film,
  FileText,
  Lock,
  BookOpen,
  Utensils,
  Compass,
} from "lucide-react";
import type { CurioTelemetry } from "@/lib/system/telemetry";

interface ArchetypeDistributionProps {
  telemetry: CurioTelemetry | null;
}

const ARCHETYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string; bgClass: string }
> = {
  PRODUCT: {
    label: "Product",
    icon: ShoppingBag,
    colorClass: "text-blue-400",
    bgClass: "bg-blue-500",
  },
  PLACE: {
    label: "Place",
    icon: MapPin,
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-500",
  },
  MEDIA: {
    label: "Media / Film",
    icon: Film,
    colorClass: "text-purple-400",
    bgClass: "bg-purple-500",
  },
  BOOK: {
    label: "Book",
    icon: BookOpen,
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500",
  },
  ARTICLE: {
    label: "Article",
    icon: FileText,
    colorClass: "text-sky-400",
    bgClass: "bg-sky-500",
  },
  CULINARY: {
    label: "Culinary",
    icon: Utensils,
    colorClass: "text-rose-400",
    bgClass: "bg-rose-500",
  },
  PRIVATE_MEMO: {
    label: "Private Memo",
    icon: Lock,
    colorClass: "text-yellow-400",
    bgClass: "bg-yellow-500",
  },
  OTHER: {
    label: "Custom / Other",
    icon: Compass,
    colorClass: "text-zinc-400",
    bgClass: "bg-zinc-500",
  },
};

export function ArchetypeDistribution({ telemetry }: ArchetypeDistributionProps) {
  if (!telemetry) return null;

  const archetypes = telemetry.archetypes || {};
  const totalSaves = Object.values(archetypes).reduce((acc, curr) => acc + curr, 0);

  const items = Object.entries(ARCHETYPE_CONFIG).map(([key, config]) => {
    const count = archetypes[key] || 0;
    const percentage = totalSaves > 0 ? ((count / totalSaves) * 100).toFixed(1) : "0.0";
    return {
      key,
      count,
      percentage: Number(percentage),
      ...config,
    };
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-serif font-medium tracking-tight text-foreground">
            Taste Graph Archetype Distribution
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Breakdown across 8 canonical ontology silhouettes ({totalSaves} total saves)
          </p>
        </div>
      </div>

      {/* Multi-segment Distribution Bar */}
      <div className="w-full h-3 rounded-full overflow-hidden bg-secondary flex mb-6">
        {items.map((item) => {
          if (item.count === 0) return null;
          return (
            <div
              key={item.key}
              className={`${item.bgClass} transition-all duration-500`}
              style={{ width: `${item.percentage}%` }}
              title={`${item.label}: ${item.count} (${item.percentage}%)`}
            />
          );
        })}
      </div>

      {/* 8 Archetype Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className="p-3 rounded-lg border border-border bg-background/50 hover:bg-background transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider truncate">
                  {item.label}
                </span>
                <Icon className={`w-3.5 h-3.5 ${item.colorClass} shrink-0`} />
              </div>
              <div className="flex items-baseline justify-between mt-1 font-mono">
                <span className="text-xl font-semibold text-foreground">{item.count}</span>
                <span className="text-xs text-muted-foreground">{item.percentage}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
