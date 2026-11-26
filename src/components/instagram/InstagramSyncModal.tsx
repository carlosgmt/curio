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

export interface InstagramSyncStatusInfo {
  configured: boolean;
  instagramUsername: string | null;
  hasCookie: boolean;
  authStatus: "ok" | "expired" | "challenge" | "unconfigured" | string;
  lastError: string | null;
  lastSyncedAt: string | null;
  boardSlug?: string;
}

export interface InstagramSyncModalProps {
  isOpen: boolean;
  status: InstagramSyncStatusInfo | null;
  onClose: () => void;
  onSynced: () => void;
}

export function InstagramSyncModal({
  isOpen,
  status,
  onClose,
  onSynced,
}: InstagramSyncModalProps) {
  const [tab, setTab] = useState<"cookie" | "export">("cookie");
  const [cookie, setCookie] = useState("");
  const [igUsername, setIgUsername] = useState("");
  const [incremental, setIncremental] = useState(true);
  const [exportPayload, setExportPayload] = useState<string>("");
  const [exportFilesLabel, setExportFilesLabel] = useState<string | null>(null);
  const [hydrateCount, setHydrateCount] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setResultMsg(null);
    if (status?.instagramUsername) {
      setIgUsername(status.instagramUsername);
    }
  }, [isOpen, status]);

  if (!isOpen) return null;

  const handleCookieSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setErrorMsg(null);
    setResultMsg(null);

    try {
      const res = await apiFetch("/api/v1/sync/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie: cookie.trim() || undefined,
          igUsername: igUsername.trim() || undefined,
          incremental,
          maxPages: incremental ? 5 : 25,
          force: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Instagram sync failed");
      }

      const processed = data.recordsProcessed ?? 0;
      const created = data.createdSaves ?? 0;
      const updated = data.updatedSaves ?? 0;
      const boardsCreated = data.boardsCreated ?? 0;
      const archived = data.meta?.mediaArchivedCount ?? 0;

      setCookie("");
      setResultMsg(
        `Synced ${processed} Instagram saves (${created} added, ${updated} updated, ${boardsCreated} collection boards created, ${archived} media archived).`
      );
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || "Instagram sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportImport = async () => {
    if (!exportPayload.trim()) return;
    setIsSyncing(true);
    setErrorMsg(null);
    setResultMsg(null);

    try {
      const parsedJson = JSON.parse(exportPayload);
      const res = await apiFetch("/api/v1/sync/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exportJson: parsedJson,
          hydrateLimit: hydrateCount ? 20 : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Instagram export import failed");
      }

      setResultMsg(
        `Imported ${data.parsedCount ?? 0} saved posts (${data.createdSaves ?? 0} added, ${data.updatedSaves ?? 0} updated, ${data.hydratedCount ?? 0} hydrated).`
      );
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || "Invalid JSON export or import failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      await apiFetch("/api/v1/sync/instagram", { method: "DELETE" });
      setCookie("");
      setResultMsg("Instagram session cookie cleared.");
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to clear Instagram cookie");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setErrorMsg(null);
    try {
      if (files.length === 1) {
        setExportFilesLabel(files[0].name);
        setExportPayload(await files[0].text());
        return;
      }

      const combined: Record<string, unknown> = {};
      for (const f of files) {
        const txt = await f.text();
        const json = JSON.parse(txt);
        if (json && typeof json === "object" && !Array.isArray(json)) {
          if ("saved_saved_media" in json) combined.saved_posts = json;
          else if ("saved_collections" in json) combined.saved_collections_json = json;
          else Object.assign(combined, json);
        } else if (Array.isArray(json)) {
          combined.saved_posts = json;
        }
      }
      setExportFilesLabel(files.map((f) => f.name).join(" + "));
      setExportPayload(JSON.stringify(combined, null, 2));
    } catch {
      setErrorMsg("Could not parse selected JSON file(s).");
    }
  };

  const isExpired = status?.authStatus === "expired";
  const isChallenge = status?.authStatus === "challenge";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-3xl bg-card border border-border p-6 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Instagram Saves &amp; Collections Auto-Sync
            </span>
            <h2 className="font-serif-editorial text-2xl font-medium text-foreground">
              Sync Instagram Saves
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
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
              setTab("export");
              setErrorMsg(null);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              tab === "export"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Import JSON Export
          </button>
        </div>

        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {(isExpired || isChallenge) && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  {isChallenge
                    ? "Instagram requested verification / rate-limit pause"
                    : "Instagram session cookie expired"}
                </p>
                <p className="text-[11px] opacity-90">
                  {status?.lastError ||
                    "Open instagram.com in Chrome, then click 'Refresh Instagram Session' in the Curio Chrome extension (or paste a fresh cookie below)."}
                </p>
              </div>
            </div>
          )}

          {tab === "cookie" ? (
            <form onSubmit={handleCookieSync} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    Gentle Incremental Web-API Sync
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase ${
                      status?.configured && status.authStatus === "ok"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : isExpired || isChallenge
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {status?.authStatus || "unconfigured"}
                  </span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Archives images, carousels &amp; Reels to{" "}
                  <span className="font-mono text-foreground">/Volumes/Photo</span>, classifies
                  posts with local Ollama into Curio boards, and mirrors IG Collections under{" "}
                  <span className="font-mono text-foreground">Instagram Saves</span>. Unsaving on
                  Instagram never deletes cards from Curio.
                </p>
                {status?.lastSyncedAt && (
                  <p className="text-[11px] font-mono text-muted-foreground pt-0.5">
                    Last synced: {new Date(status.lastSyncedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono font-medium text-foreground mb-1">
                    Instagram Handle (Optional)
                  </label>
                  <input
                    type="text"
                    value={igUsername}
                    onChange={(e) => setIgUsername(e.target.value)}
                    placeholder="e.g. @carlosgmt"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-mono font-medium text-foreground mb-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>
                      Instagram Session Cookie{" "}
                      {status?.hasCookie ? "(stored — leave blank to reuse)" : "(required)"}
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={cookie}
                    onChange={(e) => setCookie(e.target.value)}
                    placeholder="Paste Cookie header (must include sessionid=...) or use 1-click Refresh in the Curio Chrome extension"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={incremental}
                    onChange={(e) => setIncremental(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>
                    Incremental sync (stop at already-archived saves; uncheck for deep backfill up
                    to 25 pages)
                  </span>
                </label>
              </div>

              {resultMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{resultMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-2">
                {status?.hasCookie ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono text-rose-600 hover:bg-rose-500/10 transition cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Cookie</span>
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSyncing || (!cookie.trim() && !status?.hasCookie)}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-mono font-medium hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>{isSyncing ? "Syncing..." : "Sync Instagram"}</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border text-xs space-y-1">
                <p className="font-medium text-foreground">
                  Backfill History from Official Meta Data Export
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Select{" "}
                  <span className="font-mono text-foreground">saved_posts.json</span> and/or{" "}
                  <span className="font-mono text-foreground">saved_collections.json</span> from{" "}
                  <span className="font-mono">your_instagram_activity/saved/</span>.
                </p>
              </div>

              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-2xl bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-center">
                <input
                  type="file"
                  accept=".json"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <Upload className="w-7 h-7 text-muted-foreground mb-2" />
                <span className="text-xs font-mono font-medium text-foreground">
                  {exportFilesLabel || "Select saved_posts.json / saved_collections.json"}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground mt-1">
                  You can select both JSON files together
                </span>
              </label>

              {status?.hasCookie && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hydrateCount}
                    onChange={(e) => setHydrateCount(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>
                    Gently hydrate up to 20 posts (captions, images &amp; Reels) via active IG
                    cookie
                  </span>
                </label>
              )}

              {exportPayload && (
                <textarea
                  rows={4}
                  value={exportPayload}
                  onChange={(e) => setExportPayload(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none resize-none"
                />
              )}

              {resultMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{resultMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExportImport}
                  disabled={isSyncing || !exportPayload.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-mono font-medium hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer"
                >
                  {isSyncing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSyncing ? "Importing..." : "Import Instagram Export"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
