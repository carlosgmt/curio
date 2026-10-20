"use client";

import React from "react";
import Link from "next/link";
import { TasteGraphCanvas } from "@/components/graph/TasteGraphCanvas";
import { ArrowLeft, Sparkles, Network } from "lucide-react";

export default function TasteGraphPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 sm:p-8 flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 mb-4 border-b border-neutral-800/80">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trove</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-amber-500" />
              <h1 className="font-serif text-xl font-bold tracking-tight text-white">
                Sovereign Taste Graph
              </h1>
            </div>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">
              60fps Interactive Synaptic Topology & Vector Clusters
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono">
            <Sparkles className="w-3 h-3" />
            <span>Live Physics Active</span>
          </span>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <main className="flex-1">
        <TasteGraphCanvas />
      </main>
    </div>
  );
}
