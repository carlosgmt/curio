import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  varchar,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. User Profiles, Creator Handles & Monthly AI Quotas
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  username: varchar("username", { length: 32 }).notNull().unique(), // @handle
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  isPro: boolean("is_pro").default(false).notNull(),
  aiCreditsRemaining: integer("ai_credits_remaining").default(25).notNull(), // Monthly quota for custom AI field extraction
  aiCreditsResetAt: timestamp("ai_credits_reset_at").defaultNow().notNull(),
  customDomain: text("custom_domain"),
  affiliateTags: jsonb("affiliate_tags").$type<{
    amazon?: string;
    ltk?: string;
    skimlinks?: string;
  }>(),
  googleSyncTokens: jsonb("google_sync_tokens").$type<{
    mapsListEnabled?: boolean;
    ytMusicEnabled?: boolean;
    googleTvEnabled?: boolean;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Curio Types & Custom Schemas ("Curio Learns")
export const curioTypes = pgTable("curio_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id), // null = platform core type; uuid = user custom schema
  name: text("name").notNull(), // e.g., "ceramic_tile_studio", "supplement_protocol"
  jsonSchema: jsonb("json_schema").notNull(), // Validated Zod/JSON Schema definition
  publicFieldKeys: jsonb("public_field_keys").$type<string[]>().default([]).notNull(), // Objective keys safe to merge into Global Cache
  extractionPrompt: text("extraction_prompt"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Progressive Global Entity Cache (Shared Core + Crowdsourced Custom Attributes)
export const globalEntities = pgTable(
  "global_entities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentEntityId: uuid("parent_entity_id"), // Self-reference for 1-to-Many YouTube / Article child items
    urlHash: text("url_hash").notNull(), // SHA-256 of source URL
    entityKey: text("entity_key").notNull(), // Normalized (url_hash + canonical_item_slug)
    canonicalUrl: text("canonical_url").notNull(),
    coreType: varchar("core_type", { length: 32 }).notNull(), // "PRODUCT", "PLACE", "MEDIA", "BOOK", "SOURCE_VIDEO"
    title: text("title").notNull(),
    summary: text("summary"),
    heroImageUrl: text("hero_image_url"),
    coreStructuredData: jsonb("core_structured_data").notNull(), // Universal baseline fields
    extendedAttributes: jsonb("extended_attributes").default({}).notNull(), // Crowdsourced custom fields merged from Curio Learns
    ucpSkuId: text("ucp_sku_id"), // Verified Google Universal Commerce Protocol SKU
    priceCents: integer("price_cents"), // Integer for fast numeric filtering
    currency: varchar("currency", { length: 3 }).default("USD"),
    priceVerifiedAt: timestamp("price_verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_global_entities_entity_key").on(table.entityKey),
    index("idx_global_entities_url_hash").on(table.urlHash),
    index("idx_global_entities_parent_id").on(table.parentEntityId),
    index("idx_global_entities_price_cents").on(table.priceCents),
  ]
);

// 4. User Saves (Personal Memory, Private Notes, Manual Overrides & Disambiguation)
export const userSaves = pgTable(
  "user_saves",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    entityId: uuid("entity_id").references(() => globalEntities.id), // Nullable for strictly PRIVATE_MEMO saves!
    customTypeId: uuid("custom_type_id").references(() => curioTypes.id),
    isPrivateMemo: boolean("is_private_memo").default(false).notNull(), // True = never touches global_entities
    privateTitle: text("private_title"), // Used when isPrivateMemo == true
    personalNotes: text("personal_notes"), // Strictly private; never promoted to global cache
    userCustomValues: jsonb("user_custom_values").default({}), // User's manual edits or unverified custom fields
    candidateFallbacks: jsonb("candidate_fallbacks")
      .$type<
        Array<{
          title: string;
          url: string;
          snippet: string;
          coreType: string;
        }>
      >()
      .default([]), // Powers FR-2.3 1-Tap Disambiguation Bar
    autoTags: jsonb("auto_tags").$type<string[]>().default([]),
    hasConvertedPurchase: boolean("has_converted_purchase").default(false).notNull(), // Collaborative filtering signal
    enrichmentStatus: varchar("enrichment_status", { length: 32 }).default("ENRICHED").notNull(), // "ENRICHED" | "LAZY_QUEUED" | "LOCAL_ONLY"
    visibility: varchar("visibility", { length: 32 }).default("PRIVATE").notNull(), // "PRIVATE" | "UNLISTED" | "PUBLIC"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_user_saves_user_id").on(table.userId),
    index("idx_user_saves_entity_id").on(table.entityId),
  ]
);

// 5. Smart Lists & Curated Boards
export const smartLists = pgTable("smart_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  isPaywalled: boolean("is_paywalled").default(false).notNull(),
  accessPriceCents: integer("access_price_cents"), // Integer cents for Stripe / Google Pay paywall
  autoRules: jsonb("auto_rules").$type<{
    coreType?: string;
    tagsInclude?: string[];
    maxPriceCents?: number;
  }>(),
  externalSyncTarget: varchar("external_sync_target", { length: 32 }).default("NONE"), // "NONE" | "GOOGLE_MAPS" | "YT_MUSIC" | "GOOGLE_TV"
  visibility: varchar("visibility", { length: 32 }).default("PRIVATE").notNull(), // "PRIVATE" | "UNLISTED" | "PUBLIC"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. List Items Join Table (Enables Manual Ordering, Pinning & Section Headers)
export const listItems = pgTable(
  "list_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id").references(() => smartLists.id).notNull(),
    saveId: uuid("save_id").references(() => userSaves.id).notNull(),
    positionIndex: integer("position_index").notNull().default(0), // Explicit drag-and-drop sequence
    sectionHeader: text("section_header"), // e.g., "Phase 1: Morning Supplements" or "Day 1: Shinjuku"
    curatorNote: text("curator_note"), // Public editorial commentary specific to this board
    isPinned: boolean("is_pinned").default(false).notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_list_items_list_order").on(table.listId, table.positionIndex),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  saves: many(userSaves),
  lists: many(smartLists),
  curioTypes: many(curioTypes),
}));

