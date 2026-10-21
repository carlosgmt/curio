"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  X,
  Film,
  BookOpen,
  Bookmark,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Rss,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

interface ImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported?: () => void;
}

type PlatformTab = "rss" | "auto" | "letterboxd" | "goodreads" | "bookmarks" | "takeout";

const SAMPLE_LETTERBOXD = `Date,Name,Year,Letterboxd URI,Rating
2026-03-14,Dune: Part Two,2024,https://boxd.it/mXQk,4.5
2026-02-10,"Everything Everywhere All at Once",2022,https://boxd.it/l78u,5.0
2026-01-05,Past Lives,2023,https://boxd.it/xK24,4.0`;

const SAMPLE_GOODREADS = `Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Recommended For,Recommended By,Owned Copies
44767,"Dune (Dune #1)",Frank Herbert,"Herbert, Frank",,="0441172717",="9780441172719",5,4.27,Ace Books,688,1990,1965,2026/02/01,2026/01/15,,,"read","A monumental masterpiece of ecology, religion, and politics.",,,,,1,,,0
234225,"Dune Messiah (Dune #2)",Frank Herbert,"Herbert, Frank",,="0441102670",="9780441102679",4,3.89,Ace Books,336,1987,1969,2026/03/10,2026/02/05,,,"read","A deconstruction of the messiah myth.",,,,,1,,,0`;

const SAMPLE_BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1710000000">Design &amp; Architecture</H3>
    <DL><p>
        <DT><A HREF="https://archdaily.com" ADD_DATE="1710001000" TAGS="architecture,inspiration">ArchDaily</A>
        <DT><A HREF="https://siteinspire.com" ADD_DATE="1710002000" TAGS="web,design">SiteInspire</A>
    </DL><p>
