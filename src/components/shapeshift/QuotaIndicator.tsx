"use client";

import React, { useState, useEffect } from "react";
import { Zap, Crown, Info, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export interface QuotaData {
  isPro: boolean;
  creditsRemaining: number;
  totalMonthlyCredits: number;
  resetAt: string | null;
  percentUsed: number;
}

export function QuotaIndicator() {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const fetchQuota = async () => {
    try {
      const res = await apiFetch("/api/v1/user/quota");
      if (res.ok) {
        const data = await res.json();
        setQuota(data.quota);
      }
    } catch (err) {
      console.error("Failed to fetch quota:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, []);

  if (loading || !quota) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-400 animate-pulse border border-neutral-200 dark:border-neutral-700">
        <Zap className="w-3.5 h-3.5" />
        <span>Syncing Quota...</span>
      </div>
    );
  }

  // 1. Pro Tier Display
  if (quota.isPro) {
    return (
      <div className="relative inline-block">
        <div
          onClick={() => setShowDetails(!showDetails)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-rose-500/10 border border-amber-500/30 dark:border-amber-400/30 text-amber-900 dark:text-amber-200 shadow-2xs cursor-pointer hover:border-amber-500/60 transition"
          title="Curio Pro • Unlimited AI Extractions"
        >
          <Crown className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-semibold">PRO</span>
          <span className="text-[11px] opacity-80">• Unlimited AI</span>
        </div>

        {showDetails && (
          <div className="absolute right-0 mt-2 w-64 p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>Curio Pro Member</span>
            </div>
            <p className="text-neutral-500 text-[11px] leading-relaxed">
              You have unlimited AI web extractions, deep ontology classification, and automatic sensory metadata enrichment.
            </p>
          </div>
        )}
      </div>
    );
  }

  // 2. Free Tier Metered Display (25 credits / month)
  const isDepleted = quota.creditsRemaining <= 0;
  const isLow = quota.creditsRemaining > 0 && quota.creditsRemaining <= 5;

  const resetDateText = quota.resetAt
    ? new Date(quota.resetAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "Next month";

  return (
    <div className="relative inline-block">
      <div
        onClick={() => setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium transition cursor-pointer border ${
          isDepleted
            ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300"
            : isLow
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300"
            : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300"
        }`}
      >
        <Zap className={`w-3.5 h-3.5 ${isDepleted ? "text-rose-500" : isLow ? "text-amber-500" : "text-neutral-500"}`} />
        <span>
          <strong className="font-semibold">{quota.creditsRemaining}</strong>/{quota.totalMonthlyCredits} Credits
        </span>

        {/* Miniature Progress Bar */}
        <div className="w-10 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isDepleted
                ? "bg-rose-500"
                : isLow
                ? "bg-amber-500"
                : "bg-neutral-900 dark:bg-neutral-100"
            }`}
            style={{ width: `${Math.max(4, 100 - quota.percentUsed)}%` }}
          />
        </div>
      </div>

      {showDetails && (
        <div className="absolute right-0 mt-2 w-72 p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 text-xs">
          <div className="flex items-center justify-between font-bold text-neutral-900 dark:text-neutral-100 mb-1">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
              Monthly AI Extraction Quota
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fetchQuota();
              }}
              className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 p-0.5 rounded transition"
              title="Refresh quota status"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <p className="text-neutral-500 text-[11px] leading-relaxed mb-2.5">
            Free tier includes 25 autonomous AI captures per month. Resets automatically on{" "}
            <strong className="text-neutral-700 dark:text-neutral-300">{resetDateText}</strong>.
          </p>

          <div className="p-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-semibold text-neutral-900 dark:text-neutral-100">
                Unlock Curio Pro
              </span>
              <span className="block text-[10px] text-neutral-400">Unlimited captures & AI</span>
            </div>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition cursor-pointer"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
