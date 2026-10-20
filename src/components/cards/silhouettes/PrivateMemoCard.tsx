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
    <div className="group relative rounded-2xl bg-amber-50/60 dark:bg-amber-950/25 text-amber-950 dark:text-amber-100 shadow-sm hover:shadow-md transition-all duration-300 border-2 border-amber-200/80 dark:border-amber-900/50 p-5 flex flex-col justify-between overflow-hidden">
      {/* Top Header Vault Badge */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-1 rounded-full border border-amber-300/60 dark:border-amber-800/60">
            <Lock className="w-3.5 h-3.5" />
            Text note
          </span>
          <span className="text-[11px] font-mono text-amber-800/60 dark:text-amber-400/60">
            {formattedDate}
          </span>
        </div>

        <h3 className="font-serif text-lg font-bold text-amber-950 dark:text-amber-50 mb-2 leading-snug">
          {save.privateTitle || "Personal Note"}
        </h3>

        <div className="p-3.5 rounded-xl bg-white/70 dark:bg-neutral-900/60 border border-amber-200/50 dark:border-amber-900/40 text-xs text-neutral-800 dark:text-neutral-200 font-sans leading-relaxed whitespace-pre-wrap">
          {save.personalNotes}
        </div>
      </div>

      {/* Zero Network Leak Guarantee Row */}
      <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-[11px] font-mono text-amber-900/80 dark:text-amber-400/80">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Zero network leak • Encrypted locally</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-800 dark:text-amber-300 hover:text-amber-950 p-1 rounded hover:bg-amber-100/60 transition cursor-pointer"
          title="Copy note to clipboard"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
}
