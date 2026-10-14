import { db } from "./index";
import { lists, listRules } from "./schema";
import { sql } from "drizzle-orm";

const DEFAULT_LISTS = [
  { id: "inbox", name: "Inbox", icon: "inbox", sortOrder: 0, isDefault: true },
  { id: "tasks", name: "Tasks", icon: "check-square", sortOrder: 1, isDefault: false },
  { id: "calendar", name: "Calendar", icon: "calendar", sortOrder: 2, isDefault: false },
  { id: "kitchen", name: "Kitchen", icon: "chef-hat", sortOrder: 3, isDefault: false },
  { id: "notes", name: "Notes", icon: "sticky-note", sortOrder: 4, isDefault: false },
  { id: "money", name: "Money", icon: "wallet", sortOrder: 5, isDefault: false },
  { id: "style", name: "Style", icon: "shirt", sortOrder: 6, isDefault: false },
] as const;

const DEFAULT_RULES = [
  { listId: "tasks", intent: "todo" },
  { listId: "tasks", intent: "reminder" },
  { listId: "tasks", intent: "habit" },
  { listId: "tasks", intent: "goal" },
  { listId: "calendar", intent: "event" },
  { listId: "calendar", intent: "countdown" },
  { listId: "kitchen", intent: "recipe" },
  { listId: "notes", intent: "note" },
  { listId: "notes", intent: "link" },
  { listId: "notes", intent: "contact" },
  { listId: "money", intent: "expense" },
  { listId: "money", intent: "split" },
  { listId: "style", intent: "apparel" },
  { listId: "style", intent: "outfit" },
] as const;

export async function seed() {
  for (const list of DEFAULT_LISTS) {
    db.insert(lists)
      .values(list)
      .onConflictDoNothing()
      .run();
  }

  for (const rule of DEFAULT_RULES) {
    db.insert(listRules)
      .values(rule)
      .onConflictDoNothing()
      .run();
  }

  console.log("Seed complete.");
}

// Run directly if called as script
if (import.meta.main) {
  seed();
}
