"use client";

import React, { useState } from "react";
import { Plus, X, Tag, Globe, Check, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import {
  StatBadge,
  MeterGauge,
  SpecRow,
  PriceTag,
  ActionChecklist,
  RelationPill,
} from "./primitives";

export interface CustomFieldsSectionProps {
  saveId: string;
  userCustomValues?: Record<string, unknown> | null;
  extendedAttributes?: Record<string, unknown> | null;
  onUpdated?: (newCustomValues: Record<string, unknown>) => void;
  /** Attribute keys that should never render as pills (e.g. quote text/author). */
  hiddenKeys?: string[];
}

export function CustomFieldsSection({
  saveId,
  userCustomValues = {},
  extendedAttributes = {},
  onUpdated,
  hiddenKeys = [],
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

  const renderFieldBadge = (
    attrKey: string,
    attrVal: unknown,
    isGlobal: boolean,
    onRemove?: () => void
  ) => {
    // Sanitize: only render scalar string, number, or boolean values.
    // Never render objects, arrays, or [object Object]
    if (attrVal === null || attrVal === undefined) return null;
    if (hiddenKeys.includes(attrKey.toLowerCase())) return null;
    if (typeof attrVal === "object") return null;
    const strVal = String(attrVal).trim();
    if (!strVal || strVal === "[object Object]") return null;

    const k = attrKey.toLowerCase();
    // Filter out raw URLs or keys ending in _url, url, uri or starting with http
    if (
      k.endsWith("_url") ||
      k.endsWith("url") ||
      k.endsWith("uri") ||
      k.startsWith("http") ||
      k.includes("wikidata") ||
      k === "provenance" ||
      strVal.startsWith("http://") ||
      strVal.startsWith("https://")
    ) {
      return null;
    }

    const numVal = Number(attrVal);

    if (
      (k.includes("rating") || k.includes("score") || k.includes("cupping")) &&
      !isNaN(numVal)
    ) {
      return (
        <div key={`${isGlobal ? "global" : "user"}-${attrKey}`} className="flex items-center gap-1">
          <MeterGauge value={numVal} max={10} label={attrKey} className="min-w-[100px]" />
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-neutral-400 hover:text-rose-500 ml-1">
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      );
    }

    if (
      (k.includes("abv") ||
        k.includes("weight") ||
        k.includes("temperature") ||
        k.includes("temp") ||
        k.includes("wattage")) &&
      strVal
    ) {
      return (
        <div key={`${isGlobal ? "global" : "user"}-${attrKey}`} className="flex items-center gap-1">
          <StatBadge label={attrKey} value={strVal} />
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-neutral-400 hover:text-rose-500 ml-1">
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      );
    }

    if ((k.includes("price") || k.includes("cost")) && !isNaN(numVal)) {
      return (
        <div key={`${isGlobal ? "global" : "user"}-${attrKey}`} className="flex items-center gap-1">
          <PriceTag priceCents={numVal} />
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-neutral-400 hover:text-rose-500 ml-1">
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      );
    }

    if ((k.includes("paired") || k.includes("related") || k.includes("synapse")) && strVal) {
      return (
        <div key={`${isGlobal ? "global" : "user"}-${attrKey}`} className="flex items-center gap-1">
          <RelationPill relationType={attrKey} targetTitle={strVal} />
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-neutral-400 hover:text-rose-500 ml-1">
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      );
    }

    return (
      <span
        key={`${isGlobal ? "global" : "user"}-${attrKey}`}
        className={`group/tag inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono ${
          isGlobal
            ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
        }`}
      >
        {isGlobal ? <Globe className="w-3.5 h-3.5 text-indigo-500" /> : <Tag className="w-3.5 h-3.5 text-neutral-400" />}
        <strong className="font-semibold capitalize">{attrKey.replace(/_/g, " ")}:</strong>{" "}
        <span>{strVal}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="opacity-0 group-hover/tag:opacity-100 text-neutral-400 hover:text-rose-500 transition cursor-pointer ml-1"
            title={`Remove ${attrKey}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </span>
    );
  };

  return (
    <div className="mt-2 text-xs">
      {/* Pills Container */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Promoted Consensus Attributes (Global) */}
        {Object.entries(cleanExtended).map(([attrKey, attrVal]) => {
          if (attrVal === null || attrVal === undefined) return null;
          return renderFieldBadge(attrKey, attrVal, true);
        })}

        {/* User Specific Custom Attributes */}
        {Object.entries(localCustomValues).map(([attrKey, attrVal]) => {
          if (attrVal === null || attrVal === undefined) return null;
          return renderFieldBadge(attrKey, attrVal, false, () => handleRemoveField(attrKey));
        })}

        {/* Inline Add Field Trigger */}
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 transition cursor-pointer"
            title="Add custom attribute (e.g., roast, vintage, elevation)"
          >
            <Plus className="w-3 h-3" />
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
            className="flex-1 min-w-[80px] text-xs font-mono px-2.5 py-1.5 rounded-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:outline-none"
            autoFocus
          />
          <input
            type="text"
            placeholder="Value (e.g. 2018)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 min-w-[90px] text-xs font-mono px-2.5 py-1.5 rounded-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:outline-none"
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
