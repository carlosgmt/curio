"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Film, BookOpen, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

interface ImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported?: () => void;
}

const SAMPLE_LETTERBOXD = `Date,Name,Year,Letterboxd URI,Rating
2026-03-14,Dune: Part Two,2024,https://boxd.it/mXQk,4.5
2026-02-10,"Everything Everywhere All at Once",2022,https://boxd.it/l78u,5.0
2026-01-05,Past Lives,2023,https://boxd.it/xK24,4.0`;

const SAMPLE_GOODREADS = `Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Recommended For,Recommended By,Owned Copies
44767,"Dune (Dune #1)",Frank Herbert,"Herbert, Frank",,="0441172717",="9780441172719",5,4.27,Ace Books,688,1990,1965,2026/02/01,2026/01/15,,,"read","A monumental masterpiece of ecology, religion, and politics.",,,,,1,,,0
234225,"Dune Messiah (Dune #2)",Frank Herbert,"Herbert, Frank",,="0441102670",="9780441102679",4,3.89,Ace Books,336,1987,1969,2026/03/10,2026/02/05,,,"read","A deconstruction of the messiah myth.",,,,,1,,,0`;

export function ImporterModal({ isOpen, onClose, onImported }: ImporterModalProps) {
  const [platform, setPlatform] = useState<"auto" | "letterboxd" | "goodreads">("auto");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ count?: number; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
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
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setIsUploading(true);
    setResult(null);

    try {
      const res = await apiFetch("/api/v1/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platform === "auto" ? undefined : platform,
          csvText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import items");
      }

      setResult({ count: data.insertedCount });
      setTimeout(() => {
        onImported?.();
      }, 800);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const loadSample = (type: "letterboxd" | "goodreads") => {
    setPlatform(type);
    setFileName(type === "letterboxd" ? "sample_watched.csv" : "sample_goodreads_export.csv");
    setCsvText(type === "letterboxd" ? SAMPLE_LETTERBOXD : SAMPLE_GOODREADS);
    setResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Upload className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              Day-0 Cold-Start Importer
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Instantly port your taste graph from Letterboxd or Goodreads.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex items-center gap-2 my-4">
          <button
            type="button"
            onClick={() => setPlatform("auto")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
              platform === "auto"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
            }`}
          >
            Auto-Detect
          </button>
          <button
            type="button"
            onClick={() => setPlatform("letterboxd")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
              platform === "letterboxd"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Letterboxd (Films)
          </button>
          <button
            type="button"
            onClick={() => setPlatform("goodreads")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
              platform === "goodreads"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Goodreads (Books)
          </button>
        </div>

        {/* Dropzone Area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 rounded-2xl p-6 text-center cursor-pointer transition bg-neutral-50/50 dark:bg-neutral-800/20"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <FileText className="w-10 h-10 mx-auto text-neutral-400 mb-2" />
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {fileName ? (
              <span className="font-mono text-emerald-600 dark:text-emerald-400">{fileName}</span>
            ) : (
              "Click to choose CSV or drag & drop here"
            )}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Exports accepted: Letterboxd watched.csv or Goodreads library export.
          </p>
        </div>

        {/* Sample Loaders */}
        <div className="flex items-center justify-between text-xs text-neutral-500 my-3">
          <span>Need sample data?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadSample("letterboxd")}
              className="text-neutral-700 dark:text-neutral-300 underline underline-offset-2 hover:text-neutral-900 cursor-pointer"
            >
              Letterboxd Sample
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => loadSample("goodreads")}
              className="text-neutral-700 dark:text-neutral-300 underline underline-offset-2 hover:text-neutral-900 cursor-pointer"
            >
              Goodreads Sample
            </button>
          </div>
        </div>

        {/* Status Feedback */}
        {result && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs flex items-center gap-2 ${
              result.error
                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
            }`}
          >
            {result.error ? (
              <>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{result.error}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Successfully imported {result.count} items into your Taste Stream!</span>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!csvText.trim() || isUploading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-40 transition cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <span>Import to Taste Graph</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
