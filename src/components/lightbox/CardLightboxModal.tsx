"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Share2,
  Trash2,
  Save,
  Check,
  Code2,
  FolderPlus,
  Link2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Disc3,
  Film,
  BookOpen,
  Wine,
  Frame,
  UtensilsCrossed,
  MapPin,
  Lock,
} from "lucide-react";
import type { CardData } from "../cards/PolymorphicCard";
import { CinemaCulturalMode } from "./modes/CinemaCulturalMode";
import { BookCulturalMode } from "./modes/BookCulturalMode";
import { VinylCulturalMode } from "./modes/VinylCulturalMode";
import { RecipeCulturalMode } from "./modes/RecipeCulturalMode";
import { PlaceCulturalMode } from "./modes/PlaceCulturalMode";
import { WineLabelCard } from "../cards/silhouettes/WineLabelCard";
import { ArtFrameCard } from "../cards/silhouettes/ArtFrameCard";
import { PrivateMemoCard } from "../cards/silhouettes/PrivateMemoCard";
import { SynapsePill } from "../connections/SynapsePill";
import { CustomFieldsSection } from "../cards/CustomFieldsSection";
import { AddToListPopover } from "../lists/AddToListPopover";
import type { ConnectedItem } from "@/lib/connections/service";
import type { UserAffiliateTags } from "@/lib/commerce/affiliate";

export interface CardLightboxModalProps {
  card: CardData | null;
  isOpen: boolean;
  onClose: () => void;
  creatorAffiliateTags?: UserAffiliateTags | null;
  onCardUpdated?: (updatedSave: any) => void;
  onCardDeleted?: (saveId: string) => void;
}

type ArchetypeMode = "cinema" | "book" | "vinyl" | "wine" | "recipe" | "place" | "art" | "memo";

