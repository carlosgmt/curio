"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Share2,
  Trash2,
  Save,
  Check,
  Code2,
  FolderPlus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Disc3,
  Music,
  Film,
  BookOpen,
  Wine,
  Frame,
  UtensilsCrossed,
  MapPin,
  Lock,
  Watch,
  ShoppingBag,
  Shirt,
  Pencil,
  BookmarkCheck,
  Quote as QuoteIcon,
} from "lucide-react";
import type { CardData } from "../cards/PolymorphicCard";
import { CinemaCulturalMode } from "./modes/CinemaCulturalMode";
import { BookCulturalMode } from "./modes/BookCulturalMode";
import { VinylCulturalMode } from "./modes/VinylCulturalMode";
import { RecipeCulturalMode } from "./modes/RecipeCulturalMode";
import { apiFetch } from "@/lib/apiClient";
import { PlaceCulturalMode } from "./modes/PlaceCulturalMode";
import { WineSommelierMode } from "./modes/WineSommelierMode";
import { ArtFrameCard } from "../cards/silhouettes/ArtFrameCard";
import { PrivateMemoCard } from "../cards/silhouettes/PrivateMemoCard";
import { ProductCard } from "../cards/silhouettes/ProductCard";
import { QuoteCard } from "../cards/silhouettes/QuoteCard";
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

type ArchetypeOption = {
  id: string;
  label: string;
  typePath: string;
  icon: React.ReactNode;
};

