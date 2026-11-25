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

export interface FilmAffinitySyncStatusInfo {
  configured: boolean;
  filmaffinityUserId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface FilmAffinitySyncModalProps {
  isOpen: boolean;
  status: FilmAffinitySyncStatusInfo | null;
  onClose: () => void;
  onSynced: () => void;
}

export function FilmAffinitySyncModal({
  isOpen,
  status,
  onClose,
  onSynced,
}: FilmAffinitySyncModalProps) {
  const [tab, setTab] = useState<"import" | "profile">("import");
  const [rawText, setRawText] = useState("");
  const [fileKind, setFileKind] = useState<"html" | "csv">("html");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isWatchlist, setIsWatchlist] = useState(false);
  const [profileInput, setProfileInput] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setResultMsg(null);
    if (status?.filmaffinityUserId) {
      setProfileInput(status.filmaffinityUserId);
    }
  }, [isOpen, status]);

  if (!isOpen) return null;

  const handleImportSubmit = async () => {
    if (!rawText.trim()) return;
    setIsSyncing(true);
    setErrorMsg(null);
    setResultMsg(null);

    try {
      const looksLikeHtml =
        fileKind === "html" ||
        /<\s*(?:!doctype|html|div|li|body)/i.test(rawText.slice(0, 600));
      const res = await apiFetch("/api/v1/cinema/filmaffinity-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          looksLikeHtml
            ? { htmlText: rawText, isWatchlist }
            : { csvText: rawText, isWatchlist }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "FilmAffinity import failed");
      }
      setResultMsg(
        `Imported ${data.recordsProcessed ?? 0} FilmAffinity films (${data.createdSaves ?? 0} added, ${data.updatedSaves ?? 0} updated).`
      );
      setRawText("");
      setFileName(null);
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || "Import failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleProfileSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileInput.trim()) return;
    setIsSyncing(true);
    setErrorMsg(null);
    setResultMsg(null);

    try {
      const res = await apiFetch("/api/v1/cinema/filmaffinity-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIdOrUrl: profileInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "FILMAFFINITY_CLOUDFLARE_BLOCKED") {
          setTab("import");
        }
        throw new Error(data.error || "FilmAffinity profile sync failed");
      }
      setResultMsg(
        `Synced ${data.recordsProcessed ?? 0} FilmAffinity ratings (${data.createdSaves ?? 0} added, ${data.updatedSaves ?? 0} updated).`
      );
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || "Profile sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    setResultMsg(null);
    try {
      const res = await apiFetch("/api/v1/cinema/filmaffinity-sync", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      setProfileInput("");
      setResultMsg("Disconnected saved FilmAffinity ID.");
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
    const isHtml = /\.html?$/i.test(file.name);
    setFileKind(isHtml ? "html" : "csv");
    setIsWatchlist(/watchlist|pendiente|mylist/i.test(file.name));
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setRawText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="FilmAffinity Sync Settings"
        className="w-full max-w-xl rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Film className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="font-serif-editorial text-xl text-foreground">
              FilmAffinity Connector
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

        <div className="px-6 pt-4 flex gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => {
              setTab("import");
              setErrorMsg(null);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              tab === "import"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Import Saved HTML / CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("profile");
              setErrorMsg(null);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              tab === "profile"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Profile URL
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {tab === "import" ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p>
                  FilmAffinity protects its public pages with Cloudflare and has no official API.
                  Saving your page in your browser preserves ratings (1–10 converted cleanly to
                  Curio 0.5–5★), directors, years, reviews, and lists.
                </p>
                <ol className="space-y-1 list-decimal list-inside text-[11px]">
                  <li>
                    Open your FilmAffinity ratings (<span className="font-mono text-foreground">Mis votaciones</span>)
                    or watchlist (<span className="font-mono text-foreground">Mis listas / Pendientes</span>) in Chrome/Safari.
                  </li>
                  <li>
                    Press <span className="font-mono text-foreground">Cmd+S</span> (Save Page As → Web Page, HTML only) or export as CSV.
                  </li>
                  <li>Upload the saved <span className="font-mono text-foreground">.html</span> or <span className="font-mono text-foreground">.csv</span> file below.</li>
                </ol>
              </div>

              <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border border-dashed border-border hover:border-foreground/40 bg-background cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs font-mono text-foreground">
                  {fileName
                    ? `Selected: ${fileName}`
                    : "Choose saved FilmAffinity .html or .csv file"}
                </span>
                <input
                  type="file"
                  accept=".html,.htm,.csv,text/html,text/csv"
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
                <span>Treat unrated items in this file as Want to Watch</span>
              </label>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Or paste FilmAffinity CSV
                </label>
                <textarea
                  rows={4}
                  value={rawText.length > 8000 ? `${rawText.slice(0, 400)}... (${rawText.length} chars loaded)` : rawText}
                  onChange={(e) => {
                    setFileKind("csv");
                    setRawText(e.target.value);
                  }}
                  placeholder="Title,Year,Directors,Rating,WatchedDate,Review"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          ) : (
            <form id="filmaffinity-profile-form" onSubmit={handleProfileSync} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border text-xs text-muted-foreground space-y-1.5">
                <p>
                  Enter your FilmAffinity <span className="font-mono text-foreground">user_id</span> or
                  profile URL. Note: if Cloudflare blocks direct server access, Curio will switch you
                  to the 1-click saved HTML importer.
                </p>
                {status?.lastSyncedAt && (
                  <p className="font-mono text-[10px]">
                    Last synced: {new Date(status.lastSyncedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    FilmAffinity User ID or Ratings URL
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
                  value={profileInput}
                  onChange={(e) => setProfileInput(e.target.value)}
                  placeholder="e.g. 123456 or https://www.filmaffinity.com/en/userratings.php?user_id=123456"
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </form>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
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
          {tab === "import" ? (
            <button
              type="button"
              disabled={isSyncing || !rawText.trim()}
              onClick={handleImportSubmit}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-foreground text-background text-xs font-mono font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>{isSyncing ? "Importing..." : "Import FilmAffinity"}</span>
            </button>
          ) : (
            <button
              type="submit"
              form="filmaffinity-profile-form"
              disabled={isSyncing || !profileInput.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-foreground text-background text-xs font-mono font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>{isSyncing ? "Checking..." : "Try Profile Sync"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
