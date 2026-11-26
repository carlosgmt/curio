"use client";

import React, { useState, useEffect, useCallback, useRef, useId } from "react";
import dynamic from "next/dynamic";
import {
  CURATED_CLOTH_PALETTES,
  type PressPalette,
  formatSpineMeta,
  getArchetypeSpec,
  getDeterministicClothPalette,
  resolveSameOriginImageUrl,
} from "@/lib/press/archetypes";
import { extractPaletteFromImageUrl } from "@/lib/press/palette";

const Hero3DInspector = dynamic(() => import("./Hero3DInspector"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[300px] sm:min-h-[420px] items-center justify-center font-mono text-xs uppercase tracking-widest opacity-65">
      Loading 3D Stage...
    </div>
  ),
});
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
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Disc3,
  Music,
  Film,
  BookOpen,
  Box,
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
  ListTodo,
  Plane,
  User,
  Camera,
  Globe,
  Gamepad2,
  Layers,
  Cpu,
  Link2,
} from "lucide-react";
import { Heart } from "lucide-react";
import { wishLabel } from "@/lib/wishlist";
import type { CardData } from "../cards/PolymorphicCard";
import { CinemaCulturalMode } from "./modes/CinemaCulturalMode";
import { BookCulturalMode } from "./modes/BookCulturalMode";
import { VinylCulturalMode } from "./modes/VinylCulturalMode";
import { RecipeCulturalMode } from "./modes/RecipeCulturalMode";
import { apiFetch, getApiUrl } from "@/lib/apiClient";
import { PlaceCulturalMode } from "./modes/PlaceCulturalMode";
import { WineSommelierMode } from "./modes/WineSommelierMode";
import { ArtFrameCard } from "../cards/silhouettes/ArtFrameCard";
import { PrivateMemoCard } from "../cards/silhouettes/PrivateMemoCard";
import { ProductCard } from "../cards/silhouettes/ProductCard";
import { GarmentCard } from "../cards/silhouettes/GarmentCard";
import { OutfitCard } from "../cards/silhouettes/OutfitCard";
import { VideoGameCard } from "../cards/silhouettes/VideoGameCard";
import { CosmeticsCard } from "../cards/silhouettes/CosmeticsCard";
import { ElectronicsCard } from "../cards/silhouettes/ElectronicsCard";
import { QuoteCard } from "../cards/silhouettes/QuoteCard";
import { ChecklistCard } from "../cards/silhouettes/ChecklistCard";
import { TravelPassCard } from "../cards/silhouettes/TravelPassCard";
import { CreatorProfileCard } from "../cards/silhouettes/CreatorProfileCard";
import { PhotoCard } from "../cards/silhouettes/PhotoCard";
import { WebLinkCard } from "../cards/silhouettes/WebLinkCard";
import { PlaceSpotCard } from "../cards/silhouettes/PlaceSpotCard";
import { SynapsePill } from "../connections/SynapsePill";
import { CustomFieldsSection, hasVisibleCustomFields } from "../cards/CustomFieldsSection";
import { DisambiguationBar } from "../cards/DisambiguationBar";
import { AddToListPopover } from "../lists/AddToListPopover";
import type { ConnectedItem } from "@/lib/connections/service";
import { partitionConnections } from "@/lib/connections/classify";
import type { UserAffiliateTags } from "@/lib/commerce/affiliate";

export interface CardLightboxModalProps {
  card: CardData | null;
  isOpen: boolean;
  initialPresentation?: "standard" | "press";
  onClose: () => void;
  creatorAffiliateTags?: UserAffiliateTags | null;
  readOnly?: boolean;
  suppressEscape?: boolean;
  onConnect?: (card: CardData) => void;
  onUnlink?: (connectionId: string) => void;
  onCardUpdated?: (updatedSave: any, updatedEntity?: any) => void;
  onCardDeleted?: (saveId: string) => void;
  onListUpdated?: () => void;
  onNavigateToBoard?: (slug: string) => void;
}

const PURCHASE_HUB_CATEGORIES = [
  "Furniture",
  "Electronics",
  "Home & Kitchen",
  "Appliances",
  "Tools & DIY",
  "Sports & Outdoors",
  "Office & Tech",
  "Books & Media",
  "Other",
] as const;

function guessPurchaseHubCategory(card: CardData | null): string {
  if (!card) return "Other";
  const ext = card.entity?.extendedAttributes as Record<string, unknown> | null | undefined;
  const existingCat = typeof ext?.category === "string" ? ext.category : "";
  if (existingCat && (PURCHASE_HUB_CATEGORIES as readonly string[]).includes(existingCat)) {
    return existingCat;
  }
  const tp = (card.entity?.typePath || card.save.typePath || "").toLowerCase();
  const titleText = (card.save.privateTitle || card.entity?.title || "").toLowerCase();
  const tagsText = (card.save.autoTags || []).join(" ").toLowerCase();
  const combined = `${tp} ${titleText} ${tagsText}`;
  if (/furniture|chair|sofa|table|desk|lamp|shelf|cabinet|bed|rug|stool|bench|mirror/.test(combined)) {
    return "Furniture";
  }
  if (/book|film|movie|vinyl|album|music|videogame|game/.test(combined)) {
    return "Books & Media";
  }
  if (/electronic|camera|headphone|speaker|monitor|phone|laptop|tablet|keyboard|mouse/.test(combined)) {
    return "Electronics";
  }
  if (/kitchen|coffee|espresso|pan|pot|mug|plate|glass/.test(combined)) {
    return "Home & Kitchen";
  }
  if (/appliance|vacuum|washer|dryer|fridge|oven|blender/.test(combined)) {
    return "Appliances";
  }
  if (/tool|drill|saw|wrench|hammer/.test(combined)) {
    return "Tools & DIY";
  }
  if (/bike|camp|tent|hike|ski|sport|fitness/.test(combined)) {
    return "Sports & Outdoors";
  }
  if (/office|notebook|pen|dock/.test(combined)) {
    return "Office & Tech";
  }
  return "Other";
}

function isSafeHttpOrRelativeUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  return trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("/");
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
  { id: "videogame", label: "Video Game", typePath: "/media/videogame", icon: <Gamepad2 className="w-3.5 h-3.5" /> },
  { id: "watch", label: "Watch", typePath: "/product/watch", icon: <Watch className="w-3.5 h-3.5" /> },
  { id: "product", label: "Product", typePath: "/product", icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  { id: "garment", label: "Garment", typePath: "/product/garment", icon: <Shirt className="w-3.5 h-3.5" /> },
  { id: "outfit", label: "Outfit", typePath: "/style/outfit", icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "cosmetics", label: "Cosmetics", typePath: "/product/cosmetics", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: "electronics", label: "Electronics", typePath: "/product/electronics", icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: "wine", label: "Wine", typePath: "/product/beverage/wine", icon: <Wine className="w-3.5 h-3.5" /> },
  { id: "recipe", label: "Recipe", typePath: "/culinary/recipe", icon: <UtensilsCrossed className="w-3.5 h-3.5" /> },
  { id: "place", label: "Place", typePath: "/place", icon: <MapPin className="w-3.5 h-3.5" /> },
  { id: "art", label: "Art", typePath: "/product/art", icon: <Frame className="w-3.5 h-3.5" /> },
  { id: "quote", label: "Quote", typePath: "/quote", icon: <QuoteIcon className="w-3.5 h-3.5" /> },
  { id: "checklist", label: "Checklist", typePath: "/memo/list", icon: <ListTodo className="w-3.5 h-3.5" /> },
  { id: "travel", label: "Travel Pass", typePath: "/travel/transit", icon: <Plane className="w-3.5 h-3.5" /> },
  { id: "creator", label: "Creator Profile", typePath: "/person", icon: <User className="w-3.5 h-3.5" /> },
  { id: "photo", label: "Photo", typePath: "/media/image", icon: <Camera className="w-3.5 h-3.5" /> },
  { id: "link", label: "Web Link", typePath: "/link", icon: <Globe className="w-3.5 h-3.5" /> },
  { id: "memo", label: "Text Note", typePath: "/memo/personal", icon: <Lock className="w-3.5 h-3.5" /> },
];

