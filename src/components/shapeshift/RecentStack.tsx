"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Search,
  Archive,
  ArchiveRestore,
  LayoutGrid,
  Kanban,
  CalendarRange,
  Clock,
  Inbox,
  CheckSquare,
  Calendar,
  ChefHat,
  StickyNote,
  CornerDownRight,
  Wallet,
  Shirt,
  Sparkles,
  MapPin,
  Share2,
  Check,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { registry } from "@/components/intents/registry";
import { spring, tween } from "@/lib/motion";
import { savedItems, type SavedItem } from "@/lib/savedItems";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

const LIST_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  all: Sparkles,
  inbox: Inbox,
  tasks: CheckSquare,
  calendar: Calendar,
  kitchen: ChefHat,
  notes: StickyNote,
  CornerDownRight,
  money: Wallet,
  style: Shirt,
};

function formatRelativeTime(timestamp: number | string | undefined): string {
  if (!timestamp) return "";
  const time = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  if (isNaN(time)) return "";
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RecentStack({
  items,
  flyingId,
  onOpen,
  onDelete,
  onArchive,
  onRestore,
}: {
  items: SavedItem[];
  flyingId: number | string | null;
  onOpen: (item: SavedItem) => void;
  onDelete: (item: SavedItem) => void;
  onArchive?: (item: SavedItem) => void;
  onRestore?: (item: SavedItem) => void;
}) {
  const reduce = useReducedMotion();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeList, setActiveList] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "board" | "timeline">("cards");
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([
    { id: "all", name: "All" },
    { id: "inbox", name: "Inbox" },
    { id: "tasks", name: "Tasks" },
    { id: "calendar", name: "Calendar" },
    { id: "kitchen", name: "Kitchen" },
    { id: "notes", name: "Notes" },
    { id: "money", name: "Money" },
    { id: "style", name: "Style" },
  ]);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  const handleToggleCheckItem = (item: SavedItem, index: number) => {
    if (!Array.isArray(item.data?.items)) return;
    const newItems = [...item.data.items];
    const current = newItems[index];
    if (typeof current === "string") {
      newItems[index] = { id: `item-${index}`, text: current, done: true };
    } else if (current && typeof current === "object") {
      newItems[index] = { ...current, done: !current.done };
    }
    const updatedItem: SavedItem = {
      ...item,
      data: { ...item.data, items: newItems },
    };
    savedItems.update((list) =>
      list.map((x) => (x.id === item.id ? updatedItem : x))
    );
    savedItems.updateServerCard(updatedItem);
  };

  const handleShareCard = (item: SavedItem) => {
    const url = `${window.location.origin}/p/${item.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(item.id);
    notify("Public link copied to clipboard!", { id: "share" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Global Cmd+K / Ctrl+K shortcut to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch backend lists
  useEffect(() => {
    fetch("/api/v1/lists")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLists([{ id: "all", name: "All" }, ...data]);
        }
      })
      .catch(() => {});
  }, []);

  const childrenByParentId = useMemo(() => {
    const map = new Map<string, SavedItem[]>();
    for (const item of items) {
      if (item.parentId) {
        const pId = String(item.parentId);
        const list = map.get(pId) || [];
        list.push(item);
        map.set(pId, list);
      }
    }
    return map;
  }, [items]);

  // Filter items and SORT BY MOST RECENT (createdAt descending)
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Status filter
        const itemStatus = item.status || "active";
        if (statusFilter !== "all" && itemStatus !== statusFilter) {
          return false;
        }

        // List filter (default shows all)
        if (activeList !== "all") {
          const itemList = item.listId || "inbox";
          if (itemList !== activeList) return false;
        }

        // Text query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchSummary = item.summary.toLowerCase().includes(q);
          const matchText = item.text.toLowerCase().includes(q);
          const matchIntent = item.intent.toLowerCase().includes(q);
          const matchTags = item.tags?.some((t) => t.toLowerCase().includes(q));
          const matchList = item.listId?.toLowerCase().includes(q);
          if (!matchSummary && !matchText && !matchIntent && !matchTags && !matchList) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = typeof a.createdAt === "number" ? a.createdAt : new Date(a.createdAt).getTime();
        const timeB = typeof b.createdAt === "number" ? b.createdAt : new Date(b.createdAt).getTime();
        return (timeB || 0) - (timeA || 0); // Newest first
      });
  }, [items, activeList, statusFilter, searchQuery]);

  // Counts per list for active status
  const countsByList = useMemo(() => {
    const map: Record<string, number> = { all: 0 };
    for (const item of items) {
      if ((item.status || "active") !== "archived") {
        map.all = (map.all || 0) + 1;
        const lid = item.listId || "inbox";
        map[lid] = (map[lid] || 0) + 1;
      }
    }
    return map;
  }, [items]);


  return (
    <motion.section
      key="saved"
      aria-label="Saved"
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: tween.exit }}
      transition={reduce ? tween.fade : spring.settle}
      className="mt-6 flex flex-col gap-3 rounded-shell border border-border bg-card p-3 shadow-[var(--shadow-rest)]"
    >
      {/* ── SEARCH & CONTROLS HEADER ── */}
      <div className="flex flex-col gap-3 border-b border-border/50 pb-3">
        {/* Search Bar */}
        <div className="relative flex items-center w-full">
          <Search className="absolute start-3.5 size-4 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all cards, notes, tasks, tags..."
            className="w-full rounded-xl border border-border/70 bg-secondary/40 py-2 ps-10 pe-20 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-brand focus:bg-card focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <div className="absolute end-2.5 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                title="Clear search"
                className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/70 bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-2xs">
                ⌘K
              </span>
            )}
          </div>
        </div>

        {/* Status Filter & View Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status Tabs: Active, Archived, All States */}
          <div className="flex items-center rounded-lg bg-secondary/70 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={cn(
                "rounded-md px-3 py-1 transition-all",
                statusFilter === "active" ? "bg-card text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("archived")}
              className={cn(
                "rounded-md px-3 py-1 transition-all",
                statusFilter === "archived" ? "bg-card text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Archived
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "rounded-md px-3 py-1 transition-all",
                statusFilter === "all" ? "bg-card text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All States
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Count Display */}
            <span className="text-xs text-muted-foreground font-medium">
              {searchQuery
                ? `${filteredItems.length} matching`
                : `${filteredItems.length} card${filteredItems.length === 1 ? "" : "s"}`}
            </span>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg bg-secondary/70 p-0.5 text-muted-foreground">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-label="Cards view"
                title="Cards view"
                className={cn(
                  "rounded-md p-1 transition-colors",
                  viewMode === "cards" ? "bg-card text-foreground shadow-2xs" : "hover:text-foreground"
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("board")}
                aria-label="Board view"
                title="Board view"
                className={cn(
                  "rounded-md p-1 transition-colors",
                  viewMode === "board" ? "bg-card text-foreground shadow-2xs" : "hover:text-foreground"
                )}
              >
                <Kanban className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                aria-label="Timeline view"
                title="Timeline view"
                className={cn(
                  "rounded-md p-1 transition-colors",
                  viewMode === "timeline" ? "bg-card text-foreground shadow-2xs" : "hover:text-foreground"
                )}
              >
                <CalendarRange className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── LISTS / CATEGORIES FILTER BAR (DEFAULT SHOWS ALL) ── */}
      {viewMode !== "board" && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {lists.map((l) => {
            const Icon = LIST_ICONS[l.id.toLowerCase()] || Sparkles;
            const count = countsByList[l.id] ?? 0;
            const isSelected = activeList === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setActiveList(l.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-all",
                  isSelected
                    ? "bg-foreground text-background shadow-2xs"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span>{l.name}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "ms-0.5 rounded-full px-1.5 py-0.2 text-[10px]",
                      isSelected ? "bg-background/25 text-background font-semibold" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── BOARD VIEW ────────────────────────────────────────── */}
      {viewMode === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-3 pt-1 no-scrollbar">
          {lists
            .filter((l) => l.id !== "all")
            .map((col) => {
              const colItems = items
                .filter(
                  (item) => (item.listId || "inbox") === col.id && (statusFilter === "all" || (item.status || "active") === statusFilter)
                )
                .sort((a, b) => {
                  const timeA = typeof a.createdAt === "number" ? a.createdAt : new Date(a.createdAt).getTime();
                  const timeB = typeof b.createdAt === "number" ? b.createdAt : new Date(b.createdAt).getTime();
                  return (timeB || 0) - (timeA || 0); // Most recent first
                });
              const ColIcon = LIST_ICONS[col.id.toLowerCase()] || Sparkles;

              return (
                <div
                  key={col.id}
                  className="flex flex-col flex-shrink-0 w-64 rounded-xl border border-border/60 bg-secondary/30 p-2.5"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-border/40">
                    <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                      <ColIcon className="size-3.5 text-muted-foreground" />
                      <span>{col.name}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                      {colItems.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2 overflow-y-auto max-h-[450px]">
                    {colItems.length === 0 ? (
                      <div className="py-6 text-center text-[11px] text-muted-foreground/60 italic">
                        Empty list
                      </div>
                    ) : (
                      colItems.map((item) => {
                        const def = registry[item.intent];
                        const ItemIcon = def.icon;
                        return (
                          <div
                            key={item.id}
                            onClick={() => onOpen(item)}
                            className="group relative flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card p-2.5 shadow-2xs hover:border-primary/40 cursor-pointer transition-all"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                <ItemIcon className="size-3" />
                                {def.label}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground/70">
                                  {formatRelativeTime(item.createdAt)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(item);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                              {item.summary}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      ) : viewMode === "timeline" ? (
        /* ── TIMELINE VIEW ─────────────────────────────────────── */
        <div className="relative flex flex-col gap-4 py-2 ps-6 before:absolute before:start-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/70">
          {filteredItems.map((item, idx) => {
            const def = registry[item.intent];
            const Icon = def.icon;
            const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={item.id} className="relative flex flex-col gap-1">
                {/* Timeline node marker */}
                <div className="absolute -start-6 top-1.5 grid size-5 place-items-center rounded-full bg-card border-2 border-primary text-primary">
                  <Icon className="size-2.5" />
                </div>

                <div
                  onClick={() => onOpen(item)}
                  className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card p-3 shadow-2xs hover:bg-secondary/40 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold uppercase tracking-wider text-primary">
                      {def.label}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {dateStr}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {item.summary}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── CARDS VIEW (PINTEREST / TUMBLR / KEEP MASONRY) ── */
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3.5 space-y-3.5">
          <AnimatePresence initial={false}>
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? `No cards match "${searchQuery}"`
                  : activeList !== "all"
                  ? `No cards in ${activeList}`
                  : "Your Curio is empty. Type a thought or paste a brain dump above."}
              </div>
            ) : (
              filteredItems.map((item, i) => {
                const def = registry[item.intent];
                const Icon = def?.icon || StickyNote;
                const isArchived = item.status === "archived";
                const childNotes = childrenByParentId.get(String(item.id)) || [];
                const heroImg =
                  item.data?.coverUrl ||
                  item.data?.artworkUrl ||
                  item.data?.posterUrl ||
                  item.data?.ogImage;

                return (
                  <motion.div
                    key={item.id}
                    layoutId={reduce ? undefined : `item-${item.id}`}
                    layout="position"
                    initial={
                      reduce
                        ? { opacity: 0 }
                        : item.id === flyingId
                          ? false
                          : { opacity: 0, y: -4, filter: "blur(4px)" }
                    }
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: -4,
                            filter: "blur(4px)",
                            transition: tween.exit,
                          }
                    }
                    transition={reduce ? tween.fade : spring.morph}
                    onClick={() => onOpen(item)}
                    className={cn(
                      "break-inside-avoid inline-block w-full mb-3.5 group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-4 shadow-2xs hover:border-primary/40 hover:bg-secondary/15 hover:shadow-xs transition-all duration-150 ease-out cursor-pointer",
                      isArchived && "opacity-60"
                    )}
                  >
                    {/* Visual Media Banner (Pinterest style) */}
                    {heroImg && (
                      <div className="relative w-full overflow-hidden rounded-xl bg-secondary/30 mb-3 max-h-56 flex justify-center">
                        <img
                          src={heroImg}
                          alt={item.summary}
                          className="w-full max-h-56 object-cover rounded-xl transition-transform hover:scale-[1.01]"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Color Swatch */}
                    {item.intent === "color" && item.data?.hex && (
                      <div
                        className="w-full h-12 rounded-xl border border-border/40 shadow-inner flex items-end p-2 mb-3"
                        style={{ backgroundColor: item.data.hex }}
                      >
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                          {item.data.hex}
                        </span>
                      </div>
                    )}

                    {/* Top Row: Intent & Metadata */}
                    <div className="flex items-center justify-between gap-2 w-full pb-2 border-b border-border/40">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary shadow-2xs">
                          <Icon className="size-3.5" aria-hidden />
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90 truncate">
                          {def?.label || item.intent}
                        </span>
                        {item.listId && item.listId !== "inbox" && (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-foreground border border-border/50">
                            {item.listId}
                          </span>
                        )}
                        {item.subtype && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {item.subtype}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-normal text-muted-foreground/75">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        {/* Actions: Share, Archive/Restore & Delete */}
                        <div
                          className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleShareCard(item)}
                            title="Copy public link"
                            aria-label="Share card"
                            className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
                          >
                            {copiedId === item.id ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Share2 className="size-3" />
                            )}
                          </button>
                          {isArchived ? (
                            <button
                              type="button"
                              onClick={() => onRestore?.(item)}
                              title="Restore card"
                              aria-label="Restore card"
                              className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
                            >
                              <ArchiveRestore className="size-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onArchive?.(item)}
                              title="Archive card"
                              aria-label="Archive card"
                              className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
                            >
                              <Archive className="size-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDelete(item)}
                            title="Delete card"
                            aria-label={`Delete card`}
                            className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:text-destructive hover:bg-secondary active:scale-[0.96]"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Summary & Body Text */}
                    <div className="flex flex-col gap-1.5 py-2 flex-1">
                      <span
                        className={cn(
                          "text-sm font-semibold text-foreground leading-snug break-words",
                          isArchived && "line-through text-muted-foreground"
                        )}
                      >
                        {item.summary}
                      </span>

                      {/* Tumblr-style quote block */}
                      {item.intent === "quote" && (
                        <blockquote className="border-s-2 border-primary/50 ps-2.5 my-1.5 italic text-xs text-foreground/90 font-serif">
                          “{item.text || item.summary}”
                        </blockquote>
                      )}

                      {/* Body text if distinct from summary */}
                      {item.text && item.text !== item.summary && item.intent !== "quote" && (
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed break-words">
                          {item.text}
                        </p>
                      )}

                      {/* Keep-style Interactive Checklist */}
                      {Array.isArray(item.data?.items) && item.data.items.length > 0 && (
                        <div
                          className="flex flex-col gap-1.5 py-2 border-t border-border/30 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.data.items.slice(0, 5).map((task: any, idx: number) => {
                            const taskText = typeof task === "string" ? task : (task?.text ?? "");
                            const isDone = typeof task === "object" && task !== null ? !!task.done : false;
                            return (
                              <label
                                key={task?.id || `${idx}-${taskText}`}
                                className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={isDone}
                                  onChange={() => handleToggleCheckItem(item, idx)}
                                  className="size-3.5 rounded border-border accent-primary cursor-pointer"
                                />
                                <span className={cn(isDone && "line-through text-muted-foreground")}>
                                  {taskText}
                                </span>
                              </label>
                            );
                          })}
                          {item.data.items.length > 5 && (
                            <span className="text-[10px] text-muted-foreground italic">
                              +{item.data.items.length - 5} more items
                            </span>
                          )}
                        </div>
                      )}

                      {/* OpenStreetMap Location Button */}
                      {item.data?.mapUrl && (
                        <a
                          href={item.data.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors my-1 w-fit"
                        >
                          <MapPin className="size-3" />
                          <span>Map location</span>
                        </a>
                      )}

                      {/* Child notes */}
                      {childNotes.length > 0 && (
                        <div className="flex flex-col gap-1 w-full pt-1.5 border-t border-border/40 mt-1">
                          {childNotes.map((child) => (
                            <div
                              key={child.id}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-2 py-0.5"
                            >
                              <CornerDownRight className="size-3 text-primary shrink-0" />
                              <span className="truncate">{child.summary}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom: Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-border/30">
                        {item.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.section>
  );
}
