"use client";

import Link from "next/link";
import { Brain, Settings } from "lucide-react";

export function BrainSpaceHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="flex items-center gap-2">
        <div className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground font-semibold shadow-xs">
          <Brain className="size-4" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold tracking-tight text-foreground text-sm">BrainSpace</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="grid size-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground shadow-2xs hover:text-foreground hover:bg-secondary transition-all active:scale-[0.97]"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="size-4" />
        </Link>
      </div>
    </header>
  );
}