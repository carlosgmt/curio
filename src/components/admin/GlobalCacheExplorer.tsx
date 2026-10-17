"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Filter, Layers, ExternalLink, ImageOff, Code2, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

interface CanonicalEntityItem {
  id: string;
  title: string;
  coreType: string;
  typePath: string | null;
  canonicalUrl: string;
  canonicalExternalId: string | null;
  identityFingerprint: string | null;
  heroImageUrl: string | null;
  summary: string | null;
  sourceCount: number;
  saveCount: number;
  coreStructuredData: Record<string, any>;
  extendedAttributes: Record<string, any>;
  createdAt: string;
}

export function GlobalCacheExplorer() {
  const [items, setItems] = useState<CanonicalEntityItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [archetype, setArchetype] = useState("ALL");
  const [missingArtwork, setMissingArtwork] = useState(false);
  const [multiMerchant, setMultiMerchant] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<CanonicalEntityItem | null>(null);

  const fetchCache = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (archetype !== "ALL") params.set("archetype", archetype);
      if (missingArtwork) params.set("missingArtwork", "true");
      if (multiMerchant) params.set("multiMerchant", "true");
      params.set("limit", "50");

      const res = await apiFetch(`/api/v1/system/cache?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error("Error fetching cache entities:", err);
    } finally {
      setIsLoading(false);
    }
  }, [search, archetype, missingArtwork, multiMerchant]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCache();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchCache]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-serif font-medium tracking-tight text-foreground">
              Global Cache Explorer
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {totalCount} canonical records
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deduplicated universal entity store ($0.00 compute reuse)
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search title, external ID, fingerprint..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>

          {/* Archetype Selector */}
          <select
            value={archetype}
            onChange={(e) => setArchetype(e.target.value)}
            className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Archetypes</option>
            <option value="PRODUCT">Products</option>
            <option value="PLACE">Places</option>
            <option value="MEDIA">Media / Films</option>
            <option value="BOOK">Books</option>
            <option value="ARTICLE">Articles</option>
            <option value="CULINARY">Culinary</option>
            <option value="OTHER">Other</option>
          </select>

          {/* Missing Artwork Toggle */}
          <button
            onClick={() => setMissingArtwork(!missingArtwork)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors border ${
              missingArtwork
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500 font-medium"
                : "bg-background border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <ImageOff className="w-3.5 h-3.5" />
            <span>Missing Artwork</span>
          </button>

          {/* Multi-Merchant Toggle */}
          <button
            onClick={() => setMultiMerchant(!multiMerchant)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors border ${
              multiMerchant
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-medium"
                : "bg-background border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Multi-Merchant</span>
          </button>
        </div>
      </div>

      {/* Explorer Table */}
      <div className="border border-border rounded-lg overflow-x-auto bg-background/50">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-mono uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Item</th>
              <th className="py-2.5 px-3">Archetype</th>
              <th className="py-2.5 px-3">Canonical ID</th>
              <th className="py-2.5 px-3">Fingerprint</th>
              <th className="py-2.5 px-3 text-center">Sources</th>
              <th className="py-2.5 px-3 text-center">Saves</th>
              <th className="py-2.5 px-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground font-mono">
                  Loading canonical entities...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground font-mono">
                  No canonical entities found matching criteria.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  {/* Hero thumbnail & title */}
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
                            <span>Link</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Archetype Pill */}
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] uppercase font-semibold bg-primary/10 text-primary border border-primary/20">
                      {item.coreType || "OTHER"}
                    </span>
                  </td>

                  {/* Canonical External ID */}
                  <td className="py-2.5 px-3 font-mono text-muted-foreground max-w-[180px] truncate" title={item.canonicalExternalId || "None"}>
                    {item.canonicalExternalId || "—"}
                  </td>

                  {/* Fingerprint */}
                  <td className="py-2.5 px-3 font-mono text-muted-foreground/80 max-w-[140px] truncate" title={item.identityFingerprint || "None"}>
                    {item.identityFingerprint ? item.identityFingerprint.substring(0, 16) + "..." : "—"}
                  </td>

                  {/* Sources Count */}
                  <td className="py-2.5 px-3 text-center font-mono font-medium">
                    <span className={item.sourceCount > 1 ? "text-indigo-400 font-bold" : "text-muted-foreground"}>
                      {item.sourceCount}
                    </span>
                  </td>

                  {/* Saves Count */}
                  <td className="py-2.5 px-3 text-center font-mono font-medium text-foreground">
                    {item.saveCount}
                  </td>

                  {/* Inspect Button */}
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setSelectedEntity(item)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Inspect raw structured JSON"
                    >
                      <Code2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Raw JSON Inspect Modal / Drawer */}
      {selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div>
                <h3 className="font-serif font-medium text-base text-foreground">
                  {selectedEntity.title}
                </h3>
                <span className="font-mono text-xs text-muted-foreground">
                  ID: {selectedEntity.id}
                </span>
              </div>
              <button
                onClick={() => setSelectedEntity(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4 text-xs font-mono">
              <div>
                <span className="text-muted-foreground uppercase tracking-wider block mb-1">
                  coreStructuredData:
                </span>
                <pre className="p-3 rounded-lg bg-background border border-border overflow-x-auto text-emerald-400">
                  {JSON.stringify(selectedEntity.coreStructuredData, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-muted-foreground uppercase tracking-wider block mb-1">
                  extendedAttributes:
                </span>
                <pre className="p-3 rounded-lg bg-background border border-border overflow-x-auto text-blue-400">
                  {JSON.stringify(selectedEntity.extendedAttributes, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
