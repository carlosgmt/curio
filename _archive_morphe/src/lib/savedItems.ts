import { z } from "zod";
import { INTENT_KEYS, type CardIntent } from "@/lib/jev/types";

/** Completed cards, persisted in SQLite via API with localStorage fallback/cache. */
export const savedItemSchema = z.object({
  id: z.union([z.number(), z.string()]),
  intent: z.enum(INTENT_KEYS).exclude(["none"]),
  summary: z.string(),
  text: z.string(),
  createdAt: z.number(),
  listId: z.string().optional().default("inbox"),
  status: z.string().optional().default("active"),
  tags: z.array(z.string()).optional().default([]),
  parentId: z.string().nullable().optional(),
  subtype: z.string().nullable().optional(),
  data: z.record(z.string(), z.any()).optional().default({}),
});
export type SavedItem = z.infer<typeof savedItemSchema>;

const KEY = "curio:saved:v2";
const EMPTY: SavedItem[] = [];
let items: SavedItem[] | null = null;
let ephemeral = false;
let hasSynced = false;
const listeners = new Set<() => void>();

function load(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = z.array(savedItemSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function persist(list: SavedItem[]) {
  if (ephemeral || typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or private mode
  }
}

export const savedItems = {
  subscribe(listener: () => void) {
    listeners.add(listener);

    // Initial background sync with backend
    if (!hasSynced && typeof window !== "undefined") {
      hasSynced = true;
      savedItems.syncFromBackend();
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || ephemeral) return;
      items = load();
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },

  getSnapshot(): SavedItem[] {
    if (items === null) items = load();
    return items;
  },

  getServerSnapshot(): SavedItem[] {
    return EMPTY;
  },

  update(fn: (prev: SavedItem[]) => SavedItem[]) {
    items = fn(savedItems.getSnapshot());
    persist(items);
    listeners.forEach((l) => l());
  },

  setEphemeral(on: boolean) {
    if (ephemeral === on) return;
    ephemeral = on;
    items = on ? [] : load();
    listeners.forEach((l) => l());
  },

  async syncFromBackend() {
    try {
      const res = await fetch("/api/v1/cards?limit=100");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.cards || !Array.isArray(data.cards)) return;

      const serverItems: SavedItem[] = data.cards.map((c: any) => ({
        id: c.id,
        intent: c.intent as CardIntent,
        summary: c.title,
        text: c.rawText || c.title,
        createdAt: new Date(c.createdAt).getTime() || Date.now(),
        listId: c.listId || "inbox",
        status: c.status || "active",
        tags: c.tags || [],
        parentId: c.parentId || null,
        subtype: c.subtype || null,
        data: c.data ? (typeof c.data === "string" ? JSON.parse(c.data) : c.data) : {},
      }));

      // If server has items, merge them with local
      if (serverItems.length > 0) {
        savedItems.update(() => serverItems);
      }
    } catch {
      // Offline: keep local storage
    }
  },

  async createServerCard(item: SavedItem, activeListId?: string) {
    try {
      const res = await fetch("/api/v1/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: item.intent,
          title: item.summary,
          raw_text: item.text,
          list_id: activeListId && activeListId !== "all" ? activeListId : item.listId,
          status: item.status ?? "active",
          tags: item.tags ?? [],
          data: item.data ?? {},
        }),
      });
      if (res.ok) {
        const created = await res.json();
        // Update local item with server id and assigned listId
        savedItems.update((list) =>
          list.map((x) =>
            x.id === item.id
              ? { ...x, id: created.id, listId: created.listId, status: created.status }
              : x
          )
        );
      }
    } catch {
      // Backend unavailable, remains in local cache
    }
  },

  async updateServerCard(item: SavedItem) {
    try {
      await fetch(`/api/v1/cards/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.summary,
          raw_text: item.text,
          list_id: item.listId,
          status: item.status,
          tags: item.tags,
          data: item.data ?? {},
        }),
      });
    } catch {
      // Silent offline
    }
  },

  async deleteServerCard(id: string | number) {
    try {
      await fetch(`/api/v1/cards/${id}`, { method: "DELETE" });
    } catch {
      // Silent offline
    }
  },

  async archiveServerCard(id: string | number) {
    try {
      await fetch(`/api/v1/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      savedItems.update((list) =>
        list.map((x) => (x.id === id ? { ...x, status: "archived" } : x))
      );
    } catch {
      savedItems.update((list) =>
        list.map((x) => (x.id === id ? { ...x, status: "archived" } : x))
      );
    }
  },

  async restoreServerCard(id: string | number) {
    try {
      await fetch(`/api/v1/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      savedItems.update((list) =>
        list.map((x) => (x.id === id ? { ...x, status: "active" } : x))
      );
    } catch {
      savedItems.update((list) =>
        list.map((x) => (x.id === id ? { ...x, status: "active" } : x))
      );
    }
  },
};

let last = 0;
/** Unique increasing id for optimistic client-side cards */
export function newId(): number {
  last = Math.max(Date.now(), last + 1);
  return last;
}
