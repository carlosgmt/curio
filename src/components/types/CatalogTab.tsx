"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Plus,
  Check,
  Loader2,
  Trash2,
  Quote as QuoteIcon,
  Watch,
  Coffee,
  Mic,
  Tag,
  Upload,
  BookOpen,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { CatalogTypeDefinition } from "@/lib/types/catalog";
import { ImportTypeModal } from "./ImportTypeModal";

export interface CatalogItemWithStatus extends CatalogTypeDefinition {
  isInstalled: boolean;
  installedTypeId?: string | null;
  isCanonical?: boolean;
}

export interface CatalogTabProps {
  onTypeInstalled?: () => void;
}

export function CatalogTab({ onTypeInstalled }: CatalogTabProps) {
  const [catalog, setCatalog] = useState<CatalogItemWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const fetchCatalog = () => {
    setLoading(true);
    apiFetch("/api/v1/types/catalog")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.catalog) {
          setCatalog(data.catalog);
        }
      })
      .catch((err) => console.error("Failed to load catalog:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleInstall = async (item: CatalogItemWithStatus) => {
    setInstallingId(item.id);
    try {
      const res = await apiFetch("/api/v1/types/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (res.ok) {
        fetchCatalog();
        onTypeInstalled?.();
      }
    } catch (err) {
      console.error("Install failed:", err);
    } finally {
      setInstallingId(null);
    }
  };

  const handleUninstall = async (item: CatalogItemWithStatus) => {
    setUninstallingId(item.id);
    try {
      const res = await apiFetch(`/api/v1/types/catalog?typePath=${encodeURIComponent(item.typePath)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchCatalog();
        onTypeInstalled?.();
      }
    } catch (err) {
      console.error("Uninstall failed:", err);
    } finally {
      setUninstallingId(null);
    }
  };

  const getCatalogIcon = (iconName?: string) => {
    switch (iconName) {
      case "Quote":
        return <QuoteIcon className="w-5 h-5 text-amber-500" />;
      case "Watch":
        return <Watch className="w-5 h-5 text-blue-500" />;
      case "Coffee":
        return <Coffee className="w-5 h-5 text-amber-700" />;
      case "Sparkles":
        return <Sparkles className="w-5 h-5 text-rose-500" />;
      case "Mic":
        return <Mic className="w-5 h-5 text-indigo-500" />;
      default:
        return <BookOpen className="w-5 h-5 text-neutral-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Import Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-100/70 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/60">
        <div>
          <h3 className="text-sm font-bold tracking-tight">Curio Secondary Types Catalog</h3>
          <p className="text-xs text-neutral-500">
            Curated, community-tested specialized schemas you can activate in 1 tap without cluttering defaults.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsImportModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-semibold transition cursor-pointer shadow-2xs shrink-0"
        >
          <Upload className="w-3.5 h-3.5 text-neutral-500" />
          <span>Import Shared Schema</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs font-mono">Loading catalog types...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {catalog.map((item) => {
            const isInstalled = item.isInstalled;
            const isPending = installingId === item.id || uninstallingId === item.id;

            return (
              <div
                key={item.id}
                className="group relative rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 flex flex-col justify-between hover:border-neutral-300 dark:hover:border-neutral-700 shadow-2xs hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        {getCatalogIcon(item.icon)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                          {item.name}
                        </h4>
                        <span className="text-[10px] font-mono text-neutral-400 block">
                          {item.typePath}
                        </span>
                      </div>
                    </div>

                    {isInstalled ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
                        <Check className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                        Available
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed mb-4">
                    {item.description}
                  </p>

                  {/* Schema fields pill preview */}
                  <div className="mb-4">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 block mb-1.5">
                      Included Attributes ({item.fields.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {item.fields.map((f) => (
                        <span
                          key={f.key}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/50 dark:border-neutral-700/50"
                        >
                          {f.label}
                          {f.required ? " *" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-neutral-400">
                    Silhouette: {item.defaultSilhouette}
                  </span>

                  {isInstalled ? (
                    <button
                      type="button"
                      onClick={() => handleUninstall(item)}
                      disabled={isPending || item.isCanonical}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      {uninstallingId === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>Deactivate</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInstall(item)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 text-xs font-semibold transition active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {installingId === item.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Installing...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to My Types</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Import Modal */}
      <ImportTypeModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          fetchCatalog();
          onTypeInstalled?.();
        }}
      />
    </div>
  );
}
