"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, ShoppingBag, Globe, Check, Loader2, DollarSign } from "lucide-react";
import type { UserAffiliateTags } from "@/lib/commerce/affiliate";
import { apiFetch } from "@/lib/apiClient";

export interface AffiliateSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedTags: UserAffiliateTags, customDomain?: string | null) => void;
}

export function AffiliateSettingsModal({
  isOpen,
  onClose,
  onSaved,
}: AffiliateSettingsModalProps) {
  const [amazon, setAmazon] = useState("");
  const [bookshop, setBookshop] = useState("");
  const [ltk, setLtk] = useState("");
  const [skimlinks, setSkimlinks] = useState("");
  const [customRef, setCustomRef] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSavedSuccess(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    apiFetch("/api/v1/user/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.user) {
          const tags = data.user.affiliateTags || {};
          setAmazon(tags.amazon || "");
          setBookshop(tags.bookshop || "");
          setLtk(tags.ltk || "");
          setSkimlinks(tags.skimlinks || "");
          setCustomRef(tags.customRef || "");
          setCustomDomain(data.user.customDomain || "");
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const payload = {
        customDomain: customDomain.trim() || null,
        affiliateTags: {
          amazon: amazon.trim() || undefined,
          bookshop: bookshop.trim() || undefined,
          ltk: ltk.trim() || undefined,
          skimlinks: skimlinks.trim() || undefined,
          customRef: customRef.trim() || undefined,
        },
      };

      const res = await apiFetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update affiliate settings");
      }

      setSavedSuccess(true);
      if (onSaved) {
        onSaved(payload.affiliateTags, payload.customDomain);
      }
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  Creator Monetization
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  100% Commission
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Route outbound merchant & split-bag checkouts to your affiliate accounts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-neutral-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs">Loading affiliate settings...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amazon Associates */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Amazon Associates Tag
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. curator-20"
                  value={amazon}
                  onChange={(e) => setAmazon(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 text-neutral-900 dark:text-neutral-100 text-xs font-mono placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Injected into all Amazon product, vinyl, and book links.
              </p>
            </div>

            {/* Bookshop.org */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Bookshop.org Affiliate ID (aid)
              </label>
              <input
                type="text"
                placeholder="e.g. my-bookshop-handle"
                value={bookshop}
                onChange={(e) => setBookshop(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 text-neutral-900 dark:text-neutral-100 text-xs font-mono placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Injected into independent bookstore links and book cards.
              </p>
            </div>

            {/* LTK & Skimlinks Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  LTK (rewardStyle) ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. style_curator"
                  value={ltk}
                  onChange={(e) => setLtk(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 text-neutral-900 dark:text-neutral-100 text-xs font-mono placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Skimlinks Publisher ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 12345X67890"
                  value={skimlinks}
                  onChange={(e) => setSkimlinks(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 text-neutral-900 dark:text-neutral-100 text-xs font-mono placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>

            {/* Universal Referral Tag */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Universal Referral Tag (ref)
              </label>
              <input
                type="text"
                placeholder="e.g. curator_handle"
                value={customRef}
                onChange={(e) => setCustomRef(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 text-neutral-900 dark:text-neutral-100 text-xs font-mono placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Default tracking parameter appended to boutique & marketplace destinations.
              </p>
            </div>

            {/* Custom Domain */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Custom Domain (Vitrine CNAME)
              </label>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  placeholder="curate.mydomain.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 text-neutral-900 dark:text-neutral-100 text-xs font-mono placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition active:scale-95 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Save Attribution Tags</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
