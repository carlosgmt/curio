import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// 1. User Profiles, Creator Handles & Monthly AI Quotas
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(), // @handle
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  isPro: integer("is_pro", { mode: "boolean" }).default(false).notNull(),
  aiCreditsRemaining: integer("ai_credits_remaining").default(25).notNull(),
  aiCreditsResetAt: text("ai_credits_reset_at"),
  customDomain: text("custom_domain"),
  affiliateTags: text("affiliate_tags", { mode: "json" }).$type<{
    amazon?: string;
    ltk?: string;
    skimlinks?: string;
  }>(),
  googleSyncTokens: text("google_sync_tokens", { mode: "json" }).$type<{
    mapsListEnabled?: boolean;
    ytMusicEnabled?: boolean;
    googleTvEnabled?: boolean;
  }>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// 2. Curio Types & Custom Schemas ("Curio Learns")
export const curioTypes = sqliteTable("curio_types", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  jsonSchema: text("json_schema", { mode: "json" }).notNull(),
  publicFieldKeys: text("public_field_keys", { mode: "json" }).$type<string[]>().default([]).notNull(),
  extractionPrompt: text("extraction_prompt"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// 3. Progressive Global Entity Cache (Shared Core + Crowdsourced Custom Attributes)
export const globalEntities = sqliteTable(
  "global_entities",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    parentEntityId: text("parent_entity_id"),
    urlHash: text("url_hash").notNull(),
    entityKey: text("entity_key").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    coreType: text("core_type").notNull(), // PRODUCT, PLACE, MEDIA, BOOK, SOURCE_VIDEO
    title: text("title").notNull(),
    summary: text("summary"),
    heroImageUrl: text("hero_image_url"),
    coreStructuredData: text("core_structured_data", { mode: "json" }).notNull(),
    extendedAttributes: text("extended_attributes", { mode: "json" }).default({}).notNull(),
    ucpSkuId: text("ucp_sku_id"),
    priceCents: integer("price_cents"),
    currency: text("currency").default("USD"),
    priceVerifiedAt: text("price_verified_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("idx_global_entities_entity_key").on(table.entityKey),
    index("idx_global_entities_url_hash").on(table.urlHash),
    index("idx_global_entities_parent_id").on(table.parentEntityId),
    index("idx_global_entities_price_cents").on(table.priceCents),
  ]
);

// 4. User Saves (Personal Memory, Private Notes, Manual Overrides & Disambiguation)
export const userSaves = sqliteTable(
  "user_saves",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id).notNull(),
    entityId: text("entity_id").references(() => globalEntities.id),
    customTypeId: text("custom_type_id").references(() => curioTypes.id),
    isPrivateMemo: integer("is_private_memo", { mode: "boolean" }).default(false).notNull(),
    privateTitle: text("private_title"),
    personalNotes: text("personal_notes"),
    userCustomValues: text("user_custom_values", { mode: "json" }).default({}),
    candidateFallbacks: text("candidate_fallbacks", { mode: "json" })
      .$type<
        Array<{
          title: string;
          url: string;
          snippet: string;
          coreType: string;
        }>
      >()
      .default([]),
    autoTags: text("auto_tags", { mode: "json" }).$type<string[]>().default([]),
    hasConvertedPurchase: integer("has_converted_purchase", { mode: "boolean" }).default(false).notNull(),
    enrichmentStatus: text("enrichment_status").default("ENRICHED").notNull(),
    visibility: text("visibility").default("PRIVATE").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_user_saves_user_id").on(table.userId),
    index("idx_user_saves_entity_id").on(table.entityId),
  ]
);

// 5. Smart Lists & Curated Boards
export const smartLists = sqliteTable("smart_lists", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  isPaywalled: integer("is_paywalled", { mode: "boolean" }).default(false).notNull(),
  accessPriceCents: integer("access_price_cents"),
  autoRules: text("auto_rules", { mode: "json" }).$type<{
    coreType?: string;
    tagsInclude?: string[];
    maxPriceCents?: number;
  }>(),
  externalSyncTarget: text("external_sync_target").default("NONE"),
  visibility: text("visibility").default("PRIVATE").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// 6. List Items Join Table (Enables Manual Ordering, Pinning & Section Headers)
export const listItems = sqliteTable(
  "list_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    listId: text("list_id").references(() => smartLists.id).notNull(),
    saveId: text("save_id").references(() => userSaves.id).notNull(),
    positionIndex: integer("position_index").notNull().default(0),
    sectionHeader: text("section_header"),
    curatorNote: text("curator_note"),
    isPinned: integer("is_pinned", { mode: "boolean" }).default(false).notNull(),
    addedAt: text("added_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_list_items_list_order").on(table.listId, table.positionIndex),
  ]
);

// 7. Synaptic Memory Edges (Element-to-Element Relationships & Pairings)
export const entryConnections = sqliteTable(
  "entry_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id).notNull(),
    sourceSaveId: text("source_save_id").references(() => userSaves.id).notNull(),
    targetSaveId: text("target_save_id").references(() => userSaves.id).notNull(),
    connectionType: text("connection_type").notNull(), // PAIRED_WITH, SOUNDTRACK_TO, WORN_ON, INSPIRED_BY, CONSUMED_AT
    contextNote: text("context_note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_entry_connections_user").on(table.userId),
    index("idx_entry_connections_pair").on(table.sourceSaveId, table.targetSaveId),
  ]
);

// Inferred TypeScript types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type CurioType = typeof curioTypes.$inferSelect;
export type GlobalEntity = typeof globalEntities.$inferSelect;
export type NewGlobalEntity = typeof globalEntities.$inferInsert;
export type UserSave = typeof userSaves.$inferSelect;
export type NewUserSave = typeof userSaves.$inferInsert;
export type SmartList = typeof smartLists.$inferSelect;
export type ListItem = typeof listItems.$inferSelect;
export type EntryConnection = typeof entryConnections.$inferSelect;
export type NewEntryConnection = typeof entryConnections.$inferInsert;
