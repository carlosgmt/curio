"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, LogOut, Sparkles, ChevronDown, CheckCircle2, Shield, DollarSign, Layers, Upload } from "lucide-react";
import { AffiliateSettingsModal } from "@/components/commerce/AffiliateSettingsModal";
import { TypesSettingsModal } from "@/components/types/TypesSettingsModal";

export interface UserNavProps {
  user: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    isPro: boolean;
    aiCreditsRemaining?: number;
    onboardingCompleted?: boolean;
  } | null;
  onOpenAuth: (tab?: "login" | "register") => void;
  onOpenOnboarding: () => void;
  onOpenImporter?: () => void;
  onOpenAffiliateSettings?: () => void;
  onOpenTypesSettings?: () => void;
  onLogout: () => void;
}

export function UserNav({
  user,
  onOpenAuth,
  onOpenOnboarding,
  onOpenImporter,
  onOpenAffiliateSettings,
  onOpenTypesSettings,
  onLogout,
}: UserNavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [affiliateModalOpen, setAffiliateModalOpen] = useState(false);
  const [typesModalOpen, setTypesModalOpen] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          onClick={(e) => {
            if (onOpenAuth) {
              e.preventDefault();
              onOpenAuth("login");
            }
          }}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition active:scale-95 cursor-pointer"
        >
          Log In
        </Link>
        <Link
          href="/register"
          onClick={(e) => {
            if (onOpenAuth) {
              e.preventDefault();
              onOpenAuth("register");
            }
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition active:scale-95 shadow-2xs cursor-pointer"
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Sign Up</span>
        </Link>
      </div>
    );
  }

  const initials = (user.displayName || user.username || "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-2">
        {/* User Pill Trigger */}
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-2 p-1.5 pr-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 border border-neutral-200/60 dark:border-neutral-700/60 transition cursor-pointer"
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName || user.username}
              className="w-6 h-6 rounded-xl object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-[10px] font-bold flex items-center justify-center">
              {initials}
            </div>
          )}

          <div className="text-left hidden sm:block">
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 font-mono block leading-none">
              @{user.username}
            </span>
          </div>

          <ChevronDown className="w-3 h-3 text-neutral-400" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
            <div className="p-2 border-b border-neutral-100 dark:border-neutral-800 mb-1">
              <div className="font-bold text-neutral-900 dark:text-neutral-100">
                {user.displayName || `@${user.username}`}
              </div>
              <div className="text-neutral-400 font-mono text-[11px]">
                @{user.username}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    user.isPro
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  {user.isPro ? "PRO TIER" : "FREE TIER"}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {user.aiCreditsRemaining ?? 25} credits left
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                onOpenOnboarding();
              }}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-left cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Bring in Collections & Starters</span>
            </button>

            {onOpenImporter && (
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenImporter();
                }}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-left cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-blue-500" />
                <span>Import CSV & Data</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                if (onOpenTypesSettings) {
                  onOpenTypesSettings();
                } else {
                  setTypesModalOpen(true);
                }
              }}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-left cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>Types & Schemas</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                if (onOpenAffiliateSettings) {
                  onOpenAffiliateSettings();
                } else {
                  setAffiliateModalOpen(true);
                }
              }}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-left cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-500" />
              <span>Affiliate & Monetization</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition text-left cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </>
      )}

      {/* Embedded Creator Affiliate Modal if used standalone */}
      <AffiliateSettingsModal
        isOpen={affiliateModalOpen}
        onClose={() => setAffiliateModalOpen(false)}
      />

      {/* Embedded Types & Schemas Modal if used standalone */}
      <TypesSettingsModal
        isOpen={typesModalOpen}
        onClose={() => setTypesModalOpen(false)}
      />
    </div>
  );
}