export const globalEntitiesRelations = relations(globalEntities, ({ one, many }) => ({
  parent: one(globalEntities, {
    fields: [globalEntities.parentEntityId],
    references: [globalEntities.id],
    relationName: "childEntities",
  }),
  childEntities: many(globalEntities, { relationName: "childEntities" }),
  saves: many(userSaves),
}));

export const userSavesRelations = relations(userSaves, ({ one, many }) => ({
  user: one(users, {
    fields: [userSaves.userId],
    references: [users.id],
  }),
  entity: one(globalEntities, {
    fields: [userSaves.entityId],
    references: [globalEntities.id],
  }),
  customType: one(curioTypes, {
    fields: [userSaves.customTypeId],
    references: [curioTypes.id],
  }),
  listItems: many(listItems),
}));

export const smartListsRelations = relations(smartLists, ({ one, many }) => ({
  user: one(users, {
    fields: [smartLists.userId],
    references: [users.id],
  }),
  items: many(listItems),
}));

export const listItemsRelations = relations(listItems, ({ one }) => ({
  list: one(smartLists, {
    fields: [listItems.listId],
    references: [smartLists.id],
  }),
  save: one(userSaves, {
    fields: [listItems.saveId],
    references: [userSaves.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type CurioType = typeof curioTypes.$inferSelect;
export type NewCurioType = typeof curioTypes.$inferInsert;
export type GlobalEntity = typeof globalEntities.$inferSelect;
export type NewGlobalEntity = typeof globalEntities.$inferInsert;
export type UserSave = typeof userSaves.$inferSelect;
export type NewUserSave = typeof userSaves.$inferInsert;
export type SmartList = typeof smartLists.$inferSelect;
export type NewSmartList = typeof smartLists.$inferInsert;
export type ListItem = typeof listItems.$inferSelect;
export type NewListItem = typeof listItems.$inferInsert;
