"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";
import { CardLightboxModal } from "@/components/lightbox/CardLightboxModal";
import { PairingModal } from "@/components/connections/PairingModal";
import { apiFetch } from "@/lib/apiClient";
import type { CardData } from "@/components/cards/PolymorphicCard";
import type { SaveDetails } from "@/lib/saves/service";

export interface CardDeepLinkClientProps {
  saveId: string;
  initialDetails: SaveDetails | null;
  initialIsOwner?: boolean;
}

export function CardDeepLinkClient({
  saveId,
  initialDetails,
  initialIsOwner = false,
}: CardDeepLinkClientProps) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(initialIsOwner);
  const [card, setCard] = useState<CardData | null>(() =>
    initialDetails
      ? {
          save: initialDetails.save,
          entity: initialDetails.entity,
          primarySource: initialDetails.sources[0] || null,
          connections: initialDetails.connections,
          creatorAffiliateTags: initialDetails.owner?.affiliateTags,
        }
      : null
  );
  const [checkingBearerOwner, setCheckingBearerOwner] = useState(false);
  const [isPairingOpen, setIsPairingOpen] = useState(false);

  // Heal missing session cookie and upgrade to owner view if localStorage holds a valid Bearer token
  useEffect(() => {
    if (isOwner || typeof window === "undefined") return;
    const token = window.localStorage?.getItem("curio_token");
    if (!token) return;

    let cancelled = false;
    if (!card) {
      setCheckingBearerOwner(true);
    }

    (async () => {
      try {
        const [, saveRes] = await Promise.all([
          apiFetch("/api/v1/auth/me").catch(() => null),
          apiFetch(`/api/v1/saves/${encodeURIComponent(saveId)}`),
        ]);
        if (cancelled) return;
        if (saveRes.ok) {
          const data = await saveRes.json();
          if (data?.save) {
            setCard({
              save: data.save,
              entity: data.entity,
              primarySource: data.sources?.[0] || null,
              connections: data.connections ?? [],
              creatorAffiliateTags: data.owner?.affiliateTags,
            });
            setIsOwner(true);
          }
        }
      } catch {
        // Non-fatal
      } finally {
        if (!cancelled) {
          setCheckingBearerOwner(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOwner, saveId]);

  const handleClose = () => {
    router.push("/");
  };

  const handleUpdated = (updatedSave: any) => {
    setCard((prev) =>
      prev
        ? {
            ...prev,
            save: {
              ...prev.save,
              ...updatedSave,
            },
          }
        : prev
    );
  };

  const handleDeleted = () => {
    router.push("/");
  };

  const refreshConnections = async () => {
    if (!card) return;
    try {
      const res = await apiFetch(`/api/v1/connections?saveId=${encodeURIComponent(card.save.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.connections)) {
          setCard((prev) => (prev ? { ...prev, connections: data.connections } : prev));
        }
      }
    } catch {
      // Non-fatal
    }
  };

  if (!card) {
    if (checkingBearerOwner) {
      return (
        <main className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] flex flex-col items-center justify-center p-6 text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-neutral-400">
            Verifying Vault Access...
          </p>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
          <Lock className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold font-serif text-neutral-900 dark:text-neutral-100 mb-2">
          Private Curio Save
        </h1>
        <p className="text-sm text-neutral-500 max-w-sm mb-6">
          This save is private to its curator and cannot be viewed publicly.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Return to Taste Stream</span>
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] flex flex-col justify-center items-center p-4">
      {/* Fallback back link if modal is dismissed */}
      <div className="max-w-5xl w-full flex items-center justify-between py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Return to Taste Stream</span>
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          <span>Autonomous Memory & Taste Graph</span>
        </div>
      </div>

      <CardLightboxModal
        card={card}
        creatorAffiliateTags={card.creatorAffiliateTags || initialDetails?.owner?.affiliateTags}
        isOpen={true}
        readOnly={!isOwner}
        suppressEscape={isPairingOpen}
        onClose={handleClose}
        onConnect={
          isOwner && !card.save.isPrivateMemo
            ? () => setIsPairingOpen(true)
            : undefined
        }
        onUnlink={
          isOwner
            ? (connectionId) =>
                setCard((prev) =>
                  prev
                    ? {
                        ...prev,
                        connections: (prev.connections || []).filter(
                          (c) => c.connectionId !== connectionId
                        ),
                      }
                    : prev
                )
            : undefined
        }
        onCardUpdated={isOwner ? handleUpdated : undefined}
        onCardDeleted={isOwner ? handleDeleted : undefined}
      />

      {isOwner && (
        <PairingModal
          sourceCard={card}
          availableCards={[]}
          isOpen={isPairingOpen}
          onClose={() => setIsPairingOpen(false)}
          onPaired={refreshConnections}
        />
      )}
    </main>
  );
}
