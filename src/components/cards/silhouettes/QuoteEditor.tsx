"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export interface QuoteEditorValues {
  text: string;
  author: string;
  date: string;
  work: string;
}

export interface QuoteEditorProps {
  saveId: string;
  initial: QuoteEditorValues;
  /** Existing user custom values, preserved on save. */
  existingCustom?: Record<string, unknown>;
  onSaved: (result: { customValues: Record<string, unknown>; privateTitle: string; save?: any }) => void;
  onCancel: () => void;
}

/** Derived display title for a quote save: first ~60 chars of the quote. */
export function quoteTitleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 60 ? `${t.slice(0, 59).trimEnd()}…` : t;
}

const QUOTE_KEYS = ["text", "quote_text", "quoteText", "author", "speaker", "date", "year", "era", "work", "source", "publication"];

export function QuoteEditor({ saveId, initial, existingCustom = {}, onSaved, onCancel }: QuoteEditorProps) {
  const [values, setValues] = useState<QuoteEditorValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const save = async () => {
    if (saving || !values.text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const customValues: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(existingCustom)) {
        if (!QUOTE_KEYS.includes(k)) customValues[k] = v;
      }
      customValues.text = values.text.trim();
      customValues.author = values.author.trim();
      if (values.date.trim()) customValues.date = values.date.trim();
      if (values.work.trim()) customValues.work = values.work.trim();
      const privateTitle = quoteTitleFrom(values.text);

      const res = await apiFetch(`/api/v1/saves/${saveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCustomValues: customValues, privateTitle }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      onSaved({ customValues, privateTitle, save: data.save });
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  };

  const field =
    "w-full text-sm px-3 py-2 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-900 dark:text-neutral-100";

  return (
    <div
      data-testid="quote-editor"
      className="space-y-2.5 relative z-20"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      <label className="block">
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">Quote</span>
        <textarea
          ref={textRef}
          rows={4}
          value={values.text}
          onChange={(e) => setValues({ ...values, text: e.target.value })}
          className={`${field} font-serif italic leading-relaxed`}
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">Author</span>
          <input
            value={values.author}
            onChange={(e) => setValues({ ...values, author: e.target.value })}
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">Date (optional)</span>
          <input
            value={values.date}
            onChange={(e) => setValues({ ...values, date: e.target.value })}
            className={field}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">Work (optional)</span>
        <input value={values.work} onChange={(e) => setValues({ ...values, work: e.target.value })} className={field} />
      </label>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline">⌘/Ctrl+Enter save · Esc cancel</span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !values.text.trim()}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40 cursor-pointer"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
