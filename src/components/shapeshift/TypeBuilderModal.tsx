"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  Layers,
  Code2,
  Loader2,
  Check,
  Disc3,
  Film,
  BookOpen,
  Wine,
  Frame,
  UtensilsCrossed,
  MapPin,
} from "lucide-react";
import type { curioTypes } from "@/db";
import { apiFetch } from "@/lib/apiClient";

export interface TypeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTypeCreated?: (newType: typeof curioTypes.$inferSelect) => void;
}

interface CustomFieldDraft {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select";
  optionsStr?: string;
}

const PARENT_ARCHETYPES = [
  { path: "/product", label: "Physical Goods & Gear", root: "PRODUCT" },
  { path: "/media", label: "Media & Cinema & Music", root: "MEDIA" },
  { path: "/place", label: "Places & Transit Trails", root: "PLACE" },
  { path: "/culinary", label: "Culinary & Beverage", root: "CULINARY" },
];

const SILHOUETTES = [
  { id: "swatch", label: "Tactile Swatch (Compact pill & badge)" },
  { id: "landscape_label", label: "Apothecary Label (Horizontal estate label)" },
  { id: "recipe_card", label: "Index Card (Lined note & checklist)" },
  { id: "tall_portrait", label: "Theatrical Poster (2:3 Cinema billing block)" },
  { id: "circle", label: "Turntable Plinth (Rotating grooved vinyl disc)" },
  { id: "book_jacket", label: "Hardcover Jacket (Fabric spine with Obi band)" },
  { id: "map_pass", label: "Cartographic Pass (Transit coordinates & compass)" },
];

export function TypeBuilderModal({
  isOpen,
  onClose,
  onTypeCreated,
}: TypeBuilderModalProps) {
  const [name, setName] = useState("");
  const [parentTypePath, setParentTypePath] = useState("/product");
  const [silhouette, setSilhouette] = useState("landscape_label");
  const [extractionPrompt, setExtractionPrompt] = useState("");
  const [fields, setFields] = useState<CustomFieldDraft[]>([
    { key: "makerOrRegion", label: "Maker / Region", type: "string" },
    { key: "notes", label: "Curator Notes", type: "string" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: `field_${prev.length + 1}`,
        label: `Field ${prev.length + 1}`,
        type: "string",
      },
    ]);
  };

  const handleRemoveField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFieldChange = (
    index: number,
    patch: Partial<CustomFieldDraft>
  ) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const selectedParent = PARENT_ARCHETYPES.find((p) => p.path === parentTypePath);

    const formattedFields = fields
      .filter((f) => f.key.trim() && f.label.trim())
      .map((f) => ({
        key: f.key.trim().replace(/[^a-zA-Z0-9_]/g, "_"),
        label: f.label.trim(),
        type: f.type,
        options:
          f.type === "select" && f.optionsStr
            ? f.optionsStr
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
      }));

    try {
      const res = await apiFetch("/api/v1/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parentTypePath,
          rootArchetype: selectedParent?.root || "PRODUCT",
          defaultSilhouette: silhouette,
          fields: formattedFields,
          extractionPrompt: extractionPrompt.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to register custom type");
      }

      const { type } = await res.json();
      onTypeCreated?.(type);
      onClose();
      setName("");
      setExtractionPrompt("");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-neutral-50/50 dark:bg-neutral-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                Teach Curio a New Type
              </h2>
              <p className="text-xs text-neutral-500">
                Extend your ontology with specialized fields and local model extraction
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Type Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Type Name <span className="text-amber-600">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!extractionPrompt) {
                  setExtractionPrompt(
                    `Extract specialized attributes for ${e.target.value.toLowerCase()}.`
                  );
                }
              }}
              placeholder="e.g. Japanese Incense, 35mm Cameras, Natural Wine"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>

          {/* Parent Archetype & Silhouette */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Parent Archetype
              </label>
              <select
                value={parentTypePath}
                onChange={(e) => setParentTypePath(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                {PARENT_ARCHETYPES.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Visual Silhouette
              </label>
              <select
                value={silhouette}
                onChange={(e) => setSilhouette(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                {SILHOUETTES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Schema Fields */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Custom Attributes & Schema Fields
                </label>
                <p className="text-[11px] text-neutral-500">
                  Values that Curio Learns and prompts for this specific cultural type
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddField}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Field</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {fields.map((field, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/80 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Display Label (e.g. Burn Time)"
                      value={field.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        const key = label
                          .toLowerCase()
                          .replace(/[^a-zA-Z0-9]/g, "_")
                          .replace(/^_+|_+$/g, "");
                        handleFieldChange(idx, { label, key: field.key || key });
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-medium"
                    />

                    <input
                      type="text"
                      placeholder="Key (camelCase)"
                      value={field.key}
                      onChange={(e) => handleFieldChange(idx, { key: e.target.value })}
                      className="w-32 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
                    />

                    <select
                      value={field.type}
                      onChange={(e) =>
                        handleFieldChange(idx, {
                          type: e.target.value as any,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-medium"
                    >
                      <option value="string">Text</option>
                      <option value="number">Number</option>
                      <option value="boolean">Toggle</option>
                      <option value="select">Dropdown</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveField(idx)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                      title="Remove Field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {field.type === "select" && (
                    <input
                      type="text"
                      placeholder="Options (comma separated, e.g. Sandalwood, Cedar, Floral)"
                      value={field.optionsStr || ""}
                      onChange={(e) => handleFieldChange(idx, { optionsStr: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-600 dark:text-neutral-400"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Local LLM Extraction Prompt */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-neutral-500" />
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Local LLM Extraction Prompt (Mini Agent Pi)
              </label>
            </div>
            <textarea
              rows={2}
              value={extractionPrompt}
              onChange={(e) => setExtractionPrompt(e.target.value)}
              placeholder="e.g. Extract burn time in minutes, fragrance family, and Japanese prefecture."
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 transition disabled:opacity-50 cursor-pointer shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering Type...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-current" />
                  <span>Register Custom Type</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
