"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CardLightboxModal } from "@/components/lightbox/CardLightboxModal";
import type { CardData } from "@/components/cards/PolymorphicCard";
import type { SaveDetails } from "@/lib/saves/service";

export interface CardDeepLinkClientProps {
  initialDetails: SaveDetails;
}

export function CardDeepLinkClient({ initialDetails }: CardDeepLinkClientProps) {
  const router = useRouter();
  const [card, setCard] = useState<CardData>({
    save: initialDetails.save,
    entity: initialDetails.entity,
    primarySource: initialDetails.sources[0] || null,
    connections: initialDetails.connections,
    creatorAffiliateTags: initialDetails.owner?.affiliateTags,
  });

  const handleClose = () => {
    router.push("/");
  };

  const handleUpdated = (updatedSave: any) => {
    setCard((prev) => ({
      ...prev,
      save: {
        ...prev.save,
        ...updatedSave,
      },
    }));
  };

  const handleDeleted = () => {
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] flex flex-col justify-center items-center p-4">
      {/* Fallback back link if modal is dismissed */}
      <div className="max-w-5xl w-full flex items-center justify-between py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Taste Stream</span>
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Autonomous Memory & Taste Graph</span>
        </div>
      </div>

      <CardLightboxModal
        card={card}
        creatorAffiliateTags={initialDetails.owner?.affiliateTags}
        isOpen={true}
        onClose={handleClose}
        onCardUpdated={handleUpdated}
        onCardDeleted={handleDeleted}
      />
    </main>
  );
}
