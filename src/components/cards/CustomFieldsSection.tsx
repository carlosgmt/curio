"use client";

import React, { useState } from "react";
import { Plus, X, Tag, Globe, Check, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export interface CustomFieldsSectionProps {
  saveId: string;
  userCustomValues?: Record<string, unknown> | null;
  extendedAttributes?: Record<string, unknown> | null;
  onUpdated?: (newCustomValues: Record<string, unknown>) => void;
}

export function CustomFieldsSection({
  saveId,
  userCustomValues = {},
  extendedAttributes = {},
  onUpdated,
}: CustomFieldsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localCustomValues, setLocalCustomValues] = useState<Record<string, unknown>>(
    userCustomValues || {}
  );

  const cleanExtended = extendedAttributes || {};

  const handleAddField = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const cleanVal = value.trim();

    if (!cleanKey || !cleanVal || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload = {
        customValues: {
          [cleanKey]: cleanVal,
        },
      };

      const res = await apiFetch(`/api/v1/saves/${saveId}/custom-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = (data.save?.userCustomValues as Record<string, unknown>) || {
          ...localCustomValues,
          [cleanKey]: cleanVal,
        };
        setLocalCustomValues(updated);
        onUpdated?.(updated);
        setKey("");
        setValue("");
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Failed to add custom attribute:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveField = async (removeKey: string) => {
    try {
      const payload = {
        customValues: {
          [removeKey]: null,
        },
      };

      const res = await apiFetch(`/api/v1/saves/${saveId}/custom-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const next = { ...localCustomValues };
        delete next[removeKey];
        setLocalCustomValues(next);
        onUpdated?.(next);
      }
    } catch (err) {
      console.error("Failed to delete custom attribute:", err);
    }
  };

  const hasAnyFields =
    Object.keys(localCustomValues).length > 0 || Object.keys(cleanExtended).length > 0;

  return (
    <div className="mt-2 text-xs">
      {/* Pills Container */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Promoted Consensus Attributes (Global) */}
        {Object.entries(cleanExtended).map(([attrKey, attrVal]) => {
          if (attrVal === null || attrVal === undefined) return null;
          return (
            <span
              key={`global-${attrKey}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs"
              title="Verified consensus attribute from Curio Learns graph"
            >
              <Globe className="w-2.5 h-2.5 text-indigo-500" />
              <strong className="font-semibold capitalize">{attrKey.replace(/_/g, " ")}:</strong>{" "}
              {String(attrVal)}
            </span>
          );
        })}

        {/* User Specific Custom Attributes */}
        {Object.entries(localCustomValues).map(([attrKey, attrVal]) => {
          if (attrVal === null || attrVal === undefined) return null;
          return (
            <span
              key={`user-${attrKey}`}
              className="group/tag inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
            >
              <Tag className="w-2.5 h-2.5 text-neutral-400" />
              <span className="font-semibold capitalize">{attrKey.replace(/_/g, " ")}:</span>{" "}
              <span>{String(attrVal)}</span>
              <button
                type="button"
                onClick={() => handleRemoveField(attrKey)}
                className="opacity-0 group-hover/tag:opacity-100 text-neutral-400 hover:text-rose-500 transition cursor-pointer ml-0.5"
                title={`Remove ${attrKey}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          );
        })}

        {/* Inline Add Field Trigger */}
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 transition cursor-pointer"
            title="Add custom attribute (e.g., roast, vintage, elevation)"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>Field</span>
          </button>
        )}
      </div>

      {/* Popover / Inline Input Row */}
      {isOpen && (
        <form
          onSubmit={handleAddField}
          className="mt-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-wrap sm:flex-nowrap items-center gap-1.5 shadow-sm animate-in fade-in duration-150"
        >
          <input
            type="text"
            placeholder="Field (e.g. vintage)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="flex-1 min-w-[80px] text-[11px] font-mono px-2 py-1 rounded-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:outline-none"
            autoFocus
          />
          <input
            type="text"
            placeholder="Value (e.g. 2018)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 min-w-[90px] text-[11px] font-mono px-2 py-1 rounded-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:outline-none"
          />
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="submit"
              disabled={!key.trim() || !value.trim() || isSubmitting}
              className="p-1 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-30 transition cursor-pointer"
              title="Save field"
            >
              {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setKey("");
                setValue("");
              }}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition cursor-pointer"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
