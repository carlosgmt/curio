"use client";

import React, { useState } from "react";
import { X, Copy, Check, Download, Share2, Code2, Globe } from "lucide-react";
import type { CurioTypeRecord } from "./TypesSettingsModal";
import { exportCurioSchemaSpec, type CurioSchemaSpec } from "@/lib/types/catalog";

export interface ShareTypeModalProps {
  typeRecord: CurioTypeRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareTypeModal({ typeRecord, isOpen, onClose }: ShareTypeModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  if (!isOpen || !typeRecord) return null;

  const spec: CurioSchemaSpec = exportCurioSchemaSpec(
    typeRecord,
    typeof window !== "undefined" ? window.location.host : "curio.local"
  );
  const jsonString = JSON.stringify(spec, null, 2);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/types/${typeRecord.id}/export`
      : `/api/v1/types/${typeRecord.id}/export`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${typeRecord.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-schema.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Share Type Schema</h3>
              <p className="text-xs text-neutral-500 font-mono">{typeRecord.name} ({typeRecord.typePath})</p>
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

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Contract + Overlay Explanation */}
          <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <span className="font-semibold block mb-0.5">Contract + Overlay Architecture</span>
            Exporting generates a portable Curio Schema bundle (`CurioSchemaSpec`). When others import this type, its base contract is preserved while allowing personal custom fields.
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold transition cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Globe className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "Link Copied" : "Copy Share Link"}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyJson}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold transition cursor-pointer"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedJson ? "JSON Copied" : "Copy Schema JSON"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .json</span>
            </button>
          </div>

          {/* Schema JSON Viewer */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-semibold text-neutral-500">
                CurioSchemaSpec Bundle (v1.0)
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                {spec.curioType.fields.length} fields defined
              </span>
            </div>
            <pre className="p-4 rounded-2xl bg-neutral-950 text-neutral-200 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-64 border border-neutral-800">
              {jsonString}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
