"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, CheckCircle2, ExternalLink, ImageOff, ShieldAlert, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

interface TriageItem {
  saveId: string;
  entityId: string | null;
  title: string;
  typePath: string;
  coreType: string;
  enrichmentStatus: string;
  heroImageUrl: string | null;
  canonicalUrl: string | null;
  missingFields: string[];
  createdAt: string;
}

export function TriageQueue() {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "failed" | "missing_artwork">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isReEnriching, setIsReEnriching] = useState(false);
  const [reEnrichMessage, setReEnrichMessage] = useState<string | null>(null);

  const fetchTriage = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`/api/v1/system/triage?filter=${filter}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error("Failed to load triage items:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTriage();
  }, [fetchTriage]);

  const handleBatchReEnrich = async (mode: "failed" | "all" = "failed") => {
    setIsReEnriching(true);
    setReEnrichMessage("Hydrating metadata via TMDB, OpenLibrary & OpenGraph...");
    try {
      const res = await apiFetch("/api/v1/system/re-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, limit: 50 }),
      });
      if (res.ok) {
        const result = await res.json();
        setReEnrichMessage(
          `Processed ${result.processedCount} items (${result.successCount} succeeded, ${result.failedCount} failed)`
        );
        await fetchTriage();
      } else {
        setReEnrichMessage("Batch re-enrichment failed");
      }
    } catch (err: any) {
      setReEnrichMessage(err.message || "Failed to trigger re-enrichment");
    } finally {
      setIsReEnriching(false);
      setTimeout(() => setReEnrichMessage(null), 6000);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-serif font-medium tracking-tight text-foreground">
              Ingestion Triage Queue
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {totalCount} items needing attention
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Resolve failed enrichments, missing artwork, and unlinked sources
          </p>
        </div>

        {/* Action Buttons & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pills */}
          <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs font-mono">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "all" ? "bg-secondary text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              All Incomplete
            </button>
            <button
              onClick={() => setFilter("failed")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "failed" ? "bg-secondary text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              Failed Status
            </button>
            <button
              onClick={() => setFilter("missing_artwork")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "missing_artwork" ? "bg-secondary text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              Missing Art
            </button>
          </div>

          {/* 1-Click Batch Re-enrich Button */}
          <button
            onClick={() => handleBatchReEnrich("failed")}
            disabled={isReEnriching || totalCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-mono font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isReEnriching ? "animate-spin" : ""}`} />
            <span>{isReEnriching ? "Enriching..." : "Batch Re-enrich All"}</span>
          </button>
        </div>
      </div>

      {/* Progress / Status Notice */}
      {reEnrichMessage && (
        <div className="mb-4 p-3 rounded-lg bg-secondary/80 border border-border text-xs font-mono text-foreground flex items-center gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${isReEnriching ? "animate-spin text-primary" : "text-emerald-500"}`} />
          <span>{reEnrichMessage}</span>
        </div>
      )}

      {/* Triage Table */}
      <div className="border border-border rounded-lg overflow-x-auto bg-background/50">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-mono uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Item</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Missing Elements</th>
              <th className="py-2.5 px-3 text-right">Card</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground font-mono">
                  Loading triage items...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground font-mono">
                  <div className="flex flex-col items-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span>Triage queue is completely clear. All items enriched!</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.saveId} className="hover:bg-muted/30 transition-colors">
                  {/* Thumbnail & Title */}
                  <td className="py-2.5 px-3 max-w-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border">
                        {item.heroImageUrl ? (
                          <img
                            src={item.heroImageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageOff className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="font-medium text-foreground truncate" title={item.title}>
                          {item.title}
                        </div>
                        {item.canonicalUrl && (
                          <a
                            href={item.canonicalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 font-mono truncate"
                          >
                            <span>Canonical Source</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="py-2.5 px-3 font-mono text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-secondary text-secondary-foreground font-semibold">
                      {item.typePath}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase font-semibold border ${
                        item.enrichmentStatus === "FAILED"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                          : item.enrichmentStatus === "OPTIMISTIC"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                          : "bg-blue-500/10 border-blue-500/30 text-blue-500"
                      }`}
                    >
                      {item.enrichmentStatus}
                    </span>
                  </td>

                  {/* Missing Fields */}
                  <td className="py-2.5 px-3 font-mono text-[10px]">
                    <div className="flex flex-wrap gap-1">
                      {item.missingFields.map((f) => (
                        <span
                          key={f}
                          className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Card link */}
                  <td className="py-2.5 px-3 text-right">
                    <Link
                      href={`/card/${item.saveId}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
                      title="Inspect item card"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
