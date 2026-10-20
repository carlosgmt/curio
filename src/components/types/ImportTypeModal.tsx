"use client";

import React, { useState } from "react";
import { X, Upload, Check, AlertCircle, Loader2, Sparkles, Code2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { validateCurioSchemaSpec, type CurioSchemaSpec } from "@/lib/types/catalog";

export interface ImportTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (importedType: any) => void;
}

export function ImportTypeModal({ isOpen, onClose, onImportSuccess }: ImportTypeModalProps) {
  const [mode, setMode] = useState<"json" | "url">("json");
  const [jsonText, setJsonText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [parsedSpec, setParsedSpec] = useState<CurioSchemaSpec | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleJsonChange = (val: string) => {
    setJsonText(val);
    setSubmitError(null);
    if (!val.trim()) {
      setParsedSpec(null);
      setParseError(null);
      return;
    }
    try {
      const parsed = JSON.parse(val);
      const spec = validateCurioSchemaSpec(parsed);
      setParsedSpec(spec);
      setParseError(null);
    } catch (err: any) {
      setParsedSpec(null);
      setParseError(err.message || "Invalid JSON schema bundle");
    }
  };

  const handleImport = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let body: any;
      if (mode === "json") {
        if (!parsedSpec) {
          throw new Error("Please enter a valid Curio schema JSON bundle");
        }
        body = { spec: parsedSpec };
      } else {
        if (!urlInput.trim()) {
          throw new Error("Please enter a valid schema URL");
        }
        body = { url: urlInput.trim() };
      }

      const res = await apiFetch("/api/v1/types/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      onImportSuccess?.(result.type);
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to import type");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Import Type Schema</h3>
              <p className="text-xs text-neutral-500">Add a shared custom type using Contract + Overlay</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("json")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
              mode === "json"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            Paste JSON Bundle
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
              mode === "url"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            Import from URL
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {mode === "json" ? (
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-neutral-700 dark:text-neutral-300">
                CurioSchemaSpec JSON
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder='Paste exported CurioSchemaSpec bundle (e.g. {"schemaVersion": "1.0", "curioType": {...}})'
                rows={8}
                className="w-full p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-neutral-400"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-neutral-700 dark:text-neutral-300">
                Shared Schema URL
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://curio.network/api/v1/types/uuid/export"
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs focus:outline-hidden focus:ring-1 focus:ring-neutral-400"
              />
            </div>
          )}

          {parseError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {parsedSpec && (
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-emerald-900 dark:text-emerald-300">
                  Ready to install: {parsedSpec.curioType.name}
                </span>
                <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60">
                  {parsedSpec.curioType.typePath}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {parsedSpec.curioType.fields.map((f) => (
                  <span
                    key={f.key}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white dark:bg-neutral-900 border border-emerald-300/40 dark:border-emerald-800/40 text-neutral-700 dark:text-neutral-300"
                  >
                    {f.label} ({f.type})
                  </span>
                ))}
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleImport}
            disabled={isSubmitting || (mode === "json" && !parsedSpec) || (mode === "url" && !urlInput.trim())}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Install Type</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
