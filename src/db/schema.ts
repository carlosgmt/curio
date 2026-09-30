import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Lists ──────────────────────────────────────────────────────────────

export const lists = sqliteTable("lists", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  icon: text("icon"),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── List auto-sort rules ───────────────────────────────────────────────

export const listRules = sqliteTable("list_rules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  listId: text("list_id")
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  intent: text("intent").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Cards ──────────────────────────────────────────────────────────────

export const cards = sqliteTable(
  "cards",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    listId: text("list_id")
      .notNull()
      .default("inbox")
      .references(() => lists.id),
    intent: text("intent").notNull(),
    status: text("status").notNull().default("active"),
    title: text("title").notNull(),
    rawText: text("raw_text").notNull(),
    data: text("data").notNull().default("{}"),
    tags: text("tags").notNull().default("[]"),
    parentId: text("parent_id").references((): any => cards.id, { onDelete: "cascade" }),
    subtype: text("subtype"),
    dueAt: text("due_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    archivedAt: text("archived_at"),
  },
  (t) => [
    index("idx_cards_intent").on(t.intent),
    index("idx_cards_status").on(t.status),
    index("idx_cards_list").on(t.listId),
    index("idx_cards_parent").on(t.parentId),
    index("idx_cards_created").on(t.createdAt),
  ]
);

// ── Card events (audit trail) ──────────────────────────────────────────

export const cardEvents = sqliteTable(
  "card_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    actor: text("actor").notNull().default("user"), // user | agent | system
    action: text("action").notNull(), // created | updated | moved | archived | ...
    diff: text("diff"), // JSON: what changed
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("idx_events_card").on(t.cardId)]
);

// ── Custom Types (Dynamic User-defined Schemas) ────────────────────────

export const customTypes = sqliteTable("custom_types", {
  id: text("id").primaryKey(), // slug, e.g. 'wine', 'workout'
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("Sparkles"),
  color: text("color").notNull().default("oklch(0.65 0.18 270)"),
  fields: text("fields").notNull().default("[]"), // JSON array of CustomTypeField
  patterns: text("patterns").notNull().default("[]"), // JSON array of string keywords/regex
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type CustomType = typeof customTypes.$inferSelect;
export type NewCustomType = typeof customTypes.$inferInsert;

// ── Attachments ────────────────────────────────────────────────────────

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    aiCaption: text("ai_caption"),
    path: text("path").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("idx_attachments_card").on(t.cardId)]
);

// ── Type helpers ───────────────────────────────────────────────────────

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type List = typeof lists.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type CardEvent = typeof cardEvents.$inferSelect;

// ── App Settings (Key-Value persistent store) ──────────────────────────

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
