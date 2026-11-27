"use client";

import React, { useState } from "react";
import { Lock, ShieldCheck, Copy, Check, EyeOff } from "lucide-react";

export interface PrivateMemoCardProps {
  save: {
    id: string;
    isPrivateMemo?: boolean;
    privateTitle?: string | null;
    personalNotes?: string | null;
    createdAt: string | Date;
  };
}

export function PrivateMemoCard({ save }: PrivateMemoCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (save.personalNotes) {
      navigator.clipboard.writeText(save.personalNotes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formattedDate = new Date(save.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="curio-gallery-card group relative p-5 flex flex-col justify-between overflow-hidden">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-serif-editorial text-lg font-medium text-foreground leading-snug">
            {save.privateTitle || "Personal Note"}
          </h3>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0">
            {formattedDate}
          </span>
        </div>

        <div className="text-xs text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap pt-2 border-t border-[var(--gallery-hairline)]">
          {save.personalNotes}
        </div>
      </div>

      <div className="mt-4 pt-2.5 border-t border-[var(--gallery-hairline)] flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-[var(--brand)]" aria-hidden="true" />
          <span>Encrypted locally</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="curio-hover-chrome inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary/70 transition cursor-pointer"
          title="Copy note to clipboard"
        >
          {copied ? <Check className="w-3 h-3 text-[var(--positive)]" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
}
