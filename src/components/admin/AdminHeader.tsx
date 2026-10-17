"use client";

import React from "react";
import Link from "next/link";
import { RefreshCw, Database, Activity, Sparkles, ArrowLeft, Radio } from "lucide-react";
import type { CurioTelemetry } from "@/lib/system/telemetry";

interface AdminHeaderProps {
  telemetry: CurioTelemetry | null;
  isLoading: boolean;
  isPolling: boolean;
  onTogglePolling: () => void;
  onRefresh: () => void;
}

export function AdminHeader({
  telemetry,
  isLoading,
  isPolling,
  onTogglePolling,
  onRefresh,
}: AdminHeaderProps) {
  const isWalActive = telemetry?.storage?.journalMode?.toLowerCase() === "wal";
  const walSizeMb = telemetry?.storage?.walSizeMb ?? 0;
  const dbSizeMb = telemetry?.storage?.dbSizeMb ?? 0;
  const ollamaStatus = telemetry?.ollama?.status ?? "offline";
  const ollamaLatency = telemetry?.ollama?.latencyMs;

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-40 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Title & Navigation */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Return to Curio"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-primary/80 font-bold">
                Operator System Hub
              </span>
              <span className="text-muted-foreground/40 text-xs">/</span>
              <span className="text-xs text-muted-foreground font-mono">v3.2</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-medium tracking-tight text-foreground">
              Curio Telemetry &amp; Diagnostics
            </h1>
          </div>
        </div>

        {/* Live Subsystem Badges & Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* SQLite WAL Mode Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border text-xs font-mono">
            <Database className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-muted-foreground">WAL:</span>
            <span className={isWalActive ? "text-emerald-500 font-semibold" : "text-amber-500"}>
              {isWalActive ? `Active (${walSizeMb} MB)` : "Standby"}
            </span>
          </div>

          {/* DB Footprint Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border text-xs font-mono">
            <span className="text-muted-foreground">DB:</span>
            <span className="font-semibold text-foreground">{dbSizeMb} MB</span>
          </div>

          {/* Ollama Subsystem Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-muted-foreground">Ollama:</span>
            <span
              className={
                ollamaStatus === "online"
                  ? "text-emerald-500 font-semibold"
                  : ollamaStatus === "degraded"
                  ? "text-amber-500 font-semibold"
                  : "text-rose-500 font-semibold"
              }
            >
              {ollamaStatus === "online"
                ? `Online (${ollamaLatency ?? 0}ms)`
                : ollamaStatus}
            </span>
          </div>

          {/* Real-time Polling Toggle */}
          <button
            onClick={onTogglePolling}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
              isPolling
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-muted border-border text-muted-foreground hover:text-foreground"
            }`}
            title="Toggle 10s automatic telemetry refresh"
          >
            <Radio className={`w-3.5 h-3.5 ${isPolling ? "animate-pulse text-emerald-500" : ""}`} />
            <span>{isPolling ? "10s Live" : "Paused"}</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-md border border-border bg-card hover:bg-accent text-foreground disabled:opacity-50 transition-colors"
            title="Refresh telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
