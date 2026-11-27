"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Lock,
  Globe,
  Sparkles,
  Loader2,
  Link2,
  BookOpen,
  Coffee,
  ShoppingBag,
  Film,
  Search,
  Disc,
  MapPin,
  Utensils,
  X,
  Compass,
  Edit3,
  FolderInput,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Undo2,
  Mic,
  MicOff,
  Image as ImageIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { CardData } from "@/components/cards/PolymorphicCard";

export interface ActiveBoardContext {
  id: string;
  slug: string;
  title: string;
  coreType?: string;
  typePathPrefix?: string;
}

interface OmniboxProps {
  onCaptured?: (item: any) => void;
  onOptimisticStart?: (tempCard: CardData) => void;
  onOptimisticSettle?: (tempId: string, result: any | null, errorMessage?: string) => void;
  onSelectExistingSave?: (saveId: string) => void;
  activeBoardContext?: ActiveBoardContext | null;
  isCapturing?: boolean;
  onOpenTypeBuilder?: () => void;
}

interface SearchResultItem {
  saveId: string;
  title: string;
  summary: string | null;
  heroImageUrl: string | null;
  typePath: string | null;
  coreType: string | null;
  isPrivateMemo: boolean;
  score: number;
  semanticScore: number;
  lexicalScore: number;
}

interface SaveCandidate {
  saveId: string;
  entityId: string | null;
  title: string;
  typePath: string | null;
  similarity: number;
  personalNotes?: string | null;
  rating?: number | null;
  heroImageUrl?: string | null;
  brandOrCreator?: string | null;
}

interface IntentPreview {
  intent: "SEARCH_QUERY" | "EDIT_SAVE" | "ADD_ENTITY" | "PRIVATE_MEMO";
  confidence: number;
  tier: number;
  action?: "RATING" | "NOTE" | "LIST_MOVE" | "STATUS" | "CHECKLIST_APPEND" | "VIEW";
  targetSave?: SaveCandidate;
  ambiguousCandidates?: SaveCandidate[];
  editDetails?: {
    action: string;
    targetTitle?: string;
    rating?: number;
    note?: string;
    targetList?: string;
    status?: string;
    itemToAdd?: string;
  };
  suggestedTitle?: string;
  reasoning?: string;
}

interface UndoState {
  saveId: string;
  title: string;
  previousNotes?: string | null;
  previousValues?: Record<string, unknown> | null;
  countdown: number;
}

export interface OmniboxSuggestion {
  title: string;
  subtitle: string;
  creator?: string | null;
  year?: number | null;
  conceptUri?: string | null;
  typePath: string;
  badgeLabel: string;
  heroImageUrl: string | null;
  canonicalUrl: string;
  isExistingSave: boolean;
  saveId: string | null;
  curioTypeId?: string | null;
}