export function CardLightboxModal({
  card,
  isOpen,
  onClose,
  creatorAffiliateTags,
  onCardUpdated,
  onCardDeleted,
}: CardLightboxModalProps) {
  const [title, setTitle] = useState("");
  const [personalNotes, setPersonalNotes] = useState("");
  const [activeArchetype, setActiveArchetype] = useState<ArchetypeMode>("book");
  const [isJsonDrawerOpen, setIsJsonDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isAddToListOpen, setIsAddToListOpen] = useState(false);
  const [connections, setConnections] = useState<ConnectedItem[]>([]);

  // Detect initial archetype from card
  useEffect(() => {
    if (!card) return;

    setTitle(card.save.privateTitle || card.entity?.title || "");
    setPersonalNotes(card.save.personalNotes || "");

    if (card.save.isPrivateMemo || !card.entity) {
      setActiveArchetype("memo");
      return;
    }

    const typePath = (card.entity?.typePath || card.save.typePath || "").toLowerCase();
    const coreType = (card.entity?.coreType || "").toUpperCase();

    if (typePath.includes("film") || typePath.includes("movie") || coreType === "MEDIA") {
      setActiveArchetype("cinema");
    } else if (typePath.includes("vinyl") || typePath.includes("music")) {
      setActiveArchetype("vinyl");
    } else if (typePath.includes("wine") || typePath.includes("beverage")) {
      setActiveArchetype("wine");
    } else if (typePath.includes("recipe") || typePath.includes("culinary") || coreType === "CULINARY") {
      setActiveArchetype("recipe");
    } else if (typePath.includes("place") || typePath.includes("trail") || coreType === "PLACE") {
      setActiveArchetype("place");
    } else if (typePath.includes("art")) {
      setActiveArchetype("art");
    } else {
      setActiveArchetype("book");
    }

    // Load connections
    fetch(`/api/v1/connections?saveId=${card.save.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.connections) {
          setConnections(data.connections);
        }
      })
      .catch(() => {});
  }, [card]);

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !card) return null;

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const archetypeToTypePath: Record<ArchetypeMode, string> = {
        cinema: "/media/film",
        book: "/product/book",
        vinyl: "/media/music/vinyl",
        wine: "/product/beverage/wine",
        recipe: "/culinary/recipe",
        place: "/place/transit_trail",
        art: "/product/art",
        memo: "/memo/personal",
      };

      const res = await fetch(`/api/v1/saves/${card.save.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privateTitle: title.trim() || null,
          personalNotes: personalNotes.trim() || null,
          typePath: archetypeToTypePath[activeArchetype],
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        onCardUpdated?.(updated.save);
        onClose();
      }
    } catch (err) {
      console.error("Failed to save card changes:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this card from your library?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/saves/${card.save.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onCardDeleted?.(card.save.id);
        onClose();
      }
    } catch (err) {
      console.error("Failed to delete card:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyShareLink = () => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/card/${card.save.id}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyJson = () => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": card.entity?.coreType || "Thing",
      name: card.entity?.title || card.save.privateTitle,
      description: card.entity?.summary,
      image: card.entity?.heroImageUrl,
      url: card.entity?.canonicalUrl,
      coreStructuredData: card.entity?.coreStructuredData,
      extendedAttributes: card.entity?.extendedAttributes,
    };
    navigator.clipboard.writeText(JSON.stringify(jsonLd, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const archetypes: Array<{ id: ArchetypeMode; label: string; icon: React.ReactNode }> = [
    { id: "cinema", label: "Cinema", icon: <Film className="w-3.5 h-3.5" /> },
    { id: "book", label: "Book", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: "vinyl", label: "Vinyl", icon: <Disc3 className="w-3.5 h-3.5" /> },
    { id: "wine", label: "Wine", icon: <Wine className="w-3.5 h-3.5" /> },
    { id: "recipe", label: "Recipe", icon: <UtensilsCrossed className="w-3.5 h-3.5" /> },
    { id: "place", label: "Place", icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: "art", label: "Art", icon: <Frame className="w-3.5 h-3.5" /> },
    { id: "memo", label: "Memo", icon: <Lock className="w-3.5 h-3.5" /> },
  ];

  const renderLeftStage = () => {
    switch (activeArchetype) {
      case "cinema":
        return <CinemaCulturalMode save={card.save} entity={card.entity} primarySource={card.primarySource} creatorAffiliateTags={creatorAffiliateTags} />;
      case "book":
        return <BookCulturalMode save={card.save} entity={card.entity} primarySource={card.primarySource} creatorAffiliateTags={creatorAffiliateTags} />;
      case "vinyl":
        return <VinylCulturalMode save={card.save} entity={card.entity} primarySource={card.primarySource} creatorAffiliateTags={creatorAffiliateTags} />;
      case "recipe":
        return <RecipeCulturalMode save={card.save} entity={card.entity} primarySource={card.primarySource} />;
      case "place":
        return <PlaceCulturalMode save={card.save} entity={card.entity} primarySource={card.primarySource} />;
      case "wine":
        return (
          <WineLabelCard
            save={card.save}
            entity={card.entity as any}
            primarySource={card.primarySource}
          />
        );
      case "art":
        return (
          <ArtFrameCard
            save={card.save}
            entity={card.entity as any}
            primarySource={card.primarySource}
          />
        );
      case "memo":
      default:
        return <PrivateMemoCard save={card.save} />;
    }
  };

  return (
    <div data-lightbox-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[92vh] rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Lightbox Navigation Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-neutral-50/50 dark:bg-neutral-950/40">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-neutral-400 font-bold">
              Card Lightbox Inspector
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              title="Copy shareable link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "Copied" : "Share"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Two-Stage Split Stage View */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Stage: Cultural Mode Preview & Instant Archetype Switcher */}
          <div className="lg:col-span-6 flex flex-col p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-neutral-800 bg-[#f9f8f6] dark:bg-neutral-950/80 overflow-y-auto">
            {/* Archetype Switcher Bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-4 scrollbar-none shrink-0">
              {archetypes.map((arch) => (
                <button
                  key={arch.id}
                  data-archetype-btn={arch.id}
                  type="button"
                  onClick={() => setActiveArchetype(arch.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                    activeArchetype === arch.id
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
                      : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {arch.icon}
                  <span>{arch.label}</span>
                </button>
              ))}
            </div>

            {/* Cultural Mode Stage Display */}
            <div className="flex-1 flex flex-col justify-center">
              {renderLeftStage()}
            </div>
          </div>

          {/* Right Stage: Curator's Voice, Synapses, Board Memberships & Metadata */}
          <div className="lg:col-span-6 flex flex-col p-6 overflow-y-auto space-y-6">
            {/* Editable Title */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-1">
                Curator Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give this curation a personal title..."
                className="w-full text-xl sm:text-2xl font-serif font-bold text-neutral-900 dark:text-neutral-50 bg-transparent border-b border-neutral-200 dark:border-neutral-800 focus:border-neutral-400 focus:outline-none pb-1"
              />
            </div>

            {/* Editable Personal Notes */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-1">
                Personal Reflections & Tasting Notes
              </label>
              <textarea
                rows={4}
                value={personalNotes}
                onChange={(e) => setPersonalNotes(e.target.value)}
                placeholder="Where were you? What did it evoke? Unfiltered personal memory..."
                className="w-full text-xs font-serif leading-relaxed p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </div>

            {/* Curated Board Memberships */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                  Curated Board Memberships
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddToListOpen(true)}
                  className="text-[10px] font-mono font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 cursor-pointer"
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>Assign Boards</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddToListOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700 transition cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Manage Boards</span>
                </button>
              </div>
            </div>

            {/* Synaptic Pairs */}
            {connections.length > 0 && (
              <div>
                <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-2">
                  Synaptic Memory Pairs ({connections.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {connections.map((conn) => (
                    <SynapsePill
                      key={conn.connectionId}
                      connection={conn}
                      onClick={() => {
                        // Close lightbox and jump to connected save
                        onClose();
                        const el = document.getElementById(`save-${conn.saveId}`);
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                          el.classList.add("ring-2", "ring-neutral-400");
                          setTimeout(() => el.classList.remove("ring-2", "ring-neutral-400"), 2000);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Curio Learns: Custom Attributes Grid */}
            <div>
              <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-1">
                Custom Attributes & Specifications
              </span>
              <CustomFieldsSection
                saveId={card.save.id}
                userCustomValues={card.save.userCustomValues}
                extendedAttributes={card.entity?.extendedAttributes}
              />
            </div>

            {/* Collapsible Agent JSON-LD Drawer */}
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setIsJsonDrawerOpen(!isJsonDrawerOpen)}
                className="flex items-center justify-between w-full text-xs font-mono text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Agent JSON-LD / Schema.org</span>
                </div>
                {isJsonDrawerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {isJsonDrawerOpen && (
                <div className="mt-2.5 p-3 rounded-2xl bg-neutral-900 text-neutral-300 font-mono text-[10px] leading-relaxed relative animate-in fade-in">
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="absolute top-2 right-2 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-[9px] transition cursor-pointer"
                  >
                    {copiedJson ? "Copied" : "Copy JSON"}
                  </button>
                  <pre className="overflow-x-auto max-h-40">
                    {JSON.stringify(
                      {
                        "@context": "https://schema.org",
                        "@type": card.entity?.coreType || "Thing",
                        name: card.entity?.title || title,
                        description: card.entity?.summary,
                        image: card.entity?.heroImageUrl,
                        url: card.entity?.canonicalUrl,
                        coreStructuredData: card.entity?.coreStructuredData,
                        extendedAttributes: card.entity?.extendedAttributes,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between mt-auto">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 shadow-md transition cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Add To List Popover */}
        <AddToListPopover
          saveId={card.save.id}
          isOpen={isAddToListOpen}
          onClose={() => setIsAddToListOpen(false)}
        />
      </div>
    </div>
  );
}
