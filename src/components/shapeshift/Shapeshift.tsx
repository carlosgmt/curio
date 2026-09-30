"use client";

import { AnimatePresence, motion, MotionConfig, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { registry } from "@/components/intents/registry";
import { useDemoScript } from "@/hooks/useDemoScript";
import { useIntent } from "@/hooks/useIntent";
import { activeIntent, type DecideMemory, decide, force, initialMemory, promote } from "@/lib/decide";
import type { CardIntent, IntentResult } from "@/lib/jev/types";
import { spring, tween } from "@/lib/motion";
import { parseFor, parsers } from "@/lib/parse";
import { type GatedSignals, gateSignals, neutralGated } from "@/lib/signals";
import { cn } from "@/lib/utils";
import { DraftContext } from "@/components/intents/shared";
import { CardView } from "./CardView";
import { CyclingPlaceholder } from "./CyclingPlaceholder";
import { DebugPanel } from "./DebugPanel";
import { GhostPreview } from "./GhostPreview";
import { FirstRunHint } from "./FirstRunHint";
import { IntentChips } from "./IntentChips";
import { IntentPalette } from "./IntentPalette";
import { LatencyHud } from "./LatencyHud";
import { MorphContainer } from "./MorphContainer";
import { RecentStack } from "./RecentStack";
import { newId, type SavedItem, savedItems } from "@/lib/savedItems";
import { notify } from "@/lib/notify";
import { analyzeSmartInput } from "@/lib/smartInput";
import { isBrainDump, splitBrainDump } from "@/lib/brainDump";
import { parseInlineTypeDefinition } from "@/lib/customTypes";
import { startVoiceDictation } from "@/lib/deviceIntelligence";
import { ImagePlus, Layers, Mic, MicOff, Sparkles, X, ChevronRight, ArrowLeft, PenTool, LayoutGrid, Check } from "lucide-react";

const subscribeNoop = () => () => {};

function useSearchFlags() {
  const search = useSyncExternalStore(
    subscribeNoop,
    () => window.location.search,
    () => "",
  );
  return useMemo(() => {
    const p = new URLSearchParams(search);
    return { debug: p.get("debug") === "1", demo: p.get("demo") === "1", loop: p.get("loop") === "1" };
  }, [search]);
}

/** Everything about the current card that isn't the typed data itself. */
function derive<K extends CardIntent>(intent: K, text: string, signals: GatedSignals) {
  const data = parseFor(intent, text, { colorMood: signals.colorMood });
  const def = registry[intent];
  return {
    edge: def.edge?.(signals, data) ?? null,
    summary: def.summary(data),
    completeness: parsers[intent].complete(data),
  };
}

function IntentCard<K extends CardIntent>(props: {
  intent: K;
  text: string;
  signals: GatedSignals;
  readiness: ReturnType<typeof useSpring>;
  ghost: boolean;
  editing: boolean;
  onConfirm: () => void;
}) {
  const { intent, text, signals } = props;
  const data = useMemo(() => parseFor(intent, text, { colorMood: signals.colorMood }), [intent, text, signals.colorMood]);
  return <CardView {...props} data={data} />;
}

export function Shapeshift() {
  const flags = useSearchFlags();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const { result, resultText, status, hud } = useIntent(text);

  const [mem, setMem] = useState<DecideMemory>(initialMemory);
  const [gated, setGated] = useState<GatedSignals>(neutralGated);
  const [seen, setSeen] = useState<IntentResult>(result);
  const [chip, setChip] = useState(0);
  const saved = useSyncExternalStore(savedItems.subscribe, savedItems.getSnapshot, savedItems.getServerSnapshot);
  // The saved item currently reopened in the shell; its row is hidden while you edit.
  const [editingId, setEditingId] = useState<number | string | null>(null);
  // The saved row currently flying out of the shell (shared layoutId), so it skips its fade-in.
  const [flyingId, setFlyingId] = useState<number | string | null>(null);
  // Not rendered until a card exists, so a client-only id is hydration-safe.
  const [draftId, setDraftId] = useState<number | string>(newId);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Navigation pane: 'capture' (Zen input only) vs 'cards' (Cards & Search)
  const [activePane, setActivePane] = useState<"capture" | "cards">("capture");
  const [lastSaved, setLastSaved] = useState<{ title: string; intent: string } | null>(null);

  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (deltaX < -50 && activePane === "capture") {
      setActivePane("cards");
    } else if (deltaX > 50 && activePane === "cards") {
      setActivePane("capture");
    }
  };

  const [recording, setRecording] = useState(false);
  const dictationRef = useRef<{ stop: () => void } | null>(null);

  const [attachedImages, setAttachedImages] = useState<Array<{ id: string; url: string; filename: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImageFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/v1/attachments/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setAttachedImages((prev) => [...prev, data]);
        notify(`Attached ${file.name}`, { id: "attach" });
      }
    } catch {}
  };

  const toggleDictation = () => {
    if (recording) {
      dictationRef.current?.stop();
      setRecording(false);
    } else {
      const dict = startVoiceDictation(
        (transcript: string) => {
          setText((prev) => (prev ? prev + " " + transcript : transcript));
        },
        () => setRecording(false),
        () => setRecording(false)
      );
      if (dict) {
        dictationRef.current = dict;
        setRecording(true);
      }
    }
  };

  const brainDumpItems = useMemo(() => {
    return isBrainDump(text) ? splitBrainDump(text) : null;
  }, [text]);

  const customTypeDef = useMemo(() => {
    return parseInlineTypeDefinition(text);
  }, [text]);

  const smartTarget = useMemo(() => {
    return analyzeSmartInput(
      text,
      saved.map((s) => ({
        id: String(s.id),
        title: s.summary,
        intent: s.intent,
        listId: s.listId || "inbox",
      })),
      [
        { id: "inbox", name: "Inbox" },
        { id: "tasks", name: "Tasks" },
        { id: "calendar", name: "Calendar" },
        { id: "kitchen", name: "Kitchen" },
        { id: "notes", name: "Notes" },
        { id: "money", name: "Money" },
        { id: "style", name: "Style" },
      ]
    );
  }, [text, saved]);

  // Fold each new result into the calm UI state (decide + signal gating).
  if (seen !== result) {
    setSeen(result);
    const next = decide(mem, result, resultText);
    const nextIntent = activeIntent(next.ui);
    const prevIntent = activeIntent(mem.ui);
    setMem(next);
    setGated(nextIntent ? gateSignals(prevIntent === nextIntent ? gated : neutralGated, result, registry[nextIntent].signals) : neutralGated);
    if (next.ui.kind === "choose" && mem.ui.kind !== "choose") setChip(0);
  }

  const ui = mem.ui;
  const intent = activeIntent(ui);
  const ghost = ui.kind === "ghost";
  const meta = useMemo(() => (intent ? derive(intent, text, gated) : null), [intent, text, gated]);

  // Readiness: Jev's continuous score when it agrees with the card, otherwise how filled-in the card is.
  const target = !intent
    ? 0
    : result.intent.value === intent && resultText === text && result.source === "jev"
      ? result.readiness / 2
      : (meta?.completeness ?? 0);
  const readiness = useSpring(0, spring.number);
  useEffect(() => {
    readiness.set(ghost ? target * 0.4 : target);
  }, [target, ghost, readiness]);

  // Announce commits (and completions) for screen readers.
  const committedIntent = ui.kind === "committed" ? ui.intent : null;
  const liveMessage = committedIntent ? `Showing ${registry[committedIntent].label.toLowerCase()} card` : announcement;

  /** Clear the input. When editing a saved item, it returns to the list unchanged. */
  const reset = () => {
    setText("");
    setAttachedImages([]);
    setMem(initialMemory);
    setGated(neutralGated);
    if (editingId !== null) {
      setFlyingId(editingId);
      setEditingId(null);
      setDraftId(newId());
    }
  };

  const complete = (): boolean => {
    // 1. If input is inline custom type definition (e.g. "new type: Wine (vintage, rating)")
    if (editingId === null && customTypeDef) {
      fetch("/api/v1/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customTypeDef),
      })
        .then((r) => r.json())
        .then(() => {
          notify(`Created type "${customTypeDef.name}" with ${customTypeDef.fields.length} fields`, { id: "custom-type" });
        })
        .catch(() => {});

      setAnnouncement(`Created custom type ${customTypeDef.name}`);
      setLastSaved({ title: customTypeDef.name, intent: "Custom Type" });
      setText("");
      setMem(initialMemory);
      setGated(neutralGated);
      requestAnimationFrame(() => inputRef.current?.focus());
      return true;
    }

    // 2. If input is multi-line brain dump
    if (editingId === null && brainDumpItems) {
      const dumpText = text;
      fetch("/api/v1/cards/dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: dumpText, items: brainDumpItems }),
      })
        .then((r) => r.json())
        .then((res) => {
          savedItems.syncFromBackend();
          notify(res.message || `Processed ${brainDumpItems.length} items`, { id: "brain-dump" });
        })
        .catch(() => {});

      setAnnouncement(`Processing ${brainDumpItems.length} brain dump items`);
      setLastSaved({ title: `${brainDumpItems.length} items parsed`, intent: "Brain Dump" });
      setText("");
      setMem(initialMemory);
      setGated(neutralGated);
      requestAnimationFrame(() => inputRef.current?.focus());
      return true;
    }

    // If input matches smart action (append to card/list or attach note), execute it directly!
    if (editingId === null && smartTarget) {
      const actionText = text;
      fetch("/api/v1/cards/smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: actionText }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.matched) {
            savedItems.syncFromBackend();
            notify(res.message, { id: "smart-action" });
          }
        })
        .catch(() => {});

      setAnnouncement(smartTarget.label);
      setLastSaved({ title: smartTarget.label, intent: "Smart Action" });
      setText("");
      setMem(initialMemory);
      setGated(neutralGated);
      requestAnimationFrame(() => inputRef.current?.focus());
      return true;
    }

    const target: CardIntent | null =
      ui.kind === "committed" || ui.kind === "ghost" ? ui.intent : ui.kind === "choose" ? ui.options[chip] : null;
    if (!target || !text.trim()) return false;
    const { summary } = derive(target, text, gated);
    const parsedData = parseFor(target, text, { colorMood: gated.colorMood }) as Record<string, any>;
    if (editingId !== null) {
      // Save edits in place, keeping the item's position in the list.
      const updatedItem: SavedItem = {
        id: editingId,
        intent: target,
        summary,
        text,
        data: parsedData,
        createdAt: Date.now(),
        listId: "inbox",
        status: "active",
        tags: [],
      };
      savedItems.update((list) => list.map((x) => (x.id === editingId ? { ...x, intent: target, summary, text, data: parsedData } : x)));
      savedItems.updateServerCard(updatedItem);
      setAnnouncement(`Updated ${registry[target].label.toLowerCase()}: ${summary}`);
      setLastSaved({ title: summary, intent: registry[target].label });
    } else {
      const item: SavedItem = {
        id: draftId,
        intent: target,
        summary,
        text,
        data: parsedData,
        createdAt: Date.now(),
        listId: "inbox",
        status: "active",
        tags: [],
      };
      savedItems.update((list) => (flags.demo ? [item, ...list].slice(0, 9) : [item, ...list])); // demo list is in-memory
      savedItems.createServerCard(item);
      setAnnouncement(`Added ${registry[target].label.toLowerCase()}: ${summary}`);
      setLastSaved({ title: summary, intent: registry[target].label });
    }
    setFlyingId(editingId ?? draftId);
    // Saving with the button (or a card control) keeps you in flow: focus returns to the input.
    requestAnimationFrame(() => inputRef.current?.focus());
    setEditingId(null);
    setText("");
    setMem(initialMemory);
    setGated(neutralGated);
    setDraftId(newId());
    return true;
  };

  // Reopen a completed card: it flies back into the shell (shared layoutId) with its text.
  const reopen = (item: SavedItem) => {
    setActivePane("capture");
    complete(); // file away whatever is being drafted instead of discarding it
    setEditingId(item.id);
    setDraftId(item.id);
    setText(item.text);
    setMem(force(item.intent, item.text));
    setGated(neutralGated);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(item.text.length, item.text.length);
    });
  };

  // Delete card with undo
  const remove = (item: SavedItem) => {
    const index = savedItems.getSnapshot().findIndex((x) => x.id === item.id);
    savedItems.update((list) => list.filter((x) => x.id !== item.id));
    savedItems.deleteServerCard(item.id);
    setAnnouncement(`Deleted ${registry[item.intent].label.toLowerCase()}: ${item.summary}`);
    notify(item.summary, {
      lead: "Deleted",
      id: "deleted",
      action: {
        label: "Undo",
        onClick: () => {
          savedItems.update((list) => {
            if (list.some((x) => x.id === item.id)) return list;
            const next = [...list];
            next.splice(Math.min(index, next.length), 0, item);
            return next;
          });
          savedItems.createServerCard(item);
        },
      },
    });
  };

  const archive = (item: SavedItem) => {
    savedItems.archiveServerCard(item.id);
    setAnnouncement(`Archived ${registry[item.intent].label.toLowerCase()}: ${item.summary}`);
  };

  const restore = (item: SavedItem) => {
    savedItems.restoreServerCard(item.id);
    setAnnouncement(`Restored ${registry[item.intent].label.toLowerCase()}: ${item.summary}`);
  };

  const pick = (picked: CardIntent) => {
    let t = text;
    if (!t.trim()) {
      t = registry[picked].example;
      setText(t);
    }
    setMem(force(picked, t));
    setGated((g) => (intent === picked ? g : neutralGated));
    setPaletteOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // Dashed "Add …" chips type their connecting word into the input.
  const draft = useMemo(
    () => ({
      append: (snippet: string) => {
        setText((t) => {
          const base = t.trimEnd();
          // Keep a trailing question mark at the end: "pizza or burgers?" + " or " → "pizza or burgers or ?"
          return base.endsWith("?") ? `${base.slice(0, -1).trimEnd()}${snippet}?` : `${base}${snippet}`;
        });
        requestAnimationFrame(() => {
          const el = inputRef.current;
          if (!el) return;
          el.focus();
          const end = el.value.endsWith("?") ? el.value.length - 1 : el.value.length;
          el.setSelectionRange(end, end);
        });
      },
    }),
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const atEnd = e.currentTarget.selectionStart === text.length;
    if (e.key === "/" && text === "") {
      e.preventDefault();
      setPaletteOpen(true);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (ui.kind === "choose") pick(ui.options[chip]);
      else complete();
    } else if (e.key === "Escape") {
      e.preventDefault();
      reset();
    } else if (e.key === "Tab" && ghost) {
      e.preventDefault();
      setMem(promote(mem));
    } else if (ui.kind === "choose" && atEnd && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      setChip(e.key === "ArrowLeft" ? 0 : 1);
    }
  };

  useEffect(() => {
    savedItems.setEphemeral(flags.demo);
  }, [flags.demo]);

  useDemoScript(flags.demo, flags.loop, {
    getText: () => inputRef.current?.value ?? "",
    setText: (t) => setText(t),
    complete,
    clear: reset,
  });

  // Focus the input on load, and listen for keyboard navigation between panes
  useEffect(() => {
    if (activePane === "capture") {
      inputRef.current?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const isInput = el?.closest("input, textarea, [contenteditable], [role=dialog]");

      if (e.key === "/" && el && !isInput) {
        e.preventDefault();
        setActivePane("capture");
        inputRef.current?.focus();
        if (!inputRef.current?.value) setPaletteOpen(true);
      } else if (e.key === "Tab" && !e.shiftKey && activePane === "capture" && !text.trim() && !ghost) {
        e.preventDefault();
        setActivePane("cards");
      } else if (e.key === "Escape" && activePane === "cards") {
        e.preventDefault();
        setActivePane("capture");
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePane, text, ghost]);

  return (
    <MotionConfig reducedMotion="user">
      <main
        id="main"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 sm:pt-10 sm:px-6"
      >
        <h1 className="sr-only">BrainSpace</h1>

        {/* ── Mode Navigation Bar ── */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-1 p-1 rounded-full bg-secondary/60 border border-border/50 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setActivePane("capture");
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-medium transition-all cursor-pointer",
                activePane === "capture"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <PenTool className="size-3.5 text-primary" />
              <span>Capture</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePane("cards")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-medium transition-all cursor-pointer",
                activePane === "cards"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-3.5 text-primary" />
              <span>Cards ({saved.length})</span>
            </button>
          </div>

          {activePane === "capture" ? (
            <button
              type="button"
              onClick={() => setActivePane("cards")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer group"
            >
              <span>Browse Memory</span>
              <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setActivePane("capture");
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              <span>New Capture</span>
            </button>
          )}
        </div>

        {/* ── Pane 1: Zen Capture View (Base View) ── */}
        {activePane === "capture" && (
          <motion.div
            key="pane-capture"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={tween.fade}
            className="flex flex-col min-h-[50vh] justify-center"
          >
            <div className="w-full">
              <MorphContainer readiness={readiness} edge={ghost ? null : (meta?.edge ?? null)}>
                <motion.div
                  layout="position"
                  className="relative flex h-[72px] items-center px-5"
                >
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => {
                      const v = e.target.value;
                      setText(v);
                      if (!v.trim()) {
                        setMem(initialMemory);
                        setGated(neutralGated);
                      }
                    }}
                    onPaste={(e) => {
                      const files = e.clipboardData.files;
                      if (files && files.length > 0) {
                        for (let i = 0; i < files.length; i++) {
                          const f = files[i];
                          if (f.type.startsWith("image/")) {
                            e.preventDefault();
                            uploadImageFile(f);
                          }
                        }
                      }
                    }}
                    onKeyDown={onKeyDown}
                    aria-label="Type anything"
                    aria-describedby="shapeshift-hint"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    className="relative z-[1] h-8 w-full bg-transparent pe-2 text-[20px] sm:text-[22px] leading-8 font-[450] tracking-[-0.01em] text-foreground caret-brand outline-none"
                  />

                  {text === "" && <CyclingPlaceholder />}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute end-28 size-1.5 rounded-full bg-brand transition-opacity duration-300 ease-out",
                      status === "thinking" ? "opacity-60" : "opacity-0",
                    )}
                  />

                  {/* Input Controls: Clear, Image Upload & Voice Dictation */}
                  <div className="flex items-center gap-1.5 ms-2 shrink-0 z-[3]">
                    {text.length > 0 && (
                      <button
                        type="button"
                        onClick={reset}
                        title="Clear input (Esc)"
                        aria-label="Clear input"
                        className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                      >
                        <X className="size-4" />
                      </button>
                    )}

                    {/* Attach Image Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach photo or image"
                      aria-label="Attach photo"
                      className="grid size-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all cursor-pointer"
                    >
                      <ImagePlus className="size-3.5" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadImageFile(file);
                        e.target.value = "";
                      }}
                    />

                    <button
                      type="button"
                      onClick={toggleDictation}
                      title={recording ? "Stop listening" : "Dictate with voice"}
                      aria-label="Voice dictation"
                      className={cn(
                        "grid size-7 place-items-center rounded-full transition-all cursor-pointer",
                        recording ? "bg-red-500 text-white animate-pulse" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      )}
                    >
                      {recording ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                    </button>
                  </div>
                </motion.div>

                {/* Attached Images Thumbnail Preview Strip */}
                {attachedImages.length > 0 && (
                  <div className="flex items-center gap-2 px-5 py-2.5 overflow-x-auto border-t border-border/30 bg-secondary/20">
                    {attachedImages.map((img) => (
                      <div key={img.id} className="relative group shrink-0">
                        <img
                          src={img.url}
                          alt={img.filename}
                          className="size-14 rounded-lg object-cover border border-border shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => setAttachedImages((prev) => prev.filter((x) => x.id !== img.id))}
                          className="absolute -top-1.5 -end-1.5 size-4 rounded-full bg-destructive text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                        >
                          <X className="size-2.5" />
                        </button>
                      </div>
                    ))}
                    <span className="text-[11px] text-muted-foreground">
                      {attachedImages.length} image{attachedImages.length === 1 ? "" : "s"} attached
                    </span>
                  </div>
                )}

                {/* Context / Smart Detection Action Strip */}
                {(customTypeDef || brainDumpItems || smartTarget) && (
                  <div className="flex items-center justify-between px-5 pb-3 pt-1 text-xs border-t border-border/40">
                    {customTypeDef ? (
                      <span className="flex items-center gap-1.5 font-semibold text-primary">
                        <Sparkles className="size-3.5 animate-pulse text-primary" />
                        <span>Create custom type "{customTypeDef.name}" ({customTypeDef.fields.length} fields)</span>
                      </span>
                    ) : brainDumpItems ? (
                      <span className="flex items-center gap-1.5 font-semibold text-primary">
                        <Layers className="size-3.5 animate-pulse text-primary" />
                        <span>Brain dump: {brainDumpItems.length} items detected</span>
                      </span>
                    ) : smartTarget ? (
                      <span className="flex items-center gap-1.5 font-semibold text-brand">
                        <span className="size-1.5 rounded-full bg-brand animate-pulse" />
                        <span>{smartTarget.label}</span>
                      </span>
                    ) : null}

                    <span className="text-[11px] text-muted-foreground">
                      Press <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-foreground">Enter</kbd> to save
                    </span>
                  </div>
                )}

                <AnimatePresence initial={false} mode="popLayout">
                  {intent && (
                    <motion.div
                      key={`card-${draftId}`}
                      layoutId={reduce ? undefined : `item-${draftId}`}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)" }}
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, transition: tween.exit }}
                      transition={reduce ? tween.fade : { ...spring.settle, delay: 0.04 }}
                    >
                      <GhostPreview ghost={ghost}>
                        <DraftContext value={draft}>
                          <IntentCard intent={intent} text={text} signals={gated} readiness={readiness} ghost={ghost} editing={editingId !== null} onConfirm={complete} />
                        </DraftContext>
                      </GhostPreview>
                    </motion.div>
                  )}
                </AnimatePresence>
              </MorphContainer>

              <FirstRunHint show={!intent && ui.kind !== "choose" && saved.length === 0 && !flags.demo} />

              <IntentChips
                options={ui.kind === "choose" ? ui.options : null}
                probabilities={result.intent.probabilities}
                active={chip}
                onPick={pick}
              />

              {/* Instant reassurance confirmation pill */}
              {lastSaved && !text.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mt-6 flex items-center justify-between p-3.5 rounded-2xl bg-secondary/50 border border-border/60 text-xs shadow-2xs backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
                      <Check className="size-3" />
                    </span>
                    <span className="text-foreground">
                      Stored in <strong className="font-semibold text-primary">{lastSaved.intent}</strong>: &ldquo;{lastSaved.title}&rdquo;
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePane("cards")}
                    className="flex items-center gap-1 text-primary font-semibold hover:underline cursor-pointer"
                  >
                    <span>View in Cards</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                </motion.div>
              )}

              {/* Tranquil Hint */}
              <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground/60 select-none">
                <span>Swipe left or press Tab for Cards & Search</span>
                <ChevronRight className="size-3.5" />
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Pane 2: Cards, Search & Memory Management ── */}
        {activePane === "cards" && (
          <motion.div
            key="pane-cards"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={tween.fade}
          >
            <RecentStack
              items={saved.filter((x) => x.id !== editingId)}
              flyingId={flyingId}
              onOpen={reopen}
              onDelete={remove}
              onArchive={archive}
              onRestore={restore}
            />
          </motion.div>
        )}

        <p id="shapeshift-hint" className="sr-only">
          Type anything. Enter adds the card, Escape clears, Tab keeps a preview, slash opens every card type.
        </p>
        <div role="status" aria-live="polite" className="sr-only">
          {liveMessage}
        </div>
      </main>

      <IntentPalette open={paletteOpen} onOpenChange={setPaletteOpen} onPick={pick} />
      <LatencyHud {...hud} large={flags.demo} />
      {flags.debug && <DebugPanel result={result} mem={mem} gated={gated} />}
    </MotionConfig>
  );
}
