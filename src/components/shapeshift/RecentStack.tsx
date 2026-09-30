"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  Search,
  Archive,
  ArchiveRestore,
  LayoutGrid,
  List as ListIcon,
  Inbox,
  CheckSquare,
  Calendar,
  ChefHat,
  StickyNote,
  Wallet,
  Shirt,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { registry } from "@/components/intents/registry";
import { spring, tween } from "@/lib/motion";
import type { SavedItem } from "@/lib/savedItems";
import { cn } from "@/lib/utils";

const LIST_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  all: Sparkles,
  inbox: Inbox,
  tasks: CheckSquare,
  calendar: Calendar,
  kitchen: ChefHat,
  notes: StickyNote,
  money: Wallet,
  style: Shirt,
};

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
  const [activeList, setActiveList] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
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

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status filter
      const itemStatus = item.status || "active";
      if (statusFilter !== "all" && itemStatus !== statusFilter) {
        return false;
      }

      // List filter
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
        if (!matchSummary && !matchText && !matchIntent && !matchTags) {
          return false;
        }
      }

      return true;
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

  if (items.length === 0 && !searchQuery) return null;

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
      {/* Header controls: Search & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
        {/* Search Input */}
        <div className="relative flex flex-1 min-w-[200px] items-center">
          <Search className="absolute start-3 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards, tags, contents..."
            className="w-full rounded-lg bg-secondary/60 py-1.5 ps-9 pe-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute end-2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Status Filter & View Toggle */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg bg-secondary/80 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                statusFilter === "active" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("archived")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                statusFilter === "archived" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Archive
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                statusFilter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
          </div>

          <div className="flex items-center rounded-lg bg-secondary/80 p-0.5 text-muted-foreground">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className={cn(
                "rounded-md p-1 transition-colors",
                viewMode === "list" ? "bg-card text-foreground shadow-xs" : "hover:text-foreground"
              )}
            >
              <ListIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              className={cn(
                "rounded-md p-1 transition-colors",
                viewMode === "grid" ? "bg-card text-foreground shadow-xs" : "hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* List Chips Bar */}
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
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-all",
                isSelected
                  ? "bg-foreground text-background shadow-xs"
                  : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              <span>{l.name}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "ms-0.5 rounded-full px-1.5 py-0.2 text-[10px]",
                    isSelected ? "bg-background/25 text-background" : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Items Container */}
      <div
        className={cn(
          viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 gap-2"
            : "flex flex-col gap-0.5"
        )}
      >
        <AnimatePresence initial={false}>
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? `No cards match "${searchQuery}"` : "No cards in this list"}
            </div>
          ) : (
            filteredItems.map((item, i) => {
              const def = registry[item.intent];
              const Icon = def.icon;
              const isArchived = item.status === "archived";

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
                  className={cn(
                    "group relative flex items-center rounded-xl border border-transparent transition-all duration-150 ease-out hover:bg-secondary",
                    viewMode === "grid" && "border-border/60 bg-secondary/30 p-2.5 flex-col items-start gap-2 min-h-24",
                    isArchived && "opacity-60"
                  )}
                >
                  <motion.button
                    type="button"
                    whileTap={reduce ? undefined : { scale: 0.96 }}
                    onClick={() => onOpen(item)}
                    aria-label={`Edit ${def.label.toLowerCase()}: ${item.summary}`}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2 ps-2 pe-16 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      viewMode === "grid" && "w-full p-0 flex-col items-start gap-2"
                    )}
                  >
                    <div className="flex items-center gap-2.5 w-full">
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-foreground transition-[opacity,background-color] duration-150 group-hover:bg-card group-hover:opacity-100"
                        style={{ opacity: Math.max(0.45, 1 - i * 0.1) }}
                      >
                        <Icon className="size-4.5" aria-hidden />
                      </span>
                      <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                        {def.label}
                      </span>
                      {item.listId && item.listId !== "inbox" && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {item.listId}
                        </span>
                      )}
                    </div>

                    <span
                      className={cn(
                        "min-w-0 flex-1 text-[14px] leading-snug text-pretty break-words",
                        i === 0 ? "text-foreground font-medium" : "text-ink-2",
                        isArchived && "line-through text-muted-foreground"
                      )}
                    >
                      {item.summary}
                    </span>
                  </motion.button>

                  {/* Actions: Archive/Restore & Delete */}
                  <div
                    className={cn(
                      "absolute end-1 top-2 flex items-center gap-0.5",
                      viewMode === "grid" && "end-2 top-2"
                    )}
                  >
                    {isArchived ? (
                      <button
                        type="button"
                        onClick={() => onRestore?.(item)}
                        title="Restore card"
                        aria-label="Restore card"
                        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArchiveRestore className="size-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onArchive?.(item)}
                        title="Archive card"
                        aria-label="Archive card"
                        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Archive className="size-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      title="Delete card"
                      aria-label={`Delete ${def.label.toLowerCase()}: ${item.summary}`}
                      className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-destructive active:scale-[0.96]"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
