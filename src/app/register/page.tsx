import React, { Suspense } from "react";
import Link from "next/link";
import { Sparkles, ShieldCheck } from "lucide-react";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = {
  title: "Claim Sovereign Handle — Curio",
  description: "Join Curio to start your personal cultural taste graph and sovereign library.",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between selection:bg-amber-100 dark:selection:bg-neutral-800">
      {/* Brand Header */}
      <header className="w-full px-6 py-6 max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="w-8 h-8 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center font-serif font-black text-base shadow-xs group-hover:scale-105 transition">
            C
          </div>
          <div>
            <span className="font-serif font-bold text-lg tracking-tight block leading-none">
              Curio
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 block">
              Taste Graph
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition"
        >
          ← Back to Curio
        </Link>
      </header>

      {/* Auth Card Centered Stage */}
      <main className="w-full max-w-md mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Sovereign Creator</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Claim Your Sovereign Handle
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-sm mx-auto">
            Build your personal taste universe. Curate Criterion films, vinyl records, first editions, and estate wines.
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xl overflow-hidden">
          <Suspense fallback={<div className="p-8 text-center text-xs text-neutral-400 font-mono">Loading registration...</div>}>
            <AuthForm initialMode="register" />
          </Suspense>
        </div>

        {/* Step 0 Privacy Assurance Banner */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-mono text-neutral-500 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Step 0 Privacy • Encrypted client-side memos with zero ad tracking</span>
        </div>
      </main>

      {/* Footer Colophon */}
      <footer className="w-full py-6 text-center text-xs text-neutral-400 font-mono">
        Curio PRD v3.2 • Autonomous Memory & Taste Graph
      </footer>
    </div>
  );
}
