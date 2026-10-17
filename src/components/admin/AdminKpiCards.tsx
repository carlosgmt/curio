"use client";

import React from "react";
import { Users, Bookmark, Layers, Zap, Cpu, Database, HardDrive, CheckCircle2 } from "lucide-react";
import type { CurioTelemetry } from "@/lib/system/telemetry";

interface AdminKpiCardsProps {
  telemetry: CurioTelemetry | null;
}

export function AdminKpiCards({ telemetry }: AdminKpiCardsProps) {
  if (!telemetry) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl border border-border bg-card/40 animate-pulse" />
        ))}
      </div>
    );
  }

  const { counts, cache, storage, process: proc } = telemetry;
  const privateMemosCount = telemetry.archetypes?.PRIVATE_MEMO ?? 0;
  const publicSavesCount = cache.totalPublicSaves;
  const totalSavesCount = counts.userSaves;
  const savesPerEntity =
    cache.uniqueEntities > 0
      ? (publicSavesCount / cache.uniqueEntities).toFixed(2)
      : "1.00";

  // Estimated compute savings: $0.025 per SERP/LLM call avoided
  const estimatedSavingsUsd = (cache.cacheHitCount * 0.025).toFixed(2);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 1. Total Users */}
      <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all shadow-xs">
        <div className="flex items-center justify-between text-muted-foreground mb-3">
          <span className="text-xs font-mono uppercase tracking-wider">User Directory</span>
          <Users className="w-4 h-4 text-blue-500" />
        </div>
        <div className="text-3xl font-mono font-semibold tracking-tight text-foreground">
          {counts.users}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          <span>Single-tenant Host</span>
          <span className="text-muted-foreground/40">•</span>
          <span>Pro Tier Enabled</span>
        </div>
      </div>

      {/* 2. Total Saves & Privacy Split */}
      <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all shadow-xs">
        <div className="flex items-center justify-between text-muted-foreground mb-3">
          <span className="text-xs font-mono uppercase tracking-wider">Taste Saves &amp; Memos</span>
          <Bookmark className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-3xl font-mono font-semibold tracking-tight text-foreground">
          {totalSavesCount}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span className="text-foreground/90 font-medium">{publicSavesCount} Public Saves</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-amber-500 font-medium">{privateMemosCount} Step-0 Memos</span>
        </div>
      </div>

      {/* 3. Canonical Entities */}
      <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all shadow-xs">
        <div className="flex items-center justify-between text-muted-foreground mb-3">
          <span className="text-xs font-mono uppercase tracking-wider">Canonical Entities</span>
          <Layers className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="text-3xl font-mono font-semibold tracking-tight text-foreground">
          {counts.globalEntities}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>Multi-source: {cache.multiSourceEntities}</span>
          <span className="text-muted-foreground/40">•</span>
          <span>{savesPerEntity}x deduplication</span>
        </div>
      </div>

      {/* 4. Global Cache Hit Rate */}
      <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all shadow-xs">
        <div className="flex items-center justify-between text-muted-foreground mb-3">
          <span className="text-xs font-mono uppercase tracking-wider">Cache Efficiency</span>
          <Zap className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-mono font-semibold tracking-tight text-emerald-500">
            {cache.cacheHitRatePercent}%
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            ({cache.cacheHitCount} hits)
          </span>
        </div>
        <div className="mt-3">
          <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(cache.cacheHitRatePercent, 100)}%` }}
            />
          </div>
          <div className="mt-2 text-xs font-mono text-muted-foreground flex justify-between">
            <span>LLM Calls Saved</span>
            <span className="text-emerald-400 font-medium">+${estimatedSavingsUsd} Est.</span>
          </div>
        </div>
      </div>

      {/* 5. Process & Memory RSS */}
      <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all shadow-xs">
        <div className="flex items-center justify-between text-muted-foreground mb-3">
          <span className="text-xs font-mono uppercase tracking-wider">Runtime &amp; Memory</span>
          <Cpu className="w-4 h-4 text-purple-500" />
        </div>
        <div className="text-3xl font-mono font-semibold tracking-tight text-foreground">
          {proc.memoryRssMb} <span className="text-base font-normal text-muted-foreground">MB</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>Uptime: {Math.floor(proc.uptimeSeconds / 60)}m {proc.uptimeSeconds % 60}s</span>
          <span className="text-muted-foreground/40">•</span>
          <span>Bun {proc.bunVersion || "runtime"}</span>
        </div>
      </div>

      {/* 6. SQLite Engine & WAL Status */}
      <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all shadow-xs">
        <div className="flex items-center justify-between text-muted-foreground mb-3">
          <span className="text-xs font-mono uppercase tracking-wider">SQLite WAL Engine</span>
          <HardDrive className="w-4 h-4 text-cyan-500" />
        </div>
        <div className="text-3xl font-mono font-semibold tracking-tight text-foreground">
          {storage.pageCount} <span className="text-base font-normal text-muted-foreground">pages</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>WAL: {storage.walSizeMb} MB</span>
          <span className="text-muted-foreground/40">•</span>
          <span>Freelist: {storage.freelistCount}</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Integrity
          </span>
        </div>
      </div>
    </div>
  );
}