const BUILTIN_ARCHETYPES: ArchetypeOption[] = [
  { id: "cinema", label: "Film", typePath: "/media/film", icon: <Film className="w-3.5 h-3.5" /> },
  { id: "book", label: "Book", typePath: "/product/book", icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: "album", label: "Album", typePath: "/media/music/album", icon: <Disc3 className="w-3.5 h-3.5" /> },
  { id: "song", label: "Song", typePath: "/media/music/song", icon: <Music className="w-3.5 h-3.5" /> },
  { id: "watch", label: "Watch", typePath: "/product/watch", icon: <Watch className="w-3.5 h-3.5" /> },
  { id: "product", label: "Product", typePath: "/product", icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  { id: "garment", label: "Garment", typePath: "/product/garment", icon: <Shirt className="w-3.5 h-3.5" /> },
  { id: "wine", label: "Wine", typePath: "/product/beverage/wine", icon: <Wine className="w-3.5 h-3.5" /> },
  { id: "recipe", label: "Recipe", typePath: "/culinary/recipe", icon: <UtensilsCrossed className="w-3.5 h-3.5" /> },
  { id: "place", label: "Place", typePath: "/place", icon: <MapPin className="w-3.5 h-3.5" /> },
  { id: "art", label: "Art", typePath: "/product/art", icon: <Frame className="w-3.5 h-3.5" /> },
  { id: "quote", label: "Quote", typePath: "/quote", icon: <QuoteIcon className="w-3.5 h-3.5" /> },
  { id: "memo", label: "Text Note", typePath: "/memo/personal", icon: <Lock className="w-3.5 h-3.5" /> },
];

function detectInitialArchetypeId(card: CardData): string {
  const typePath = (card.entity?.typePath || card.save.typePath || "").toLowerCase();
  const coreType = (card.entity?.coreType || "").toUpperCase();

  if (typePath.includes("quote") || typePath.startsWith("/quote") || typePath.startsWith("/culture/quote")) {
    return "quote";
  }

  if (card.save.isPrivateMemo || !card.entity) {
    return "memo";
  }

  if (typePath.includes("/media/music/song") || typePath.includes("track")) {
    return "song";
  }
  if (typePath.includes("vinyl") || typePath.includes("music") || typePath.includes("album") || coreType === "VINYL" || coreType === "MUSIC") {
    return "album";
  }
  if (typePath.includes("film") || typePath.includes("movie") || coreType === "MEDIA") {
    return "cinema";
  }
  if (typePath.includes("watch")) {
    return "watch";
  }
  if (typePath.includes("garment") || typePath.includes("apparel")) {
    return "garment";
  }
  if (typePath.includes("wine") || typePath.includes("beverage")) {
    return "wine";
  }
  if (typePath.includes("recipe") || typePath.includes("culinary") || coreType === "CULINARY") {
    return "recipe";
  }
  if (typePath.includes("place") || typePath.includes("trail") || coreType === "PLACE") {
    return "place";
  }
  if (typePath.includes("art")) {
    return "art";
  }
  if (typePath.includes("book")) {
    return "book";
  }
  if (typePath.startsWith("/product") || coreType === "PRODUCT") {
    return "product";
  }
  return "book";
}

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
  const [activeArchetype, setActiveArchetype] = useState<string>("book");
  const [isEditingType, setIsEditingType] = useState(false);
  const [customTypes, setCustomTypes] = useState<ArchetypeOption[]>([]);
  const [memberBoards, setMemberBoards] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [isJsonDrawerOpen, setIsJsonDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isAddToListOpen, setIsAddToListOpen] = useState(false);
  const [connections, setConnections] = useState<ConnectedItem[]>([]);

  const loadBoardMemberships = useCallback((targetCard: CardData) => {
    Promise.all([
      apiFetch(`/api/v1/saves/${targetCard.save.id}`).then((r) => (r.ok ? r.json() : null)),
      apiFetch("/api/v1/lists").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([saveData, listsData]) => {
        const boardMap = new Map<string, { id: string; title: string; slug: string }>();
        if (Array.isArray(saveData?.lists)) {
          for (const l of saveData.lists) {
            if (l?.id && l?.title) {
              boardMap.set(l.id, { id: l.id, title: l.title, slug: l.slug });
            }
          }
        }
        const effectiveTypePath = (targetCard.entity?.typePath || targetCard.save.typePath || "").toLowerCase();
        const effectiveCoreType = (targetCard.entity?.coreType || "").toUpperCase();
        if (Array.isArray(listsData?.lists)) {
          for (const l of listsData.lists) {
            const ruleType = l?.autoRules?.coreType;
            if (ruleType && typeof ruleType === "string") {
              const upperRule = ruleType.toUpperCase();
              const lowerRule = ruleType.toLowerCase();
              if (
                effectiveCoreType === upperRule ||
                (lowerRule.startsWith("/") && effectiveTypePath.startsWith(lowerRule)) ||
                effectiveTypePath.includes(lowerRule)
              ) {
                boardMap.set(l.id, { id: l.id, title: l.title, slug: l.slug });
              }
            }
          }
        }
        setMemberBoards(Array.from(boardMap.values()));
      })
      .catch(() => {});
  }, []);

  // Load custom types from ontology
  useEffect(() => {
    if (!isOpen) return;
    apiFetch("/api/v1/types")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.types)) {
          const builtinPaths = new Set(BUILTIN_ARCHETYPES.map((a) => a.typePath.toLowerCase()));
          const extras: ArchetypeOption[] = data.types
            .filter((t: any) => (t.isCustom || t.userId) && t.typePath && !builtinPaths.has(String(t.typePath).toLowerCase()))
            .map((t: any) => ({
              id: `custom:${t.typePath}`,
              label: t.name,
              typePath: t.typePath,
              icon: <Sparkles className="w-3.5 h-3.5" />,
            }));
          setCustomTypes(extras);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Detect initial archetype from card
  useEffect(() => {
    if (!card) return;

    setTitle(card.save.privateTitle || card.entity?.title || "");
    setPersonalNotes(card.save.personalNotes || "");
    setIsEditingType(false);
    setActiveArchetype(detectInitialArchetypeId(card));
    loadBoardMemberships(card);

    // Load connections
    apiFetch(`/api/v1/connections?saveId=${card.save.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.connections) {
          setConnections(data.connections);
        }
      })
      .catch(() => {});
  }, [card, loadBoardMemberships]);

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

  const allArchetypes: ArchetypeOption[] = [...BUILTIN_ARCHETYPES, ...customTypes];
  const currentArchetypeOption =
    allArchetypes.find((a) => a.id === activeArchetype) ||
    allArchetypes.find((a) => a.typePath === (card.entity?.typePath || card.save.typePath)) ||
    BUILTIN_ARCHETYPES[1];

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const selectedTypePath = currentArchetypeOption?.typePath || "/product/book";

      const res = await apiFetch(`/api/v1/saves/${card.save.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privateTitle: title.trim() || null,
          personalNotes: personalNotes.trim() || null,
          typePath: selectedTypePath,
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
      const res = await apiFetch(`/api/v1/saves/${card.save.id}`, {
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

  const previewEntity = card.entity
    ? {
        ...card.entity,
        typePath: currentArchetypeOption.typePath,
      }
    : null;

  const renderLeftStage = () => {
    switch (activeArchetype) {
      case "cinema":
        return <CinemaCulturalMode save={card.save} entity={previewEntity} primarySource={card.primarySource} creatorAffiliateTags={creatorAffiliateTags} />;
      case "book":
        return <BookCulturalMode save={card.save} entity={previewEntity} primarySource={card.primarySource} creatorAffiliateTags={creatorAffiliateTags} />;
      case "album":
      case "song":
      case "vinyl":
        return <VinylCulturalMode save={card.save} entity={previewEntity} primarySource={card.primarySource} creatorAffiliateTags={creatorAffiliateTags} />;
      case "watch":
      case "product":
      case "garment":
        return previewEntity ? (
          <ProductCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
          />
        ) : (
          <PrivateMemoCard save={card.save} />
        );
      case "recipe":
        return <RecipeCulturalMode save={card.save} entity={previewEntity} primarySource={card.primarySource} />;
      case "place":
        return <PlaceCulturalMode save={card.save} entity={previewEntity} primarySource={card.primarySource} />;
      case "wine":
        return (
          <WineSommelierMode
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
          />
        );
      case "art":
        return (
          <ArtFrameCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
          />
        );
      case "quote":
        return (
          <QuoteCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
          />
        );
      case "memo":
        return <PrivateMemoCard save={card.save} />;
      default:
        if (currentArchetypeOption.typePath.startsWith("/product") && previewEntity) {
          return (
            <ProductCard
              save={card.save}
              entity={previewEntity as any}
              primarySource={card.primarySource}
              creatorAffiliateTags={creatorAffiliateTags}
            />
          );
        }
        return <BookCulturalMode save={card.save} entity={previewEntity} primarySource={card.primarySource} creatorAffiliateTags={creatorAffiliateTags} />;
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
          {/* Left Stage: Cultural Mode Preview & Collapsible Type Switcher */}
          <div className="lg:col-span-6 flex flex-col p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-neutral-800 bg-[#f9f8f6] dark:bg-neutral-950/80 overflow-y-auto">
            {/* Prominent Active Type Badge + Edit Type Toggle */}
            <div className="mb-4 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs">
                  {currentArchetypeOption.icon}
                  <span>{currentArchetypeOption.label}</span>
                </div>

                <button
                  type="button"
                  data-testid="edit-type-toggle"
                  onClick={() => setIsEditingType((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 transition cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>{isEditingType ? "Done" : "Edit Type"}</span>
                </button>
              </div>

              {isEditingType && (
                <div className="mt-2.5 p-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-1.5 animate-in fade-in duration-150">
                  {allArchetypes.map((arch) => (
                    <button
                      key={arch.id}
                      data-archetype-btn={arch.id}
                      type="button"
                      onClick={() => {
                        setActiveArchetype(arch.id);
                        setIsEditingType(false);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                        activeArchetype === arch.id
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
                          : "bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900"
                      }`}
                    >
                      {arch.icon}
                      <span>{arch.label}</span>
                    </button>
                  ))}
                </div>
              )}
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
              <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-2">
                Curated Board Memberships
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                {memberBoards.map((board) => (
                  <span
                    key={board.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-2xs"
                  >
                    <BookmarkCheck className="w-3 h-3" />
                    <span>{board.title}</span>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setIsAddToListOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700 transition cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-neutral-500" />
                  <span>+ Manage Boards</span>
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
          onListUpdated={() => loadBoardMemberships(card)}
        />
      </div>
    </div>
  );
}
