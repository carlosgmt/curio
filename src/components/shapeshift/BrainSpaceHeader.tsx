"use client";

import { useState } from "react";
import { Plus, Sparkles, Brain, LayoutTemplate } from "lucide-react";
import { NewTypeDialog } from "./NewTypeDialog";

export function BrainSpaceHeader() {
  const [newTypeOpen, setNewTypeOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground font-semibold shadow-xs">
            <Brain className="size-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold tracking-tight text-foreground text-sm">BrainSpace</span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNewTypeOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-2xs hover:bg-secondary transition-all active:scale-[0.97]"
          >
            <Plus className="size-3.5 text-primary" />
            <span>New Type</span>
          </button>
        </div>
      </header>

      <NewTypeDialog open={newTypeOpen} onOpenChange={setNewTypeOpen} />
    </>
  );
}