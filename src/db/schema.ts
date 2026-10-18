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
  passwordHash: text("password_hash"),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }).default(false).notNull(),
  isPro: integer("is_pro", { mode: "boolean" }).default(false).notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).default(false).notNull(),
  aiCreditsRemaining: integer("ai_credits_remaining").default(25).notNull(),
  aiCreditsResetAt: text("ai_credits_reset_at"),
  customDomain: text("custom_domain"),
  affiliateTags: text("affiliate_tags", { mode: "json" }).$type<{
    amazon?: string;
    bookshop?: string;
    ltk?: string;
    skimlinks?: string;
    customRef?: string;
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

// 2. Curio Types & Hierarchical Type Ontology (PRD v3.2)
export const curioTypes = sqliteTable(
  "curio_types",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    parentTypeId: text("parent_type_id"),
    userId: text("user_id").references(() => users.id),
    name: text("name").notNull(),
    typePath: text("type_path").notNull().unique(), // e.g. /media/film, /product/book, /media/music/vinyl
    rootArchetype: text("root_archetype").notNull(), // PRODUCT, PLACE, MEDIA, ARTICLE, PRIVATE_MEMO, CULINARY
    defaultSilhouette: text("default_silhouette").notNull(), // circle, tall_portrait, book_jacket, landscape_label, art_frame, recipe_card, map_pass, private_memo
    identityRules: text("identity_rules", { mode: "json" }).$type<{
      hardExternalIdKeys?: string[];
      fingerprintFields?: string[];
    }>(),
    jsonSchema: text("json_schema", { mode: "json" }).notNull(),
    publicFieldKeys: text("public_field_keys", { mode: "json" }).$type<string[]>().default([]).notNull(),
    extractionPrompt: text("extraction_prompt"),
    typeEmbedding: text("type_embedding"),
    localizedAliases: text("localized_aliases", { mode: "json" }).$type<Record<string, string>>().default({}),
    ownJsonSchema: text("own_json_schema", { mode: "json" }).$type<Record<string, unknown>>().default({}),
    effectiveJsonSchema: text("effective_json_schema", { mode: "json" }).$type<Record<string, unknown>>().default({}),
    uiFieldConfig: text("ui_field_config", { mode: "json" }).$type<Array<{ key: string; label: string; primitive: string; isPublicObjective: boolean }>>().default([]),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_curio_types_parent").on(table.parentTypeId),
    index("idx_curio_types_path").on(table.typePath),
  ]
);

// 3. Progressive Global Entity Cache (Shared Core + Canonical External Resolution)
export const globalEntities = sqliteTable(
  "global_entities",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    parentEntityId: text("parent_entity_id"),
    canonicalExternalId: text("canonical_external_id"), // e.g. isbn:978..., tmdb:movie:..., spotify:album:...
    identityFingerprint: text("identity_fingerprint"),
    brandOrCreator: text("brand_or_creator"),
    typePath: text("type_path"),
    urlHash: text("url_hash").notNull(),
    entityKey: text("entity_key").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    coreType: text("core_type").notNull(), // PRODUCT, PLACE, MEDIA, BOOK, SOURCE_VIDEO, CULINARY
    title: text("title").notNull(),
    summary: text("summary"),
    heroImageUrl: text("hero_image_url"),
    coreStructuredData: text("core_structured_data", { mode: "json" }).notNull(),
    extendedAttributes: text("extended_attributes", { mode: "json" }).default({}).notNull(),
    ucpSkuId: text("ucp_sku_id"),
    priceCents: integer("price_cents"),
    bestPriceCents: integer("best_price_cents"),
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
    index("idx_global_entities_canonical_ext").on(table.canonicalExternalId),
    index("idx_global_entities_type_path").on(table.typePath),
    index("idx_global_entities_title").on(table.title),
  ]
);

// 4. Multi-Merchant Sourcing (PRD v3.2 - Distinct Retailers/Platforms per Canonical Entity)
export const entitySources = sqliteTable(
  "entity_sources",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    entityId: text("entity_id")
      .references(() => globalEntities.id, { onDelete: "cascade" })
      .notNull(),
    sellerName: text("seller_name").notNull(), // Amazon, Bookshop.org, MUBI, Apple TV, Spotify
    sourceUrl: text("source_url").notNull(),
    urlHash: text("url_hash").notNull(),
    priceCents: integer("price_cents"),
    currency: text("currency").default("USD"),
    affiliateTemplate: text("affiliate_template"),
    inStock: integer("in_stock", { mode: "boolean" }).default(true).notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_entity_sources_entity_id").on(table.entityId),
    index("idx_entity_sources_url_hash").on(table.urlHash),
  ]
);

// 5. User Saves (Personal Memory, Private Notes, Manual Overrides & Disambiguation)
export const userSaves = sqliteTable(
  "user_saves",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id).notNull(),
    entityId: text("entity_id").references(() => globalEntities.id),
    customTypeId: text("custom_type_id").references(() => curioTypes.id),
    typeId: text("type_id").references(() => curioTypes.id),
    typePath: text("type_path"),
    preferredSourceId: text("preferred_source_id").references(() => entitySources.id),
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
    privateEmbedding: text("private_embedding"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_user_saves_user_id").on(table.userId),
    index("idx_user_saves_entity_id").on(table.entityId),
    index("idx_user_saves_type_path").on(table.typePath),
    index("idx_user_saves_private_title").on(table.privateTitle),
  ]
);

// 6. Smart Lists & Curated Boards
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

// 7. List Items Join Table (Enables Manual Ordering, Pinning & Section Headers)
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

// 8. Synaptic Memory Edges (Element-to-Element Relationships & Pairings)
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

// 9. User Authentication Sessions (Multi-Tenancy & Sliding Window Sessions)
export const userSessions = sqliteTable(
  "user_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("idx_user_sessions_token").on(table.token),
    index("idx_user_sessions_user_id").on(table.userId),
  ]
);

// 10. Linked User Accounts (OAuth Provider Linkage)
export const userAccounts = sqliteTable(
  "user_accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_user_accounts_user_id").on(table.userId),
    uniqueIndex("idx_user_accounts_provider_account").on(table.provider, table.providerAccountId),
  ]
);

// Inferred TypeScript types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
export type UserAccount = typeof userAccounts.$inferSelect;
export type NewUserAccount = typeof userAccounts.$inferInsert;
export type CurioType = typeof curioTypes.$inferSelect;
export type NewCurioType = typeof curioTypes.$inferInsert;
export type GlobalEntity = typeof globalEntities.$inferSelect;
export type NewGlobalEntity = typeof globalEntities.$inferInsert;
export type EntitySource = typeof entitySources.$inferSelect;
export type NewEntitySource = typeof entitySources.$inferInsert;
export type UserSave = typeof userSaves.$inferSelect;
export type NewUserSave = typeof userSaves.$inferInsert;
export type SmartList = typeof smartLists.$inferSelect;
export type ListItem = typeof listItems.$inferSelect;
export type EntryConnection = typeof entryConnections.$inferSelect;
export type NewEntryConnection = typeof entryConnections.$inferInsert;

