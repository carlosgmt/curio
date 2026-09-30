"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  Search,
  Archive,
  ArchiveRestore,
  LayoutGrid,
  List as ListIcon,
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
  CornerDownRight,
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
  const [viewMode, setViewMode] = useState<"list" | "grid" | "board" | "timeline">("list");
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
              title="List view"
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
              title="Grid view"
              className={cn(
                "rounded-md p-1 transition-colors",
                viewMode === "grid" ? "bg-card text-foreground shadow-xs" : "hover:text-foreground"
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
                viewMode === "board" ? "bg-card text-foreground shadow-xs" : "hover:text-foreground"
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
                viewMode === "timeline" ? "bg-card text-foreground shadow-xs" : "hover:text-foreground"
              )}
            >
              <CalendarRange className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* List Chips Bar (shown in List, Grid, Timeline modes) */}
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
      )}

      {/* ── BOARD VIEW ────────────────────────────────────────── */}
      {viewMode === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-3 pt-1 no-scrollbar">
          {lists
            .filter((l) => l.id !== "all")
            .map((col) => {
              const colItems = items.filter(
                (item) => (item.listId || "inbox") === col.id && (statusFilter === "all" || (item.status || "active") === statusFilter)
              );
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
        /* ── LIST / GRID VIEW ──────────────────────────────────── */
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

                      {childrenByParentId.get(String(item.id))?.length ? (
                        <div className="flex flex-col gap-1 w-full pt-1.5 border-t border-border/40 mt-1">
                          {childrenByParentId.get(String(item.id))!.map((child) => (
                            <div
                              key={child.id}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 rounded-md px-2 py-1"
                            >
                              <CornerDownRight className="size-3 text-primary shrink-0" />
                              <span className="truncate">{child.summary}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
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
      )}
    </motion.section>
  );
}