function detectInitialArchetypeId(card: CardData): string {
  const typePath = (card.entity?.typePath || card.save.typePath || "").toLowerCase();
  const coreType = (card.entity?.coreType || "").toUpperCase();
  const tags = (card.save.autoTags || []).map((t) => t.toLowerCase());

  if (typePath === "/memo/list" || typePath === "/memo/checklist" || tags.includes("checklist")) {
    return "checklist";
  }

  if (typePath.startsWith("/travel") || typePath.includes("transit") || coreType === "TRAVEL") {
    return "travel";
  }

  if (typePath.startsWith("/person") || coreType === "CREATOR") {
    return "creator";
  }

  if (typePath === "/media/image" || typePath.includes("photo") || typePath.includes("image")) {
    return "photo";
  }

  if (typePath === "/link" || typePath.startsWith("/link") || typePath.includes("article/web") || coreType === "LINK") {
    return "link";
  }

  if (typePath.includes("quote") || typePath.startsWith("/quote") || typePath.startsWith("/culture/quote")) {
    return "quote";
  }

  if (card.save.isPrivateMemo || !card.entity) {
    return "memo";
  }

  if (typePath.startsWith("/style/outfit") || typePath.includes("outfit") || tags.includes("outfit")) {
    return "outfit";
  }
  if (typePath.includes("/media/music/song") || typePath.includes("track")) {
    return "song";
  }
  if (typePath.includes("vinyl") || typePath.includes("music") || typePath.includes("album") || coreType === "VINYL" || coreType === "MUSIC") {
    return "album";
  }
  if (typePath.includes("videogame") || typePath.includes("game") || coreType === "VIDEOGAME") {
    return "videogame";
  }
  if (typePath.includes("film") || typePath.includes("movie") || coreType === "MEDIA") {
    return "cinema";
  }
  if (typePath.includes("watch")) {
    return "watch";
  }
  if (typePath.includes("garment") || typePath.includes("apparel") || typePath.includes("clothing") || tags.includes("garment")) {
    return "garment";
  }
  if (typePath.includes("cosmetics") || typePath.includes("skincare") || typePath.includes("beauty")) {
    return "cosmetics";
  }
  if (typePath.includes("electronics") || typePath.includes("hardware") || typePath.includes("gadget")) {
    return "electronics";
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

const QUOTE_HIDDEN_KEYS = ["text", "quote_text", "quotetext", "author", "speaker", "date", "year", "era", "work", "source", "publication"];

export function CardLightboxModal({
  card,
  isOpen,
  initialPresentation = "standard",
  onClose,
  creatorAffiliateTags,
  readOnly = false,
  suppressEscape = false,
  onConnect,
  onUnlink,
  onCardUpdated,
  onCardDeleted,
  onListUpdated,
  onNavigateToBoard,
}: CardLightboxModalProps) {
  const [title, setTitle] = useState("");
  const [brandOrCreator, setBrandOrCreator] = useState("");
  const [summary, setSummary] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [personalNotes, setPersonalNotes] = useState("");
  const [activeArchetype, setActiveArchetype] = useState<string>("book");
  const [presentation, setPresentation] = useState<"standard" | "press">(initialPresentation);
  const [pressPalette, setPressPalette] = useState<PressPalette>(CURATED_CLOTH_PALETTES[0]);
  const [hasChangedArchetype, setHasChangedArchetype] = useState(false);
  const [isEditingType, setIsEditingType] = useState(false);
  const [customTypes, setCustomTypes] = useState<ArchetypeOption[]>([]);
  const [memberBoards, setMemberBoards] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [isJsonDrawerOpen, setIsJsonDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isAddToListOpen, setIsAddToListOpen] = useState(false);
  const [wished, setWished] = useState(false);
  useEffect(() => {
    setWished(Boolean(card?.save.wishlist));
  }, [card?.save.id, card?.save.wishlist]);
  const [connections, setConnections] = useState<ConnectedItem[]>([]);
  const [isWearHistoryOpen, setIsWearHistoryOpen] = useState(false);
  const [showAllWearLinks, setShowAllWearLinks] = useState(false);
  const [showAllAutoCoWear, setShowAllAutoCoWear] = useState(false);
  const [igCarouselIdx, setIgCarouselIdx] = useState(0);
  const { wearLinks, autoCoWearPairs, curatedPairs } = React.useMemo(
    () => partitionConnections(connections),
    [connections]
  );
  const [isMarkBoughtOpen, setIsMarkBoughtOpen] = useState(false);
  const [boughtPrice, setBoughtPrice] = useState("");
  const [boughtCurrency, setBoughtCurrency] = useState("CHF");
  const [boughtDate, setBoughtDate] = useState("");
  const [boughtRetailer, setBoughtRetailer] = useState("");
  const [boughtCategory, setBoughtCategory] = useState("Other");
  const [boughtOwnerScope, setBoughtOwnerScope] = useState<"home" | "personal">("home");
  const [boughtLocation, setBoughtLocation] = useState("");
  const [boughtLogToPurchaseHub, setBoughtLogToPurchaseHub] = useState(true);
  const [isMarkingBought, setIsMarkingBought] = useState(false);
  const [markBoughtError, setMarkBoughtError] = useState<string | null>(null);
  const [markBoughtResult, setMarkBoughtResult] = useState<{
    targetBoardSlug: string;
    purchaseHubSynced: boolean;
    purchaseHubError?: string;
  } | null>(null);

  const loadBoardMemberships = useCallback(
    (targetCard: CardData) => {
      if (readOnly) {
        setMemberBoards([]);
        return;
      }
      apiFetch(`/api/v1/lists/memberships?saveId=${encodeURIComponent(targetCard.save.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (Array.isArray(data?.boards)) {
            const matched = data.boards
              .filter((b: any) => b.isMember || b.isAutoMatched)
              .map((b: any) => ({ id: b.id, title: b.title, slug: b.slug }));
            setMemberBoards(matched);
          }
        })
        .catch(() => {});
    },
    [readOnly]
  );

  // Load custom types from ontology (owner-only)
  useEffect(() => {
    if (!isOpen || readOnly) return;
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
  }, [isOpen, readOnly]);

  const headingId = useId();
  const initializedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPresentation(initialPresentation);
    }
  }, [isOpen, initialPresentation, card?.save.id]);

  // Dynamic cover palette extraction when in Press Stage
  useEffect(() => {
    if (!isOpen || !card || presentation !== "press") return;
    let cancelled = false;
    const fallback = getDeterministicClothPalette(card, activeArchetype);
    setPressPalette(fallback);
    const imgUrl = resolveSameOriginImageUrl(heroImageUrl || card.entity?.heroImageUrl);
    if (!imgUrl) return;
    void extractPaletteFromImageUrl(imgUrl, fallback).then((pal) => {
      if (!cancelled) setPressPalette(pal);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, card, presentation, activeArchetype, heroImageUrl]);

  // Sync connections when parent refreshes card.connections (e.g. after PairingModal completes)
  useEffect(() => {
    if (!isOpen || !card) return;
    if (card.connections !== undefined) {
      setConnections(card.connections);
    }
  }, [isOpen, card?.save.id, card?.connections]);

  // Detect initial archetype from card (only when opening, switching saveId, or upgrading readOnly -> owner)
  useEffect(() => {
    if (!isOpen || !card) {
      initializedKeyRef.current = null;
      setIsMarkBoughtOpen(false);
      setMarkBoughtError(null);
      setMarkBoughtResult(null);
      return;
    }
    const initKey = `${card.save.id}:${readOnly ? "ro" : "rw"}`;
    if (initializedKeyRef.current === initKey) {
      return;
    }
    initializedKeyRef.current = initKey;

    setTitle(card.save.privateTitle || card.entity?.title || "");
    setBrandOrCreator(card.entity?.brandOrCreator || "");
    setSummary(card.entity?.summary || "");
    setHeroImageUrl(card.entity?.heroImageUrl || "");
    setIsEditingDetails(false);
    setPersonalNotes(card.save.personalNotes || "");
    setIsEditingType(false);
    setHasChangedArchetype(false);
    setActiveArchetype(detectInitialArchetypeId(card));
    setPresentation(initialPresentation);
    setIsMarkBoughtOpen(false);
    setMarkBoughtError(null);
    setMarkBoughtResult(null);
    setIsWearHistoryOpen(false);
    setShowAllWearLinks(false);
    setShowAllAutoCoWear(false);
    setIgCarouselIdx(0);
    const ext = card.entity?.extendedAttributes as Record<string, unknown> | null | undefined;
    const primarySource = card.primarySource as Record<string, unknown> | null | undefined;
    setBoughtPrice(
      typeof card.entity?.priceCents === "number" && card.entity.priceCents > 0
        ? (card.entity.priceCents / 100).toFixed(2)
        : ""
    );
    setBoughtCurrency((card.entity?.currency || "CHF").toUpperCase());
    setBoughtDate(new Date().toISOString().slice(0, 10));
    setBoughtRetailer(
      typeof primarySource?.merchantName === "string" ? primarySource.merchantName : ""
    );
    setBoughtCategory(guessPurchaseHubCategory(card));
    setBoughtOwnerScope(ext?.ownerScope === "personal" ? "personal" : "home");
    setBoughtLocation(typeof ext?.location === "string" ? ext.location : "");
    setBoughtLogToPurchaseHub(true);
    loadBoardMemberships(card);

    // Load connections if not already hydrated on card
    if (card.connections !== undefined) {
      setConnections(card.connections);
    } else if (card.save.isPrivateMemo || readOnly) {
      setConnections([]);
    } else {
      apiFetch(`/api/v1/connections?saveId=${card.save.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.connections) {
            setConnections(data.connections);
          }
        })
        .catch(() => {});
    }
  }, [card, isOpen, readOnly, loadBoardMemberships]);

  const handleUnlinkConnection = async (connectionId: string) => {
    try {
      const res = await apiFetch(`/api/v1/connections?connectionId=${connectionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConnections((prev) => prev.filter((c) => c.connectionId !== connectionId));
        onUnlink?.(connectionId);
      }
    } catch (err) {
      console.error("Failed to delete connection:", err);
    }
  };

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !suppressEscape && !isAddToListOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, suppressEscape, isAddToListOpen]);

  if (!isOpen || !card) return null;

  const cardExt = card.entity?.extendedAttributes as Record<string, unknown> | null | undefined;
  const cardStructured = card.entity?.coreStructuredData as Record<string, unknown> | null | undefined;
  const isSyncedClosetOrPurchaseHub = Boolean(
    cardExt?.purchaseHubProductId || cardStructured?.closetId
  );

  const customFieldHiddenKeys: string[] = [];
  if (cardExt?.purchaseHubProductId) {
    customFieldHiddenKeys.push(
      "retailers",
      "firstbought",
      "lastbought",
      "warrantyuntil",
      "location",
      "modelnumber",
      "collections"
    );
  }
  if (activeArchetype === "garment" || activeArchetype === "outfit") {
    customFieldHiddenKeys.push(
      "timesworn",
      "lastworn",
      "inlaundry",
      "isfavorite",
      "isretired",
      "iswaterproof",
      "purchasedate",
      "datesworn",
      "weathercondition",
      "temperature",
      "subtype",
      "size",
      "season"
    );
  }
  if (activeArchetype === "quote") {
    customFieldHiddenKeys.push(...QUOTE_HIDDEN_KEYS);
  }
  if (activeArchetype === "book") {
    customFieldHiddenKeys.push(
      "author",
      "publisher",
      "isbn",
      "pagecount",
      "pages",
      "numberofpagesmedian",
      "releaseyear",
      "firstpublishyear",
      "rating"
    );
  }
  if (activeArchetype === "cinema") {
    customFieldHiddenKeys.push(
      "director",
      "distributor",
      "runtimeminutes",
      "cinematographer",
      "releaseyear",
      "year",
      "rating",
      "tmdbrating"
    );
  }
  if (activeArchetype === "recipe") {
    customFieldHiddenKeys.push("time", "complexity", "yieldservings");
  }
  const hasVisibleAttributes = hasVisibleCustomFields(
    card.save.userCustomValues,
    card.entity?.extendedAttributes,
    customFieldHiddenKeys
  );

  const allArchetypes: ArchetypeOption[] = [...BUILTIN_ARCHETYPES, ...customTypes];
  const currentArchetypeOption =
    allArchetypes.find((a) => a.id === activeArchetype) ||
    allArchetypes.find((a) => a.typePath === (card.entity?.typePath || card.save.typePath)) ||
    BUILTIN_ARCHETYPES[1];

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        privateTitle: title.trim() || null,
        title: title.trim() || null,
        brandOrCreator: brandOrCreator.trim() || null,
        summary: summary.trim() || null,
        heroImageUrl: heroImageUrl.trim() || null,
        personalNotes: personalNotes.trim() || null,
      };
      if (hasChangedArchetype && currentArchetypeOption?.typePath) {
        payload.typePath = currentArchetypeOption.typePath;
      }

      const res = await apiFetch(`/api/v1/saves/${card.save.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        if (card.entity && updated.entity) {
          Object.assign(card.entity, updated.entity);
        }
        onCardUpdated?.(updated.save, updated.entity);
        onClose();
      }
    } catch (err) {
      console.error("Failed to save card changes:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkBoughtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;
    const trimmedPrice = boughtPrice.trim();
    const numericPrice = trimmedPrice === "" ? null : Number(trimmedPrice);
    if (numericPrice !== null && (Number.isNaN(numericPrice) || numericPrice < 0)) {
      setMarkBoughtError("Enter a valid non-negative price.");
      return;
    }
    setIsMarkingBought(true);
    setMarkBoughtError(null);
    try {
      const res = await apiFetch(`/api/v1/saves/${card.save.id}/mark-bought`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: numericPrice,
          currency: (boughtCurrency.trim() || "CHF").toUpperCase(),
          orderDate: boughtDate.trim() || undefined,
          retailer: boughtRetailer.trim() || undefined,
          category: boughtCategory || "Other",
          ownerScope: boughtOwnerScope,
          location: boughtLocation.trim() || undefined,
          notes: personalNotes.trim() || undefined,
          logToPurchaseHub: boughtLogToPurchaseHub,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMarkBoughtError(data?.error || "Failed to mark item as bought.");
        return;
      }
      setWished(false);
      setIsMarkBoughtOpen(false);
      setMarkBoughtResult({
        targetBoardSlug: data.targetBoardSlug || "my-stuff",
        purchaseHubSynced: Boolean(data.purchaseHubSynced),
        purchaseHubError: data.purchaseHubError,
      });
      if (card.entity && data.entity) {
        Object.assign(card.entity, data.entity);
      }
      onCardUpdated?.(
        data.save || { ...card.save, wishlist: false, hasConvertedPurchase: true },
        data.entity
      );
      onListUpdated?.();
      loadBoardMemberships(card);
    } catch {
      setMarkBoughtError("Network error while promoting item.");
    } finally {
      setIsMarkingBought(false);
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
      const url = `${window.location.origin}${getApiUrl(`/card/${card.save.id}`)}`;
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
        typePath: hasChangedArchetype
          ? currentArchetypeOption.typePath
          : card.entity.typePath || currentArchetypeOption.typePath,
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
      case "videogame":
        return previewEntity ? (
          <VideoGameCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
          />
        ) : (
          <PrivateMemoCard save={card.save} />
        );
      case "outfit":
        return previewEntity ? (
          <OutfitCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
          />
        ) : (
          <PrivateMemoCard save={card.save} />
        );
      case "garment":
        return previewEntity ? (
          <GarmentCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
            wearLinkCount={wearLinks.length}
          />
        ) : (
          <PrivateMemoCard save={card.save} />
        );
      case "cosmetics":
        return previewEntity ? (
          <CosmeticsCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
          />
        ) : (
          <PrivateMemoCard save={card.save} />
        );
      case "electronics":
        return previewEntity ? (
          <ElectronicsCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
          />
        ) : (
          <PrivateMemoCard save={card.save} />
        );
      case "watch":
      case "product":
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
      case "checklist":
        return (
          <ChecklistCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
          />
        );
      case "travel":
        return (
          <TravelPassCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
          />
        );
      case "creator":
        return (
          <CreatorProfileCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
          />
        );
      case "photo":
        return (
          <PhotoCard
            save={card.save}
            entity={previewEntity as any}
            primarySource={card.primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
          />
        );
      case "link":
        return (
          <WebLinkCard
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

  const titleInputId = `${headingId}-title`;
  const notesInputId = `${headingId}-notes`;

  const typeSwitcher = (
    <>
      {/* Prominent Active Type Badge + Edit Type Toggle */}
      <div className="mb-4 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs">
            <span aria-hidden="true">{currentArchetypeOption.icon}</span>
            <span>{currentArchetypeOption.label}</span>
          </div>

          {!readOnly && (
            <button
              type="button"
              data-testid="edit-type-toggle"
              onClick={() => setIsEditingType((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 transition cursor-pointer"
            >
              <Pencil className="w-3 h-3" aria-hidden="true" />
              <span>{isEditingType ? "Done" : "Edit Type"}</span>
            </button>
          )}
        </div>

        {!readOnly && isEditingType && (
          <div className="mt-2.5 p-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-1.5 animate-in fade-in duration-150">
            {allArchetypes.map((arch) => (
              <button
                key={arch.id}
                data-archetype-btn={arch.id}
                type="button"
                onClick={() => {
                  setActiveArchetype(arch.id);
                  setHasChangedArchetype(true);
                  setIsEditingType(false);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                  activeArchetype === arch.id
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
                    : "bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900"
                }`}
              >
                <span aria-hidden="true">{arch.icon}</span>
                <span>{arch.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

    </>
  );

  const rightPane = (
    <div className="md:col-span-6 flex flex-col p-4 sm:p-6 md:overflow-y-auto overscroll-contain space-y-6">
      {markBoughtResult && (
        <div
          data-testid="mark-bought-confirmation"
          className="p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/30 text-xs flex flex-wrap items-center justify-between gap-2"
        >
          <div className="text-emerald-900 dark:text-emerald-200">
            <span className="font-semibold">Promoted to My Stuff.</span>{" "}
            <span className="text-emerald-700 dark:text-emerald-300">
              {markBoughtResult.purchaseHubSynced
                ? "Logged in Purchase Hub."
                : markBoughtResult.purchaseHubError
                ? `Saved in Curio (Purchase Hub note: ${markBoughtResult.purchaseHubError}).`
                : "Saved in Curio."}
            </span>
          </div>
          {onNavigateToBoard && (
            <button
              type="button"
              data-testid="mark-bought-open-board"
              onClick={() => onNavigateToBoard(markBoughtResult.targetBoardSlug)}
              className="px-2.5 py-1 rounded-xl font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition cursor-pointer"
            >
              Open board →
            </button>
          )}
        </div>
      )}

      {!readOnly && isMarkBoughtOpen && (
        <form
          onSubmit={handleMarkBoughtSubmit}
          data-testid="mark-bought-form"
          className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-neutral-500">
              Bought it → Promote to My Stuff
            </span>
            <button
              type="button"
              onClick={() => setIsMarkBoughtOpen(false)}
              className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
            >
              Close
            </button>
          </div>
          {markBoughtError && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
              {markBoughtError}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Price
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                data-testid="mark-bought-price"
                value={boughtPrice}
                onChange={(e) => setBoughtPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Currency
              </label>
              <input
                type="text"
                maxLength={3}
                value={boughtCurrency}
                onChange={(e) => setBoughtCurrency(e.target.value.toUpperCase())}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono uppercase focus:outline-none"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Order Date
              </label>
              <input
                type="date"
                value={boughtDate}
                onChange={(e) => setBoughtDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Retailer / Merchant
              </label>
              <input
                type="text"
                data-testid="mark-bought-retailer"
                value={boughtRetailer}
                onChange={(e) => setBoughtRetailer(e.target.value)}
                placeholder="e.g. Vitra, Galaxus..."
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Category
              </label>
              <select
                data-testid="mark-bought-category"
                value={boughtCategory}
                onChange={(e) => setBoughtCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                {PURCHASE_HUB_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Owner
              </label>
              <select
                value={boughtOwnerScope}
                onChange={(e) => setBoughtOwnerScope(e.target.value === "personal" ? "personal" : "home")}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                <option value="home">home</option>
                <option value="personal">personal</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Room / Location (optional)
              </label>
              <input
                type="text"
                value={boughtLocation}
                onChange={(e) => setBoughtLocation(e.target.value)}
                placeholder="e.g. Living room, Study"
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                data-testid="mark-bought-log-ph"
                checked={boughtLogToPurchaseHub}
                onChange={(e) => setBoughtLogToPurchaseHub(e.target.checked)}
                className="rounded border-neutral-300 dark:border-neutral-700"
              />
              <span>Log in Purchase Hub</span>
            </label>
            <button
              type="submit"
              data-testid="mark-bought-submit"
              disabled={isMarkingBought}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
            >
              {isMarkingBought ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>Confirm Purchase</span>
            </button>
          </div>
        </form>
      )}
      {/* Editable Title & Inline Entity Metadata Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {readOnly ? (
            <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
              Curated Item
            </span>
          ) : (
            <label
              htmlFor={titleInputId}
              className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold"
            >
              Curator Title
            </label>
          )}
          {!readOnly && !card.save.isPrivateMemo && (
            <button
              type="button"
              data-testid="edit-card-details-toggle"
              onClick={() => setIsEditingDetails((prev) => !prev)}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer"
            >
              <Pencil className="w-3 h-3" aria-hidden="true" />
              <span>{isEditingDetails ? "Hide Details" : "Edit Card Details"}</span>
            </button>
          )}
        </div>
        {readOnly ? (
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 dark:text-neutral-50 pb-1 border-b border-neutral-200 dark:border-neutral-800">
              {title || card.entity?.title || "Untitled Curio"}
            </h2>
            {brandOrCreator && (
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {brandOrCreator}
              </p>
            )}
            {summary && (
              <p className="text-xs font-serif leading-relaxed text-neutral-700 dark:text-neutral-300 pt-1">
                {summary}
              </p>
            )}
          </div>
        ) : (
          <input
            id={titleInputId}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this curation a personal title..."
            className="w-full text-xl sm:text-2xl font-serif font-bold text-neutral-900 dark:text-neutral-50 bg-transparent border-b border-neutral-200 dark:border-neutral-800 focus:border-neutral-400 focus:outline-none pb-1"
          />
        )}
        {!readOnly && isEditingDetails && (
          <div className="grid grid-cols-1 gap-2.5 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-xs">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Creator / Director / Author / Artist / Location
              </label>
              <input
                type="text"
                value={brandOrCreator}
                onChange={(e) => setBrandOrCreator(e.target.value)}
                placeholder="e.g. Alejandro G. Iñárritu, Enrique Morente..."
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Cover / Poster Image URL
              </label>
              <input
                type="text"
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono text-[11px] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Summary / Description
              </label>
              <textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief editorial summary..."
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
              />
            </div>
          </div>
        )}
        {!readOnly && !card.save.isPrivateMemo && !isSyncedClosetOrPurchaseHub && (
          <div className="flex justify-start">
            <DisambiguationBar
              saveId={card.save.id}
              candidates={card.save.candidateFallbacks || []}
              initialQuery={title}
              alwaysShowTrigger
              onSwapped={async () => {
                try {
                  const res = await apiFetch(`/api/v1/saves/${encodeURIComponent(card.save.id)}`);
                  if (res.ok) {
                    const data = await res.json();
                    if (data?.save) {
                      onCardUpdated?.(data.save, data.entity);
                      return;
                    }
                  }
                } catch {
                  // Non-fatal fallback
                }
                onCardUpdated?.(card.save);
              }}
            />
          </div>
        )}
      </div>

      {/* Editable Personal Notes (owner-only unless explicitly populated) */}
      {(!readOnly || Boolean(personalNotes)) && (
        <div>
          {readOnly ? (
            <>
              <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-1">
                Curator Notes
              </span>
              <p className="text-xs font-serif leading-relaxed p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200">
                {personalNotes}
              </p>
            </>
          ) : (
            <>
              <label
                htmlFor={notesInputId}
                className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-1"
              >
                Personal Reflections & Tasting Notes
              </label>
              <textarea
                id={notesInputId}
                rows={4}
                value={personalNotes}
                onChange={(e) => setPersonalNotes(e.target.value)}
                placeholder="Where were you? What did it evoke? Unfiltered personal memory..."
                className="w-full text-xs font-serif leading-relaxed p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </>
          )}
        </div>
      )}

      {/* Curated Board Memberships */}
      {(!readOnly || memberBoards.length > 0) && (
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
                <BookmarkCheck className="w-3 h-3" aria-hidden="true" />
                <span>{board.title}</span>
              </span>
            ))}
            {!readOnly && (
              <button
                type="button"
                onClick={() => setIsAddToListOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700 transition cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
                <span>+ Manage Boards</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Curated Synaptic Pairs */}
      {(curatedPairs.length > 0 || (!readOnly && !card.save.isPrivateMemo && Boolean(onConnect))) && (
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-2">
            Synaptic Memory Pairs ({curatedPairs.length})
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {curatedPairs.map((conn) => (
              <SynapsePill
                key={conn.connectionId}
                connection={conn}
                onUnlink={!readOnly && (onConnect || onUnlink) ? handleUnlinkConnection : undefined}
                onClick={() => {
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
            {!readOnly && !card.save.isPrivateMemo && onConnect && (
              <button
                type="button"
                data-testid="lightbox-pair-btn"
                onClick={() => onConnect(card)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700 transition cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
                <span>+ Pair</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Closet Wear History (collapsed by default to keep Lightbox uncluttered) */}
      {(wearLinks.length > 0 || autoCoWearPairs.length > 0) && (
        <div
          data-testid="closet-wear-history-drawer"
          className="pt-2 border-t border-neutral-200 dark:border-neutral-800"
        >
          <button
            type="button"
            data-testid="closet-wear-history-toggle"
            aria-expanded={isWearHistoryOpen}
            onClick={() => setIsWearHistoryOpen((prev) => !prev)}
            className="flex items-center justify-between w-full text-xs font-mono text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors duration-150 cursor-pointer py-1"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Shirt className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden="true" />
              <span className="font-semibold">Closet Wear History</span>
              <span className="text-neutral-400 tabular-nums truncate">
                ·{" "}
                {[
                  wearLinks.length > 0
                    ? `${wearLinks.length} ${wearLinks.length === 1 ? "outfit" : "outfits"}`
                    : null,
                  autoCoWearPairs.length > 0
                    ? `${autoCoWearPairs.length} co-worn ${
                        autoCoWearPairs.length === 1 ? "piece" : "pieces"
                      }`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            {isWearHistoryOpen ? (
              <ChevronUp className="w-3.5 h-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
            )}
          </button>

          {isWearHistoryOpen && (
            <div className="mt-2.5 space-y-3 pl-1">
              {wearLinks.length > 0 && (
                <div>
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-1.5">
                    Outfits worn in ({wearLinks.length})
                  </span>
                  <div className="max-h-48 overflow-y-auto flex flex-wrap gap-1.5 pr-1">
                    {(showAllWearLinks ? wearLinks : wearLinks.slice(0, 12)).map((conn) => (
                      <SynapsePill
                        key={conn.connectionId}
                        connection={conn}
                        onClick={() => {
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
                  {wearLinks.length > 12 && !showAllWearLinks && (
                    <button
                      type="button"
                      onClick={() => setShowAllWearLinks(true)}
                      className="mt-1.5 text-[11px] font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 underline underline-offset-2 cursor-pointer"
                    >
                      Show all {wearLinks.length} outfits
                    </button>
                  )}
                </div>
              )}

              {autoCoWearPairs.length > 0 && (
                <div>
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-1.5">
                    Co-worn pieces ({autoCoWearPairs.length})
                  </span>
                  <div className="max-h-48 overflow-y-auto flex flex-wrap gap-1.5 pr-1">
                    {(showAllAutoCoWear ? autoCoWearPairs : autoCoWearPairs.slice(0, 12)).map((conn) => (
                      <SynapsePill
                        key={conn.connectionId}
                        connection={conn}
                        onClick={() => {
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
                  {autoCoWearPairs.length > 12 && !showAllAutoCoWear && (
                    <button
                      type="button"
                      onClick={() => setShowAllAutoCoWear(true)}
                      className="mt-1.5 text-[11px] font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 underline underline-offset-2 cursor-pointer"
                    >
                      Show all {autoCoWearPairs.length} co-worn pieces
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instagram Archive Metadata */}
      {(() => {
        const ext = card.entity?.extendedAttributes as Record<string, any> | null | undefined;
        const ig = ext?.instagram as Record<string, any> | undefined;
        if (!ig) return null;
        const permalink = isSafeHttpOrRelativeUrl(ig.permalink) ? ig.permalink : null;
        const collections = Array.isArray(ig.collections) ? ig.collections : [];
        const externalLinks = Array.isArray(ig.externalLinks)
          ? ig.externalLinks.filter((u: unknown): u is string => isSafeHttpOrRelativeUrl(u))
          : [];
        const captionText = typeof ig.caption === "string" ? ig.caption.trim() : "";
        return (
          <div
            data-testid="instagram-archive-metadata"
            className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 space-y-2.5 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                Instagram Archive {ig.authorUsername ? `· @${ig.authorUsername}` : ""}
              </span>
              {permalink && (
                <a
                  href={permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-700 dark:text-neutral-200 hover:underline"
                >
                  <span>Open on Instagram</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              )}
            </div>

            {collections.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {collections.map((c: any, idx: number) => (
                  <span
                    key={`${c?.id || idx}`}
                    className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                  >
                    {String(c?.name || c)}
                  </span>
                ))}
              </div>
            )}

            {externalLinks.length > 0 && (
              <div className="space-y-1">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Preserved Links
                </span>
                <div className="flex flex-col gap-1">
                  {externalLinks.map((url: string) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{url}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {captionText && (
              <details className="pt-1">
                <summary className="text-[11px] font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer select-none">
                  Original Instagram Caption
                </summary>
                <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {captionText}
                </p>
              </details>
            )}
          </div>
        );
      })()}

      {/* Purchase Hub Ownership Metadata */}
      {(() => {
        const ext = card.entity?.extendedAttributes as Record<string, unknown> | null | undefined;
        if (!ext?.purchaseHubProductId) return null;
        const retailers = Array.isArray(ext.retailers)
          ? ext.retailers.map(String).filter(Boolean).join(", ")
          : typeof ext.retailers === "string"
          ? ext.retailers
          : "";
        const purchaseDate =
          typeof ext.lastBought === "string" && ext.lastBought
            ? ext.lastBought
            : typeof ext.firstBought === "string"
            ? ext.firstBought
            : "";
        const warrantyUntil = typeof ext.warrantyUntil === "string" ? ext.warrantyUntil : "";
        const location = typeof ext.location === "string" ? ext.location : "";
        const ownerScope = typeof ext.ownerScope === "string" ? ext.ownerScope : "";
        const modelNumber = typeof ext.modelNumber === "string" ? ext.modelNumber : "";
        const manualUrl = isSafeHttpOrRelativeUrl(ext.manualUrl) ? ext.manualUrl.trim() : null;
        return (
          <div
            data-testid="purchase-hub-metadata"
            className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                Ownership &amp; Purchase Hub
              </span>
              <a
                href="/my-stuff/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-neutral-600 dark:text-neutral-300 hover:underline"
              >
                Open in My Stuff ↗
              </a>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              {retailers && (
                <div>
                  <span className="text-neutral-400 font-mono uppercase text-[9px] block">Retailer</span>
                  <span className="text-neutral-800 dark:text-neutral-200">{retailers}</span>
                </div>
              )}
              {purchaseDate && (
                <div>
                  <span className="text-neutral-400 font-mono uppercase text-[9px] block">Acquired</span>
                  <span className="text-neutral-800 dark:text-neutral-200 font-mono tabular-nums">{purchaseDate}</span>
                </div>
              )}
              {warrantyUntil && (
                <div>
                  <span className="text-neutral-400 font-mono uppercase text-[9px] block">Warranty Until</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">{warrantyUntil}</span>
                </div>
              )}
              {location && (
                <div>
                  <span className="text-neutral-400 font-mono uppercase text-[9px] block">Location</span>
                  <span className="text-neutral-800 dark:text-neutral-200">{location}</span>
                </div>
              )}
              {ownerScope && (
                <div>
                  <span className="text-neutral-400 font-mono uppercase text-[9px] block">Scope</span>
                  <span className="text-neutral-800 dark:text-neutral-200 font-mono">{ownerScope}</span>
                </div>
              )}
              {modelNumber && (
                <div>
                  <span className="text-neutral-400 font-mono uppercase text-[9px] block">Model</span>
                  <span className="text-neutral-800 dark:text-neutral-200 font-mono">{modelNumber}</span>
                </div>
              )}
            </div>
            {manualUrl && (
              <div className="pt-1">
                <a
                  href={manualUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-700 dark:text-neutral-200 underline hover:opacity-80"
                >
                  Open Product Manual ↗
                </a>
              </div>
            )}
          </div>
        );
      })()}

      {/* Curio Learns: Custom Attributes Grid */}
      {(!readOnly || hasVisibleAttributes) && (
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-1">
            Custom Attributes & Specifications
          </span>
          <CustomFieldsSection
            saveId={card.save.id}
            readOnly={readOnly}
            userCustomValues={card.save.userCustomValues}
            extendedAttributes={card.entity?.extendedAttributes}
            hiddenKeys={customFieldHiddenKeys}
          />
        </div>
      )}

      {/* Collapsible Agent JSON-LD Drawer */}
      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setIsJsonDrawerOpen(!isJsonDrawerOpen)}
          className="flex items-center justify-between w-full text-xs font-mono text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Agent JSON-LD / Schema.org</span>
          </div>
          {isJsonDrawerOpen ? (
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          )}
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
        {readOnly ? (
          <div className="ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const isQuote = activeArchetype === "quote";
  const isPressStage = presentation === "press";
  const pressSpec = getArchetypeSpec(card, activeArchetype);
  const basePressMeta = formatSpineMeta(card);
  const pressMeta = {
    title: title.trim() || basePressMeta.title,
    creator: brandOrCreator.trim() || basePressMeta.creator,
    yearOrPrice: basePressMeta.yearOrPrice,
    subtitle: summary.trim() || basePressMeta.subtitle,
    isWishlist: wished,
  };
  const pressImageUrl = resolveSameOriginImageUrl(
    heroImageUrl.trim() || card.entity?.heroImageUrl
  );
  const quoteLayout = (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-8 bg-[#f9f8f6] dark:bg-neutral-950/80">
      <div className="max-w-2xl mx-auto space-y-5">
        <QuoteCard
          save={card.save}
          entity={previewEntity as any}
          primarySource={card.primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          onQuoteSaved={
            readOnly
              ? undefined
              : (id, cv, privateTitle) => {
                  setTitle(privateTitle);
                  onCardUpdated?.({ ...card.save, id, userCustomValues: cv, privateTitle });
                }
          }
        />
        {!readOnly && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {memberBoards.map((board) => (
                <span key={board.id} className="px-2.5 py-0.5 rounded-full text-[11px] bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
                  {board.title}
                </span>
              ))}
              <button
                type="button"
                onClick={() => setIsAddToListOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 cursor-pointer"
              >
                <FolderPlus className="w-3 h-3" aria-hidden="true" /> Boards
              </button>
              {!card.save.isPrivateMemo && onConnect && (
                <button
                  type="button"
                  data-testid="lightbox-quote-pair-btn"
                  onClick={() => onConnect(card)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 cursor-pointer"
                >
                  <Link2 className="w-3 h-3" aria-hidden="true" /> Pair
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
            </button>
          </div>
        )}
        <details className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <summary className="px-4 py-2.5 text-xs font-mono text-neutral-500 cursor-pointer select-none">More</summary>
          <div className="border-t border-neutral-200 dark:border-neutral-800">
            <div className="p-4">{typeSwitcher}</div>
            {rightPane}
          </div>
        </details>
      </div>
    </div>
  );

  return (
    <div
      data-lightbox-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200 overscroll-contain"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        style={
          isPressStage
            ? {
                borderColor: pressPalette.rule,
              }
            : undefined
        }
        className="relative w-full max-w-5xl h-[100dvh] sm:h-[92vh] rounded-none sm:rounded-3xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Lightbox Navigation Bar */}
        <div
          style={
            isPressStage
              ? {
                  backgroundColor: pressPalette.surfaceSecondary,
                  color: pressPalette.ink,
                  borderColor: pressPalette.rule,
                }
              : undefined
          }
          className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-3.5 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-neutral-50/50 dark:bg-neutral-950/40 transition-colors duration-300"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {isPressStage && (
              <span
                className="font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded border shrink-0"
                style={{
                  borderColor: pressPalette.rule,
                  color: pressPalette.accent,
                }}
              >
                {pressSpec.label}
              </span>
            )}
            <span
              id={headingId}
              style={isPressStage ? { color: pressPalette.ink } : undefined}
              className={`truncate ${
                isPressStage
                  ? "font-serif-editorial text-lg sm:text-xl font-normal tracking-tight"
                  : "font-mono text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-bold"
              }`}
            >
              {title || card.entity?.title || card.save.privateTitle || "Card Lightbox Inspector"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="toggle-press-stage"
              aria-pressed={isPressStage}
              onClick={() =>
                setPresentation((prev) => (prev === "press" ? "standard" : "press"))
              }
              style={
                isPressStage
                  ? {
                      backgroundColor: pressPalette.accent,
                      color: pressPalette.surfaceSecondary,
                    }
                  : undefined
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider font-medium transition cursor-pointer ${
                isPressStage
                  ? "hover:opacity-90"
                  : "text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
              title={isPressStage ? "Return to Standard Card View" : "Inspect in 3D Press Stage"}
            >
              <Box className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                {isPressStage ? "Standard View" : "Press Stage"}
              </span>
              <span className="sm:hidden">{isPressStage ? "Card" : "3D"}</span>
            </button>

            {!readOnly && wished && (
              <button
                type="button"
                data-testid="lightbox-mark-bought"
                onClick={() => {
                  setMarkBoughtError(null);
                  setIsMarkBoughtOpen((prev) => !prev);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Bought it</span>
              </button>
            )}

            {!readOnly && (
              <button
                type="button"
                data-testid="lightbox-wish-toggle"
                aria-pressed={wished}
                onClick={async () => {
                  const next = !wished;
                  setWished(next);
                  if (!next) setIsMarkBoughtOpen(false);
                  try {
                    const res = await apiFetch(`/api/v1/saves/${card.save.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ wishlist: next }),
                    });
                    if (!res.ok) throw new Error("fail");
                    const updated = await res.json();
                    onCardUpdated?.({ ...card.save, ...updated.save, wishlist: next });
                  } catch {
                    setWished(!next);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
                  wished
                    ? "bg-rose-500 text-white"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${wished ? "fill-current" : ""}`} aria-hidden="true" />
                <span className="whitespace-nowrap"><span className="sm:hidden">{wished ? "Wished" : "Wish"}</span><span className="hidden sm:inline">{wished ? "On wishlist" : wishLabel(card.entity?.typePath || card.save.typePath, card.entity?.coreType)}</span></span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              title="Copy shareable link"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
              ) : (
                <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{copiedLink ? "Copied" : "Share"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close card inspector"
              className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Two-Stage Split Stage View */}
        {isQuote && !isPressStage ? quoteLayout : (
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 md:grid-rows-[minmax(0,1fr)] overflow-y-auto overscroll-contain md:overflow-hidden">
          {/* Left Stage: Press Stage 3D Hero or Cultural Mode Preview */}
          {isPressStage ? (
            <div
              data-testid="press-stage-pane"
              style={{
                backgroundColor: pressPalette.surface,
                color: pressPalette.ink,
                borderColor: pressPalette.rule,
              }}
              className="md:col-span-6 flex flex-col border-b md:border-b-0 md:border-r transition-colors duration-300 overflow-hidden"
            >
              <div
                className="px-4 sm:px-6 pt-4 pb-3 border-b shrink-0 space-y-1"
                style={{ borderColor: pressPalette.rule }}
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
                  <span style={{ color: pressPalette.accent }}>
                    {pressMeta.creator}
                  </span>
                  {pressMeta.yearOrPrice && (
                    <span className="tabular-nums" style={{ color: pressPalette.muted }}>
                      {pressMeta.yearOrPrice}
                    </span>
                  )}
                </div>
                <h2 className="font-serif-editorial text-2xl sm:text-3xl leading-[1.12] font-normal">
                  {pressMeta.title}
                </h2>
              </div>

              <div className="flex-1 min-h-[300px] flex flex-col">
                <Hero3DInspector
                  spec={pressSpec}
                  meta={pressMeta}
                  palette={pressPalette}
                  imageUrl={pressImageUrl}
                />
              </div>
            </div>
          ) : (
            <div className="md:col-span-6 flex flex-col p-4 sm:p-6 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-[#f9f8f6] dark:bg-neutral-950/80 md:overflow-y-auto overscroll-contain">
              {typeSwitcher}

              {/* Cultural Mode Stage Display + Archived Instagram Reel/Carousel */}
              <div className="flex-1 flex flex-col justify-center gap-4">
                {(() => {
                  const ig = (card.entity?.extendedAttributes as Record<string, any> | null | undefined)?.instagram;
                  if (!ig) return null;
                  const slides = Array.isArray(ig.carouselItems) ? ig.carouselItems : [];
                  if (slides.length > 1) {
                    const activeIdx = Math.min(igCarouselIdx, slides.length - 1);
                    const activeSlide = slides[activeIdx];
                    const slideSrc = resolveSameOriginImageUrl(activeSlide?.url) || activeSlide?.url;
                    return (
                      <div data-testid="instagram-carousel-player" className="rounded-2xl overflow-hidden bg-black border border-neutral-800">
                        <div className="relative flex items-center justify-center bg-black min-h-[240px] max-h-[380px]">
                          {activeSlide?.kind === "video" ? (
                            <video
                              key={slideSrc}
                              src={slideSrc}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full max-h-[380px] object-contain"
                            />
                          ) : (
                            <img
                              src={slideSrc}
                              alt={`Slide ${activeIdx + 1} of ${slides.length}`}
                              className="w-full max-h-[380px] object-contain"
                            />
                          )}
                          <button
                            type="button"
                            aria-label="Previous slide"
                            onClick={() => setIgCarouselIdx((prev) => (prev - 1 + slides.length) % slides.length)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Next slide"
                            onClick={() => setIgCarouselIdx((prev) => (prev + 1) % slides.length)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-white font-mono text-[10px]">
                            {activeIdx + 1} / {slides.length}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  if (ig.videoUrl) {
                    const videoSrc = resolveSameOriginImageUrl(ig.videoUrl) || ig.videoUrl;
                    const posterSrc = ig.coverUrl ? resolveSameOriginImageUrl(ig.coverUrl) || ig.coverUrl : undefined;
                    return (
                      <div data-testid="instagram-reel-player" className="rounded-2xl overflow-hidden bg-black border border-neutral-800">
                        <video
                          src={videoSrc}
                          poster={posterSrc}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full max-h-[400px] object-contain"
                        />
                      </div>
                    );
                  }
                  return null;
                })()}
                {renderLeftStage()}
              </div>
            </div>
          )}

          {/* Right Stage: Curator's Voice, Synapses, Board Memberships & Metadata */}
          {rightPane}
        </div>
        )}

        {/* Add To List Popover */}
        {!readOnly && (
          <AddToListPopover
            saveId={card.save.id}
            isOpen={isAddToListOpen}
            onClose={() => setIsAddToListOpen(false)}
            onListUpdated={() => {
              loadBoardMemberships(card);
              onListUpdated?.();
            }}
          />
        )}
      </div>
    </div>
  );
}
