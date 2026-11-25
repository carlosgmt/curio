"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Film,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export interface LetterboxdSyncStatusInfo {
  configured: boolean;
  letterboxdUsername: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface LetterboxdSyncModalProps {
  isOpen: boolean;
  status: LetterboxdSyncStatusInfo | null;
  onClose: () => void;
  onSynced: () => void;
}

export function LetterboxdSyncModal({
  isOpen,
  status,
  onClose,
  onSynced,
}: LetterboxdSyncModalProps) {
  const [tab, setTab] = useState<"rss" | "csv">("rss");
  const [username, setUsername] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isWatchlist, setIsWatchlist] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setResultMsg(null);
    if (status?.letterboxdUsername) {
      setUsername(status.letterboxdUsername);
    }
  }, [isOpen, status]);

  if (!isOpen) return null;

  const handleRssSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setErrorMsg(null);
    setResultMsg(null);

    try {
      const res = await apiFetch("/api/v1/cinema/letterboxd-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Letterboxd RSS sync failed");
      }

      const processed = data.recordsProcessed ?? data.fetchedCount ?? 0;
      const created = data.createdSaves ?? 0;
      const updated = data.updatedSaves ?? 0;
      const tagsCount = data.meta?.tagsImportedCount ?? data.tagsImportedCount ?? 0;

      setResultMsg(
        `Synced ${processed} Letterboxd diary entries (${created} added, ${updated} updated, ${tagsCount} tags merged).`
      );
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || "Letterboxd sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCsvSync = async () => {
    if (!csvText.trim()) return;
    setIsSyncing(true);
    setErrorMsg(null);
    setResultMsg(null);

    try {
      const res = await apiFetch("/api/v1/cinema/letterboxd-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          isWatchlist,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Letterboxd CSV import failed");
      }

      const processed = data.recordsProcessed ?? 0;
      const created = data.createdSaves ?? 0;
      const updated = data.updatedSaves ?? 0;
      const tagsCount = data.tagsImportedCount ?? 0;

      setResultMsg(
        `Imported ${processed} ${isWatchlist ? "watchlist" : "film"} rows (${created} added, ${updated} updated, ${tagsCount} tags imported).`
      );
      setCsvText("");
      setFileName(null);
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || "CSV import failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    setResultMsg(null);
    try {
      const res = await apiFetch("/api/v1/cinema/letterboxd-sync", {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to disconnect Letterboxd username");
      }
      setUsername("");
      setResultMsg("Disconnected saved Letterboxd username.");
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to disconnect");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsWatchlist(/watchlist/i.test(file.name));
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Letterboxd Sync Settings"
        className="w-full max-w-xl rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Film className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="font-serif-editorial text-xl text-foreground">
              Letterboxd Sync &amp; Import
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-6 pt-4 flex gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => {
              setTab("rss");
              setErrorMsg(null);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              tab === "rss"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Auto-Sync (RSS)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("csv");
              setErrorMsg(null);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              tab === "csv"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Import History CSV
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {tab === "rss" ? (
            <form id="letterboxd-rss-form" onSubmit={handleRssSync} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    Public Diary RSS Sync (No Cookie Needed)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider ${
                      status?.configured
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {status?.configured ? "Connected" : "Not Configured"}
                  </span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Letterboxd exposes a live public RSS feed at{" "}
                  <span className="font-mono text-foreground">
                    letterboxd.com/&lt;username&gt;/rss/
                  </span>
                  . Curio checks it automatically every 2 hours on mini to import new watches,
                  half-star ratings, rewatch flags, and reviews.
                </p>
                {status?.lastSyncedAt && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Last synced: {new Date(status.lastSyncedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Letterboxd Username or Profile URL
                  </label>
                  {status?.configured && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Disconnect
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. carlosgmt or https://letterboxd.com/carlosgmt/"
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <details className="rounded-xl border border-border bg-secondary/40 p-3 text-[11px] text-muted-foreground">
                <summary className="cursor-pointer font-mono text-[11px] font-medium text-foreground select-none">
                  Step-by-step: How to find your Letterboxd username &amp; backfill tags
                </summary>
                <ol className="mt-2.5 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    <span className="font-medium text-foreground">Find your username:</span>{" "}
                    Sign in at <span className="font-mono">letterboxd.com</span> and open your
                    profile. The handle after <span className="font-mono">letterboxd.com/</span>{" "}
                    is your username (e.g. <span className="font-mono">carlosgmt</span>). You can
                    paste the full URL or just the username.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">No cookie needed:</span>{" "}
                    Because Letterboxd diary RSS is public, your Mac Mini background sync picks up
                    every film you log automatically without expiring sessions. Note: RSS includes
                    recent diary entries, ratings, rewatches, and reviews, but not custom Letterboxd tags.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">One-time backfill + Tags:</span>{" "}
                    For your full film history, custom <span className="font-mono">Tags</span>, or{" "}
                    <span className="font-mono">watchlist.csv</span>, switch to{" "}
                    <span className="font-medium text-foreground">Import History CSV</span>.
                  </li>
                </ol>
              </details>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p>
                  Letterboxd&apos;s ZIP export includes your entire archive with{" "}
                  <span className="font-mono text-foreground">Tags</span>,{" "}
                  <span className="font-mono text-foreground">Watched Date</span>,{" "}
                  <span className="font-mono text-foreground">Rewatch</span>,{" "}
                  <span className="font-mono text-foreground">Review</span>, and{" "}
                  <span className="font-mono text-foreground">Watchlist</span>.
                </p>
                <ol className="space-y-1 list-decimal list-inside text-[11px]">
                  <li>
                    Open{" "}
                    <span className="font-mono text-foreground">
                      letterboxd.com/settings/data/
                    </span>{" "}
                    and click <span className="font-medium text-foreground">Export Your Data</span>.
                  </li>
                  <li>
                    Unzip the downloaded archive and pick{" "}
                    <span className="font-mono text-foreground">diary.csv</span> (has Tags,
                    Watched Date, Rewatch),{" "}
                    <span className="font-mono text-foreground">reviews.csv</span>,{" "}
                    <span className="font-mono text-foreground">watched.csv</span>, or{" "}
                    <span className="font-mono text-foreground">watchlist.csv</span>.
                  </li>
                  <li>Upload the file below — watchlist files are detected automatically.</li>
                </ol>
              </div>

              <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border border-dashed border-border hover:border-foreground/40 bg-background cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs font-mono text-foreground">
                  {fileName
                    ? `Selected: ${fileName}`
                    : "Choose diary.csv, reviews.csv, watched.csv, or watchlist.csv"}
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>

              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isWatchlist}
                  onChange={(e) => setIsWatchlist(e.target.checked)}
                  className="rounded border-border"
                />
                <span>
                  Treat rows in this CSV as{" "}
                  <span className="font-mono font-medium">Watchlist</span> (auto-enabled for{" "}
                  <span className="font-mono">watchlist.csv</span>)
                </span>
              </label>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Or paste CSV content
                </label>
                <textarea
                  rows={4}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {(errorMsg || status?.lastError) && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg || status?.lastError}</span>
            </div>
          )}

          {resultMsg && (
            <div className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3.5 py-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{resultMsg}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-card">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-border text-xs font-mono text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Close
          </button>
          {tab === "rss" ? (
            <button
              type="submit"
              form="letterboxd-rss-form"
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-foreground text-background text-xs font-mono font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{isSyncing ? "Syncing..." : "Save & Sync Now"}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isSyncing || !csvText.trim()}
              onClick={handleCsvSync}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-foreground text-background text-xs font-mono font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isSyncing ? "Importing..." : "Import CSV"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
