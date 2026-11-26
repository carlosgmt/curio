"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { ClipperBookmarkletBar } from "@/components/clip/ClipperModal";
import {
  decodeUniversalClipFragment,
  getClipDestinationTarget,
  type ClipClassification,
  type ClipDestination,
  type UniversalClipPayload,
} from "@/lib/clip/protocol";

const PENDING_CLIP_STORAGE_KEY = "curio_pending_clip";

interface ClipSaveResult {
  status: "created" | "existing";
  save: { id: string };
  entity: { title: string; brandOrCreator?: string | null; heroImageUrl?: string | null };
  routing: ClipClassification;
}

const DESTINATION_CHOICES: Array<{ id: ClipDestination; label: string }> = [
  { id: "closet", label: "Closet" },
  { id: "chef", label: "Chef" },
  { id: "my-stuff", label: "My Stuff" },
  { id: "curio", label: "Stay in Curio" },
];

export default function ClipRouterPage() {
  const [phase, setPhase] = useState<"loading" | "ready" | "setup" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clip, setClip] = useState<UniversalClipPayload | null>(null);
  const [rawToken, setRawToken] = useState<string>("");
  const [result, setResult] = useState<ClipSaveResult | null>(null);
  const [redirectCancelled, setRedirectCancelled] = useState(false);
  const redirectTimerRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const cancelAutoRedirect = () => {
    setRedirectCancelled(true);
    if (redirectTimerRef.current !== null) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  };

  const navigateToDestination = (dest: ClipDestination, saveId?: string | null, token?: string) => {
    cancelAutoRedirect();
    const target = getClipDestinationTarget(dest, saveId);
    if (dest === "curio") {
      window.location.replace(target.targetPath);
      return;
    }
    const suffix = token ? `#clip=${token}` : "";
    window.location.replace(`${target.targetPath}${suffix}`);
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const hashOrSearch = window.location.hash || window.location.search;
    let decoded = decodeUniversalClipFragment(hashOrSearch);

    if (!decoded) {
      try {
        const storedToken = window.sessionStorage.getItem(PENDING_CLIP_STORAGE_KEY);
        if (storedToken) {
          decoded = decodeUniversalClipFragment(`#clip=${storedToken}`);
        }
      } catch {
        // ignore storage restrictions
      }
    }

    if (!decoded) {
      setPhase("setup");
      return;
    }

    setClip(decoded.clip);
    setRawToken(decoded.rawToken);

    if (window.location.hash.includes("clip=")) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    (async () => {
      try {
        const res = await apiFetch("/api/v1/capture/clip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(decoded.clip),
        });

        if (res.status === 401) {
          try {
            window.sessionStorage.setItem(PENDING_CLIP_STORAGE_KEY, decoded.rawToken);
          } catch {
            // ignore
          }
          window.location.replace(`/curio/login?returnUrl=${encodeURIComponent("/curio/clip")}`);
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        try {
          window.sessionStorage.removeItem(PENDING_CLIP_STORAGE_KEY);
        } catch {
          // ignore
        }

        const savedResult = data as ClipSaveResult;
        setResult(savedResult);
        setPhase("ready");

        const dest = savedResult.routing.destination;
        const delayMs = dest === "curio" ? 950 : 650;
        redirectTimerRef.current = window.setTimeout(() => {
          navigateToDestination(dest, savedResult.save?.id, decoded.rawToken);
        }, delayMs);
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to save clip to Curio");
        setPhase("error");
      }
    })();

    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between px-4 py-8">
      <header className="w-full max-w-lg mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center font-serif font-black text-base">
            C
          </div>
          <span className="font-serif font-bold text-lg tracking-tight">Curio Clipper</span>
        </Link>
        <Link
          href="/"
          className="text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition"
        >
          ← Back to Curio
        </Link>
      </header>

      <main className="w-full max-w-lg mx-auto my-auto py-8">
        {phase === "loading" && (
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-7 shadow-xl text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-600 dark:text-neutral-300" />
            <h1 className="font-serif font-bold text-xl">Saving &amp; Routing…</h1>
            {clip && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {clip.brand ? `${clip.brand} · ` : ""}
                {clip.name || clip.url}
              </p>
            )}
          </div>
        )}

        {phase === "setup" && (
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>One Bookmarklet for All Apps</span>
            </div>
            <h1 className="font-serif font-bold text-2xl">Save to Curio</h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Use this bookmarklet on any page to save directly to Curio and automatically open garments in Closet, recipes in Chef, or gear in My Stuff.
            </p>
            <ClipperBookmarkletBar />
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-red-200 dark:border-red-900/60 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="w-5 h-5" />
              <h1 className="font-serif font-bold text-lg">Could Not Process Clip</h1>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{errorMsg}</p>
            {rawToken && (
              <div className="flex flex-wrap gap-2 pt-2">
                {DESTINATION_CHOICES.filter((c) => c.id !== "curio").map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => navigateToDestination(choice.id, null, rawToken)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                  >
                    Open directly in {choice.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {phase === "ready" && result && (
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl space-y-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {result.status === "existing" ? "Updated in Curio" : "Saved to Curio"}
                </div>
                <h1 className="font-serif font-bold text-xl leading-snug break-words">
                  {result.entity.title}
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {result.routing.reason} → <strong>{result.routing.label}</strong>
                </p>
              </div>
              {result.entity.heroImageUrl && (
                <img
                  src={result.entity.heroImageUrl}
                  alt={result.entity.title}
                  className="w-16 h-16 rounded-xl object-cover border border-neutral-200 dark:border-neutral-800 shrink-0"
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() =>
                  navigateToDestination(result.routing.destination, result.save?.id, rawToken)
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 transition cursor-pointer"
              >
                <span>
                  {result.routing.destination === "curio"
                    ? "Open Card in Curio"
                    : `Continue to ${result.routing.label}`}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {!redirectCancelled ? (
                <button
                  type="button"
                  onClick={cancelAutoRedirect}
                  className="text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 cursor-pointer"
                >
                  Pause redirect
                </button>
              ) : (
                <span className="text-xs font-mono text-neutral-400">Auto-redirect paused</span>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                Or route manually to:
              </div>
              <div className="flex flex-wrap gap-2">
                {DESTINATION_CHOICES.map((choice) => {
                  const active = result.routing.destination === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => navigateToDestination(choice.id, result.save?.id, rawToken)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        active
                          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950"
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="w-full max-w-lg mx-auto text-center text-[11px] font-mono text-neutral-400">
        Zero server scraping • Direct DOM capture
      </footer>
    </div>
  );
}
