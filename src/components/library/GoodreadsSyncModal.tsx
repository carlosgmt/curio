"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export interface GoodreadsSyncStatusInfo {
  configured: boolean;
  goodreadsUserId: string | null;
  hasCookie: boolean;
  authStatus: "ok" | "expired" | "unconfigured" | string;
  lastError: string | null;
  lastSyncedAt: string | null;
}

export interface GoodreadsSyncModalProps {
  isOpen: boolean;
  status: GoodreadsSyncStatusInfo | null;
  onClose: () => void;
  onSynced: () => void;
}

export function GoodreadsSyncModal({
  isOpen,
  status,
  onClose,
  onSynced,
}: GoodreadsSyncModalProps) {
  const [tab, setTab] = useState<"cookie" | "csv">("cookie");
  const [goodreadsUserId, setGoodreadsUserId] = useState("");
  const [cookie, setCookie] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setResultMsg(null);
    if (status?.goodreadsUserId) {
      setGoodreadsUserId(status.goodreadsUserId);
    }
  }, [isOpen, status]);

  if (!isOpen) return null;

  const handleCookieSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setErrorMsg(null);
    setResultMsg(null);

    try {
      const res = await apiFetch("/api/v1/library/goodreads-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goodreadsUserId: goodreadsUserId.trim() || undefined,
          cookie: cookie.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Goodreads sync failed");
      }

      const processed = data.recordsProcessed ?? 0;
      const created = data.createdSaves ?? 0;
      const updated = data.updatedSaves ?? 0;
      const merged = data.meta?.mergedWithOwned ?? 0;
      const tagsCount = data.meta?.tagsImportedCount ?? 0;

      setCookie("");
      setResultMsg(
        `Synced ${processed} Goodreads books (${created} added, ${updated} updated, ${merged} merged with owned books, ${tagsCount} shelf tags imported).`
      );
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || "Goodreads sync failed");
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
      const res = await apiFetch("/api/v1/library/goodreads-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "CSV import failed");
      }
      setResultMsg(
        `Imported ${data.recordsProcessed ?? 0} Goodreads books (${data.createdSaves ?? 0} added, ${data.updatedSaves ?? 0} updated, ${data.tagsImportedCount ?? 0} shelf tags).`
      );
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
    try {
      await apiFetch("/api/v1/library/goodreads-sync", { method: "DELETE" });
      setCookie("");
      setResultMsg("Goodreads session cookie cleared.");
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to clear cookie");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(String(ev.target?.result || ""));
    reader.readAsText(file);
  };

  const isExpired = status?.authStatus === "expired";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-3xl bg-card border border-border p-6 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Goodreads Auto-Sync &amp; Shelf Tags
            </span>
            <h2 className="font-serif-editorial text-2xl font-medium text-foreground">
              Sync Goodreads Library
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 pt-4 pb-3 border-b border-border">
          <button
            type="button"
            onClick={() => {
              setTab("cookie");
              setErrorMsg(null);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              tab === "cookie"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Auto-Sync (Cookie)
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
            Import CSV Export
          </button>
        </div>

        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {tab === "cookie" ? (
            <form id="goodreads-cookie-form" onSubmit={handleCookieSync} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    Authenticated Shelf Sync
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider ${
                      isExpired
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : status?.configured
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isExpired
                      ? "Cookie Expired"
                      : status?.configured
                      ? "Connected"
                      : "Not Configured"}
                  </span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Goodreads retired public RSS feeds. Curio uses your Goodreads User ID and session cookie to auto-import{" "}
                  <span className="font-mono text-foreground">read</span>,{" "}
                  <span className="font-mono text-foreground">currently-reading</span>,{" "}
                  <span className="font-mono text-foreground">to-read</span>, reviews, ratings, and all custom shelf tags.
                </p>
                {status?.lastSyncedAt && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Last synced: {new Date(status.lastSyncedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Goodreads User ID or Profile URL
                </label>
                <input
                  type="text"
                  value={goodreadsUserId}
                  onChange={(e) => setGoodreadsUserId(e.target.value)}
                  placeholder="e.g. 12345678 or https://www.goodreads.com/user/show/12345678"
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Session Cookie</span>
                  </label>
                  {status?.hasCookie && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear saved cookie
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  placeholder={
                    status?.hasCookie && !isExpired
                      ? "•••••••• (saved; leave blank to reuse existing cookie)"
                      : "Paste Cookie header from goodreads.com request..."
                  }
                  autoComplete="off"
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Stored locally in <span className="font-mono text-foreground">0600</span> storage on mini and never returned to the browser.
                </p>
                <details className="mt-2.5 rounded-xl border border-border bg-secondary/40 p-3 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer font-mono text-[11px] font-medium text-foreground select-none">
                    Step-by-step: How to get your Goodreads User ID &amp; Session Cookie
                  </summary>
                  <ol className="mt-2.5 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>
                      <span className="font-medium text-foreground">Find your Goodreads User ID:</span>{" "}
                      Sign in at <span className="font-mono">goodreads.com</span>, click your avatar →{" "}
                      <span className="font-medium text-foreground">Profile</span>, and copy the URL (e.g.{" "}
                      <span className="font-mono">goodreads.com/user/show/12345678-name</span>) or just the number{" "}
                      <span className="font-mono">12345678</span>.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Copy your Session Cookie (Mac Chrome / Safari):</span>{" "}
                      Open <span className="font-mono">https://www.goodreads.com/review/list</span> while signed in. Open DevTools (<span className="font-mono">Cmd + Option + I</span> in Chrome, or{" "}
                      <span className="font-mono">Develop → Show Web Inspector</span> in Safari) →{" "}
                      <span className="font-medium text-foreground">Network</span> tab → filter by{" "}
                      <span className="font-mono">Doc</span> → reload (<span className="font-mono">Cmd + R</span>).
                    </li>
                    <li>
                      Click the first <span className="font-mono">list</span> request → scroll to{" "}
                      <span className="font-medium text-foreground">Request Headers</span> → copy the full{" "}
                      <span className="font-mono text-foreground">Cookie:</span> value and paste it above.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">On iPad / Mobile?</span> Use the{" "}
                      <span className="font-medium text-foreground">Import CSV Export</span> tab instead, or paste the cookie once from your Mac — Curio&apos;s 2-hour background sync on mini will reuse it automatically until it expires.
                    </li>
                  </ol>
                </details>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border text-xs space-y-1.5">
                <p className="font-medium text-foreground">
                  Step-by-step CSV Export (works on iPad &amp; Desktop)
                </p>
                <ol className="space-y-1 list-decimal list-inside text-muted-foreground leading-relaxed">
                  <li>
                    Open <span className="font-mono text-foreground">goodreads.com/review/import</span> while signed in.
                  </li>
                  <li>
                    Click <span className="font-medium text-foreground">Export Library</span> at the top and wait a few seconds for the download link.
                  </li>
                  <li>
                    Upload <span className="font-mono text-foreground">goodreads_library_export.csv</span> below — Curio imports ratings, reviews, dates, and all custom shelf tags, and merges with your owned books.
                  </li>
                </ol>
              </div>

              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-2xl bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-center">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="w-7 h-7 text-muted-foreground mb-2" />
                <span className="text-xs font-mono font-medium text-foreground">
                  {fileName || "Select goodreads_library_export.csv"}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground mt-1">
                  Preserves Bookshelves as tags &amp; merges with owned books
                </span>
              </label>
            </div>
          )}

          {resultMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{resultMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
          {tab === "cookie" ? (
            <button
              type="submit"
              form="goodreads-cookie-form"
              disabled={isSyncing || (!goodreadsUserId.trim() && !status?.goodreadsUserId)}
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
              onClick={handleCsvSync}
              disabled={isSyncing || !csvText.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-foreground text-background text-xs font-mono font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {isSyncing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSyncing ? "Importing..." : "Import CSV"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