export function Omnibox({
  onCaptured,
  onOptimisticStart,
  onOptimisticSettle,
  onSelectExistingSave,
  activeBoardContext = null,
  isCapturing: externalIsCapturing,
  onOpenTypeBuilder,
}: OmniboxProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isUploadingPaste, setIsUploadingPaste] = useState(false);
  const [inFlightCount, setInFlightCount] = useState(0);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Typeahead Entity Suggestions state (Q3: never pre-select top suggestion)
  const [suggestions, setSuggestions] = useState<OmniboxSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // Intent preview state
  const [intentPreview, setIntentPreview] = useState<IntentPreview | null>(null);
  const [showDisambiguation, setShowDisambiguation] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<SaveCandidate | null>(null);

  // Real-time Undo Toast state
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [undoSuccess, setUndoSuccess] = useState(false);

  // Q4: Web Speech API browser dictation (zero host RAM; hidden if unsupported)
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const speechRecognitionRef = useRef<any>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSpeechSupported(Boolean(Ctor));
    }
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const openExistingSave = useCallback(
    (saveId: string) => {
      if (onSelectExistingSave) {
        onSelectExistingSave(saveId);
      } else {
        router.push(`/card/${saveId}`);
      }
    },
    [onSelectExistingSave, router]
  );

  const buildBoardPayload = useCallback(() => {
    if (!activeBoardContext) return {};
    return {
      listId: activeBoardContext.id,
      boardContext: {
        slug: activeBoardContext.slug,
        title: activeBoardContext.title,
        coreType: activeBoardContext.coreType,
        typePathPrefix: activeBoardContext.typePathPrefix,
      },
    };
  }, [activeBoardContext]);

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          setIsUploadingPaste(true);
          try {
            const formData = new FormData();
            formData.append("title", "Pasted Image");
            formData.append("image", file);
            const res = await apiFetch("/api/v1/share-target", {
              method: "POST",
              headers: { Accept: "application/json", "X-Requested-With": "Omnibox" },
              body: formData,
            });
            if (res.ok) {
              const data = await res.json().catch(() => ({ status: "created", isOptimistic: false }));
              onCaptured?.(data);
            }
          } catch (err) {
            console.error("Paste upload failed:", err);
          } finally {
            setIsUploadingPaste(false);
          }
          break;
        }
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      setIsRecording(false);
      return;
    }

    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      const prefixText = input.trim();

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0]?.transcript || "";
        }
        const combined = prefixText
          ? `${prefixText} ${transcript.trim()}`.trim()
          : transcript.trim();
        setInput(combined);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        inputRef.current?.focus();
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch (err) {
      console.warn("Web Speech dictation unavailable:", err);
      setIsRecording(false);
    }
  };

  // Determine if in search mode (starts with "/" or search mode toggled)
  const inSearch = isSearchMode || input.startsWith("/");
  const searchQuery = input.startsWith("/") ? input.slice(1).trim() : input.trim();

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
        setShowDisambiguation(false);
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Real-time Typeahead / Autocomplete Suggestions (skip for raw URLs; never auto-select index 0)
  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed || inSearch || trimmed.length < 2 || /^https?:\/\//i.test(trimmed)) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/v1/capture/suggest?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          const items: OmniboxSuggestion[] = data.suggestions || [];
          setSuggestions(items);
          setShowSuggestions(items.length > 0);
          setSelectedSuggestionIndex(-1);
        }
      } catch (err) {
        console.error("Suggestion fetch error:", err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [input, inSearch]);

  const makeOptimisticCard = (
    tempId: string,
    title: string,
    opts: {
      isPrivateMemo?: boolean;
      typePath?: string;
      heroImageUrl?: string | null;
      creator?: string | null;
      canonicalUrl?: string;
    } = {}
  ): CardData => ({
    save: {
      id: tempId,
      isPrivateMemo: Boolean(opts.isPrivateMemo),
      privateTitle: opts.isPrivateMemo ? title : null,
      typePath: opts.typePath || (opts.isPrivateMemo ? "/memo/personal" : "/product"),
      enrichmentStatus: "OPTIMISTIC",
      createdAt: new Date().toISOString(),
    },
    entity: opts.isPrivateMemo
      ? null
      : {
          id: `${tempId}-entity`,
          title,
          heroImageUrl: opts.heroImageUrl || null,
          brandOrCreator: opts.creator || null,
          coreType: "PRODUCT",
          typePath: opts.typePath || "/product",
          canonicalUrl: opts.canonicalUrl || "",
        },
    connections: [],
  });

  const executeCaptureAsTextNote = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const tempId = `optimistic-${crypto.randomUUID()}`;
    setCaptureError(null);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    setIntentPreview(null);
    setShowDisambiguation(false);
    setInput("");

    onOptimisticStart?.(makeOptimisticCard(tempId, trimmed, { isPrivateMemo: true, typePath: "/memo/personal" }));
    setInFlightCount((c) => c + 1);

    try {
      const res = await apiFetch("/api/v1/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: trimmed,
          isPrivateMemo: true,
          forcedTypePath: "/memo/personal",
          forceNew: true,
          ...buildBoardPayload(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to capture text note");
      }

      const data = await res.json();
      onOptimisticSettle?.(tempId, data);
      onCaptured?.(data);
    } catch (err: any) {
      console.error("Text note capture error:", err);
      onOptimisticSettle?.(tempId, null, err.message || "Capture failed");
      setCaptureError("Failed to save note. Restored input.");
      setInput((curr) => curr || trimmed);
    } finally {
      setInFlightCount((c) => Math.max(0, c - 1));
    }
  };

  const handleSelectSuggestion = async (sug: OmniboxSuggestion) => {
    const fullTypedQuery = input.trim();
    setCaptureError(null);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);

    if (sug.isExistingSave && sug.saveId) {
      setInput("");
      openExistingSave(sug.saveId);
      return;
    }

    const tempId = `optimistic-${crypto.randomUUID()}`;
    setIntentPreview(null);
    setInput("");

    onOptimisticStart?.(
      makeOptimisticCard(tempId, sug.title, {
        typePath: sug.typePath,
        heroImageUrl: sug.heroImageUrl,
        creator: sug.creator,
        canonicalUrl: sug.canonicalUrl,
      })
    );
    setInFlightCount((c) => c + 1);

    try {
      const res = await apiFetch("/api/v1/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: sug.title,
          queryContext: fullTypedQuery || sug.title,
          forcedTypePath: sug.typePath,
          curioTypeId: sug.curioTypeId,
          targetCandidate: sug,
          forceNew: true,
          ...buildBoardPayload(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to capture entity suggestion");
      }

      const data = await res.json();
      onOptimisticSettle?.(tempId, data);
      onCaptured?.(data);
    } catch (err: any) {
      console.error("Failed to capture suggestion:", err);
      onOptimisticSettle?.(tempId, null, err.message || "Capture failed");
      setCaptureError("Failed to capture suggestion. Restored input.");
      setInput((curr) => curr || fullTypedQuery || sug.title);
    } finally {
      setInFlightCount((c) => Math.max(0, c - 1));
    }
  };

  // Countdown timer for Undo Toast
  useEffect(() => {
    if (!undoState) return;

    if (undoState.countdown <= 0) {
      setUndoState(null);
      return;
    }

    const interval = setInterval(() => {
      setUndoState((prev) => (prev ? { ...prev, countdown: prev.countdown - 1 } : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [undoState]);

  // Real-time Keystroke Intent Preview (<15 ms deterministic)
  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed || inSearch) {
      setIntentPreview(null);
      setShowDisambiguation(false);
      setSelectedCandidate(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/v1/capture/intent?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data: IntentPreview = await res.json();
          setIntentPreview(data);

          if (data.ambiguousCandidates && data.ambiguousCandidates.length > 1) {
            setShowDisambiguation(true);
            setSelectedCandidate(data.ambiguousCandidates[0]);
          } else {
            setShowDisambiguation(false);
            setSelectedCandidate(data.targetSave || null);
          }
        }
      } catch (err) {
        console.error("Intent preview error:", err);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [input, inSearch]);

  // Debounced semantic search when in search mode
  useEffect(() => {
    if (!inSearch || !searchQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowSearchDropdown(true);

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}&semantic=true&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error("Semantic search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, inSearch]);

  const executeCapture = async (forceNew: boolean = false, targetSaveId?: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (inSearch) {
      if (searchResults.length > 0) {
        const topSaveId = searchResults[0].saveId;
        setShowSearchDropdown(false);
        setInput("");
        openExistingSave(topSaveId);
      }
      return;
    }

    const isLikelyInlineEdit =
      !forceNew && (Boolean(targetSaveId) || intentPreview?.intent === "EDIT_SAVE");
    const tempId = isLikelyInlineEdit ? null : `optimistic-${crypto.randomUUID()}`;

    setCaptureError(null);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    setIntentPreview(null);
    setShowDisambiguation(false);
    setInput("");

    if (tempId) {
      const isUrl = /^https?:\/\//i.test(trimmed);
      onOptimisticStart?.(
        makeOptimisticCard(tempId, trimmed, {
          typePath:
            activeBoardContext?.typePathPrefix ||
            (isUrl ? "/link" : "/product"),
          canonicalUrl: isUrl ? trimmed : "",
        })
      );
    }

    setInFlightCount((c) => c + 1);
    try {
      const res = await apiFetch("/api/v1/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: trimmed,
          queryContext: trimmed,
          forceNew,
          ...(targetSaveId ? { targetSaveId } : {}),
          ...buildBoardPayload(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to capture item");
      }

      const data = await res.json();

      // If inline card edit, activate 5-second Undo Toast with pre-edit state
      if (data.status === "edited") {
        setUndoState({
          saveId: data.save.id,
          title: data.save.privateTitle || data.entity?.title || "Card",
          previousNotes:
            data.previousSave !== undefined ? data.previousSave.personalNotes : null,
          previousValues:
            data.previousSave?.userCustomValues ?? {},
          countdown: 5,
        });
      }

      if (tempId) {
        onOptimisticSettle?.(tempId, data);
      }
      onCaptured?.(data);
    } catch (err: any) {
      console.error("Omnibox capture error:", err);
      if (tempId) {
        onOptimisticSettle?.(tempId, null, err.message || "Capture failed");
      }
      setCaptureError("Capture failed. Restored your input.");
      setInput((curr) => curr || trimmed);
    } finally {
      setInFlightCount((c) => Math.max(0, c - 1));
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (showSuggestions && suggestions.length > 0 && selectedSuggestionIndex >= 0) {
      if (selectedSuggestionIndex === suggestions.length) {
        executeCaptureAsTextNote();
        return;
      }
      if (suggestions[selectedSuggestionIndex]) {
        handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
        return;
      }
    }
    executeCapture(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowSearchDropdown(false);
      setShowDisambiguation(false);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      setIsSearchMode(false);
      if (input.startsWith("/")) {
        setInput("");
      }
      return;
    }

    // Q3: Cmd+Enter or Alt+Enter saves private memo
    if (e.key === "Enter" && (e.metaKey || e.altKey)) {
      e.preventDefault();
      executeCaptureAsTextNote();
      return;
    }

    // Q3: Shift+Enter forces new card creation (bypassing edit/duplicate hijack)
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      executeCapture(true);
      return;
    }

    // Navigate live typeahead suggestions & bottom text note row
    if (showSuggestions && suggestions.length > 0) {
      const totalItems = suggestions.length + 1; // includes dedicated text note row
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev < 0 ? 0 : (prev + 1) % totalItems));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => {
          if (prev < 0) return totalItems - 1;
          if (prev === 0) return -1;
          return prev - 1;
        });
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.altKey) {
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          if (selectedSuggestionIndex === suggestions.length) {
            executeCaptureAsTextNote();
          } else if (suggestions[selectedSuggestionIndex]) {
            handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
          }
          return;
        }
      }
    }
  };

  const handleUndo = async () => {
    if (!undoState) return;
    try {
      // Revert previous notes / rating
      const res = await apiFetch(`/api/v1/saves/${undoState.saveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalNotes: undoState.previousNotes ?? null,
          userCustomValues: undoState.previousValues ?? {},
        }),
      });
      if (res.ok) {
        const reverted = await res.json().catch(() => null);
        if (reverted) {
          onCaptured?.(reverted);
        }
      }
      setUndoSuccess(true);
      setTimeout(() => {
        setUndoSuccess(false);
        setUndoState(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to undo edit:", err);
    }
  };

  const isBusy = isUploadingPaste || Boolean(externalIsCapturing);

  const renderIntentBadge = () => {
    if (inSearch) {
      return (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-0.5 rounded-full border border-purple-200/50 dark:border-purple-800/50">
          <Search className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          Semantic Search
        </span>
      );
    }

    const trimmedInput = input.trim();
    if (/^https?:\/\//i.test(trimmedInput)) {
      let hostLabel = "URL";
      try {
        hostLabel = new URL(trimmedInput).hostname.replace(/^www\./, "");
      } catch {
        hostLabel = "Link";
      }
      return (
        <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-0.5 rounded-full border border-[var(--gallery-hairline)]">
          <Link2 className="w-3.5 h-3.5" />
          <span>Link: {hostLabel}</span>
        </span>
      );
    }

    if (!intentPreview) {
      return <Sparkles className="w-4 h-4 text-muted-foreground" />;
    }

    if (intentPreview.intent === "EDIT_SAVE") {
      const targetTitle = intentPreview.targetSave?.title || "Card";
      const badgeCls =
        "flex items-center gap-1.5 text-xs font-mono font-medium text-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-0.5 rounded-full border border-[var(--gallery-hairline)]";
      if (intentPreview.action === "RATING") {
        return (
          <span className={badgeCls}>
            <Edit3 className="w-3.5 h-3.5" />
            Update &lsquo;{targetTitle}&rsquo; ({intentPreview.editDetails?.rating}★)
          </span>
        );
      }
      if (intentPreview.action === "NOTE") {
        return (
          <span className={badgeCls}>
            <FileText className="w-3.5 h-3.5" />
            Note on &lsquo;{targetTitle}&rsquo;
          </span>
        );
      }
      if (intentPreview.action === "LIST_MOVE") {
        return (
          <span className={badgeCls}>
            <FolderInput className="w-3.5 h-3.5" />
            Move &lsquo;{targetTitle}&rsquo; to {intentPreview.editDetails?.targetList}
          </span>
        );
      }
      if (intentPreview.action === "STATUS") {
        return (
          <span className={badgeCls}>
            <RotateCcw className="w-3.5 h-3.5" />
            Mark &lsquo;{targetTitle}&rsquo; as {intentPreview.editDetails?.status}
          </span>
        );
      }
      return (
        <span className={badgeCls}>
          <Edit3 className="w-3.5 h-3.5" />
          Edit &lsquo;{targetTitle}&rsquo;
        </span>
      );
    }

    if (intentPreview.intent === "PRIVATE_MEMO") {
      return (
        <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full border border-[var(--gallery-hairline)]">
          <Lock className="w-3.5 h-3.5" />
          Private Note
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-0.5 rounded-full border border-[var(--gallery-hairline)]">
        <Sparkles className="w-3.5 h-3.5" />
        Capture
      </span>
    );
  };

  const renderArchetypeIcon = (item: SearchResultItem) => {
    if (item.isPrivateMemo) {
      return <Lock className="w-3.5 h-3.5 text-[var(--brand)]" />;
    }
    const path = (item.typePath || "").toLowerCase();
    const core = (item.coreType || "").toUpperCase();

    if (path.includes("/book") || core === "BOOK") {
      return <BookOpen className="w-3.5 h-3.5 text-[var(--ink-2)]" />;
    }
    if (path.includes("/film") || path.includes("/movie") || (core === "MEDIA" && path.includes("film"))) {
      return <Film className="w-3.5 h-3.5 text-[var(--ink-2)]" />;
    }
    if (path.includes("/vinyl") || path.includes("/music") || core === "MEDIA") {
      return <Disc className="w-3.5 h-3.5 text-[var(--ink-2)]" />;
    }
    if (path.includes("/recipe") || core === "CULINARY") {
      return <Utensils className="w-3.5 h-3.5 text-[var(--ink-2)]" />;
    }
    if (path.includes("/place") || core === "PLACE") {
      return <MapPin className="w-3.5 h-3.5 text-[var(--ink-2)]" />;
    }
    return <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <div ref={containerRef} className="w-full max-w-3xl mx-auto px-4 relative">
      <form
        onSubmit={handleSubmit}
        className={`relative group rounded-xl bg-card border transition-all duration-150 px-2 py-1.5 sm:px-2.5 sm:py-2 flex items-center gap-2 ${
          inSearch || intentPreview?.intent === "EDIT_SAVE"
            ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/15"
            : "border-[var(--gallery-hairline)]"
        }`}
        style={{ boxShadow: "var(--shadow-rest)" }}
      >
        <div className="pl-3 text-neutral-400 dark:text-neutral-500 flex items-center justify-center shrink-0">
          {renderIntentBadge()}
        </div>

        <input
          ref={inputRef}
          type="text"
          aria-label={inSearch ? "Search library" : "Capture or command"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => {
            if (inSearch && searchResults.length > 0) {
              setShowSearchDropdown(true);
            }
          }}
          placeholder={
            inSearch
              ? "Search by meaning, title, or tags... (Esc to exit)"
              : intentPreview?.intent === "EDIT_SAVE"
              ? "Press Enter to update card, Shift+Enter to create new card"
              : "Type / to search (e.g. /coffee), or enter anything to save..."
          }
          disabled={isBusy}
          className="flex-1 bg-transparent px-3 py-2 text-base text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none min-w-0"
        />

        {inSearch ? (
          <div className="flex items-center gap-1.5">
            {isSearching && <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400 mr-1" />}
            <button
              type="button"
              onClick={() => {
                setIsSearchMode(false);
                setInput("");
                setShowSearchDropdown(false);
              }}
              aria-label="Close search"
              className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            {inFlightCount > 0 && (
              <span
                data-testid="optimistic-inflight-indicator"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">{inFlightCount}</span>
              </span>
            )}
            {speechSupported && (
              <button
                type="button"
                data-testid="omnibox-mic-btn"
                aria-label="Voice dictation"
                aria-pressed={isRecording}
                onClick={toggleRecording}
                className={`p-2 rounded-2xl transition text-xs flex items-center gap-1 cursor-pointer ${
                  isRecording
                    ? "bg-red-500 text-white animate-pulse"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                }`}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              aria-label="Search saves"
              onClick={() => {
                setIsSearchMode(true);
                inputRef.current?.focus();
              }}
              className="p-2 rounded-2xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition text-xs flex items-center gap-1 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border border-neutral-200 dark:border-neutral-700 hidden sm:inline">
                /
              </span>
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isBusy}
              className={`cursor-pointer inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition-transform active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
                intentPreview?.intent === "EDIT_SAVE"
                  ? "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-neutral-950"
                  : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              }`}
            >
              {isBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <span>{intentPreview?.intent === "EDIT_SAVE" ? "Update" : "Save"}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </button>
          </div>
        )}
      </form>

      {captureError && (
        <div
          role="alert"
          className="mt-2 px-3.5 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2"
        >
          <span>{captureError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setCaptureError(null)}
            className="text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Live Omnibox Typeahead / Autocomplete Suggestions Dropdown */}
      {!inSearch && !showDisambiguation && showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 sm:left-4 sm:right-4 top-full mt-2 z-50 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden backdrop-blur-md">
          <div className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-neutral-950/40 flex items-center justify-between text-[11px] font-mono text-neutral-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Entity Suggestions</span>
            </span>
            <span className="text-[10px]">↑↓ to pick • Enter captures typed query</span>
          </div>

          <div className="max-h-[min(20rem,50dvh)] overflow-y-auto overscroll-contain divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {suggestions.map((sug, idx) => {
              const isSelected = selectedSuggestionIndex === idx;
              return (
                <button
                  key={`${sug.title}-${sug.canonicalUrl}-${idx}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(sug)}
                  onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                  className={`w-full text-left p-3 transition flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? "bg-neutral-100 dark:bg-neutral-800/90 text-neutral-900 dark:text-white ring-1 ring-inset ring-neutral-300 dark:ring-neutral-700"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-800 dark:text-neutral-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shrink-0 flex items-center justify-center">
                      {sug.heroImageUrl ? (
                        <img
                          src={sug.heroImageUrl}
                          alt={sug.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Sparkles className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm truncate">
                          {sug.title}
                        </span>
                        <span className="text-[9px] font-mono uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
                          {sug.badgeLabel}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {sug.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {sug.isExistingSave ? (
                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/60">
                        In saves
                      </span>
                    ) : isSelected ? (
                      <span className="text-[10px] font-mono font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-300/60 dark:border-amber-700/60">
                        ↵ Capture this
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 hidden sm:inline">
                        1-tap capture →
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Dedicated bottom row: Save as text note */}
            <button
              type="button"
              onClick={executeCaptureAsTextNote}
              onMouseEnter={() => setSelectedSuggestionIndex(suggestions.length)}
              className={`w-full text-left p-3 transition flex items-center justify-between gap-3 cursor-pointer ${
                selectedSuggestionIndex === suggestions.length
                  ? "bg-neutral-100 dark:bg-neutral-800/90 text-neutral-900 dark:text-white ring-1 ring-inset ring-neutral-300 dark:ring-neutral-700"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shrink-0 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block">
                    Save as private memo: &ldquo;{input}&rdquo;
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Bypasses catalog lookup • Encrypted vault note
                  </span>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <kbd className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 shadow-2xs">
                  ⌘/⌥+Enter
                </kbd>
              </div>
            </button>
          </div>

          {/* Dropdown footer bar */}
          <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-neutral-950/60 flex items-center justify-between text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
            <div className="flex items-center gap-2 flex-wrap">
              <span><kbd className="font-semibold text-neutral-700 dark:text-neutral-300">↵</kbd> Smart capture</span>
              <span>•</span>
              <span><kbd className="font-semibold text-neutral-700 dark:text-neutral-300">↑↓</kbd> Pick suggestion</span>
              <span>•</span>
              <span><kbd className="font-semibold text-neutral-700 dark:text-neutral-300">⇧↵</kbd> Force new card</span>
              <span>•</span>
              <span><kbd className="font-semibold text-neutral-700 dark:text-neutral-300">⌘/⌥↵</kbd> Private memo</span>
              <span>•</span>
              <span><kbd className="font-semibold text-neutral-700 dark:text-neutral-300">Esc</kbd> Dismiss</span>
            </div>
          </div>
        </div>
      )}

      {/* 1-Tap Candidate Disambiguation Dropdown */}
      {showDisambiguation && intentPreview?.ambiguousCandidates && (
        <div className="absolute left-0 right-0 sm:left-4 sm:right-4 top-full mt-2 z-50 rounded-2xl bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-800 shadow-xl overflow-hidden backdrop-blur-md">
          <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-amber-50/70 dark:bg-amber-950/40 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Multiple matching cards found in your vault. Which card would you like to update?
            </span>
            <span className="text-[11px] text-neutral-400">
              Shift+Enter to add new
            </span>
          </div>

          <div className="max-h-[min(16rem,45dvh)] overflow-y-auto overscroll-contain divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {intentPreview.ambiguousCandidates.map((c) => (
              <button
                key={c.saveId}
                type="button"
                onClick={() => {
                  setSelectedCandidate(c);
                  executeCapture(false, c.saveId);
                }}
                className="w-full text-left p-3 hover:bg-amber-50/50 dark:hover:bg-neutral-800/70 transition flex items-center justify-between gap-3 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                      {c.title}
                    </h4>
                    {c.brandOrCreator && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        by {c.brandOrCreator}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/40 shrink-0">
                  Select & Update
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => executeCapture(true)}
              className="w-full text-left p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
              <span>Don&rsquo;t update existing cards — <strong>Create as New Card</strong> (Shift+Enter)</span>
            </button>
          </div>
        </div>
      )}

      {/* Semantic Search Results Dropdown */}
      {inSearch && showSearchDropdown && searchQuery.length > 0 && (
        <div className="absolute left-0 right-0 sm:left-4 sm:right-4 top-full mt-2 z-50 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden backdrop-blur-md">
          <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/70 flex items-center justify-between text-xs text-neutral-500">
            <span className="flex items-center gap-1.5 font-medium">
              <Compass className="w-3.5 h-3.5 text-purple-500" />
              Semantic Taste Graph Retrieval
            </span>
            <span className="text-[11px] text-neutral-400">
              Hybrid Cosine + Lexical
            </span>
          </div>

          <div className="max-h-[min(20rem,50dvh)] overflow-y-auto overscroll-contain divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {isSearching && searchResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                <span>Searching your memory vault...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400">
                No matching saves found for &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              searchResults.map((item) => (
                <button
                  key={item.saveId}
                  type="button"
                  onClick={() => {
                    setShowSearchDropdown(false);
                    setIsSearchMode(false);
                    setInput("");
                    openExistingSave(item.saveId);
                  }}
                  className="w-full text-left p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition flex items-start gap-3 cursor-pointer group"
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-950/50 transition">
                    {renderArchetypeIcon(item)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                        {item.title}
                      </h4>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40 shrink-0">
                        {Math.round(item.score * 100)}% match
                      </span>
                    </div>
                    {item.summary && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                        {item.summary}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Real-time Undo Toast */}
      {undoState && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-2xl border border-neutral-700 dark:border-neutral-300 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="text-xs font-medium">
            Updated &lsquo;<strong>{undoState.title}</strong>&rsquo; inline
          </span>
          {undoSuccess ? (
            <span className="text-xs text-emerald-400 font-semibold">Reverted!</span>
          ) : (
            <button
              type="button"
              onClick={handleUndo}
              className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 dark:bg-neutral-200 dark:hover:bg-neutral-300 dark:text-amber-800 transition cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo ({undoState.countdown}s)
            </button>
          )}
        </div>
      )}

      {/* Quiet Editorial Command Footer (zero rainbow pill confetti) */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mt-2 px-1 text-[11px] font-mono tabular-nums text-muted-foreground">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setInput("/coffee");
              setIsSearchMode(true);
              inputRef.current?.focus();
            }}
            className="hover:text-[var(--brand)] transition-colors cursor-pointer"
          >
            / search
          </button>
          <span className="opacity-40">·</span>
          <button
            type="button"
            onClick={() => setInput("Change rating to 5 stars for Past Lives")}
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            edit by prompt
          </button>
          <span className="opacity-40">·</span>
          <button
            type="button"
            onClick={() => setInput("Met Sarah about Q3 funding")}
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            private note
          </button>
          {onOpenTypeBuilder && (
            <>
              <span className="opacity-40">·</span>
              <button
                type="button"
                onClick={onOpenTypeBuilder}
                className="text-[var(--brand)] hover:underline underline-offset-4 transition-colors cursor-pointer"
                title="Teach Curio a new custom type"
              >
                + add type
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
          <span>↵ save</span>
          <span className="opacity-40">·</span>
          <span>⇧↵ new</span>
          <span className="opacity-40">·</span>
          <span>esc dismiss</span>
        </div>
      </div>
    </div>
  );
}
