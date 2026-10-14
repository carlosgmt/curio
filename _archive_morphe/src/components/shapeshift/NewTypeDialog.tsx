"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { notify } from "@/lib/notify";
import type { CustomTypeField, FieldKind } from "@/lib/customTypes";

export function NewTypeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (type: any) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<CustomTypeField[]>([
    { key: "title", label: "Title", kind: "text", required: true },
    { key: "notes", label: "Notes", kind: "text" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { key: `field_${prev.length + 1}`, label: `Field ${prev.length + 1}`, kind: "text" },
    ]);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<CustomTypeField>) => {
    setFields((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      if (updates.label && !updates.key) {
        copy[index].key = updates.label.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
      }
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const res = await fetch("/api/v1/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: slug,
          name: trimmed,
          description: description.trim() || undefined,
          fields,
          patterns: [slug, trimmed.toLowerCase()],
        }),
      });

      if (res.ok) {
        const created = await res.json();
        notify(`Created custom type \"${trimmed}\"`, { id: "custom-type-created" });
        onCreated?.(created);
        setName("");
        setDescription("");
        setFields([
          { key: "title", label: "Title", kind: "text", required: true },
          { key: "notes", label: "Notes", kind: "text" },
        ]);
        onOpenChange(false);
      } else {
        notify("Failed to create type", { id: "type-error" });
      }
    } catch {
      notify("Offline: failed to create type", { id: "type-error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-primary" />
            <span>Create Custom Card Type</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Define a structured type. Any text matching this name or attributes will automatically form this card.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Type Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Wine, Workout, Meeting, Plant"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Description (optional)</label>
            <input
              type="text"
              placeholder="e.g. Track wine tastings, bottles, and ratings"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Fields</label>
              <button
                type="button"
                onClick={addField}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <Plus className="size-3" />
                <span>Add Field</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pe-1">
              {fields.map((field, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Field name"
                    value={field.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    className="flex-1 rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <select
                    value={field.kind}
                    onChange={(e) => updateField(i, { kind: e.target.value as FieldKind })}
                    className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="rating">Rating (1-5)</option>
                    <option value="tag">Tag</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeField(i)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Type"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}