</DL><p>`;

const SAMPLE_TAKEOUT_KEEP = JSON.stringify(
  [
    {
      title: "Kyoto Coffee Recommendations",
      textContent: "1. Weekenders Coffee\n2. Kurasu Kyoto\n2. Wife & Husband\nMust try Ethiopian pour-over.",
      labels: [{ name: "Coffee" }, { name: "Travel" }],
      isPinned: true,
      userEditedTimestampUsec: 1710000000000000,
    },
    {
      title: "Studio Ghibli Museum",
      textContent: "Reserved tickets for next month. https://www.ghibli-museum.jp/en/",
      labels: [{ name: "Tokyo" }],
      isPinned: false,
      userEditedTimestampUsec: 1710005000000000,
    },
  ],
  null,
  2
);

export function ImporterModal({ isOpen, onClose, onImported }: ImporterModalProps) {
  const [platform, setPlatform] = useState<PlatformTab>("rss");
  const [payloadText, setPayloadText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ count?: number; message?: string; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live RSS Sync state
  const [letterboxdUsername, setLetterboxdUsername] = useState("");
  const [goodreadsUserId, setGoodreadsUserId] = useState("");
  const [lastFeedSyncAt, setLastFeedSyncAt] = useState<string | null>(null);
  const [isSyncingFeeds, setIsSyncingFeeds] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    apiFetch("/api/v1/sync/feeds")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (data.letterboxdUsername) setLetterboxdUsername(data.letterboxdUsername);
          if (data.goodreadsUserId) setGoodreadsUserId(data.goodreadsUserId);
          if (data.lastFeedSyncAt) setLastFeedSyncAt(data.lastFeedSyncAt);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setPayloadText(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setPayloadText(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!payloadText.trim()) return;
    setIsUploading(true);
    setResult(null);

    try {
      let backendPlatform: string = platform;
      if (platform === "takeout") {
        backendPlatform = payloadText.includes("FeatureCollection") ? "maps" : "keep";
      }

      const res = await apiFetch("/api/v1/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: backendPlatform === "auto" ? undefined : backendPlatform,
          payload: payloadText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import items");
      }

      setResult({ count: data.insertedCount });
      setTimeout(() => {
        onImported?.();
      }, 1000);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncFeeds = async () => {
    if (!letterboxdUsername.trim() && !goodreadsUserId.trim()) return;
    setIsSyncingFeeds(true);
    setResult(null);

    try {
      const res = await apiFetch("/api/v1/sync/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letterboxdUsername: letterboxdUsername.trim() || undefined,
          goodreadsUserId: goodreadsUserId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync RSS feeds");
      }

      const lbCount =
        (data.letterboxd?.createdSaves || 0) + (data.letterboxd?.updatedSaves || 0);
      const grCount =
        (data.goodreads?.createdSaves || 0) + (data.goodreads?.updatedSaves || 0);
      const total = lbCount + grCount;

      if (data.syncedAt) setLastFeedSyncAt(data.syncedAt);
      setResult({
        count: total,
        message: `Synced ${lbCount} Letterboxd films & ${grCount} Goodreads books!`,
      });
      setTimeout(() => {
        onImported?.();
      }, 900);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setIsSyncingFeeds(false);
    }
  };

  const loadSample = (type: PlatformTab) => {
    setPlatform(type);
    if (type === "letterboxd") {
      setFileName("sample_watched.csv");
      setPayloadText(SAMPLE_LETTERBOXD);
    } else if (type === "goodreads") {
      setFileName("sample_goodreads_export.csv");
      setPayloadText(SAMPLE_GOODREADS);
    } else if (type === "bookmarks") {
      setFileName("sample_bookmarks.html");
      setPayloadText(SAMPLE_BOOKMARKS);
    } else if (type === "takeout") {
      setFileName("sample_takeout_keep.json");
      setPayloadText(SAMPLE_TAKEOUT_KEEP);
    }
    setResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-card border border-border p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-primary/80 font-bold">
                Day-0 Ingestion & Live RSS
              </span>
              <span className="text-muted-foreground/40 text-xs">/</span>
              <span className="text-xs text-muted-foreground font-mono">$0.00 compute</span>
            </div>
            <h2 className="text-xl font-serif font-medium text-foreground">Import & Sync Taste History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dedicated Tabs */}
        <div className="flex items-center gap-1.5 pt-4 pb-2 border-b border-border overflow-x-auto">
          <button
            onClick={() => {
              setPlatform("rss");
              setResult(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors ${
              platform === "rss"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Rss className="w-3.5 h-3.5" />
            <span>Live Sync (RSS)</span>
          </button>
          <button
            onClick={() => {
              setPlatform("auto");
              setResult(null);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors ${
              platform === "auto"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            CSV / JSON File
          </button>
          <button
            onClick={() => setPlatform("letterboxd")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors ${
              platform === "letterboxd"
                ? "bg-purple-500 text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Films (CSV)</span>
          </button>
          <button
            onClick={() => setPlatform("goodreads")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors ${
              platform === "goodreads"
                ? "bg-amber-500 text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Books (CSV)</span>
          </button>
          <button
            onClick={() => setPlatform("bookmarks")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors ${
              platform === "bookmarks"
                ? "bg-blue-500 text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Bookmarks</span>
          </button>
          <button
            onClick={() => setPlatform("takeout")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors ${
              platform === "takeout"
                ? "bg-emerald-500 text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Takeout</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {platform === "rss" ? (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-secondary/60 border border-border text-xs space-y-1">
                <p className="font-medium text-foreground">
                  Zero-Auth Live RSS Sync (Letterboxd & Goodreads)
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Connect your public Letterboxd handle and Goodreads User ID. Curio automatically syncs your diary ratings, reviews, and{" "}
                  <span className="font-mono text-foreground">to-read</span> wishlist shelves without re-exporting CSVs.
                </p>
                {lastFeedSyncAt && (
                  <p className="text-[11px] font-mono text-emerald-500 pt-1">
                    Last synced: {new Date(lastFeedSyncAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-mono font-medium text-foreground mb-1.5">
                    <Film className="w-3.5 h-3.5 text-purple-500" />
                    <span>Letterboxd Username or Profile URL</span>
                  </label>
                  <input
                    type="text"
                    value={letterboxdUsername}
                    onChange={(e) => setLetterboxdUsername(e.target.value)}
                    placeholder="e.g. carlosgmt or https://letterboxd.com/carlosgmt/"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-mono font-medium text-foreground mb-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                    <span>Goodreads User ID or Profile URL</span>
                  </label>
                  <input
                    type="text"
                    value={goodreadsUserId}
                    onChange={(e) => setGoodreadsUserId(e.target.value)}
                    placeholder="e.g. 12345678 or https://www.goodreads.com/user/show/12345678"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">
                    Syncs your public <span className="text-foreground">read</span>,{" "}
                    <span className="text-foreground">currently-reading</span>, and{" "}
                    <span className="text-foreground">to-read</span> (Wishlist) shelves.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {platform === "takeout" && (
                <div className="p-3 rounded-xl bg-secondary/80 border border-border text-xs font-mono flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground">Step-0 Zero-Trust Privacy Guarantee:</span>
                    <p className="text-muted-foreground">
                      Google Keep memos without external links are stored strictly local-only as private notes. Zero network requests, zero external scraping.
                    </p>
                  </div>
                </div>
              )}

              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-2xl bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,.html,.geojson"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-xs font-mono font-medium text-foreground">
                  {fileName ? fileName : "Click to select or drag & drop file"}
                </p>
                <p className="text-[11px] font-mono text-muted-foreground mt-1">
                  Supports .csv, .json, .html, or .geojson exports
                </p>
              </div>

              {/* Sample Data Loaders */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Instant test samples:
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => loadSample("letterboxd")}
                    className="px-2.5 py-1 rounded-md bg-secondary hover:bg-accent text-foreground transition-colors border border-border"
                  >
                    Sample Letterboxd
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample("goodreads")}
                    className="px-2.5 py-1 rounded-md bg-secondary hover:bg-accent text-foreground transition-colors border border-border"
                  >
                    Sample Goodreads
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample("bookmarks")}
                    className="px-2.5 py-1 rounded-md bg-secondary hover:bg-accent text-foreground transition-colors border border-border"
                  >
                    Sample Bookmarks
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample("takeout")}
                    className="px-2.5 py-1 rounded-md bg-secondary hover:bg-accent text-foreground transition-colors border border-border"
                  >
                    Sample Keep Notes
                  </button>
                </div>
              </div>

              {/* Payload Preview */}
              {payloadText && (
                <div>
                  <div className="flex justify-between items-center text-[11px] font-mono text-muted-foreground mb-1">
                    <span>File Payload Preview ({payloadText.length} characters)</span>
                    <button
                      onClick={() => {
                        setPayloadText("");
                        setFileName(null);
                      }}
                      className="hover:text-destructive"
                    >
                      Clear
                    </button>
                  </div>
                  <textarea
                    value={payloadText}
                    onChange={(e) => setPayloadText(e.target.value)}
                    rows={4}
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              )}
            </>
          )}

          {/* Result Alert */}
          {result?.count !== undefined && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {result.message || `Successfully ingested ${result.count} items into your taste graph!`}
              </span>
            </div>
          )}

          {result?.error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{result.error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          {platform === "rss" ? (
            <button
              type="button"
              onClick={handleSyncFeeds}
              disabled={(!letterboxdUsername.trim() && !goodreadsUserId.trim()) || isSyncingFeeds}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-mono font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
            >
              {isSyncingFeeds ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{isSyncingFeeds ? "Syncing Feeds..." : "Sync Live Feeds"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleImport}
              disabled={!payloadText.trim() || isUploading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-mono font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
            >
              {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isUploading ? "Ingesting..." : "Import into Curio"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
